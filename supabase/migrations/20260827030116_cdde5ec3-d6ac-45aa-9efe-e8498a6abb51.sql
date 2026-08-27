-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real training assignments (per-tenant).
-- Until now every employee implicitly appeared on every course's checklist.
-- This adds `assigned_at`, making a training_progress row mean "assigned" —
-- courses now start with nobody assigned; a business explicitly assigns
-- training to specific people, then monitors it (Team → Training →
-- Assignments tab).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.training_progress add column if not exists assigned_at timestamptz not null default now();