-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — fix organizations.plan's real default.
--
-- The table was originally created (20260807193256_...) with
-- plan default 'starter'. 0001_foundation.sql later tried to set it to
-- 'trial', but used `create table if not exists` — since the table already
-- existed, that never took effect. Every org created since has silently
-- been getting 'starter' (core modules only) instead of the intended
-- full-access trial tier. This actually fixes the column default, and
-- backfills any existing org that's on 'starter' with no real Stripe
-- subscription behind it back to 'trial'.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations alter column plan set default 'trial';

update public.organizations o
set plan = 'trial'
where o.plan = 'starter'
  and not exists (
    select 1 from public.subscriptions s
    where s.org_id = o.id and s.status in ('active', 'trialing')
  );
