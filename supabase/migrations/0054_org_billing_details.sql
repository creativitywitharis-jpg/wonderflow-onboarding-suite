-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real business identity fields for the invoice redesign.
-- The new invoice template shows a business address/phone/website in the
-- header and footer, like a real billing document. Nothing stored this
-- before, so it would've been either blank or fabricated — add real,
-- optional fields the owner fills in once in Settings.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text;
