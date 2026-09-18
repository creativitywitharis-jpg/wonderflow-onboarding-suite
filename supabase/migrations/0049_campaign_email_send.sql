-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — real email sending for Campaign Studio.
-- Campaigns previously had no subject/body at all — "Launch campaign" only
-- ever created a tracked record, nothing was ever actually sent. Adds real
-- content fields, an opt-out flag on customers (required for real marketing
-- email), and a public unsubscribe RPC for the link every sent email
-- includes.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.campaigns add column if not exists subject text;
alter table public.campaigns add column if not exists body text;
alter table public.customers add column if not exists email_opt_out boolean not null default false;

-- Public (anon-callable) on purpose: this is what the unsubscribe link in a
-- sent email hits, before the recipient is ever signed in. Scoped to exactly
-- one (customer_id, org_id) pair and can only ever set the flag true — an
-- opt-out, not a read, so there's nothing sensitive to leak.
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
