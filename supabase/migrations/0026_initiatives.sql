-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Strategic initiatives (per-tenant, RLS).
-- Bigger bets a business is working on, each with an impact/effort rating and a
-- step plan the team checks off. Progress is derived from completed steps.
-- Powers the AI Advisor → Strategy room.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.initiatives (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  title       text not null,
  status      text not null default 'Planning' check (status in ('Exploring','Planning','In progress','Done')),
  impact      int not null default 50,
  effort      int not null default 50,
  steps       jsonb not null default '[]',   -- [{ "text": "...", "done": false }]
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists initiatives_org_idx on public.initiatives (org_id);

alter table public.initiatives enable row level security;

drop policy if exists initiatives_select on public.initiatives;
create policy initiatives_select on public.initiatives for select using (public.is_org_member(org_id));
drop policy if exists initiatives_insert on public.initiatives;
create policy initiatives_insert on public.initiatives for insert with check (public.is_org_member(org_id));
drop policy if exists initiatives_update on public.initiatives;
create policy initiatives_update on public.initiatives for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists initiatives_delete on public.initiatives;
create policy initiatives_delete on public.initiatives for delete using (public.is_org_member(org_id));

drop trigger if exists initiatives_updated_at on public.initiatives;
create trigger initiatives_updated_at before update on public.initiatives for each row execute function public.set_updated_at();
