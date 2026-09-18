import { supabase } from "./supabase";

export type FeedbackType = "concern" | "integration_request" | "review";
export type FeedbackEntry = { id: string; type: FeedbackType; message: string; rating: number | null; created_at: string };

const COLS = "id,type,message,rating,created_at";
// Ships in migration 0053 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("feedback");

/** This person's own past submissions for an org, newest first — private, not visible to anyone else. */
export async function listFeedback(orgId: string): Promise<FeedbackEntry[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await table()
    .select(COLS)
    .eq("org_id", orgId)
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data as FeedbackEntry[]) ?? [];
}

/**
 * Record a concern, integration request, or review, then best-effort email
 * WonderFlow about it. The submission is saved either way — email delivery
 * failing doesn't undo it, it just means we find out later instead of now.
 */
export async function submitFeedback(orgId: string, type: FeedbackType, message: string, rating?: number | null) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: new Error("Please sign in.") };
  const { data, error } = await table()
    .insert({ org_id: orgId, user_id: userData.user.id, type, message: message.trim(), rating: rating ?? null })
    .select("id")
    .single();
  if (error) return { error: new Error(error.message) };

  try {
    await supabase.functions.invoke("notify-feedback", { body: { feedbackId: (data as { id: string }).id } });
  } catch {
    // best-effort — the submission itself already succeeded.
  }
  return { error: null };
}
