import { supabase } from "./supabase";

// Durable facts the AI advisor remembers about a business. Read + curated in the
// AI Advisor → Memory tab; injected into the AI system prompt server-side so
// every answer stays personalised. Ships in migration 0024.

export type MemoryCategory = "Business context" | "Goals" | "Preferences" | "Learned";
export type DbMemory = { id: string; org_id: string; category: string; text: string; created_at: string };

export const MEMORY_CATEGORIES: MemoryCategory[] = ["Business context", "Goals", "Preferences", "Learned"];

const COLS = "id,org_id,category,text,created_at";
// Not in generated DB types until Lovable regenerates after 0024.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("ai_memory");

/** All memories for an org, newest first. Fails soft (empty) if unmigrated. */
export async function listMemory(orgId: string): Promise<DbMemory[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return [];
  return (data as DbMemory[]) ?? [];
}

export async function addMemory(orgId: string, category: string, text: string): Promise<{ error: Error | null }> {
  const { error } = await table().insert({ org_id: orgId, category, text: text.trim() });
  return { error: error ? new Error(error.message) : null };
}

export async function deleteMemory(id: string): Promise<void> {
  await table().delete().eq("id", id);
}
