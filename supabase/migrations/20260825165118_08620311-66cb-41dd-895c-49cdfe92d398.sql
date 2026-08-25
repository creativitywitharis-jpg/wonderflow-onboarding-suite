create table if not exists public.automation_executions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  automation_id  uuid references public.automations (id) on delete set null,
  automation_name text not null,
  event          text not null,
  ok             boolean not null default true,
  detail         text,
  duration_ms    integer,
  created_at     timestamptz not null default now()
);
create index if not exists automation_executions_org_idx on public.automation_executions (org_id, created_at desc);

grant select on public.automation_executions to authenticated;
grant all on public.automation_executions to service_role;

alter table public.automation_executions enable row level security;

drop policy if exists automation_executions_select on public.automation_executions;
create policy automation_executions_select on public.automation_executions for select to authenticated using (public.is_org_member(org_id));