-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — accept a team invitation.
-- The signed-in user redeems an invitation token: if their email matches the
-- invite, they become an active member of the org. SECURITY DEFINER so it can
-- create the membership + mark the invite accepted regardless of RLS.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv    record;
  uid    uuid := auth.uid();
  uemail text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv from public.invitations
    where token = p_token and accepted_at is null;
  if not found then
    raise exception 'Invitation not found or already used';
  end if;

  select email into uemail from public.profiles where id = uid;
  if lower(coalesce(uemail, '')) <> lower(inv.email) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.memberships (org_id, user_id, role, status)
    values (inv.org_id, uid, inv.role, 'active')
    on conflict (org_id, user_id) do update set status = 'active', role = excluded.role;

  update public.invitations set accepted_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;

grant execute on function public.accept_invitation(uuid) to authenticated;
