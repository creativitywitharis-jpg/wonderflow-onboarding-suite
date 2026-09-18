-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real stock movement log.
-- Replaces the Inventory → Stock movement tab's hardcoded fake activity feed
-- with a real, append-only ledger. Currently only the manual stock
-- adjustment path (Inventory → Products, +/- stock) writes to this table —
-- receiving a purchase order does NOT yet touch product stock at all (POs
-- have no real line-item structure, just a free-text notes field), and
-- customer orders don't decrement stock either. Both are real, separate
-- gaps, not covered by this migration.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  product_name  text not null,
  sku           text,
  type          text not null default 'Adjusted'
                check (type in ('Received', 'Sold', 'Adjusted', 'Returned', 'Transfer')),
  qty           integer not null,
  created_at    timestamptz not null default now()
);
create index if not exists stock_movements_org_idx on public.stock_movements (org_id, created_at desc);

alter table public.stock_movements enable row level security;

drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select using (public.is_org_member(org_id));

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements
  for insert with check (public.is_org_member(org_id));

drop policy if exists stock_movements_delete on public.stock_movements;
create policy stock_movements_delete on public.stock_movements
  for delete using (public.has_org_role(org_id, array['owner', 'admin', 'manager']));
