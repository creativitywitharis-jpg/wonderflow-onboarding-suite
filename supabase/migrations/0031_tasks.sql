-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Team workspace: real task board (per-tenant, RLS).
-- Assignable to a real employee (or left unassigned). Powers Team → Tasks
-- (Phase 2 of the Team workspace rebuild).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  title          text not null,
  assignee_id    uuid references public.employees (id) on delete set null,
  assignee_name  text,
  priority       text not null default 'Normal' check (priority in ('High','Normal')),
  status         text not null default 'To do' check (status in ('To do','In progress','Review','Done')),
  due_date       date,
  notes          text,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tasks_org_idx on public.tasks (org_id);
create index if not exists tasks_status_idx on public.tasks (org_id, status);

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (public.is_org_member(org_id));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (public.is_org_member(org_id));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
