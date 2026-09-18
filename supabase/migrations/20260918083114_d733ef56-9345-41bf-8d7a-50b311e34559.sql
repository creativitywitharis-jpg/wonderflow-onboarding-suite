-- WonderFlow OS — real email sending for Campaign Studio.
alter table public.campaigns add column if not exists subject text;
alter table public.campaigns add column if not exists body text;
alter table public.customers add column if not exists email_opt_out boolean not null default false;

create or replace function public.unsubscribe_customer(p_customer_id uuid, p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers set email_opt_out = true where id = p_customer_id and org_id = p_org_id;
end;
$$;

grant execute on function public.unsubscribe_customer(uuid, uuid) to anon, authenticated;