create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  channel     text not null default 'note'
              check (channel in ('note', 'email', 'call', 'meeting', 'chat')),
  body        text not null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists interactions_org_idx on public.interactions (org_id);
create index if not exists interactions_customer_idx on public.interactions (customer_id);

grant select, insert, delete on public.interactions to authenticated;
grant all on public.interactions to service_role;

alter table public.interactions enable row level security;

drop policy if exists interactions_select on public.interactions;
create policy interactions_select on public.interactions
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists interactions_insert on public.interactions;
create policy interactions_insert on public.interactions
  for insert to authenticated with check (public.is_org_member(org_id, auth.uid()));

drop policy if exists interactions_delete on public.interactions;
create policy interactions_delete on public.interactions
  for delete to authenticated using (public.has_org_role(org_id, auth.uid(), array['owner','admin']));