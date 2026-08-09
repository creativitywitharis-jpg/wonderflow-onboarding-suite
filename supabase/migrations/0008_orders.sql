-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Orders (per-tenant, RLS). Real order management for the
-- commerce pack. Links optionally to a customer; line items stored as jsonb.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  customer_id   uuid references public.customers (id) on delete set null,
  customer_name text,                       -- denormalized display name
  number        text,                       -- human order number e.g. '#10428'
  status        text not null default 'New'
                check (status in ('New','Paid','Processing','Packed','Shipped','Delivered','Cancelled')),
  channel       text,                        -- 'Online store' | 'POS' | 'Marketplace' | 'Social'
  city          text,
  priority      text not null default 'Normal' check (priority in ('High','Normal')),
  total         numeric not null default 0,
  item_count    int not null default 1,
  items         jsonb not null default '[]', -- [{ name, qty, price }]
  eta           text,
  notes         text,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists orders_org_idx on public.orders (org_id);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_status_idx on public.orders (org_id, status);

alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (public.is_org_member(org_id));

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (public.is_org_member(org_id));

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
