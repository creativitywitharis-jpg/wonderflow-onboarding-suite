// WonderFlow OS — automation execution engine.
// Given an event (order.created / customer.created / manual), finds the org's
// enabled automations whose trigger matches, and runs each action:
//   ai_draft_note  → Claude drafts a note, stored as a customer interaction
//   email_owner    → emails the org owner via Resend (no-op if unconfigured)
//   webhook        → POSTs the payload to a configured URL
// Requires a signed-in member of the org. Best-effort per action.
//
// Secrets used if present: ANTHROPIC_API_KEY, RESEND_API_KEY, EMAIL_FROM
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type Payload = Record<string, unknown>;

async function claudeDraft(prompt: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return "";
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-5", max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await resp.json();
  if (!resp.ok) return "";
  return (data.content ?? []).filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);

  let body: { orgId?: string; event?: string; payload?: Payload; automationId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const orgId = body.orgId ?? "";
  const event = body.event ?? "";
  const payload = body.payload ?? {};
  if (!orgId || !event) return json({ error: "Missing orgId or event." }, 400);

  // Verify membership (RLS-scoped read).
  const { data: membership } = await userClient
    .from("memberships").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return json({ error: "You don't have access to this workspace." }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Find matching enabled automations. A specific automationId (manual "Run
  // now") overrides trigger matching.
  let query = admin.from("automations").select("*").eq("org_id", orgId).eq("enabled", true);
  if (body.automationId) query = query.eq("id", body.automationId);
  else query = query.eq("trigger_key", event);
  const { data: autos } = await query;
  const automations = (autos as Array<Record<string, unknown>>) ?? [];

  const results: { id: string; action: string; ok: boolean; detail?: string }[] = [];

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
        // ai_draft_note — Claude drafts, stored as an interaction on the customer.
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

  return json({ ran: results.length, results });
});
