REVOKE ALL ON FUNCTION public.add_org_owner() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, text[]) FROM anon;