// WonderFlow OS — Stripe Billing customer portal.
// Opens Stripe's hosted portal so owners/admins can update payment methods,
// see invoices, and cancel. Requires a signed-in owner/admin of the org.
//
// Secret: STRIPE_SECRET_KEY (or STRIPE_TEST_API_KEY)
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// NOTE: activate the portal once in Stripe → Settings → Billing → Customer portal.

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (!stripeKey) return json({ error: "Billing isn't configured yet." }, 500);

  let body: { orgId?: string; origin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const orgId = body.orgId ?? "";
  if (!orgId) return json({ error: "Missing organization." }, 400);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);

  const { data: membership } = await userClient
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const role = (membership as { role?: string } | null)?.role;
  if (!role) return json({ error: "You don't have access to this workspace." }, 403);
  if (role !== "owner" && role !== "admin") {
    return json({ error: "Only owners and admins can manage billing." }, 403);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();
  const customer = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!customer) return json({ error: "No billing account yet — choose a plan first." }, 400);

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const origin = body.origin || req.headers.get("origin") || "";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/admin`,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not open the billing portal." }, 502);
  }
});
