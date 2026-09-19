import { supabase } from "./supabase";

export type SocialProvider = "meta_instagram" | "meta_facebook" | "tiktok";

export type SocialConnection = {
  id: string;
  provider: SocialProvider;
  account_name: string | null;
  expires_at: string | null;
  created_at: string;
};

// Deliberately excludes access_token/refresh_token from the select list --
// those never need to reach the browser at all, even though RLS would
// technically allow an owner/admin to read the full row.
const COLS = "id,provider,account_name,expires_at,created_at";
// Ships in migration 0055 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("social_connections");

/** Real connected social accounts for an org (owner/admin only, per RLS). */
export async function listSocialConnections(orgId: string): Promise<SocialConnection[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return [];
  return (data as SocialConnection[]) ?? [];
}

/**
 * Kick off a real OAuth connect flow — asks the server for a provider
 * authorize URL (state-protected against CSRF), then redirects the whole
 * page there. The browser comes back to /admin?tab=integrations once
 * social-oauth-callback finishes.
 */
export async function startSocialConnect(orgId: string, provider: "meta" | "tiktok"): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke("social-oauth-start", { body: { orgId, provider } });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error as string };
    if (!data?.url) return { error: "Couldn't start the connection." };
    window.location.href = data.url as string;
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the connection." };
  }
}

export async function disconnectSocial(id: string) {
  const { error } = await table().delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
