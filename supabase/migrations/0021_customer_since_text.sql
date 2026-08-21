-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — fix `customers.since` type.
-- The app stores `since` as a free-form year/label (e.g. "2023"), but the live
-- column ended up as DATE, which rejects year-only values (22007). Convert it
-- to text so sample data, CSV import, and manual entry all work.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.customers alter column since type text using since::text;
