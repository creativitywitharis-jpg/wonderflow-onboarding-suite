// Shared automation execution — used by both `run-automations` (user-triggered),
// `inbound` (website/form-triggered), and `automation-tick` (external scheduler).
// Given an event, finds the org's enabled automations whose trigger matches and
// runs each one — either a single action (legacy) or an ordered multi-step
// workflow (steps: action / wait / condition).
//   ai_draft_note   → Claude drafts a note, stored as a customer interaction (internal only)
//   email_owner     → emails the org owner via Resend (no-op if unconfigured)
//   email_customer  → Claude drafts + Resend actually SENDS an email to the customer
//   webhook         → POSTs the payload to a configured URL
//   slack_message   → Claude drafts a short alert, posted to the org's connected Slack channel
//
// Multi-step workflows: a `wait` step pauses the sequence by writing a row to
// automation_runs (resume_at = now + hours) instead of blocking the function.
// It's picked back up two ways — whichever happens first:
//   1. Piggybacked at the top of every runAutomations call for that org (so
//      normal day-to-day activity naturally flushes due steps), or
//   2. The public automation-tick endpoint, which any external scheduler
//      (Zapier/n8n/GitHub Actions/cron) can ping to flush due steps org-wide —
//      useful for a dormant org where nothing else would trigger a check.
// An `approval` step pauses the same way, but resumes only on a human decision
// (Approve/Reject in Automation → Approval center) via resolveApprovalRun —
// never on a timer.

// deno-lint-ignore no-explicit-any
type Admin = any;
type Payload = Record<string, unknown>;
export type AutomationResult = { id: string; action: string; ok: boolean; detail?: string };

export type WorkflowStep =
  | { kind: "action"; action_key: string; action_config?: Record<string, unknown> }
  | { kind: "wait"; hours: number }
  | { kind: "condition"; field: string; op: ">" | "<" | "=" | ">=" | "<="; value: number }
  | { kind: "approval"; note?: string };

// System prompt keeps the automation's output a clean, usable note — without it,
// Claude (reasonably) treats the call like a chat and adds meta-commentary
// ("this record looks like test data…") when something in the payload looks
// off, which is unusable as a logged customer interaction.
const DRAFT_SYSTEM = [
  "You draft short internal business notes for an automation system — not a conversation.",
  "Output ONLY the note text itself. No preamble, no meta-commentary about the request or the data, no questions back to the user, no suggestions or caveats about the input.",
  "If a name or detail looks like placeholder/test data, write the note anyway exactly as asked — do not comment on it.",
].join(" ");

// Separate, stricter system prompt for content that gets emailed to an actual
// customer — it must never leak meta-commentary, instructions, or placeholders
// into a real inbox.
const EMAIL_SYSTEM = [
  "You write the body of a short, warm, professional email FROM a business TO one of its customers.",
  "Output ONLY the email body text — no subject line, no markdown headers, no code fences, no meta-commentary about the request or the data, no questions back to whoever triggered this.",
  "Address the customer directly and naturally. If a name looks like a placeholder, use it as given without commenting on it.",
  "Keep it concise (3–6 short sentences). Sign off simply (e.g. 'Warmly,' or 'Best,') without a name — the caller appends the business's own signature.",
].join(" ");

// A Slack alert reads worst when it sounds like a chat reply — short and flat.
const SLACK_SYSTEM = [
  "You write a short internal Slack alert for a team about a business event — not a conversation.",
  "Output ONLY the message text itself, plain text (no markdown headers, no code fences), 1–3 short sentences.",
  "No preamble, no meta-commentary about the request or the data, no questions back to whoever triggered this.",
].join(" ");

// Kept in sync with src/components/wf/admin.tsx's AiConfigView.
const MODEL_FOR_TIER: Record<string, string> = {
  precision: "claude-opus-5",
  balanced: "claude-sonnet-5",
  fast: "claude-haiku-4-5-20251001",
};

async function claudeDraft(prompt: string, system: string = DRAFT_SYSTEM, model: string = MODEL_FOR_TIER.balanced): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return "";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1024, system, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await resp.json();
  if (!resp.ok) return "";
  return (data.content ?? []).filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim();
}

