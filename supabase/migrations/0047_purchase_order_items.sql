-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real purchase order line items.
-- purchase_orders previously only stored an items COUNT and a free-text
-- notes field — no structured link to real products, so marking a PO
-- "Received" had nothing reliable to increment stock with. This table adds
-- real per-product lines so receiving a PO can genuinely move stock.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  purchase_order_id  uuid not null references public.purchase_orders (id) on delete cascade,
  product_id         uuid references public.products (id) on delete set null,
  product_name       text not null,
  qty                integer not null,
  cost               numeric not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists purchase_order_items_po_idx on public.purchase_order_items (purchase_order_id);
create index if not exists purchase_order_items_org_idx on public.purchase_order_items (org_id);

alter table public.purchase_order_items enable row level security;

drop policy if exists purchase_order_items_select on public.purchase_order_items;
create policy purchase_order_items_select on public.purchase_order_items
  for select using (public.is_org_member(org_id));

drop policy if exists purchase_order_items_insert on public.purchase_order_items;
create policy purchase_order_items_insert on public.purchase_order_items
  for insert with check (public.is_org_member(org_id));

drop policy if exists purchase_order_items_delete on public.purchase_order_items;
create policy purchase_order_items_delete on public.purchase_order_items
  for delete using (public.has_org_role(org_id, array['owner', 'admin', 'manager']));
