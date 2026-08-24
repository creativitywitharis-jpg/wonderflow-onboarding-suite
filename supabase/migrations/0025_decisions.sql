-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Decision history (per-tenant, RLS).
-- A journal of the decisions a business makes: what was decided, its expected
-- impact, and how it played out — tracked over time (Implemented / Monitoring /
-- Paused). Powers the AI Advisor → Decision history tab.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.decisions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  title       text not null,
  status      text not null default 'Monitoring' check (status in ('Implemented','Monitoring','Paused')),
  impact      text,
  result      text,
  decided_at  date not null default current_date,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists decisions_org_idx on public.decisions (org_id);

alter table public.decisions enable row level security;

drop policy if exists decisions_select on public.decisions;
create policy decisions_select on public.decisions for select using (public.is_org_member(org_id));
drop policy if exists decisions_insert on public.decisions;
create policy decisions_insert on public.decisions for insert with check (public.is_org_member(org_id));
drop policy if exists decisions_update on public.decisions;
create policy decisions_update on public.decisions for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists decisions_delete on public.decisions;
create policy decisions_delete on public.decisions for delete using (public.is_org_member(org_id));

drop trigger if exists decisions_updated_at on public.decisions;
create trigger decisions_updated_at before update on public.decisions for each row execute function public.set_updated_at();
