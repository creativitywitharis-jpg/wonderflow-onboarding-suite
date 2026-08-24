create table if not exists public.ai_memory (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  category    text not null default 'Business context',
  text        text not null,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists ai_memory_org_idx on public.ai_memory (org_id);
grant select, insert, update, delete on public.ai_memory to authenticated;
grant all on public.ai_memory to service_role;
alter table public.ai_memory enable row level security;
drop policy if exists ai_memory_select on public.ai_memory;
create policy ai_memory_select on public.ai_memory for select to authenticated using (public.is_org_member(org_id));
drop policy if exists ai_memory_insert on public.ai_memory;
create policy ai_memory_insert on public.ai_memory for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists ai_memory_delete on public.ai_memory;
create policy ai_memory_delete on public.ai_memory for delete to authenticated using (public.is_org_member(org_id));

create table if not exists public.decisions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  title       text not null,
  status      text not null default 'Monitoring' check (status in ('Implemented','Monitoring','Paused')),
  impact      text,
  result      text,
  decided_at  date not null default current_date,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists decisions_org_idx on public.decisions (org_id);
grant select, insert, update, delete on public.decisions to authenticated;
grant all on public.decisions to service_role;
alter table public.decisions enable row level security;
drop policy if exists decisions_select on public.decisions;
create policy decisions_select on public.decisions for select to authenticated using (public.is_org_member(org_id));
drop policy if exists decisions_insert on public.decisions;
create policy decisions_insert on public.decisions for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists decisions_update on public.decisions;
create policy decisions_update on public.decisions for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists decisions_delete on public.decisions;
create policy decisions_delete on public.decisions for delete to authenticated using (public.is_org_member(org_id));
drop trigger if exists decisions_updated_at on public.decisions;
create trigger decisions_updated_at before update on public.decisions for each row execute function public.set_updated_at();

create table if not exists public.initiatives (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  title       text not null,
  status      text not null default 'Planning' check (status in ('Exploring','Planning','In progress','Done')),
  impact      int not null default 50,
  effort      int not null default 50,
  steps       jsonb not null default '[]',
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists initiatives_org_idx on public.initiatives (org_id);
grant select, insert, update, delete on public.initiatives to authenticated;
grant all on public.initiatives to service_role;
alter table public.initiatives enable row level security;
drop policy if exists initiatives_select on public.initiatives;
create policy initiatives_select on public.initiatives for select to authenticated using (public.is_org_member(org_id));
drop policy if exists initiatives_insert on public.initiatives;
create policy initiatives_insert on public.initiatives for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists initiatives_update on public.initiatives;
create policy initiatives_update on public.initiatives for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists initiatives_delete on public.initiatives;
create policy initiatives_delete on public.initiatives for delete to authenticated using (public.is_org_member(org_id));
drop trigger if exists initiatives_updated_at on public.initiatives;
create trigger initiatives_updated_at before update on public.initiatives for each row execute function public.set_updated_at();