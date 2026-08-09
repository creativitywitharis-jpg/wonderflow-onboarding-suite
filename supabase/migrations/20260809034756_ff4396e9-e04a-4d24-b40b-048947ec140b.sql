create extension if not exists pgcrypto;

-- ── profiles ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ── invitations ──────────────────────────────────────────────────────────
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null,
  role        text not null default 'member',
  token       uuid not null default gen_random_uuid(),
  invited_by  uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists invitations_org_idx on public.invitations (org_id);
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

-- ── memberships.status ───────────────────────────────────────────────────
alter table public.memberships
  add column if not exists status text not null default 'active';
do $$ begin
  alter table public.memberships add constraint memberships_status_check
    check (status in ('active','invited','disabled'));
exception when duplicate_object then null; end $$;

-- ── helpers (single-arg, current-user based) ─────────────────────────────
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;

create or replace function public.has_org_role(org uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid()
      and m.status = 'active' and m.role = any (roles)
  );
$$;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

create or replace function public.shares_org(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
revoke all on function public.shares_org(uuid) from public;
grant execute on function public.shares_org(uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- profile auto-creation
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, full_name, avatar_url)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- profiles / invitations policies
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_org(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists invitations_all on public.invitations;
create policy invitations_all on public.invitations
  for all to authenticated
  using (public.has_org_role(org_id, array['owner','admin']))
  with check (public.has_org_role(org_id, array['owner','admin']));

-- ── accept_invitation ────────────────────────────────────────────────────
create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv    record;
  uid    uuid := auth.uid();
  uemail text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv from public.invitations
    where token = p_token and accepted_at is null;
  if not found then
    raise exception 'Invitation not found or already used';
  end if;

  select email into uemail from public.profiles where id = uid;
  if lower(coalesce(uemail, '')) <> lower(inv.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.memberships (org_id, user_id, role, status)
    values (inv.org_id, uid, inv.role, 'active')
    on conflict (org_id, user_id) do update set status = 'active', role = excluded.role;

  update public.invitations set accepted_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;
revoke all on function public.accept_invitation(uuid) from public;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ── orders ───────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  customer_id   uuid references public.customers (id) on delete set null,
  customer_name text,
  number        text,
  status        text not null default 'New'
                check (status in ('New','Paid','Processing','Packed','Shipped','Delivered','Cancelled')),
  channel       text,
  city          text,
  priority      text not null default 'Normal' check (priority in ('High','Normal')),
  total         numeric not null default 0,
  item_count    int not null default 1,
  items         jsonb not null default '[]',
  eta           text,
  notes         text,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_org_idx on public.orders (org_id);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_status_idx on public.orders (org_id, status);

grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ── products ─────────────────────────────────────────────────────────────
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null,
  sku           text,
  category      text,
  price         numeric not null default 0,
  cost          numeric not null default 0,
  stock         int not null default 0,
  reorder_point int not null default 0,
  incoming      int not null default 0,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_org_idx on public.products (org_id);

grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.adjust_stock(p_id uuid, p_delta int)
returns int language plpgsql security definer set search_path = public as $$
declare s int;
begin
  update public.products
    set stock = greatest(0, stock + p_delta), updated_at = now()
    where id = p_id and public.is_org_member(org_id)
    returning stock into s;
  return s;
end;
$$;
revoke all on function public.adjust_stock(uuid, int) from public;
grant execute on function public.adjust_stock(uuid, int) to authenticated;