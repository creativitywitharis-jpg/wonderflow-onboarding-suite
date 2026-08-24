import { supabase } from "./supabase";

// Strategic initiatives for the AI Advisor → Strategy room. Ships in 0026.

export type Step = { text: string; done: boolean };
export type InitiativeStatus = "Exploring" | "Planning" | "In progress" | "Done";
export type DbInitiative = {
  id: string;
  org_id: string;
  title: string;
  status: InitiativeStatus;
  impact: number;
  effort: number;
  steps: Step[];
  created_at: string;
};
export const INITIATIVE_STATUSES: InitiativeStatus[] = ["Exploring", "Planning", "In progress", "Done"];

export type NewInitiative = { title: string; status?: InitiativeStatus; impact?: number; effort?: number; steps?: Step[] };

/** Progress % from completed steps (0 when there are none). */
export function progressOf(steps: Step[]): number {
  if (!steps.length) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

const COLS = "id,org_id,title,status,impact,effort,steps,created_at";
// Not in generated DB types until Lovable regenerates after 0026.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("initiatives");

/** All initiatives for an org, newest first. Fails soft (empty) if unmigrated. */
export async function listInitiatives(orgId: string): Promise<DbInitiative[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("created_at", { ascending: false });
  if (error) return [];
  return ((data as DbInitiative[]) ?? []).map((r) => ({ ...r, steps: Array.isArray(r.steps) ? r.steps : [] }));
}

export async function addInitiative(orgId: string, i: NewInitiative): Promise<{ data: DbInitiative | null; error: Error | null }> {
  const { data, error } = await table()
    .insert({ org_id: orgId, title: i.title.trim(), status: i.status ?? "Planning", impact: i.impact ?? 50, effort: i.effort ?? 50, steps: i.steps ?? [] })
    .select(COLS)
    .single();
  return { data: (data as DbInitiative) ?? null, error: error ? new Error(error.message) : null };
}

export async function updateInitiative(id: string, patch: Partial<Pick<DbInitiative, "status" | "steps" | "impact" | "effort" | "title">>): Promise<void> {
  await table().update(patch).eq("id", id);
}

export async function deleteInitiative(id: string): Promise<void> {
  await table().delete().eq("id", id);
}
