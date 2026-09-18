import { supabase } from "./supabase";

export type SavedView = { id: string; name: string; metric: string; dim: string; chart: string; created_at: string };

const COLS = "id,name,metric,dim,chart,created_at";
const table = () => supabase.from("analytics_saved_views");

/** Every saved analytics view for an org, newest first — shared across the team. */
export async function listSavedViews(orgId: string): Promise<SavedView[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return [];
  return (data as SavedView[]) ?? [];
}

export async function saveView(orgId: string, v: { name: string; metric: string; dim: string; chart: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await table().insert({ org_id: orgId, user_id: userData.user?.id ?? null, ...v });
  return { error: error ? new Error(error.message) : null };
}

export async function deleteSavedView(id: string) {
  const { error } = await table().delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
