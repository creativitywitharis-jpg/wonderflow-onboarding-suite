-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Automations (per-tenant, RLS). Real automation rules that a
-- business defines (trigger → action), enables/disables, and that the
-- run-automations edge function actually EXECUTES.
--   trigger_key: 'order.created' | 'customer.created' | 'manual'
--   action_key : 'ai_draft_note' | 'email_owner' | 'webhook'
--   action_config: jsonb params (e.g. { prompt, webhook_url })
-- `trigger`/`action` remain human-readable labels for display.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.automations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null,
  trigger       text,
  action        text,
  trigger_key   text not null default 'manual',
  action_key    text not null default 'ai_draft_note',
  action_config jsonb not null default '{}',
  enabled       boolean not null default true,
  runs          int not null default 0,
  last_run      timestamptz,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists automations_org_idx on public.automations (org_id);

alter table public.automations enable row level security;

drop policy if exists automations_select on public.automations;
create policy automations_select on public.automations
  for select using (public.is_org_member(org_id));

drop policy if exists automations_insert on public.automations;
create policy automations_insert on public.automations
  for insert with check (public.is_org_member(org_id));

drop policy if exists automations_update on public.automations;
create policy automations_update on public.automations
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists automations_delete on public.automations;
create policy automations_delete on public.automations
  for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists automations_updated_at on public.automations;
create trigger automations_updated_at before update on public.automations
  for each row execute function public.set_updated_at();
