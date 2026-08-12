create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text,
  source     text,
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email_idx on public.waitlist (lower(email));

grant all on public.waitlist to service_role;

alter table public.waitlist enable row level security;
-- Intentionally no policies: only the service-role `waitlist` function reads/writes.