-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — platform-admin flag for the actual operator of WonderFlow
-- itself (not an org owner/admin -- a different, higher standing that
-- nothing in the app has had until now). Every other table's RLS is
-- deliberately scoped so one business can never see another's data; this
-- is the one narrow, explicit exception, and only for the specific
-- account(s) listed here.
--
-- No client can grant themselves this -- there's no insert/update/delete
-- policy at all. A row here is only ever added directly via Lovable/SQL,
-- by request, never through the app UI. The one client-facing policy lets
-- a signed-in user check ONLY their own row (to decide whether to show
-- the platform-admin nav link), never enumerate who else has one.
--
-- Actual cross-tenant reads (which businesses signed up, all
-- subscriptions, all feedback) happen in the platform-admin-data edge
-- function, which re-checks this table with the service-role key before
-- returning anything -- this table alone doesn't grant read access to
-- other tables, RLS on those stays exactly as strict as before.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists platform_admins_select_self on public.platform_admins;
create policy platform_admins_select_self on public.platform_admins
  for select using (user_id = auth.uid());
