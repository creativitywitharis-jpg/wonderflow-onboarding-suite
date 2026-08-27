create table if not exists public.team_posts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  channel      text not null default 'general',
  author_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  author_name  text not null default 'Someone',
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists team_posts_org_idx on public.team_posts (org_id, created_at desc);

grant select, insert, update, delete on public.team_posts to authenticated;
grant all on public.team_posts to service_role;

alter table public.team_posts enable row level security;

drop policy if exists team_posts_select on public.team_posts;
create policy team_posts_select on public.team_posts for select using (public.is_org_member(org_id));
drop policy if exists team_posts_insert on public.team_posts;
create policy team_posts_insert on public.team_posts for insert with check (public.is_org_member(org_id));
drop policy if exists team_posts_delete on public.team_posts;
create policy team_posts_delete on public.team_posts for delete using (public.has_org_role(org_id, array['owner','admin','manager']));