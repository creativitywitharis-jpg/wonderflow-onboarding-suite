create table if not exists public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

alter table public.platform_admins enable row level security;

drop policy if exists platform_admins_select_self on public.platform_admins;
create policy platform_admins_select_self on public.platform_admins
  for select using (user_id = auth.uid());