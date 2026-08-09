import { supabase } from "./supabase";

export type DbAutomation = {
  id: string;
  name: string;
  trigger: string | null;
  action: string | null;
  enabled: boolean;
  runs: number;
  created_at: string;
};

export type NewAutomation = {
  name: string;
  trigger?: string | null;
  action?: string | null;
  enabled?: boolean;
};

const COLS = "id,name,trigger,action,enabled,runs,created_at";

/** All automations for an org, newest first (RLS-scoped to members). */
export async function listAutomations(orgId: string): Promise<DbAutomation[]> {
  const { data, error } = await supabase
    .from("automations")
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbAutomation[]) ?? [];
}

export async function createAutomation(orgId: string, a: NewAutomation) {
  const { data, error } = await supabase
    .from("automations")
    .insert({ org_id: orgId, ...a })
    .select(COLS)
    .single();
  return { data: data as DbAutomation | null, error: error ? new Error(error.message) : null };
}

export async function insertAutomations(orgId: string, rows: NewAutomation[]) {
  const { error } = await supabase.from("automations").insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}

export async function setAutomationEnabled(id: string, enabled: boolean) {
  const { error } = await supabase.from("automations").update({ enabled }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteAutomation(id: string) {
  const { error } = await supabase.from("automations").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
