alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists carrier text;