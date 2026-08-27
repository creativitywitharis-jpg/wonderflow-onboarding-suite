create table if not exists public.team_channels (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  name         text not null,
  all_members  boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists team_channels_org_idx on public.team_channels (org_id);

create table if not exists public.team_channel_members (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  channel_id   uuid not null references public.team_channels (id) on delete cascade,
  employee_id  uuid not null references public.employees (id) on delete cascade,
  unique (channel_id, employee_id)
);
create index if not exists team_channel_members_channel_idx on public.team_channel_members (channel_id);

grant select, insert, update, delete on public.team_channels to authenticated;
grant all on public.team_channels to service_role;
grant select, insert, update, delete on public.team_channel_members to authenticated;
grant all on public.team_channel_members to service_role;

alter table public.team_posts add column if not exists channel_id uuid references public.team_channels (id) on delete set null;

alter table public.team_channels enable row level security;
alter table public.team_channel_members enable row level security;

drop policy if exists team_channels_select on public.team_channels;
create policy team_channels_select on public.team_channels for select using (public.is_org_member(org_id));
drop policy if exists team_channels_insert on public.team_channels;
create policy team_channels_insert on public.team_channels for insert with check (public.is_org_member(org_id));
drop policy if exists team_channels_update on public.team_channels;
create policy team_channels_update on public.team_channels for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists team_channels_delete on public.team_channels;
create policy team_channels_delete on public.team_channels for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop policy if exists team_channel_members_select on public.team_channel_members;
create policy team_channel_members_select on public.team_channel_members for select using (public.is_org_member(org_id));
drop policy if exists team_channel_members_insert on public.team_channel_members;
create policy team_channel_members_insert on public.team_channel_members for insert with check (public.is_org_member(org_id));
drop policy if exists team_channel_members_delete on public.team_channel_members;
create policy team_channel_members_delete on public.team_channel_members for delete using (public.is_org_member(org_id));

drop trigger if exists team_channels_updated_at on public.team_channels;
create trigger team_channels_updated_at before update on public.team_channels for each row execute function public.set_updated_at();

insert into public.team_channels (org_id, name, all_members)
select distinct p.org_id, 'general', true
from public.team_posts p
where not exists (select 1 from public.team_channels tc where tc.org_id = p.org_id and tc.name = 'general');