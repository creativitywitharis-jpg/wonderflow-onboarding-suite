-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real "Suggestions & Reviews" channel (repurposing the
-- sidebar's dead "Settings" link, which duplicated the "Administration"
-- nav item and went nowhere new). Lets a business owner send a concern,
-- an integration request, or a review straight to WonderFlow. Private to
-- the person who sent it (same visibility model as help_messages) — not
-- an org-shared record, since it's a channel to WonderFlow, not a team log.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (type in ('concern', 'integration_request', 'review')),
  message     text not null,
  rating      int check (rating is null or (rating between 1 and 5)),
  created_at  timestamptz not null default now()
);
create index if not exists feedback_user_idx on public.feedback (org_id, user_id, created_at desc);

alter table public.feedback enable row level security;

-- Private to the person who sent it — not visible to teammates, including
-- owners/admins (same reasoning as Help's history).
drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (user_id = auth.uid());

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert with check (user_id = auth.uid() and public.is_org_member(org_id));
