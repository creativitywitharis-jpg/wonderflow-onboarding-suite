alter table public.organizations
  add column if not exists ai_model text not null default 'balanced' check (ai_model in ('precision','balanced','fast'));

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text not null,
  action      text not null,
  category    text not null check (category in ('Users','Integrations','Security')),
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_log_org_idx on public.admin_audit_log (org_id, created_at desc);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log
  for select using (public.is_org_member(org_id));

drop policy if exists admin_audit_log_insert on public.admin_audit_log;
create policy admin_audit_log_insert on public.admin_audit_log
  for insert with check (public.is_org_member(org_id));