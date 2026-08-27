-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — timestamp task completion (per-tenant).
-- Needed to honestly compute Performance metrics (on-time rate, completion
-- trend over time) — a task's current status alone can't tell us WHEN it was
-- completed. Set/cleared by the app whenever status transitions to/from 'Done'.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.tasks add column if not exists completed_at timestamptz;
