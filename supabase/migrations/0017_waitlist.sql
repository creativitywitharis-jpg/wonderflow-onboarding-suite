-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Waitlist (platform-level, pre-signup). Captured by the public
-- `waitlist` edge function (service role). Not tenant-scoped; no public access.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text,
  source     text,
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email_idx on public.waitlist (lower(email));

alter table public.waitlist enable row level security;
-- Intentionally no policies: only the service-role `waitlist` function reads/writes.
