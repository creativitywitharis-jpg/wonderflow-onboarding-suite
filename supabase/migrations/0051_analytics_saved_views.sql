-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real saved views for the Analytics Builder tab.
-- "Save view" had no onClick at all — a configured metric/dimension/chart
-- combination could never actually be saved. Shared across the org (like a
-- saved report config a teammate builds and everyone can reuse), not
-- private per person.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.analytics_saved_views (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  name        text not null,
  metric      text not null,
  dim         text not null,
  chart       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_saved_views_org_idx on public.analytics_saved_views (org_id, created_at desc);

alter table public.analytics_saved_views enable row level security;

drop policy if exists analytics_saved_views_select on public.analytics_saved_views;
create policy analytics_saved_views_select on public.analytics_saved_views
  for select using (public.is_org_member(org_id));

drop policy if exists analytics_saved_views_insert on public.analytics_saved_views;
create policy analytics_saved_views_insert on public.analytics_saved_views
  for insert with check (public.is_org_member(org_id));

drop policy if exists analytics_saved_views_delete on public.analytics_saved_views;
create policy analytics_saved_views_delete on public.analytics_saved_views
  for delete using (public.has_org_role(org_id, array['owner', 'admin', 'manager']));
