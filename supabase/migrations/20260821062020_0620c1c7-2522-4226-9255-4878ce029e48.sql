create or replace function public.shares_org(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = other       and b.status = 'active'
  );
$$;

revoke execute on function public.accept_invitation(uuid) from anon, public;
grant  execute on function public.accept_invitation(uuid) to authenticated;

revoke execute on function public.adjust_stock(uuid, int) from anon, public;
grant  execute on function public.adjust_stock(uuid, int) to authenticated;

revoke execute on function public.increment_ai_usage(uuid, text) from anon, public;
grant  execute on function public.increment_ai_usage(uuid, text) to authenticated;