import { supabase } from "./supabase";

export type PlanId = "starter" | "growth" | "scale";

export type Plan = {
  id: PlanId;
  name: string;
  price: number; // USD / month
  tagline: string;
  features: string[];
  popular?: boolean;
};

// Kept in sync with the PLANS map in supabase/functions/create-checkout/index.ts.
export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    tagline: "For solo operators getting organised.",
    features: ["Core modules (CRM, analytics, advisor)", "1 seat", "100 AI messages / month", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 79,
    tagline: "For growing teams that run on data.",
    popular: true,
    features: ["Everything in Starter", "All modules incl. commerce pack", "5 seats", "Unlimited AI", "Priority support"],
  },
  {
    id: "scale",
    name: "Scale",
    price: 199,
    tagline: "For established businesses at scale.",
    features: ["Everything in Growth", "20 seats", "Priority AI + advanced analytics", "Dedicated onboarding"],
  },
];

export function planById(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

// ── Plan limits (single source of truth for gating) ──────────────────────
// `admin` is always allowed so users can always reach Billing to upgrade.
const PLAN_CORE_MODULES = ["dashboard", "crm", "team", "analytics", "advisor", "automation", "admin"];
const PLAN_COMMERCE_MODULES = ["orders", "inventory", "suppliers", "growth"];

export type PlanLimits = {
  label: string;
  modules: string[];
  seats: number;
  aiMonthly: number | null; // null = unlimited
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  trial: { label: "Trial", modules: PLAN_CORE_MODULES, seats: 1, aiMonthly: 25 },
  starter: { label: "Starter", modules: PLAN_CORE_MODULES, seats: 1, aiMonthly: 100 },
  growth: { label: "Growth", modules: [...PLAN_CORE_MODULES, ...PLAN_COMMERCE_MODULES], seats: 5, aiMonthly: null },
  scale: { label: "Scale", modules: [...PLAN_CORE_MODULES, ...PLAN_COMMERCE_MODULES], seats: 20, aiMonthly: null },
};

/** The limits for a plan id, falling back to the trial tier. */
export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? "trial"] ?? PLAN_LIMITS.trial;
}

/** Is a module included in this plan? */
export function moduleInPlan(plan: string | null | undefined, module: string): boolean {
  return planLimits(plan).modules.includes(module);
}

/** Current YYYY-MM period key (UTC) used for monthly AI metering. */
export function usagePeriod(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** This org's AI messages used in the current month (RLS-scoped to members). */
export async function getAiUsage(orgId: string): Promise<number> {
  const { data } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("org_id", orgId)
    .eq("period", usagePeriod())
    .maybeSingle();
  return (data as { count?: number } | null)?.count ?? 0;
}

export type SubscriptionRow = {
  org_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
};

/** The current org's subscription, if any (RLS-scoped to members). */
export async function getSubscription(orgId: string): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("org_id,plan,status,current_period_end,stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

/** Open Stripe Checkout for a plan and redirect the browser to it. */
export async function startCheckout(plan: PlanId, orgId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { plan, orgId, origin: window.location.origin },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error as string);
  const url = data?.url as string | undefined;
  if (!url) throw new Error("Stripe did not return a checkout URL.");
  window.location.href = url;
}
