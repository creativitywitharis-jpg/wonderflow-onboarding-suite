-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real timezone/currency fields on organizations.
-- Business settings previously had Timezone/Currency <select> elements with
-- no value/onChange and nothing to save to — pure decoration. This makes
-- them real, persisted preferences.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations
  add column if not exists timezone text not null default 'America/Chicago',
  add column if not exists currency text not null default 'USD' check (currency in ('USD','EUR','GBP'));
