create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  channel text not null default 'Email',
  status text not null default 'Draft' check (status in ('Active','Scheduled','Draft','Done')),
  audience text,
  sent int not null default 0,
  open_rate numeric not null default 0,
  click_rate numeric not null default 0,
  roi numeric not null default 0,
  budget numeric not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_org_idx on public.campaigns (org_id);
grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select to authenticated using (public.is_org_member(org_id));
drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update on public.campaigns for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_delete on public.campaigns for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));
drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text,
  number text,
  status text not null default 'Draft' check (status in ('Draft','Sent','Confirmed','In transit','Received','Cancelled')),
  items int not null default 0,
  total numeric not null default 0,
  eta text,
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchase_orders_org_idx on public.purchase_orders (org_id);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
grant select, insert, update, delete on public.purchase_orders to authenticated;
grant all on public.purchase_orders to service_role;
alter table public.purchase_orders enable row level security;
drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders for select to authenticated using (public.is_org_member(org_id));
drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert on public.purchase_orders for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists purchase_orders_update on public.purchase_orders;
create policy purchase_orders_update on public.purchase_orders for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists purchase_orders_delete on public.purchase_orders;
create policy purchase_orders_delete on public.purchase_orders for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));
drop trigger if exists purchase_orders_updated_at on public.purchase_orders;
create trigger purchase_orders_updated_at before update on public.purchase_orders for each row execute function public.set_updated_at();

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  trigger text,
  action text,
  trigger_key text not null default 'manual',
  action_key text not null default 'ai_draft_note',
  action_config jsonb not null default '{}',
  enabled boolean not null default true,
  runs int not null default 0,
  last_run timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automations_org_idx on public.automations (org_id);
grant select, insert, update, delete on public.automations to authenticated;
grant all on public.automations to service_role;
alter table public.automations enable row level security;
drop policy if exists automations_select on public.automations;
create policy automations_select on public.automations for select to authenticated using (public.is_org_member(org_id));
drop policy if exists automations_insert on public.automations;
create policy automations_insert on public.automations for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists automations_update on public.automations;
create policy automations_update on public.automations for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists automations_delete on public.automations;
create policy automations_delete on public.automations for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));
drop trigger if exists automations_updated_at on public.automations;
create trigger automations_updated_at before update on public.automations for each row execute function public.set_updated_at();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  number text,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  issue_date date not null default current_date,
  due_date date,
  amount numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  items jsonb not null default '[]',
  notes text,
  paid_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_org_idx on public.invoices (org_id);
create index if not exists invoices_status_idx on public.invoices (org_id, status);
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  vendor text,
  category text,
  amount numeric not null default 0,
  date date not null default current_date,
  status text not null default 'paid' check (status in ('paid','pending')),
  notes text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_org_idx on public.expenses (org_id);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;

alter table public.invoices enable row level security;
alter table public.expenses enable row level security;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated using (public.is_org_member(org_id));
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (public.is_org_member(org_id));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();