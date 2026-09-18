-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — per-org Stripe credentials for the Integrations "Sync now"
-- card. sync-stripe previously used WonderFlow's OWN platform Stripe key
-- (the same one stripe-webhook uses to bill orgs for their WonderFlow
-- subscription) to pull "the org's Stripe customers" — on a real
-- multi-tenant install every org's sync would pull from that SAME shared
-- Stripe account, not each business's own. Each org now stores its own
-- secret key here instead.
--
-- The secret key is never read back by the app after saving — owner/admin
-- can only overwrite or remove it, never re-display it. RLS restricts even
-- SELECT to owner/admin (unlike most org data, which any member can read).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.stripe_credentials (
  org_id      uuid primary key references public.organizations (id) on delete cascade,
  secret_key  text not null,
  updated_at  timestamptz not null default now()
);

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
