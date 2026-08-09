// WonderFlow OS — Stripe → CRM sync.
// Pulls the org's Stripe customers (and recent charge totals) and inserts any
// not already in the CRM (deduped by email). Reuses the existing Stripe key —
// no new dev app needed. Owner/admin only.
//
// Secret: STRIPE_SECRET_KEY (or STRIPE_TEST_API_KEY)
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

async function stripeGet(key: string, path: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}` } });
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? Deno.env.get("STRIPE_TEST_API_KEY");
  if (!stripeKey) return json({ error: "Stripe isn't configured — add the Stripe API key." }, 500);

  let body: { orgId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const orgId = body.orgId ?? "";
  if (!orgId) return json({ error: "Missing organization." }, 400);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data: membership } = await userClient
    .from("memberships").select("role").eq("org_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  const role = (membership as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") return json({ error: "Only owners and admins can sync integrations." }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Recent charges → spend per customer (one page is enough for a v1 sync).
    const charges = await stripeGet(stripeKey, "charges?limit=100");
    const spend: Record<string, number> = {};
    for (const c of charges.data ?? []) {
      if (c.paid && c.customer) spend[c.customer] = (spend[c.customer] ?? 0) + (c.amount ?? 0);
    }

    const customers = await stripeGet(stripeKey, "customers?limit=100");
    if (customers.error) return json({ error: customers.error.message ?? "Stripe request failed." }, 502);

    // Existing emails so re-syncing doesn't create duplicates.
    const { data: existing } = await admin.from("customers").select("email").eq("org_id", orgId);
    const have = new Set(((existing as { email: string | null }[]) ?? []).map((e) => (e.email ?? "").toLowerCase()).filter(Boolean));

    const rows: Record<string, unknown>[] = [];
    for (const c of customers.data ?? []) {
      const email = (c.email ?? "").toLowerCase();
      const name = c.name || (email ? email.split("@")[0] : null);
      if (!name) continue;
      if (email && have.has(email)) continue;
      rows.push({
        org_id: orgId,
        name,
        email: c.email ?? null,
        ltv: Math.round((spend[c.id] ?? 0) / 100),
        tier: "New",
        tags: ["Stripe"],
        since: c.created ? new Date(c.created * 1000).getFullYear().toString() : null,
      });
      if (email) have.add(email);
    }

    if (rows.length) {
      const { error: insErr } = await admin.from("customers").insert(rows);
      if (insErr) return json({ error: insErr.message }, 500);
    }

    await admin.from("connections").upsert(
      { org_id: orgId, provider: "stripe", status: "connected", config: { last_sync: new Date().toISOString(), synced: rows.length } },
      { onConflict: "org_id,provider" },
    );

    return json({ synced: rows.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Sync failed." }, 500);
  }
});
