-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real approval steps for multi-step automations.
-- A new `approval` step kind pauses a workflow and waits for a human decision
-- (Approve/Reject) in Automation → Approval center, instead of a timer. Adds
-- distinct terminal statuses so an approved/rejected outcome is unambiguous
-- from a plain resumed `wait` (which uses 'done').
-- ─────────────────────────────────────────────────────────────────────────

alter table public.automation_runs drop constraint if exists automation_runs_status_check;
alter table public.automation_runs add constraint automation_runs_status_check
  check (status in ('waiting','pending_approval','approved','rejected','done','failed'));

alter table public.automation_runs add column if not exists note text;
alter table public.automation_runs add column if not exists resolved_by uuid references public.profiles (id) on delete set null;
alter table public.automation_runs add column if not exists resolved_at timestamptz;