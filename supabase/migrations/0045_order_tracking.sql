-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real shipment tracking on orders.
-- No carrier API integration (that's a much bigger project) — just a place
-- to record the tracking number + carrier you get when you actually ship,
-- so Delivery tracking can link out to the carrier's own tracking page
-- instead of showing fabricated demo shipments.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists carrier text;
