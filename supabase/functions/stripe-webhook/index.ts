// WonderFlow OS — Stripe webhook.
// Receives subscription lifecycle events from Stripe and mirrors them into the
// `subscriptions` table (+ organizations.plan). Called by Stripe, not the app,
// so verify_jwt = false and we verify the Stripe signature instead.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(
  Deno.env.get("STRIPE_SECRET_KEY") ?? Deno.env.get("STRIPE_TEST_API_KEY") ?? "",
  {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
  },
);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Map a Stripe subscription to our billing row and persist it.
async function upsertFromSubscription(sub: Stripe.Subscription, plan: string, orgId: string) {
  if (!orgId) {
    console.error("[stripe-webhook] no org_id in metadata — cannot link subscription", sub.id);
    throw new Error("Missing org_id in subscription/session metadata.");
  }
  const status = sub.status; // active | trialing | past_due | canceled | incomplete | ...
  // `current_period_end` lives on the subscription in older API versions and on
  // the subscription item in newer ones (2025-03-31.basil+). Read either.
  const s = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const periodEndUnix = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  const { error: subErr } = await admin.from("subscriptions").upsert(
    {
      org_id: orgId,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      stripe_subscription_id: sub.id,
      plan,
      status,
      current_period_end: periodEnd,
    },
    { onConflict: "org_id" },
  );
  if (subErr) {
    console.error("[stripe-webhook] subscriptions upsert failed:", subErr.message);
    throw new Error(`subscriptions upsert failed: ${subErr.message}`);
  }

  // Mirror the effective plan onto the org for quick reads / gating.
  const effectivePlan = status === "active" || status === "trialing" ? plan : "trial";
  const { error: orgErr } = await admin.from("organizations").update({ plan: effectivePlan }).eq("id", orgId);
  if (orgErr) {
    console.error("[stripe-webhook] organizations update failed:", orgErr.message);
    throw new Error(`organizations update failed: ${orgErr.message}`);
  }
  console.log(`[stripe-webhook] org ${orgId} → plan '${effectivePlan}' (${status})`);
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) {
    return new Response("Webhook not configured.", { status: 400 });
  }

  const bodyText = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      bodyText,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    return new Response(`Signature verification failed: ${e instanceof Error ? e.message : e}`, {
      status: 400,
    });
  }

  console.log(`[stripe-webhook] received: ${event.type}`);
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id ?? session.client_reference_id ?? "";
        const plan = session.metadata?.plan;
        // No plan metadata means this session wasn't created by our own
        // create-checkout (which always sets it) — e.g. a synthetic test
        // event sent from the Stripe dashboard. Guessing "starter" here
        // previously mis-set real orgs to a paid tier they never chose.
        if (plan && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertFromSubscription(sub, plan, orgId);
        } else if (!plan) {
          console.log("[stripe-webhook] checkout.session.completed with no plan metadata — ignoring", session.id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.org_id ?? "";
        const plan = sub.metadata?.plan;
        if (plan) await upsertFromSubscription(sub, plan, orgId);
        else console.log("[stripe-webhook] subscription event with no plan metadata — ignoring", sub.id);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.org_id ?? "";
        if (orgId) {
          await admin
            .from("subscriptions")
            .update({ status: "canceled", plan: "trial" })
            .eq("org_id", orgId);
          await admin.from("organizations").update({ plan: "trial" }).eq("id", orgId);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    return new Response(`Handler error: ${e instanceof Error ? e.message : e}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
