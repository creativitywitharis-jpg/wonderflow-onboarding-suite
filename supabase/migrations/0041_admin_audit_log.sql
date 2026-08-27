-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real admin audit log (Settings → Audit logs).
-- Previously 6 hardcoded fictional entries. Scoped deliberately to
-- security-sensitive admin actions (team membership, integrations) rather
-- than instrumenting every write across the whole app — append-only, no
-- update/delete policy, so it can't be tampered with after the fact.
-- ─────────────────────────────────────────────────────────────────────────

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

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log
  for select using (public.is_org_member(org_id));

drop policy if exists admin_audit_log_insert on public.admin_audit_log;
create policy admin_audit_log_insert on public.admin_audit_log
  for insert with check (public.is_org_member(org_id));
