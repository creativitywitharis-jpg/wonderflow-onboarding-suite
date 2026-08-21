-- ─────────────────────────────────────────────────────────────────────────
-- WonderFlow OS — Security hardening (addresses the Supabase security scan).
--   • Deactivated/removed members must lose all access → require active status
--     everywhere membership is checked (shares_org was the gap: it let disabled
--     members still see teammates' profiles/emails).
--   • Lock the user-callable SECURITY DEFINER functions to authenticated only
--     (revoke from anon/public) — each already checks membership internally.
-- Note: is_org_member / has_org_role already require status = 'active', so
-- deactivated admins already cannot modify memberships. This tightens the rest.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) shares_org: both sides must be ACTIVE members (fixes profile/email leak
--    to removed or deactivated members).
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

-- 2) Restrict the mutating SECURITY DEFINER RPCs to signed-in users only.
--    (The service role bypasses grants, so edge functions are unaffected.)
revoke execute on function public.accept_invitation(uuid) from anon, public;
grant  execute on function public.accept_invitation(uuid) to authenticated;

revoke execute on function public.adjust_stock(uuid, int) from anon, public;
grant  execute on function public.adjust_stock(uuid, int) to authenticated;

revoke execute on function public.increment_ai_usage(uuid, text) from anon, public;
grant  execute on function public.increment_ai_usage(uuid, text) to authenticated;
