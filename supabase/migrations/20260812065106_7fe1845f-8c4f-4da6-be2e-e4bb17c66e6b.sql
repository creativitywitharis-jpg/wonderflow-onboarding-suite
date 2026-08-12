-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Inbound ingest key. Gives each org a unique, secret token so
-- external websites/forms can POST leads into their CRM via the `inbound` edge
-- function. Rotatable; null = the org's public form endpoint is disabled.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations add column if not exists ingest_key uuid;
create unique index if not exists organizations_ingest_key_idx on public.organizations (ingest_key);

-- Members can already read their org; owners/admins can set/rotate the key via
-- the existing organizations_update policy (has_org_role owner/admin).