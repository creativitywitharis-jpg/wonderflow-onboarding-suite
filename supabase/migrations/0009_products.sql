-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Products / Inventory (per-tenant, RLS).
-- Real product catalog + stock. Powers the Inventory module, the Orders
-- create-order catalog, and Orders analytics.
-- ─────────────────────────────────────────────────────────────────────────

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

alter table public.products enable row level security;

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (public.is_org_member(org_id));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert with check (public.is_org_member(org_id));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Atomically adjust stock (clamped at 0). Membership checked inside since the
-- function is SECURITY DEFINER.
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
grant execute on function public.adjust_stock(uuid, int) to authenticated;
