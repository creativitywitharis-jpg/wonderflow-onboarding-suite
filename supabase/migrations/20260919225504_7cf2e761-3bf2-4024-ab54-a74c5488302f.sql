create table if not exists public.oauth_states (
  state       text primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  provider    text not null check (provider in ('meta', 'tiktok')),
  origin      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists oauth_states_created_idx on public.oauth_states (created_at);

grant all on public.oauth_states to service_role;

alter table public.oauth_states enable row level security;

create table if not exists public.social_connections (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  provider        text not null check (provider in ('meta_instagram', 'meta_facebook', 'tiktok')),
  account_id      text not null,
  account_name    text,
  access_token    text not null,
  refresh_token   text,
  expires_at      timestamptz,
  connected_by    uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, provider)
);

grant select, delete on public.social_connections to authenticated;
grant all on public.social_connections to service_role;

alter table public.social_connections enable row level security;

drop policy if exists social_connections_select on public.social_connections;
create policy social_connections_select on public.social_connections
  for select using (public.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists social_connections_delete on public.social_connections;
create policy social_connections_delete on public.social_connections
  for delete using (public.has_org_role(org_id, array['owner', 'admin']));