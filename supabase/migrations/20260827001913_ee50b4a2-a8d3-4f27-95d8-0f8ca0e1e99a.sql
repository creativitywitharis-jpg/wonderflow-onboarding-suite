-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Team workspace: real employee directory (per-tenant, RLS).
-- Distinct from `memberships` (who can log into WonderFlow) — this is a
-- business's own staff roster (their team, not necessarily platform users).
-- Powers Team → People. Status is an honest, ownable field (not fake live
-- presence, which nothing in this app can actually observe).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.employees (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  role        text,
  department  text,
  status      text not null default 'Active' check (status in ('Active','On leave','Offboarded')),
  email       text,
  phone       text,
  location    text,
  since       text,
  skills      text[] not null default '{}',
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists employees_org_idx on public.employees (org_id);

alter table public.employees enable row level security;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select using (public.is_org_member(org_id));
drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees for insert with check (public.is_org_member(org_id));
drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();