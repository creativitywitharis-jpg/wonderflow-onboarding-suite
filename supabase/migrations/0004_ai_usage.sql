-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — AI usage metering (per org, per month)
-- Powers plan-based AI limits (Starter 100 / Growth+Scale unlimited).
-- Written only by the ai-chat edge function via increment_ai_usage() (service
-- role); members may read their own org's usage.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.ai_usage (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  period     text not null,               -- 'YYYY-MM' (UTC)
  count      int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, period)
);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage
  for select using (public.is_org_member(org_id));
-- (No client write policies: only the service-role edge function mutates usage.)

-- Atomically bump the counter for the current period and return the new total.
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
