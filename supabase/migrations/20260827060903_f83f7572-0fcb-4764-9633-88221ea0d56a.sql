-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — custom, editable job-title labels for team members.
-- Purely cosmetic: the underlying `role` (owner/admin/manager/analyst/
-- viewer/member) is what every RLS policy in the app actually checks —
-- `title` never changes permissions, it's just what's shown ("Sales Lead"
-- instead of the raw role name).
-- ─────────────────────────────────────────────────────────────────────────

alter table public.memberships add column if not exists title text;
alter table public.invitations add column if not exists title text;

-- Re-published to also carry the invite's title through to the new
-- membership row, and to keep it in sync on a re-invite (on conflict).
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

  insert into public.memberships (org_id, user_id, role, status, title)
    values (inv.org_id, uid, inv.role, 'active', inv.title)
    on conflict (org_id, user_id) do update set status = 'active', role = excluded.role, title = excluded.title;

  update public.invitations set accepted_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;

revoke execute on function public.accept_invitation(uuid) from anon, public;
grant  execute on function public.accept_invitation(uuid) to authenticated;