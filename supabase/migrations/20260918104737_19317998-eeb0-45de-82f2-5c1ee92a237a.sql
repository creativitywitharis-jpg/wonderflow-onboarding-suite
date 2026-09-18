create table if not exists public.stripe_credentials (
  org_id      uuid primary key references public.organizations (id) on delete cascade,
  secret_key  text not null,
  updated_at  timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_credentials TO authenticated;
GRANT ALL ON public.stripe_credentials TO service_role;

alter table public.stripe_credentials enable row level security;

drop policy if exists stripe_credentials_select on public.stripe_credentials;
create policy stripe_credentials_select on public.stripe_credentials
  for select using (public.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists stripe_credentials_insert on public.stripe_credentials;
create policy stripe_credentials_insert on public.stripe_credentials
  for insert with check (public.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists stripe_credentials_update on public.stripe_credentials;
create policy stripe_credentials_update on public.stripe_credentials
  for update using (public.has_org_role(org_id, array['owner', 'admin']));

drop policy if exists stripe_credentials_delete on public.stripe_credentials;
create policy stripe_credentials_delete on public.stripe_credentials
  for delete using (public.has_org_role(org_id, array['owner', 'admin']));