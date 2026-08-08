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

/** Record a pending invitation (owner/admin only, per RLS). */
export async function inviteMember(orgId: string, email: string, role: string) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("invitations").insert({
    org_id: orgId,
    email: email.trim().toLowerCase(),
    role,
    invited_by: userData.user?.id ?? null,
  });
  return { error: error ? new Error(error.message) : null };
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