function esc(s: string): string {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

// Simple branded wrapper (mirrors the invoice email's look) for customer-facing
// automation emails — reads as coming from the business, not WonderFlow.
function customerEmailHtml(orgName: string, bodyText: string): string {
  const paras = bodyText.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#e8e6e1">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8e6e1">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em">${esc(orgName)}</div>
    <div style="margin-top:20px;padding:28px;border:1px solid #26262b;border-radius:18px;background:#141416">${paras}</div>
  </div></body></html>`;
}

/** Run one action (used both by legacy single-action rules and each 'action' step in a workflow). */
async function runAction(
  admin: Admin,
  orgId: string,
  event: string,
  payload: Payload,
  automationName: string,
  actionKey: string,
  config: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  try {
    // Only ai_draft_note/email_customer/slack_message call Claude, but this is
    // cheap and keeps the model lookup in one place rather than duplicated
    // across three branches.
    const { data: org } = await admin.from("organizations").select("ai_model").eq("id", orgId).maybeSingle();
    const model = MODEL_FOR_TIER[(org as { ai_model?: string } | null)?.ai_model ?? "balanced"] ?? MODEL_FOR_TIER.balanced;

    if (actionKey === "webhook") {
      const url = (config.webhook_url as string) ?? "";
      if (!url) return { ok: false, detail: "no webhook_url" };
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, payload, automation: automationName }) });
      return { ok: r.ok, detail: `webhook ${r.status}` };
    }

    if (actionKey === "slack_message") {
      const { data: conn } = await admin.from("connections").select("status,config").eq("org_id", orgId).eq("provider", "slack").maybeSingle();
      const webhookUrl = (conn as { config?: { webhook_url?: string } } | null)?.config?.webhook_url;
      if ((conn as { status?: string } | null)?.status !== "connected" || !webhookUrl) return { ok: false, detail: "Slack not connected" };
      const basePrompt = (config.prompt as string) || "Write a short, friendly Slack alert for the team about this event.";
      const text = await claudeDraft(`${basePrompt}\n\nEvent: ${event}\nDetails: ${JSON.stringify(payload)}`, SLACK_SYSTEM, model);
      if (!text) return { ok: false, detail: "AI unavailable" };
      const r = await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `*${automationName}*\n${text}` }) });
      return { ok: r.ok, detail: `slack ${r.status}` };
    }

    if (actionKey === "email_owner") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return { ok: false, detail: "email not configured" };
      const { data: owner } = await admin.from("memberships").select("profiles(email,full_name)").eq("org_id", orgId).eq("role", "owner").maybeSingle();
      const email = (owner as { profiles?: { email?: string } } | null)?.profiles?.email;
      if (!email) return { ok: false, detail: "no owner email" };
      const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
      const subject = (config.subject as string) || `Automation: ${automationName}`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject, html: `<p>Your automation <b>${automationName}</b> fired on <b>${event}</b>.</p><pre>${JSON.stringify(payload, null, 2)}</pre>` }),
      });
      return { ok: r.ok, detail: `email ${r.status}` };
    }

    if (actionKey === "email_customer") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const customerId = (payload.customer_id as string) ?? null;
      if (!resendKey) return { ok: false, detail: "email not configured" };
      if (!customerId) return { ok: false, detail: "no customer on this event" };
      const { data: cust } = await admin.from("customers").select("name,email").eq("id", customerId).maybeSingle();
      const custEmail = (cust as { email?: string } | null)?.email;
      const custName = (cust as { name?: string } | null)?.name ?? "there";
      if (!custEmail) return { ok: false, detail: "customer has no email on file" };
      const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
      const orgName = (org as { name?: string } | null)?.name ?? "Your business";
      const basePrompt = (config.prompt as string) || "Write a short, warm email to this customer for this event.";
      const body = await claudeDraft(`${basePrompt}\n\nCustomer name: ${custName}\nEvent: ${event}\nDetails: ${JSON.stringify(payload)}`, EMAIL_SYSTEM, model);
      if (!body) return { ok: false, detail: "AI unavailable" };
      const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
      const subject = (config.subject as string) || `A message from ${orgName}`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [custEmail], subject, html: customerEmailHtml(orgName, body) }),
      });
      if (r.ok) await admin.from("interactions").insert({ org_id: orgId, customer_id: customerId, channel: "email", body: `📧 ${automationName} — sent to ${custEmail}: ${body}` });
      return { ok: r.ok, detail: `email ${r.status}` };
    }

    // Default: ai_draft_note
    const basePrompt = (config.prompt as string) || "Draft a short, friendly, actionable note for this business event.";
    const draft = await claudeDraft(`${basePrompt}\n\nEvent: ${event}\nDetails: ${JSON.stringify(payload)}`, DRAFT_SYSTEM, model);
    if (!draft) return { ok: false, detail: "AI unavailable" };
    const customerId = (payload.customer_id as string) ?? null;
    await admin.from("interactions").insert({ org_id: orgId, customer_id: customerId, channel: "note", body: `🤖 ${automationName}: ${draft}` });
    return { ok: true, detail: "note drafted" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "action error" };
  }
}

/** Logs a real execution attempt (initial fire, a resumed step, or an approval
 *  resolution) for Automation → Execution history. Never lets a logging
 *  failure break the actual automation run. */
async function logExecution(
  admin: Admin,
  orgId: string,
  automationId: string | null,
  automationName: string,
  event: string,
  ok: boolean,
  detail: string,
  durationMs: number,
): Promise<void> {
  try {
    await admin.from("automation_executions").insert({
      org_id: orgId,
      automation_id: automationId,
      automation_name: automationName,
      event,
      ok,
      detail,
      duration_ms: Math.max(0, Math.round(durationMs)),
    });
  } catch {
    // best-effort — never block the real execution over a logging failure
  }
}

function evalCondition(payload: Payload, step: { field: string; op: string; value: number }): boolean {
  const raw = payload[step.field];
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (isNaN(n)) return false;
  switch (step.op) {
    case ">": return n > step.value;
    case "<": return n < step.value;
    case ">=": return n >= step.value;
    case "<=": return n <= step.value;
    case "=": return n === step.value;
    default: return false;
  }
}

/**
 * Run a workflow's steps in order starting at `startIndex`. Stops (without
 * error) if a condition fails. Pauses — writing an automation_runs row and
 * returning `paused: true` — when it hits a `wait` step; the caller is
 * responsible for NOT treating a pause as a failure.
 */
async function runStepSequence(
  admin: Admin,
  orgId: string,
  automation: { id: string; name: string },
  event: string,
  payload: Payload,
  steps: WorkflowStep[],
  startIndex: number,
): Promise<{ ok: boolean; detail: string; paused?: boolean }> {
  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];
    if (step.kind === "wait") {
      const resumeAt = new Date(Date.now() + Math.max(0, step.hours) * 3600_000).toISOString();
      await admin.from("automation_runs").insert({
        org_id: orgId,
        automation_id: automation.id,
        event,
        payload,
        step_index: i + 1,
        status: "waiting",
        resume_at: resumeAt,
      });
      return { ok: true, detail: `paused — resumes in ${step.hours}h (step ${i + 2}/${steps.length})`, paused: true };
    }
    if (step.kind === "condition") {
      if (!evalCondition(payload, step)) {
        return { ok: true, detail: `stopped — condition not met at step ${i + 1}` };
      }
      continue;
    }
    if (step.kind === "approval") {
      await admin.from("automation_runs").insert({
        org_id: orgId,
        automation_id: automation.id,
        event,
        payload,
        step_index: i + 1,
        status: "pending_approval",
        resume_at: new Date().toISOString(),
        note: step.note ?? null,
      });
      return { ok: true, detail: `awaiting approval (step ${i + 2}/${steps.length})`, paused: true };
    }
    // action step
    const res = await runAction(admin, orgId, event, payload, automation.name, step.action_key, step.action_config ?? {});
    if (!res.ok) return { ok: false, detail: `step ${i + 1} failed: ${res.detail}` };
  }
  return { ok: true, detail: "workflow completed" };
}

/**
 * Resume any workflow steps whose wait has elapsed. Org-scoped when called as
 * a piggyback from a real event; org-agnostic (all orgs) when called from the
 * automation-tick endpoint. Capped per call to keep each invocation fast.
 */
export async function resumeDueRuns(admin: Admin, orgId?: string): Promise<number> {
  let query = admin.from("automation_runs").select("*").eq("status", "waiting").lte("resume_at", new Date().toISOString()).limit(50);
  if (orgId) query = query.eq("org_id", orgId);
  const { data } = await query;
  const runs = (data as Array<Record<string, unknown>>) ?? [];
  let processed = 0;
  for (const run of runs) {
    const runId = run.id as string;
    const runOrgId = run.org_id as string;
    const t0 = Date.now();
    try {
      const { data: auto } = await admin.from("automations").select("id,name,enabled,steps").eq("id", run.automation_id).maybeSingle();
      const automation = auto as { id: string; name: string; enabled: boolean; steps: WorkflowStep[] | null } | null;
      if (automation?.enabled && automation.steps?.length) {
        const res = await runStepSequence(admin, runOrgId, automation, run.event as string, (run.payload as Payload) ?? {}, automation.steps, run.step_index as number);
        await logExecution(admin, runOrgId, automation.id, automation.name, `${run.event} (resumed)`, res.ok, res.detail, Date.now() - t0);
      }
    } catch {
      // never let one bad run block the batch
    }
    await admin.from("automation_runs").update({ status: "done" }).eq("id", runId);
    processed++;
  }
  return processed;
}

/**
 * Resolve a run paused on an `approval` step. Rejecting stops the workflow
 * permanently. Approving continues the sequence from where it paused — which
 * may itself hit another wait/approval/condition and pause again (a new
 * automation_runs row), or run to completion.
 */
export async function resolveApprovalRun(
  admin: Admin,
  runId: string,
  approve: boolean,
  resolvedBy: string | null,
): Promise<{ ok: boolean; detail: string }> {
  const { data: runRow } = await admin.from("automation_runs").select("*").eq("id", runId).maybeSingle();
  const run = runRow as Record<string, unknown> | null;
  if (!run) return { ok: false, detail: "run not found" };
  if (run.status !== "pending_approval") return { ok: false, detail: `already resolved (status: ${run.status})` };

  const { data: autoRow } = await admin.from("automations").select("id,name,enabled,steps").eq("id", run.automation_id).maybeSingle();
  const automation = autoRow as { id: string; name: string; enabled: boolean; steps: WorkflowStep[] | null } | null;
  const automationName = automation?.name ?? "Automation";
  const orgId = run.org_id as string;
  const t0 = Date.now();

  if (!approve) {
    await admin.from("automation_runs").update({ status: "rejected", resolved_by: resolvedBy, resolved_at: new Date().toISOString() }).eq("id", runId);
    await logExecution(admin, orgId, automation?.id ?? null, automationName, `${run.event} (approval)`, true, "rejected", Date.now() - t0);
    return { ok: true, detail: "rejected" };
  }

  let result: { ok: boolean; detail: string } = { ok: true, detail: "workflow completed" };
  if (automation?.enabled && automation.steps?.length) {
    result = await runStepSequence(admin, orgId, automation, run.event as string, (run.payload as Payload) ?? {}, automation.steps, run.step_index as number);
  }
  await admin.from("automation_runs").update({ status: "approved", resolved_by: resolvedBy, resolved_at: new Date().toISOString() }).eq("id", runId);
  await logExecution(admin, orgId, automation?.id ?? null, automationName, `${run.event} (approved)`, result.ok, result.detail, Date.now() - t0);
  return result;
}

export async function runAutomations(
  admin: Admin,
  orgId: string,
  event: string,
  payload: Payload,
  opts: { automationId?: string } = {},
): Promise<AutomationResult[]> {
  // Piggyback: flush any of this org's workflow steps that came due, so a
  // 'wait' step resolves the next time anything happens for this org, without
  // needing a dedicated scheduler.
  await resumeDueRuns(admin, orgId).catch(() => 0);

  let query = admin.from("automations").select("*").eq("org_id", orgId).eq("enabled", true);
  if (opts.automationId) query = query.eq("id", opts.automationId);
  else query = query.eq("trigger_key", event);
  const { data: autos } = await query;
  const automations = (autos as Array<Record<string, unknown>>) ?? [];

  const results: AutomationResult[] = [];

  for (const a of automations) {
    const id = a.id as string;
    const name = a.name as string;
    const steps = (a.steps as WorkflowStep[] | null) ?? null;
    let ok = false;
    let detail = "";
    let actionLabel = (a.action_key as string) ?? "ai_draft_note";
    const t0 = Date.now();

    if (steps && steps.length > 0) {
      actionLabel = "workflow";
      const res = await runStepSequence(admin, orgId, { id, name }, event, payload, steps, 0);
      ok = res.ok;
      detail = res.detail;
    } else {
      const actionKey = (a.action_key as string) ?? "ai_draft_note";
      const config = (a.action_config as Record<string, unknown>) ?? {};
      const res = await runAction(admin, orgId, event, payload, name, actionKey, config);
      ok = res.ok;
      detail = res.detail;
    }

    await admin.from("automations").update({ runs: ((a.runs as number) ?? 0) + 1, last_run: new Date().toISOString() }).eq("id", id);
    await logExecution(admin, orgId, id, name, event, ok, detail, Date.now() - t0);
    results.push({ id, action: actionLabel, ok, detail });
  }

  return results;
}
