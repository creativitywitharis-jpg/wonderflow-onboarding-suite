create or replace function public.transfer_ownership(p_org_id uuid, p_new_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_status text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.memberships where org_id = p_org_id and user_id = uid and role = 'owner') then
    raise exception 'Only the current owner can transfer ownership';
  end if;
  if p_new_owner_user_id = uid then
    raise exception 'You are already the owner';
  end if;

  select status into target_status from public.memberships where org_id = p_org_id and user_id = p_new_owner_user_id;
  if target_status is null then
    raise exception 'That person is not a member of this business';
  end if;
  if target_status <> 'active' then
    raise exception 'That person''s account is disabled — enable it first';
  end if;

  update public.memberships set role = 'owner' where org_id = p_org_id and user_id = p_new_owner_user_id;
  update public.memberships set role = 'admin' where org_id = p_org_id and user_id = uid;
end;
$$;

revoke execute on function public.transfer_ownership(uuid, uuid) from anon, public;
grant  execute on function public.transfer_ownership(uuid, uuid) to authenticated;

create or replace function public.delete_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  member_count int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.memberships where org_id = p_org_id and user_id = uid and role = 'owner') then
    raise exception 'Only the owner can delete this business';
  end if;

  select count(*) into member_count from public.memberships where org_id = p_org_id;
  if member_count > 1 then
    raise exception 'Transfer ownership or remove other team members before deleting the business';
  end if;

  delete from public.organizations where id = p_org_id;
end;
$$;

revoke execute on function public.delete_organization(uuid) from anon, public;
grant  execute on function public.delete_organization(uuid) to authenticated;