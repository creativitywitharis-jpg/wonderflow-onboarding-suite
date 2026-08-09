-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Marketing campaigns (WonderGrowth), per-tenant, RLS.
-- Real campaign records. Delivery metrics (sent/open/click/roi) default to 0
-- until a real channel integration populates them.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  channel     text not null default 'Email',   -- Email | SMS | Ads | Social | Referral
  status      text not null default 'Draft' check (status in ('Active','Scheduled','Draft','Done')),
  audience    text,
  sent        int not null default 0,
  open_rate   numeric not null default 0,
  click_rate  numeric not null default 0,
  roi         numeric not null default 0,
  budget      numeric not null default 0,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists campaigns_org_idx on public.campaigns (org_id);

alter table public.campaigns enable row level security;

drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns
  for select using (public.is_org_member(org_id));

drop policy if exists campaigns_insert on public.campaigns;
create policy campaigns_insert on public.campaigns
  for insert with check (public.is_org_member(org_id));

drop policy if exists campaigns_update on public.campaigns;
create policy campaigns_update on public.campaigns
  for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists campaigns_delete on public.campaigns;
create policy campaigns_delete on public.campaigns
  for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();
