create table if not exists public.loyalty_settings (
  org_id            uuid primary key references public.organizations (id) on delete cascade,
  enabled           boolean not null default true,
  points_per_dollar numeric not null default 1,
  grades            jsonb   not null default
    '[{"grade":"Bronze","threshold":250,"value":10},{"grade":"Silver","threshold":750,"value":25},{"grade":"Gold","threshold":1500,"value":50},{"grade":"Platinum","threshold":3000,"value":100}]',
  repeat            jsonb   not null default '{"enabled":true,"start":4000,"step":1000,"value":75}',
  updated_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

grant select, insert, update, delete on public.loyalty_settings to authenticated;
grant all on public.loyalty_settings to service_role;

alter table public.loyalty_settings enable row level security;

drop policy if exists loyalty_settings_select on public.loyalty_settings;
create policy loyalty_settings_select on public.loyalty_settings for select using (public.is_org_member(org_id));
drop policy if exists loyalty_settings_insert on public.loyalty_settings;
create policy loyalty_settings_insert on public.loyalty_settings for insert with check (public.has_org_role(org_id, array['owner','admin','manager']));
drop policy if exists loyalty_settings_update on public.loyalty_settings;
create policy loyalty_settings_update on public.loyalty_settings for update using (public.has_org_role(org_id, array['owner','admin','manager'])) with check (public.has_org_role(org_id, array['owner','admin','manager']));
drop policy if exists loyalty_settings_delete on public.loyalty_settings;
create policy loyalty_settings_delete on public.loyalty_settings for delete using (public.has_org_role(org_id, array['owner','admin','manager']));

drop trigger if exists loyalty_settings_updated_at on public.loyalty_settings;
create trigger loyalty_settings_updated_at before update on public.loyalty_settings for each row execute function public.set_updated_at();