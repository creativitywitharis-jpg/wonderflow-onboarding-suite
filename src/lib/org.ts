import { supabase } from "./supabase";

const ACTIVE_ORG_KEY = "wf-active-org";

// The fixed industry list offered at onboarding and in Business settings —
// shared so both stay in exact sync with COMMERCE_INDUSTRIES below.
export const INDUSTRIES = [
  "E-commerce",
  "Retail",
  "Professional services",
  "SaaS / Software",
  "Finance & banking",
  "Healthcare",
  "Manufacturing",
  "Hospitality",
  "Real estate",
  "Education",
  "Logistics & transport",
  "Media & marketing",
  "Nonprofit",
  "Construction",
];

// Industry → which modules light up. Commerce businesses get the full pack;
// everyone gets the universal core. This is the "any industry" strategy.
const COMMERCE_INDUSTRIES = ["E-commerce", "Retail", "Manufacturing", "Hospitality"];
const CORE_MODULES = ["dashboard", "crm", "finance", "team", "analytics", "advisor", "automation"];
const COMMERCE_MODULES = ["orders", "inventory", "suppliers", "growth"];

export function enabledModulesFor(industry?: string): string[] {
  const commerce = !!industry && COMMERCE_INDUSTRIES.includes(industry);
  return commerce ? [...CORE_MODULES, ...COMMERCE_MODULES] : CORE_MODULES;
}

export type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  enabled_modules: string[];
  plan: string;
  health_score: number;
  created_by: string | null;
  timezone: string;
  currency: string;
  ai_model: string;
};

const ORG_COLS = "id,name,slug,industry,enabled_modules,plan,health_score,created_by,timezone,currency,ai_model";

// timezone/currency/ai_model ship in migrations 0038/0040 and aren't in the
// generated Database types until Lovable regenerates them — reach the table
// untyped. Runtime behaviour is unchanged once types regenerate.
const orgTable = () => (supabase as unknown as { from: (t: string) => any }).from("organizations");

export function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ORG_KEY);
}

export function setActiveOrgId(id: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_ORG_KEY, id);
}

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "org";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Create a new organization owned by the current user (becomes its owner via DB trigger). */
export async function createOrganization(input: {
  name: string;
  industry?: string;
  enabledModules?: string[];
}): Promise<{ data: OrgRow | null; error: Error | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { data: null, error: new Error("You must be signed in to create a workspace.") };

  const slug = slugify(input.name);
  // Insert without asking for the row back — the owner membership is created by
  // a trigger, so the row isn't yet SELECT-visible in the same statement.
  const { error } = await orgTable().insert({
    name: input.name.trim(),
    slug,
    industry: input.industry ?? null,
    enabled_modules: input.enabledModules ?? enabledModulesFor(input.industry),
    created_by: user.id,
  });
  if (error) return { data: null, error: new Error(error.message) };

  // Read it back by its unique slug (membership now exists → RLS allows the read).
  const { data } = await orgTable().select(ORG_COLS).eq("slug", slug).single();
  const org = (data as OrgRow | null) ?? null;
  if (org) setActiveOrgId(org.id);
  return { data: org, error: null };
}

/** Update an organization (owner/admin only, enforced by RLS). */
export async function updateOrganization(
  orgId: string,
  patch: Partial<Pick<OrgRow, "name" | "industry" | "health_score" | "timezone" | "currency" | "enabled_modules" | "ai_model">>,
): Promise<{ error: Error | null }> {
  const { error } = await orgTable().update(patch).eq("id", orgId);
  return { error: error ? new Error(error.message) : null };
}

/**
 * Leave a business — removes the caller's own membership, and only their
 * own. Blocked for owners (would leave the business with no one able to
 * manage it) — the RPC raises in that case.
 */
export async function leaveOrganization(orgId: string): Promise<{ error: Error | null }> {
  // Ships in migration 0042 — not in the generated RPC union type until
  // Lovable regenerates it.
  const { error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> })
    .rpc("leave_organization", { p_org_id: orgId });
  return { error: error ? new Error(error.message) : null };
}

/** Every organization the current user is a member of (RLS-scoped). */
export async function getMyOrgs(): Promise<OrgRow[]> {
  const { data } = await orgTable()
    .select(ORG_COLS)
    .order("created_at", { ascending: true });
  return (data as OrgRow[]) ?? [];
}

/** The active org (from localStorage), falling back to the user's first org. */
export async function getActiveOrg(): Promise<OrgRow | null> {
  const orgs = await getMyOrgs();
  if (orgs.length === 0) return null;
  const activeId = getActiveOrgId();
  const active = orgs.find((o) => o.id === activeId);
  if (active) return active;
  setActiveOrgId(orgs[0].id);
  return orgs[0];
}
