import { supabase } from "./supabase";

// Decision journal for the AI Advisor → Decision history tab. Ships in 0025.

export type DecisionStatus = "Implemented" | "Monitoring" | "Paused";
export type DbDecision = {
  id: string;
  org_id: string;
  title: string;
  status: DecisionStatus;
  impact: string | null;
  result: string | null;
  decided_at: string;
  created_at: string;
};
export const DECISION_STATUSES: DecisionStatus[] = ["Implemented", "Monitoring", "Paused"];

export type NewDecision = { title: string; status?: DecisionStatus; impact?: string | null; result?: string | null; decided_at?: string };

const COLS = "id,org_id,title,status,impact,result,decided_at,created_at";
// Not in generated DB types until Lovable regenerates after 0025.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("decisions");

/** All decisions for an org, newest first. Fails soft (empty) if unmigrated. */
export async function listDecisions(orgId: string): Promise<DbDecision[]> {
  const { data, error } = await table().select(COLS).eq("org_id", orgId).order("decided_at", { ascending: false });
  if (error) return [];
  return (data as DbDecision[]) ?? [];
}

export async function addDecision(orgId: string, d: NewDecision): Promise<{ error: Error | null }> {
  const { error } = await table().insert({ org_id: orgId, ...d, title: d.title.trim() });
  return { error: error ? new Error(error.message) : null };
}

export async function setDecisionStatus(id: string, status: DecisionStatus): Promise<void> {
  await table().update({ status }).eq("id", id);
}

export async function deleteDecision(id: string): Promise<void> {
  await table().delete().eq("id", id);
}
