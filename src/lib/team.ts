import { supabase } from "./supabase";

export type Member = {
  id: string;
  role: string;
  status: string;
  userId: string;
  name: string;
  email: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

type MembershipRow = {
  id: string;
  role: string;
  status: string;
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

/** Real members of an org (joined to their profile). RLS-scoped to members. */
export async function listMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id,role,status,user_id,profiles(full_name,email)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as MembershipRow[]) ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    userId: m.user_id,
    name: m.profiles?.full_name || m.profiles?.email || "Member",
    email: m.profiles?.email ?? "",
  }));
}

/** Pending (not yet accepted) invitations for an org. */
export async function listInvitations(orgId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("id,email,role,created_at,accepted_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as { id: string; email: string; role: string; created_at: string }[]) ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    createdAt: i.created_at,
  }));
}

/**
 * Record a pending invitation (owner/admin only, per RLS) and email the join
 * link (best-effort). `sent` is false when email isn't configured yet.
 */
export async function inviteMember(orgId: string, email: string, role: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      org_id: orgId,
      email: email.trim().toLowerCase(),
      role,
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
