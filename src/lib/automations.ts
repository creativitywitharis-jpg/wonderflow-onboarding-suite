import { supabase } from "./supabase";

export type TriggerKey = "order.created" | "customer.created" | "invoice.paid" | "manual";
export type ActionKey = "ai_draft_note" | "email_owner" | "email_customer" | "webhook" | "slack_message";

// A multi-step workflow, run in order. `action` steps reuse the same 4 action
// types as a simple rule; `wait` pauses the sequence (resumed later — see
// automation_runs); `condition` stops the sequence if the check fails.
export type WorkflowStep =
  | { kind: "action"; action_key: ActionKey; action_config?: Record<string, unknown> }
  | { kind: "wait"; hours: number }
  | { kind: "condition"; field: string; op: ">" | "<" | "=" | ">=" | "<="; value: number }
  | { kind: "approval"; note?: string };

export type DbAutomation = {
  id: string;
  name: string;
  trigger: string | null;
  action: string | null;
  trigger_key: TriggerKey;
  action_key: ActionKey;
  action_config: Record<string, unknown>;
  steps: WorkflowStep[] | null;
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
  steps?: WorkflowStep[] | null;
  enabled?: boolean;
};

const COLS = "id,name,trigger,action,trigger_key,action_key,action_config,steps,enabled,runs,last_run,created_at";

// `steps` ships in migration 0027 and isn't in the generated Database types
// until Lovable regenerates them, so reach the table through an untyped handle.
// Runtime behaviour is unchanged once types regenerate.
const automationsTable = () => (supabase as unknown as { from: (t: string) => any }).from("automations");

/** WonderFlow events — all of them can drive automations and fan out to
 *  subscribed outbound webhooks. */
export type WfEvent = TriggerKey;

/** Fire an event so the engine runs any matching automations AND delivers to
 *  subscribed outbound webhooks. Best-effort + non-blocking. */
export async function fireAutomationEvent(
  orgId: string,
  event: WfEvent,
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
  const { data, error } = await automationsTable()
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbAutomation[]) ?? [];
}

export async function createAutomation(orgId: string, a: NewAutomation) {
  const { data, error } = await automationsTable()
    .insert({ org_id: orgId, ...a, action_config: a.action_config ?? {} })
    .select(COLS)
    .single();
  return { data: data as DbAutomation | null, error: error ? new Error(error.message) : null };
}

export async function insertAutomations(orgId: string, rows: NewAutomation[]) {
  const { error } = await automationsTable().insert(rows.map((r) => ({ org_id: orgId, ...r, action_config: r.action_config ?? {} })));
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

/** Update an existing rule's trigger/action/steps in place (RLS restricts to the owning org's members). */
export async function updateAutomation(id: string, patch: Partial<NewAutomation>) {
  const { data, error } = await automationsTable().update(patch).eq("id", id).select(COLS).single();
  return { data: data as DbAutomation | null, error: error ? new Error(error.message) : null };
}

export async function deleteAutomation(id: string) {
  const { error } = await supabase.from("automations").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

// ── Approval steps ─────────────────────────────────────────────────────────
// A multi-step workflow can pause on an "approval" step (see WorkflowStep) —
// these are queued in automation_runs and resolved here, one at a time, by an
// org member. Ships in migration 0028; reach automation_runs untyped until
// Lovable regenerates DB types.
const runsTable = () => (supabase as unknown as { from: (t: string) => any }).from("automation_runs");

export type ApprovalRun = {
  id: string;
  automation_id: string;
  event: string;
  payload: Record<string, unknown>;
  note: string | null;
  status: "pending_approval" | "approved" | "rejected";
  created_at: string;
  resolved_at: string | null;
  automations: { name: string } | null;
};

const APPROVAL_COLS = "id,automation_id,event,payload,note,status,created_at,resolved_at,automations(name)";

/** Runs currently awaiting a human decision, oldest first (first in, first reviewed). */
export async function listPendingApprovals(orgId: string): Promise<ApprovalRun[]> {
  const { data, error } = await runsTable()
    .select(APPROVAL_COLS)
    .eq("org_id", orgId)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as ApprovalRun[]) ?? [];
}

/** Recently resolved approvals (approved or rejected), newest first — for the stats + "just resolved" list. */
export async function listResolvedApprovals(orgId: string, limit = 20): Promise<ApprovalRun[]> {
  const { data, error } = await runsTable()
    .select(APPROVAL_COLS)
    .eq("org_id", orgId)
    .in("status", ["approved", "rejected"])
    .order("resolved_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as ApprovalRun[]) ?? [];
}

// ── Execution history ───────────────────────────────────────────────────────
// A real per-attempt log (initial fire, a resumed wait/approval step, or an
// approval resolution) — written by the runner via logExecution(). Ships in
// migration 0029; reach the table untyped until Lovable regenerates DB types.
const executionsTable = () => (supabase as unknown as { from: (t: string) => any }).from("automation_executions");

export type DbExecution = {
  id: string;
  automation_id: string | null;
  automation_name: string;
  event: string;
  ok: boolean;
  detail: string | null;
  duration_ms: number | null;
  created_at: string;
};

/** Most recent execution attempts for an org, newest first. Fails soft (empty) if unmigrated. */
export async function listExecutions(orgId: string, limit = 50): Promise<DbExecution[]> {
  const { data, error } = await executionsTable()
    .select("id,automation_id,automation_name,event,ok,detail,duration_ms,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as DbExecution[]) ?? [];
}

/** Approve or reject a paused run. Approving continues the workflow (which may pause again). */
export async function resolveApproval(runId: string, approve: boolean): Promise<{ ok: boolean; detail?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("resolve-automation-approval", { body: { runId, approve } });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error as string };
    return { ok: !!data?.ok, detail: data?.detail as string | undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
