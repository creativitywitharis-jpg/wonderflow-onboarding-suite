-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Team workspace: real training catalog + per-employee
-- completion tracking (per-tenant, RLS). Powers Team → Training (Phase 5).
-- Progress is tracked per (course, employee) as a real completion flag — not
-- a single ambiguous "62%" number with no owner, as the old mock implied.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  title       text not null,
  category    text,
  lessons     integer not null default 1,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists courses_org_idx on public.courses (org_id);

create table if not exists public.training_progress (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  course_id     uuid not null references public.courses (id) on delete cascade,
  employee_id   uuid not null references public.employees (id) on delete cascade,
  completed     boolean not null default false,
  completed_at  timestamptz,
  unique (course_id, employee_id)
);
create index if not exists training_progress_org_idx on public.training_progress (org_id);

alter table public.courses enable row level security;
alter table public.training_progress enable row level security;

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select using (public.is_org_member(org_id));
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert with check (public.is_org_member(org_id));
drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop policy if exists training_progress_select on public.training_progress;
create policy training_progress_select on public.training_progress for select using (public.is_org_member(org_id));
drop policy if exists training_progress_insert on public.training_progress;
create policy training_progress_insert on public.training_progress for insert with check (public.is_org_member(org_id));
drop policy if exists training_progress_update on public.training_progress;
create policy training_progress_update on public.training_progress for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists training_progress_delete on public.training_progress;
create policy training_progress_delete on public.training_progress for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists courses_updated_at on public.courses;
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
