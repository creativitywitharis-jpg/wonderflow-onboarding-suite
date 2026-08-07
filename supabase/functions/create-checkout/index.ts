// WonderFlow OS — Stripe Checkout session creator.
// Requires a logged-in user (verify_jwt = true). Verifies the caller is a
// member of the org, then opens a Stripe Checkout Session for the chosen plan.
//
// Secrets: STRIPE_SECRET_KEY  (set via Lovable → "add secret STRIPE_SECRET_KEY")
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Plan catalog — amounts in cents (USD), billed monthly. Kept in sync with
// src/lib/billing.ts on the front end.
const PLANS: Record<string, { label: string; amount: number }> = {
  starter: { label: "Starter", amount: 2900 },
  growth: { label: "Growth", amount: 7900 },
  scale: { label: "Scale", amount: 19900 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? Deno.env.get("STRIPE_TEST_API_KEY");
  if (!stripeKey) {
    return json({ error: "Billing isn't configured yet — set a Stripe API key secret." }, 500);
  }

  let body: { plan?: string; orgId?: string; origin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const plan = body.plan ?? "";
  const orgId = body.orgId ?? "";
  const priced = PLANS[plan];
  if (!priced) return json({ error: "Unknown plan." }, 400);
  if (!orgId) return json({ error: "Missing organization." }, 400);

  // Identify the caller from their JWT and confirm org membership (RLS-scoped).
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "You must be signed in." }, 401);

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return json({ error: "You don't have access to this workspace." }, 403);

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Reuse an existing Stripe customer for this org if we've seen one before.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const origin = body.origin || req.headers.get("origin") || "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existing?.stripe_customer_id || undefined,
      customer_email: existing?.stripe_customer_id ? undefined : (user.email ?? undefined),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priced.amount,
            recurring: { interval: "month" },
            product_data: { name: `WonderFlow OS — ${priced.label}` },
          },
        },
      ],
      client_reference_id: orgId,
      metadata: { org_id: orgId, plan },
      subscription_data: { metadata: { org_id: orgId, plan } },
      success_url: `${origin}/admin?billing=success`,
      cancel_url: `${origin}/admin?billing=cancelled`,
      allow_promotion_codes: true,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not start checkout." }, 502);
  }
});
