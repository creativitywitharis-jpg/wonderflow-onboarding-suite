import { supabase } from "./supabase";

export type Member = {
  id: string;
  role: string;
  status: string;
  title: string | null;
  userId: string;
  name: string;
  email: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: string;
  title: string | null;
  createdAt: string;
};

type MembershipRow = {
  id: string;
  role: string;
  status: string;
  title: string | null;
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

// title ships in migration 0039 and isn't in the generated Database types
// until Lovable regenerates them — reach these two tables untyped wherever
// title is read or written. Runtime behaviour is unchanged once types regenerate.
const membershipsTable = () => (supabase as unknown as { from: (t: string) => any }).from("memberships");
const invitationsTable = () => (supabase as unknown as { from: (t: string) => any }).from("invitations");

/** Real members of an org (joined to their profile). RLS-scoped to members. */
export async function listMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await membershipsTable()
    .select("id,role,status,title,user_id,profiles(full_name,email)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as MembershipRow[]) ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    title: m.title,
    userId: m.user_id,
    name: m.profiles?.full_name || m.profiles?.email || "Member",
    email: m.profiles?.email ?? "",
  }));
}

/** Pending (not yet accepted) invitations for an org. */
export async function listInvitations(orgId: string): Promise<Invitation[]> {
  const { data, error } = await invitationsTable()
    .select("id,email,role,title,created_at,accepted_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as { id: string; email: string; role: string; title: string | null; created_at: string }[]) ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    title: i.title,
    createdAt: i.created_at,
  }));
}

/**
 * Record a pending invitation (owner/admin only, per RLS) and email the join
 * link (best-effort). `sent` is false when email isn't configured yet.
 * `title` is a purely cosmetic label ("Sales Lead") — it never affects
 * permissions, which are always driven by `role`.
 */
export async function inviteMember(orgId: string, email: string, role: string, title?: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await invitationsTable()
    .insert({
      org_id: orgId,
      email: email.trim().toLowerCase(),
      role,
      title: title?.trim() || null,
      invited_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: new Error(error.message), sent: false, emailError: null as string | null };

  // Best-effort: send the invitation email. A failure here doesn't undo the
  // recorded invitation — it just means we couldn't deliver the link yet.
  let sent = false;
  let emailError: string | null = null;
  try {
    const { data: res, error: fnErr } = await supabase.functions.invoke("send-invite", {
      body: { inviteId: (data as { id: string }).id, origin: window.location.origin },
    });
    if (fnErr) emailError = fnErr.message;
    else if (res?.error) emailError = res.error as string;
    sent = res?.sent === true;
  } catch (e) {
    emailError = e instanceof Error ? e.message : "Could not send the email.";
  }
  return { error: null, sent, emailError };
}

/** Redeem an invitation token → join the org. Returns the org id on success. */
export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function cancelInvitation(id: string) {
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Enable/disable a member (owner/admin only, per RLS). */
export async function setMemberStatus(id: string, status: "active" | "disabled") {
  const { error } = await supabase.from("memberships").update({ status }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/**
 * Permanently remove someone's access — a real delete, not a disable.
 * Owner/admin only (per RLS); admins can't touch an owner's row. Use when
 * the business is done working with that person for good, not for a
 * temporary pause (use setMemberStatus for that).
 */
export async function deleteMember(id: string) {
  const { error } = await supabase.from("memberships").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Edit an existing member's role and/or custom title (owner/admin only, per RLS). */
export async function updateMember(id: string, patch: { role?: string; title?: string | null }) {
  const { error } = await membershipsTable().update(patch).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
