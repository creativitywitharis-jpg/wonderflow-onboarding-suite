// WonderFlow OS — inbound lead capture (public).
// External websites/forms/Zapier POST here to drop a lead into an org's CRM.
// Auth is the per-org `ingest_key` (in ?key=, x-wf-key header, or body.key) — no
// user session. On success it creates a customer, logs the message, and fires
// the org's `customer.created` automations (AI follow-up, owner email, webhook).
//
// verify_jwt = false (called by anonymous external systems).
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { runAutomations } from "../_shared/automation-runner.ts";
import { deliverWebhooks } from "../_shared/webhook-dispatch.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wf-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Pull a value from a payload trying several common field names.
function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(obj)) {
    if (keys.includes(k.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Accept JSON or form-encoded bodies (HTML forms send the latter).
  let payload: Record<string, unknown> = {};
  const ctype = req.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) payload[k] = typeof v === "string" ? v : "";
    }
  } catch {
    return json({ error: "Could not read the submission." }, 400);
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-wf-key") || (payload.key as string) || "";
  if (!key) return json({ error: "Missing form key." }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: org } = await admin.from("organizations").select("id,name").eq("ingest_key", key).maybeSingle();
  const orgId = (org as { id?: string } | null)?.id;
  if (!orgId) return json({ error: "Invalid form key." }, 401);

  // Map common field names → a customer.
  const first = pick(payload, ["firstname", "fname", "given"]);
  const last = pick(payload, ["lastname", "lname", "surname", "family"]);
  const name = pick(payload, ["name", "fullname", "contact"]) || [first, last].filter(Boolean).join(" ").trim() || "Website lead";
  const email = pick(payload, ["email", "emailaddress"]);
  const phone = pick(payload, ["phone", "telephone", "mobile", "phonenumber"]);
  const company = pick(payload, ["company", "business", "organization", "organisation"]);
  const message = pick(payload, ["message", "notes", "comment", "comments", "enquiry", "inquiry", "details"]);
  const source = pick(payload, ["source", "utmsource"]) || "website";

  const { data: created, error } = await admin
    .from("customers")
    .insert({ org_id: orgId, name, email: email || null, company: company || null, tier: "New", tags: ["Lead", "Web"] })
    .select("id")
    .single();
  if (error) return json({ error: "Could not save the lead." }, 500);
  const customerId = (created as { id: string }).id;

  // Log the submission (message + any phone) as the first interaction.
  const bodyText = [message, phone ? `Phone: ${phone}` : "", `Source: ${source}`].filter(Boolean).join("\n");
  if (bodyText) {
    await admin.from("interactions").insert({ org_id: orgId, customer_id: customerId, channel: "note", body: `📥 New web lead — ${bodyText}` });
  }

  // Fire the org's customer.created automations + outbound webhooks.
  let ran = 0;
  const eventPayload = { customer_id: customerId, name, email, company, message, source };
  try {
    const results = await runAutomations(admin, orgId, "customer.created", eventPayload);
    ran = results.length;
    await deliverWebhooks(admin, orgId, "customer.created", eventPayload);
  } catch {
    // never fail the capture because an automation or webhook errored
  }

  return json({ ok: true, customer_id: customerId, automations_fired: ran });
});
