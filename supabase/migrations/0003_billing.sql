-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Billing (Stripe subscriptions)
-- One subscription row per organization. Written ONLY by the stripe-webhook
-- edge function (service role); members may read their own org's subscription.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null unique references public.organizations (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'trial',   -- trial | starter | growth | scale
  status                 text not null default 'inactive', -- active | trialing | past_due | canceled | incomplete | inactive
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists subscriptions_org_idx on public.subscriptions (org_id);
create index if not exists subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- keep updated_at fresh (reuses the helper from 0001)
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ── RLS: members read; no client writes (webhook uses the service role) ──
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (public.is_org_member(org_id));

-- (Intentionally no insert/update/delete policies: only the service-role
--  webhook may mutate billing state, which bypasses RLS.)
