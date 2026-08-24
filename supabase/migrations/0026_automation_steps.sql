-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — multi-step automations (per-tenant, RLS).
-- Adds an optional ordered `steps` sequence to automations (action / wait /
-- condition), and a queue table for steps paused on a `wait` — resumed either
-- opportunistically (piggybacked on the next real event for that org) or by
-- the public automation-tick endpoint, which any external scheduler
-- (Zapier/n8n/GitHub Actions/cron) can ping to flush due steps across all orgs.
-- Rules with no `steps` keep working exactly as before (single action_key).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.automations add column if not exists steps jsonb;

create table if not exists public.automation_runs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  automation_id  uuid not null references public.automations (id) on delete cascade,
  event          text not null,
  payload        jsonb not null default '{}',
  step_index     integer not null default 0,   -- step to resume at
  status         text not null default 'waiting' check (status in ('waiting','done','failed')),
  resume_at      timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists automation_runs_due_idx on public.automation_runs (status, resume_at);
create index if not exists automation_runs_org_idx on public.automation_runs (org_id);

alter table public.automation_runs enable row level security;

-- Members can see their org's pending/past steps. Writes are performed by edge
-- functions with the service role (which bypasses RLS) — no insert/update/delete
-- policy for signed-in users, same pattern as other service-managed queues.
drop policy if exists automation_runs_select on public.automation_runs;
create policy automation_runs_select on public.automation_runs for select using (public.is_org_member(org_id));

drop trigger if exists automation_runs_updated_at on public.automation_runs;
create trigger automation_runs_updated_at before update on public.automation_runs for each row execute function public.set_updated_at();
