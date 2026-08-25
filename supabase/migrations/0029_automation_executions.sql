-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real execution log for automations (per-tenant, RLS).
-- Until now the engine only kept aggregate counters (automations.runs,
-- last_run) — no per-execution audit trail. This logs every attempt (initial
-- fire, a resumed wait/approval step, or an approval resolution) so Automation
-- → Execution history shows real events instead of a mockup.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.automation_executions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  automation_id  uuid references public.automations (id) on delete set null,
  automation_name text not null,
  event          text not null,
  ok             boolean not null default true,
  detail         text,
  duration_ms    integer,
  created_at     timestamptz not null default now()
);
create index if not exists automation_executions_org_idx on public.automation_executions (org_id, created_at desc);

alter table public.automation_executions enable row level security;

-- Members can read their org's log. Writes are performed by edge functions
-- with the service role — no insert/update/delete policy for signed-in users.
drop policy if exists automation_executions_select on public.automation_executions;
create policy automation_executions_select on public.automation_executions for select using (public.is_org_member(org_id));
