create table if not exists public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null,
  category       text,
  country        text,
  contact_name   text,
  email          text,
  phone          text,
  lead_time_days int not null default 7,
  rating         numeric not null default 4.0,
  spend          numeric not null default 0,
  price_index    int not null default 0,
  status         text not null default 'Active' check (status in ('Preferred','Active','Review','Paused')),
  notes          text,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists suppliers_org_idx on public.suppliers (org_id);

grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;

alter table public.suppliers enable row level security;

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists suppliers_insert on public.suppliers;
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (public.is_org_member(org_id));

drop policy if exists suppliers_update on public.suppliers;
create policy suppliers_update on public.suppliers
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists suppliers_delete on public.suppliers;
create policy suppliers_delete on public.suppliers
  for delete to authenticated using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();