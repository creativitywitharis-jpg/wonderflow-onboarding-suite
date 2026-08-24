-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — AI memory (per-tenant, RLS).
-- Durable facts the AI advisor should remember about a business (context, goals,
-- preferences, things learned). These are injected into the AI's system prompt on
-- every ai-chat call, so the advisor stays personalised across sessions.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.ai_memory (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  category    text not null default 'Business context',
  text        text not null,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists ai_memory_org_idx on public.ai_memory (org_id);

alter table public.ai_memory enable row level security;

-- Any active member can read + curate their org's memory.
drop policy if exists ai_memory_select on public.ai_memory;
create policy ai_memory_select on public.ai_memory for select using (public.is_org_member(org_id));
drop policy if exists ai_memory_insert on public.ai_memory;
create policy ai_memory_insert on public.ai_memory for insert with check (public.is_org_member(org_id));
drop policy if exists ai_memory_delete on public.ai_memory;
create policy ai_memory_delete on public.ai_memory for delete using (public.is_org_member(org_id));
