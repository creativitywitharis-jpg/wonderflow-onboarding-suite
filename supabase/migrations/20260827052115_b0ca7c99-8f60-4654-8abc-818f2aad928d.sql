alter table public.organizations
  add column if not exists timezone text not null default 'America/Chicago',
  add column if not exists currency text not null default 'USD' check (currency in ('USD','EUR','GBP'));