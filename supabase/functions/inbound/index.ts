// WonderFlow OS — inbound capture (public).
// External websites/forms/stores/Zapier POST here. Auth is the per-org
// `ingest_key` (in ?key=, x-wf-key header, or body.key) — no user session.
//
// Two shapes, auto-detected by whether the payload carries a purchase amount:
//  • LEAD  (no amount): upsert the contact and fire `customer.created`.
//  • ORDER (has amount): match the existing customer by email (or create one),
//    roll the sale into their totals (orders +1, LTV += amount), auto-issue any
//    loyalty reward codes the new points unlock, and fire `order.created`.
// Either way we dedupe by email so repeat buyers aren't duplicated.
//
// verify_jwt = false (called by anonymous external systems).
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
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

// ── Loyalty milestones (mirrors src/lib/loyalty.ts) ────────────────────────
const GRADES = [
  { grade: "Bronze", threshold: 250, value: 10 },
  { grade: "Silver", threshold: 750, value: 25 },
  { grade: "Gold", threshold: 1500, value: 50 },
  { grade: "Platinum", threshold: 3000, value: 100 },
];
const REPEAT = { grade: "Elite", start: 4000, step: 1000, value: 75 };

function earnedMilestones(points: number) {
  const out: { grade: string; threshold: number; value: number }[] = [];
  for (const g of GRADES) if (points >= g.threshold) out.push(g);
  if (points >= REPEAT.start) {
    const highest = REPEAT.start + Math.floor((points - REPEAT.start) / REPEAT.step) * REPEAT.step;
    out.push({ grade: REPEAT.grade, threshold: highest, value: REPEAT.value });
  }
  return out;
}

function makeCode(grade: string): string {
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5).padEnd(5, "X");
  return `${grade.slice(0, 4).toUpperCase()}-${rand}`;
}

// Roll a sale into a customer + auto-issue any newly-earned reward codes.
async function rollUp(admin: SupabaseClient, orgId: string, customerId: string, name: string, amount: number) {
  const { data: cust } = await admin.from("customers").select("orders,ltv").eq("id", customerId).single();
  const newLtv = Number((cust as { ltv?: number } | null)?.ltv || 0) + amount;
  const newOrders = Number((cust as { orders?: number } | null)?.orders || 0) + 1;
  await admin.from("customers").update({ orders: newOrders, ltv: newLtv }).eq("id", customerId);

  const points = Math.max(0, Math.round(newLtv)); // 1 pt per $1
  const earned = earnedMilestones(points);
  if (earned.length > 0) {
    const rows = earned.map((m) => ({
      org_id: orgId,
      customer_id: customerId,
      customer_name: name,
      grade: m.grade,
      threshold: m.threshold,
      points_at_issue: points,
      value: m.value,
      code: makeCode(m.grade),
    }));
    try {
      await admin.from("reward_codes").upsert(rows, { onConflict: "customer_id,threshold", ignoreDuplicates: true });
    } catch {
      // reward_codes may not be migrated yet — never fail the capture for it.
    }
  }
  return newLtv;
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

  // Map common field names.
  const first = pick(payload, ["firstname", "fname", "given"]);
  const last = pick(payload, ["lastname", "lname", "surname", "family"]);
  const name = pick(payload, ["name", "fullname", "contact", "customer", "customername"]) ||
    [first, last].filter(Boolean).join(" ").trim() || "Website contact";
  const email = pick(payload, ["email", "emailaddress"]);
  const phone = pick(payload, ["phone", "telephone", "mobile", "phonenumber"]);
  const company = pick(payload, ["company", "business", "organization", "organisation"]);
  const message = pick(payload, ["message", "notes", "comment", "comments", "enquiry", "inquiry", "details"]);
  const source = pick(payload, ["source", "utmsource"]) || "website";

  // A purchase amount turns this into an ORDER rather than a lead.
  const amountRaw = pick(payload, ["total", "amount", "ordertotal", "orderamount", "grandtotal", "value", "revenue", "price"]);
  const amount = amountRaw ? Math.max(0, parseFloat(amountRaw.replace(/[^0-9.]/g, "")) || 0) : 0;
  const isOrder = amount > 0;

  // Dedupe by email so repeat buyers aren't duplicated.
  let customerId = "";
  let resolvedName = name;
  if (email) {
    const { data: match } = await admin
      .from("customers")
      .select("id,name")
      .eq("org_id", orgId)
      .ilike("email", email)
      .maybeSingle();
    if (match) {
      customerId = (match as { id: string }).id;
      resolvedName = (match as { name?: string }).name || name;
    }
  }
  if (!customerId) {
    const { data: created, error } = await admin
      .from("customers")
      .insert({
        org_id: orgId,
        name,
        email: email || null,
        company: company || null,
        tier: "New",
        tags: isOrder ? ["Web", "Customer"] : ["Lead", "Web"],
      })
      .select("id")
      .single();
    if (error) return json({ error: "Could not save the contact." }, 500);
    customerId = (created as { id: string }).id;
  }

  let newLtv: number | null = null;
  if (isOrder) newLtv = await rollUp(admin, orgId, customerId, resolvedName, amount);

  // Log the submission as an interaction.
  const bodyText = isOrder
    ? [`🛒 New order — $${amount.toLocaleString("en-US")}`, message, `Source: ${source}`].filter(Boolean).join("\n")
    : [message, phone ? `Phone: ${phone}` : "", `Source: ${source}`].filter(Boolean).join("\n");
  if (bodyText) {
    await admin.from("interactions").insert({ org_id: orgId, customer_id: customerId, channel: "note", body: isOrder ? bodyText : `📥 New web lead — ${bodyText}` });
  }

  // Fire the matching automations + outbound webhooks.
  const event = isOrder ? "order.created" : "customer.created";
  const eventPayload = { customer_id: customerId, name: resolvedName, email, company, message, source, total: amount || null };
  let ran = 0;
  try {
    const results = await runAutomations(admin, orgId, event, eventPayload);
    ran = results.length;
    await deliverWebhooks(admin, orgId, event, eventPayload);
  } catch {
    // never fail the capture because an automation or webhook errored
  }

  return json({ ok: true, type: isOrder ? "order" : "lead", customer_id: customerId, ltv: newLtv, automations_fired: ran });
});
