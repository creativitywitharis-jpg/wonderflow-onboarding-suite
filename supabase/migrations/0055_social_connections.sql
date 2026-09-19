-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real social account connections (Instagram, Facebook,
-- TikTok) via OAuth, laying the groundwork for real posting from Content
-- Studio. Two tables:
--
--   oauth_states     — short-lived, one-time CSRF tokens issued when a user
--                       starts a connect flow, redeemed by the OAuth
--                       provider's redirect back to us. Rows are deleted
--                       once redeemed or expired; nothing sensitive here.
--
--   social_connections — the actual per-org connection once OAuth
--                       completes. Holds access/refresh tokens, so SELECT
--                       is restricted to owner/admin only (unlike most org
--                       data, which any member can read) -- same treatment
--                       as stripe_credentials.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.oauth_states (
  state       text primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  provider    text not null check (provider in ('meta', 'tiktok')),
  origin      text not null,        -- the app URL to redirect back to once OAuth completes
  created_at  timestamptz not null default now()
);
create index if not exists oauth_states_created_idx on public.oauth_states (created_at);

alter table public.oauth_states enable row level security;
-- No client policies at all: only ever read/written by edge functions via
-- the service-role key (oauth-start creates a row, oauth-callback redeems
-- and deletes it). Never exposed to the browser directly.

create table if not exists public.social_connections (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  provider        text not null check (provider in ('meta_instagram', 'meta_facebook', 'tiktok')),
  account_id      text not null,              -- IG business user id / FB page id / TikTok open_id
  account_name    text,                       -- display name or @handle, for the UI
  access_token    text not null,
  refresh_token   text,
  expires_at      timestamptz,
  connected_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, provider)
);

alter table public.social_connections enable row level security;

drop policy if exists social_connections_select on public.social_connections;
create policy social_connections_select on public.social_connections
  for select using (public.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists social_connections_delete on public.social_connections;
create policy social_connections_delete on public.social_connections
  for delete using (public.has_org_role(org_id, array['owner', 'admin']));

-- No insert/update policy: connections are only ever written by the
-- oauth-callback edge function via the service-role key, never directly
-- by a client (the tokens must never round-trip through the browser).
