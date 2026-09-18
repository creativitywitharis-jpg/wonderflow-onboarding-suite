-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real date/time for scheduled campaigns.
-- "Scheduled" was a selectable status with nothing behind it — no date or
-- time was ever captured, so it meant nothing beyond a label.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.campaigns add column if not exists scheduled_at timestamptz;
