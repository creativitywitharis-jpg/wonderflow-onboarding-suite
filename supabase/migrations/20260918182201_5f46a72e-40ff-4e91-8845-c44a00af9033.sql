alter table public.organizations
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text;