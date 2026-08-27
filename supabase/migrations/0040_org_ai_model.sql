-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real, per-org AI model selection.
-- Settings → AI configuration previously had a model picker that saved
-- nothing and was never read by any AI call — every request was hardcoded
-- to claude-opus-5. This column is now actually read by the ai-chat edge
-- function and the automation runner's claudeDraft().
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations
  add column if not exists ai_model text not null default 'balanced' check (ai_model in ('precision','balanced','fast'));
