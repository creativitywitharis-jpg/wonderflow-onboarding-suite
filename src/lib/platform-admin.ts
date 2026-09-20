import { supabase } from "./supabase";

export type PlatformOrg = {
  id: string;
  name: string;
  industry: string | null;
  plan: string;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
};

export type PlatformSubscription = {
  id: string;
  org_id: string;
  org_name: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
};

export type PlatformFeedback = {
  id: string;
  org_id: string;
  org_name: string;
  user_id: string;
  submitter_name: string | null;
  submitter_email: string | null;
  type: "concern" | "integration_request" | "review";
  message: string;
  rating: number | null;
  created_at: string;
};

// Ships in migration 0056 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("platform_admins");

/** Whether the signed-in user is a platform admin (checks only their own row). */
export async function isPlatformAdmin(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data, error } = await table().select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (error) return false;
  return !!data;
}

async function call<T>(action: "orgs" | "subscriptions" | "feedback"): Promise<T[]> {
  try {
    const { data, error } = await supabase.functions.invoke("platform-admin-data", { body: { action } });
    if (error || data?.error) return [];
    const key = action === "orgs" ? "orgs" : action;
    return (data?.[key] as T[]) ?? [];
  } catch {
    return [];
  }
}

export const listAllOrgs = () => call<PlatformOrg>("orgs");
export const listAllSubscriptions = () => call<PlatformSubscription>("subscriptions");
export const listAllFeedback = () => call<PlatformFeedback>("feedback");
