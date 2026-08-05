-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — CRM customers (per-tenant, RLS)
-- Run in the Supabase SQL editor after 0001_foundation.sql.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  company     text,
  email       text,
  tier        text not null default 'New'
              check (tier in ('Champion', 'Loyal', 'Potential', 'New', 'At risk', 'Dormant')),
  sentiment   text not null default 'Neutral'
              check (sentiment in ('Positive', 'Neutral', 'Negative')),
  ltv         numeric not null default 0,
  health      int not null default 50,
  orders      int not null default 0,
  since       text,
  tags        text[] not null default '{}',
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists customers_org_idx on public.customers (org_id);

alter table public.customers enable row level security;

-- Any member of the org can read/create/update its customers.
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select using (public.is_org_member(org_id));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert with check (public.is_org_member(org_id));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- Deleting is limited to owner / admin / manager.
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete using (public.has_org_role(org_id, array['owner', 'admin', 'manager']));

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
