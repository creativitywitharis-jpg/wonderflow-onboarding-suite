-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Prevent privilege escalation via memberships.
-- Before: one policy let owners OR admins write any membership row, so an admin
-- could set their own role to 'owner' and hijack the workspace.
-- After: owners have full control; admins may manage members but can never
-- grant the 'owner' role, nor modify/remove an existing owner.
-- (Owner membership on org-creation and invite-accept go through SECURITY
--  DEFINER functions, which bypass RLS, so those still work.)
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists memberships_write on public.memberships;

-- Owners: full control (assign any role, including transferring ownership).
drop policy if exists memberships_owner_all on public.memberships;
create policy memberships_owner_all on public.memberships
  for all
  using (public.has_org_role(org_id, array['owner']))
  with check (public.has_org_role(org_id, array['owner']));

-- Admins: manage non-owner members only, and never grant the 'owner' role.
drop policy if exists memberships_admin_insert on public.memberships;
create policy memberships_admin_insert on public.memberships
  for insert
  with check (public.has_org_role(org_id, array['admin']) and role <> 'owner');

drop policy if exists memberships_admin_update on public.memberships;
create policy memberships_admin_update on public.memberships
  for update
  using (public.has_org_role(org_id, array['admin']) and role <> 'owner')
  with check (public.has_org_role(org_id, array['admin']) and role <> 'owner');

drop policy if exists memberships_admin_delete on public.memberships;
create policy memberships_admin_delete on public.memberships
  for delete
  using (public.has_org_role(org_id, array['admin']) and role <> 'owner');

-- increment_ai_usage is only ever called server-side (service role), so no
-- signed-in user needs execute on it — tighten it further.
revoke execute on function public.increment_ai_usage(uuid, text) from authenticated;
