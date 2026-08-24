// Shared automation execution — used by both `run-automations` (user-triggered)
// and `inbound` (website/form-triggered). Given an event, finds the org's
// enabled automations whose trigger matches and runs each action.
//   ai_draft_note   → Claude drafts a note, stored as a customer interaction (internal only)
//   email_owner     → emails the org owner via Resend (no-op if unconfigured)
//   email_customer  → Claude drafts + Resend actually SENDS an email to the customer
//   webhook         → POSTs the payload to a configured URL

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

// Separate, stricter system prompt for content that gets emailed to an actual
// customer — it must never leak meta-commentary, instructions, or placeholders
// into a real inbox.
const EMAIL_SYSTEM = [
  "You write the body of a short, warm, professional email FROM a business TO one of its customers.",
  "Output ONLY the email body text — no subject line, no markdown headers, no code fences, no meta-commentary about the request or the data, no questions back to whoever triggered this.",
  "Address the customer directly and naturally. If a name looks like a placeholder, use it as given without commenting on it.",
  "Keep it concise (3–6 short sentences). Sign off simply (e.g. 'Warmly,' or 'Best,') without a name — the caller appends the business's own signature.",
].join(" ");

async function claudeDraft(prompt: string, system: string = DRAFT_SYSTEM): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return "";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-5", max_tokens: 1024, system, messages: [{ role: "user", content: prompt }] }),
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
      } else if (actionKey === "email_customer") {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        const customerId = (payload.customer_id as string) ?? null;
        if (!resendKey) {
          detail = "email not configured";
        } else if (!customerId) {
          detail = "no customer on this event";
        } else {
          const { data: cust } = await admin.from("customers").select("name,email").eq("id", customerId).maybeSingle();
          const custEmail = (cust as { email?: string } | null)?.email;
          const custName = (cust as { name?: string } | null)?.name ?? "there";
          if (!custEmail) {
            detail = "customer has no email on file";
          } else {
            const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
            const orgName = (org as { name?: string } | null)?.name ?? "Your business";
            const basePrompt = (config.prompt as string) || "Write a short, warm email to this customer for this event.";
            const body = await claudeDraft(
              `${basePrompt}\n\nCustomer name: ${custName}\nEvent: ${event}\nDetails: ${JSON.stringify(payload)}`,
              EMAIL_SYSTEM,
            );
            if (body) {
              const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
              const subject = (config.subject as string) || `A message from ${orgName}`;
              const r = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ from, to: [custEmail], subject, html: customerEmailHtml(orgName, body) }),
              });
              ok = r.ok;
              detail = `email ${r.status}`;
              if (ok) {
                await admin.from("interactions").insert({ org_id: orgId, customer_id: customerId, channel: "email", body: `📧 ${a.name} — sent to ${custEmail}: ${body}` });
              }
            } else detail = "AI unavailable";
          }
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
