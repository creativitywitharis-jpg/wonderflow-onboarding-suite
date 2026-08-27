import { supabase } from "./supabase";

export type DbPost = {
  id: string;
  channel: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type NewPost = { channel: string; author_name: string; body: string };

const COLS = "id,channel,author_name,body,created_at";
// Ships in migration 0036 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("team_posts");

/** All posts for an org, oldest first (RLS-scoped to members). */
export async function listPosts(orgId: string): Promise<DbPost[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("created_at", { ascending: true });
  if (error) return [];
  return (data as DbPost[]) ?? [];
}

export async function createPost(orgId: string, p: NewPost) {
  const { data, error } = await table().insert({ org_id: orgId, ...p }).select(COLS).single();
  return { data: data as DbPost | null, error: error ? new Error(error.message) : null };
}
