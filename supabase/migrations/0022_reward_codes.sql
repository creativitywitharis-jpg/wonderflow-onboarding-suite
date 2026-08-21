-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Loyalty reward codes (per-tenant, RLS).
-- Model B ("lifetime odometer"): points = a customer's lifetime spend and only
-- ever go up. When points cross a milestone (250 / 750 / 1,500 / 3,000, then a
-- repeating tier every +1,000), a one-time reward code is auto-issued here.
-- Redeeming a code costs the customer no points — it's a milestone bonus.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.reward_codes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,
  customer_id     uuid not null references public.customers (id) on delete cascade,
  customer_name   text,
  grade           text not null,                 -- Bronze / Silver / Gold / Platinum / Elite
  threshold       integer not null,              -- points milestone that triggered it
  points_at_issue integer not null default 0,    -- customer's points when earned
  value           numeric not null default 0,    -- dollar value of the code
  code            text not null,                 -- e.g. GOLD-7K4P2
  status          text not null default 'issued' check (status in ('issued','used','void')),
  issued_at       timestamptz not null default now(),
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- One code per customer per milestone — makes issuance idempotent (safe to
-- re-run the engine without double-issuing).
create unique index if not exists reward_codes_customer_threshold_uidx
  on public.reward_codes (customer_id, threshold);
create unique index if not exists reward_codes_org_code_uidx on public.reward_codes (org_id, code);
create index if not exists reward_codes_org_idx on public.reward_codes (org_id);
create index if not exists reward_codes_status_idx on public.reward_codes (org_id, status);

alter table public.reward_codes enable row level security;

-- Members read + issue + update (mark used); owner/admin/manager delete.
drop policy if exists reward_codes_select on public.reward_codes;
create policy reward_codes_select on public.reward_codes for select using (public.is_org_member(org_id));
drop policy if exists reward_codes_insert on public.reward_codes;
create policy reward_codes_insert on public.reward_codes for insert with check (public.is_org_member(org_id));
drop policy if exists reward_codes_update on public.reward_codes;
create policy reward_codes_update on public.reward_codes for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists reward_codes_delete on public.reward_codes;
create policy reward_codes_delete on public.reward_codes for delete using (public.has_org_role(org_id, array['owner','admin','manager']));
