-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Team workspace: real weekly shifts (per-tenant, RLS).
-- One row per employee per day of a 7-day week (Mon–Sun). Powers Team →
-- Schedule (Phase 3 of the Team workspace rebuild).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.shifts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  day         text not null check (day in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  start_time  text,   -- "HH:MM" 24h, e.g. "09:00"
  end_time    text,   -- "HH:MM" 24h, e.g. "17:00"
  is_off      boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (employee_id, day)
);
create index if not exists shifts_org_idx on public.shifts (org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;

alter table public.shifts enable row level security;

drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select using (public.is_org_member(org_id));
drop policy if exists shifts_insert on public.shifts;
create policy shifts_insert on public.shifts for insert with check (public.is_org_member(org_id));
drop policy if exists shifts_update on public.shifts;
create policy shifts_update on public.shifts for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists shifts_delete on public.shifts;
create policy shifts_delete on public.shifts for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists shifts_updated_at on public.shifts;
create trigger shifts_updated_at before update on public.shifts for each row execute function public.set_updated_at();