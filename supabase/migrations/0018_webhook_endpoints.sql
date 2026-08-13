-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Outbound webhook endpoints (per-tenant, RLS).
-- A business registers URLs (Zapier Catch Hook, Make, their own server) and
-- subscribes each to events. When those events fire, WonderFlow POSTs a signed
-- JSON payload. `events` holds event keys, or ['*'] for all.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.webhook_endpoints (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  url           text not null,
  events        text[] not null default '{}',
  secret        text not null,               -- HMAC signing secret (shown once in UI)
  enabled       boolean not null default true,
  last_delivery timestamptz,
  last_status   int,
  failures      int not null default 0,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists webhook_endpoints_org_idx on public.webhook_endpoints (org_id);

alter table public.webhook_endpoints enable row level security;

-- Members can view; owners/admins manage.
drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
create policy webhook_endpoints_select on public.webhook_endpoints
  for select using (public.is_org_member(org_id));

drop policy if exists webhook_endpoints_write on public.webhook_endpoints;
create policy webhook_endpoints_write on public.webhook_endpoints
  for all using (public.has_org_role(org_id, array['owner','admin']))
  with check (public.has_org_role(org_id, array['owner','admin']));

drop trigger if exists webhook_endpoints_updated_at on public.webhook_endpoints;
create trigger webhook_endpoints_updated_at before update on public.webhook_endpoints
  for each row execute function public.set_updated_at();
