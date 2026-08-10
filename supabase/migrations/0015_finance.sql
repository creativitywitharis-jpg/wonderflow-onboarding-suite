-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Finance (per-tenant, RLS). Invoices (AR) + expenses (AP),
-- powering the Finance module's invoicing, P&L and cash position.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  customer_id   uuid references public.customers (id) on delete set null,
  customer_name text,
  number        text,
  status        text not null default 'draft' check (status in ('draft','sent','paid','void')),
  issue_date    date not null default current_date,
  due_date      date,
  amount        numeric not null default 0,   -- subtotal
  tax           numeric not null default 0,
  total         numeric not null default 0,   -- amount + tax
  items         jsonb not null default '[]',
  notes         text,
  paid_at       timestamptz,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists invoices_org_idx on public.invoices (org_id);
create index if not exists invoices_status_idx on public.invoices (org_id, status);

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  supplier_id  uuid references public.suppliers (id) on delete set null,
  vendor       text,
  category     text,
  amount       numeric not null default 0,
  date         date not null default current_date,
  status       text not null default 'paid' check (status in ('paid','pending')),
  notes        text,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists expenses_org_idx on public.expenses (org_id);

alter table public.invoices enable row level security;
alter table public.expenses enable row level security;

-- Members read; members create/update; owner/admin/manager delete (mirrors orders).
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select using (public.is_org_member(org_id));
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert with check (public.is_org_member(org_id));
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select using (public.is_org_member(org_id));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert with check (public.is_org_member(org_id));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();
