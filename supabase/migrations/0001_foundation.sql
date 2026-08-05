-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Platform foundation (multi-tenant)
-- Tables: profiles, organizations, memberships, invitations
-- Isolation: Row-Level Security (RLS). Every business = one organization.
-- Run in the Supabase SQL editor (or via the Supabase CLI / Lovable).
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── profiles: one row per auth user ──────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── organizations: the tenant ────────────────────────────────────────────
create table if not exists public.organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text unique,
  industry         text,                    -- e.g. 'retail', 'services', 'hospitality'
  enabled_modules  text[] not null default array['dashboard','crm','team','analytics','advisor','automation'],
  plan             text not null default 'trial',   -- trial | starter | growth | scale
  health_score     int  not null default 80,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── memberships: which user belongs to which org, and their role ─────────
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member'
              check (role in ('owner','admin','manager','analyst','viewer','member')),
  status      text not null default 'active' check (status in ('active','invited','disabled')),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_org_idx  on public.memberships (org_id);

-- ── invitations: pending team invites ────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER so they bypass RLS and avoid recursion
-- when referenced inside the memberships policies).
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(org uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = auth.uid()
      and m.status = 'active' and m.role = any (roles)
  );
$$;

create or replace function public.shares_org(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────

-- create a profile automatically when a new auth user signs up
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

-- the creator of an org automatically becomes its owner
create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (org_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active')
  on conflict (org_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_org_created on public.organizations;
create trigger on_org_created
  after insert on public.organizations
  for each row when (new.created_by is not null)
  execute function public.handle_new_org();

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.organizations  enable row level security;
alter table public.memberships    enable row level security;
alter table public.invitations    enable row level security;

-- profiles: see yourself + teammates in shared orgs; edit only yourself
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.shares_org(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- organizations: members read; any authed user can create; owners/admins edit
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select using (public.is_org_member(id));

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations
  for insert with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update using (public.has_org_role(id, array['owner','admin']))
  with check (public.has_org_role(id, array['owner','admin']));

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations
  for delete using (public.has_org_role(id, array['owner']));

-- memberships: members read; owners/admins manage
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (public.is_org_member(org_id));

drop policy if exists memberships_write on public.memberships;
create policy memberships_write on public.memberships
  for all using (public.has_org_role(org_id, array['owner','admin']))
  with check (public.has_org_role(org_id, array['owner','admin']));

-- invitations: only owners/admins of the org
drop policy if exists invitations_all on public.invitations;
create policy invitations_all on public.invitations
  for all using (public.has_org_role(org_id, array['owner','admin']))
  with check (public.has_org_role(org_id, array['owner','admin']));
