-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Outbound webhook endpoints (per-tenant, RLS).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.webhook_endpoints (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  url           text not null,
  events        text[] not null default '{}',
  secret        text not null,
  enabled       boolean not null default true,
  last_delivery timestamptz,
  last_status   int,
  failures      int not null default 0,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists webhook_endpoints_org_idx on public.webhook_endpoints (org_id);

grant select, insert, update, delete on public.webhook_endpoints to authenticated;
grant all on public.webhook_endpoints to service_role;

alter table public.webhook_endpoints enable row level security;

drop policy if exists webhook_endpoints_select on public.webhook_endpoints;
create policy webhook_endpoints_select on public.webhook_endpoints
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists webhook_endpoints_write on public.webhook_endpoints;
create policy webhook_endpoints_write on public.webhook_endpoints
  for all to authenticated using (public.has_org_role(org_id, array['owner','admin']))
  with check (public.has_org_role(org_id, array['owner','admin']));

drop trigger if exists webhook_endpoints_updated_at on public.webhook_endpoints;
create trigger webhook_endpoints_updated_at before update on public.webhook_endpoints
  for each row execute function public.set_updated_at();