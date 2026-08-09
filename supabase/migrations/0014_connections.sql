-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Integration connections (per-tenant, RLS).
-- One row per (org, provider). Stores connection status + non-secret config
-- (shop domain, last_sync, counts). OAuth tokens/secrets live in edge-function
-- secrets or a vault, never here.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.connections (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  provider    text not null,   -- 'stripe' | 'shopify' | 'quickbooks' | 'klaviyo' | ...
  status      text not null default 'disconnected' check (status in ('connected','disconnected','error')),
  config      jsonb not null default '{}',
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, provider)
);
create index if not exists connections_org_idx on public.connections (org_id);

alter table public.connections enable row level security;

-- Members can see integration status; only owners/admins can change it.
drop policy if exists connections_select on public.connections;
create policy connections_select on public.connections
  for select using (public.is_org_member(org_id));

drop policy if exists connections_write on public.connections;
create policy connections_write on public.connections
  for all using (public.has_org_role(org_id, array['owner','admin']))
  with check (public.has_org_role(org_id, array['owner','admin']));

drop trigger if exists connections_updated_at on public.connections;
create trigger connections_updated_at before update on public.connections
  for each row execute function public.set_updated_at();
