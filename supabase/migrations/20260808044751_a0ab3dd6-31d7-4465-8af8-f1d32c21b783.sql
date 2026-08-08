create table if not exists public.ai_usage (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  period     text not null,
  count      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, period)
);

grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

create or replace function public.increment_ai_usage(p_org uuid, p_period text)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.ai_usage (org_id, period, count)
  values (p_org, p_period, 1)
  on conflict (org_id, period)
  do update set count = ai_usage.count + 1, updated_at = now()
  returning count into c;
  return c;
end;
$$;

revoke all on function public.increment_ai_usage(uuid, text) from public;
grant execute on function public.increment_ai_usage(uuid, text) to service_role;