// Shared automation execution — used by both `run-automations` (user-triggered)
// and `inbound` (website/form-triggered). Given an event, finds the org's
// enabled automations whose trigger matches and runs each action.
//   ai_draft_note → Claude drafts a note, stored as a customer interaction
//   email_owner   → emails the org owner via Resend (no-op if unconfigured)
//   webhook       → POSTs the payload to a configured URL

// deno-lint-ignore no-explicit-any
type Admin = any;
type Payload = Record<string, unknown>;
export type AutomationResult = { id: string; action: string; ok: boolean; detail?: string };

// System prompt keeps the automation's output a clean, usable note — without it,
// Claude (reasonably) treats the call like a chat and adds meta-commentary
// ("this record looks like test data…") when something in the payload looks
// off, which is unusable as a logged customer interaction.
const DRAFT_SYSTEM = [
  "You draft short internal business notes for an automation system — not a conversation.",
  "Output ONLY the note text itself. No preamble, no meta-commentary about the request or the data, no questions back to the user, no suggestions or caveats about the input.",
  "If a name or detail looks like placeholder/test data, write the note anyway exactly as asked — do not comment on it.",
].join(" ");

async function claudeDraft(prompt: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return "";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-5", max_tokens: 1024, system: DRAFT_SYSTEM, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await resp.json();
  if (!resp.ok) return "";
  return (data.content ?? []).filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim();
}

export async function runAutomations(
  admin: Admin,
  orgId: string,
  event: string,
  payload: Payload,
  opts: { automationId?: string } = {},
): Promise<AutomationResult[]> {
  let query = admin.from("automations").select("*").eq("org_id", orgId).eq("enabled", true);
  if (opts.automationId) query = query.eq("id", opts.automationId);
  else query = query.eq("trigger_key", event);
  const { data: autos } = await query;
  const automations = (autos as Array<Record<string, unknown>>) ?? [];

  const results: AutomationResult[] = [];

  for (const a of automations) {
    const id = a.id as string;
    const actionKey = (a.action_key as string) ?? "ai_draft_note";
    const config = (a.action_config as Record<string, unknown>) ?? {};
    let ok = false;
    let detail = "";
    try {
      if (actionKey === "webhook") {
        const url = (config.webhook_url as string) ?? "";
        if (url) {
          const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, payload, automation: a.name }) });
          ok = r.ok;
          detail = `webhook ${r.status}`;
        } else detail = "no webhook_url";
      } else if (actionKey === "email_owner") {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) {
          detail = "email not configured";
        } else {
          const { data: owner } = await admin
            .from("memberships").select("profiles(email,full_name)").eq("org_id", orgId).eq("role", "owner").maybeSingle();
          const email = (owner as { profiles?: { email?: string } } | null)?.profiles?.email;
          if (email) {
            const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
            const subject = (config.subject as string) || `Automation: ${a.name}`;
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from, to: [email], subject, html: `<p>Your automation <b>${a.name}</b> fired on <b>${event}</b>.</p><pre>${JSON.stringify(payload, null, 2)}</pre>` }),
            });
            ok = r.ok;
            detail = `email ${r.status}`;
          } else detail = "no owner email";
        }
      } else {
        const basePrompt = (config.prompt as string) || "Draft a short, friendly, actionable note for this business event.";
        const draft = await claudeDraft(`${basePrompt}\n\nEvent: ${event}\nDetails: ${JSON.stringify(payload)}`);
        if (draft) {
          const customerId = (payload.customer_id as string) ?? null;
          await admin.from("interactions").insert({ org_id: orgId, customer_id: customerId, channel: "note", body: `🤖 ${a.name}: ${draft}` });
          ok = true;
          detail = "note drafted";
        } else detail = "AI unavailable";
      }
    } catch (e) {
      detail = e instanceof Error ? e.message : "action error";
    }

    await admin.from("automations").update({ runs: ((a.runs as number) ?? 0) + 1, last_run: new Date().toISOString() }).eq("id", id);
    results.push({ id, action: actionKey, ok, detail });
  }

  return results;
}
