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

grant select, insert on public.feedback to authenticated;
grant all on public.feedback to service_role;

alter table public.feedback enable row level security;

drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback
  for select using (user_id = auth.uid());

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback
  for insert with check (user_id = auth.uid() and public.is_org_member(org_id));