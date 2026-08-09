-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Purchase Orders (per-tenant, RLS). Links Suppliers → the
-- replenishment flow. Created from the Suppliers module (and Inventory reorder).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  supplier_id   uuid references public.suppliers (id) on delete set null,
  supplier_name text,                         -- denormalized display name
  number        text,                         -- 'PO-2043'
  status        text not null default 'Draft'
                check (status in ('Draft','Sent','Confirmed','In transit','Received','Cancelled')),
  items         int not null default 0,
  total         numeric not null default 0,
  eta           text,
  notes         text,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists purchase_orders_org_idx on public.purchase_orders (org_id);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);

alter table public.purchase_orders enable row level security;

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders
  for select using (public.is_org_member(org_id));

drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert on public.purchase_orders
  for insert with check (public.is_org_member(org_id));

drop policy if exists purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update on public.purchase_orders
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists purchase_orders_delete on public.purchase_orders;
create policy purchase_orders_delete on public.purchase_orders
  for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists purchase_orders_updated_at on public.purchase_orders;
create trigger purchase_orders_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();
