-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real Advisor chat history.
-- The "Recent" sidebar in Advisor chat was a hardcoded list of 4 made-up
-- conversation titles with dead buttons — no chat history was ever actually
-- saved. Adds a real, private-per-person message log grouped into
-- conversations (same pattern as help_messages).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.advisor_messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null,
  role            text not null check (role in ('user', 'ai')),
  text            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists advisor_messages_conv_idx on public.advisor_messages (org_id, user_id, conversation_id, created_at);
create index if not exists advisor_messages_user_idx on public.advisor_messages (org_id, user_id, created_at desc);

alter table public.advisor_messages enable row level security;

-- Private to the person who wrote it — not visible to other org members,
-- including owners/admins (same as Help's history).
drop policy if exists advisor_messages_select on public.advisor_messages;
create policy advisor_messages_select on public.advisor_messages
  for select using (user_id = auth.uid());

drop policy if exists advisor_messages_insert on public.advisor_messages;
create policy advisor_messages_insert on public.advisor_messages
  for insert with check (user_id = auth.uid() and public.is_org_member(org_id));

drop policy if exists advisor_messages_delete on public.advisor_messages;
create policy advisor_messages_delete on public.advisor_messages
  for delete using (user_id = auth.uid());
