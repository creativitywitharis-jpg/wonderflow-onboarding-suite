revoke execute on function public.shares_org(uuid) from anon, public;
revoke execute on function public.is_org_member(uuid) from anon, public;
revoke execute on function public.has_org_role(uuid, text[]) from anon, public;
revoke execute on function public.handle_new_user() from anon, public, authenticated;