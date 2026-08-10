import { supabase } from "./supabase";

export type TriggerKey = "order.created" | "customer.created" | "manual";
export type ActionKey = "ai_draft_note" | "email_owner" | "webhook";

export type DbAutomation = {
  id: string;
  name: string;
  trigger: string | null;
  action: string | null;
  trigger_key: TriggerKey;
  action_key: ActionKey;
  action_config: Record<string, unknown>;
  enabled: boolean;
  runs: number;
  last_run: string | null;
  created_at: string;
};

export type NewAutomation = {
  name: string;
  trigger?: string | null;
  action?: string | null;
  trigger_key?: TriggerKey;
  action_key?: ActionKey;
  action_config?: Record<string, unknown>;
  enabled?: boolean;
};

const COLS = "id,name,trigger,action,trigger_key,action_key,action_config,enabled,runs,last_run,created_at";

/** Fire an event so the engine runs any matching enabled automations.
 *  Best-effort + non-blocking: failures never break the triggering action. */
export async function fireAutomationEvent(
  orgId: string,
  event: TriggerKey,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.functions.invoke("run-automations", { body: { orgId, event, payload } });
  } catch {
    // swallow — automations must never block the core action that triggered them
  }
}

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
    .insert({ org_id: orgId, ...a, action_config: (a.action_config ?? {}) as never })
    .select(COLS)
    .single();
  return { data: data as DbAutomation | null, error: error ? new Error(error.message) : null };
}

export async function insertAutomations(orgId: string, rows: NewAutomation[]) {
  const { error } = await supabase
    .from("automations")
    .insert(rows.map((r) => ({ org_id: orgId, ...r, action_config: (r.action_config ?? {}) as never })));
  return { error: error ? new Error(error.message) : null };
}

/** Manually run one automation now (for testing / on-demand rules). */
export async function runAutomationNow(orgId: string, automationId: string): Promise<{ ok: boolean; detail?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("run-automations", {
      body: { orgId, event: "manual", automationId },
    });
    if (error) return { ok: false, detail: error.message };
    const first = ((data?.results as { ok?: boolean; detail?: string }[]) ?? [])[0];
    return { ok: !!first?.ok, detail: first?.detail };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "failed" };
  }
}

export async function setAutomationEnabled(id: string, enabled: boolean) {
  const { error } = await supabase.from("automations").update({ enabled }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteAutomation(id: string) {
  const { error } = await supabase.from("automations").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
