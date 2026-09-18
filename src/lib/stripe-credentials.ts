import { supabase } from "./supabase";

// Ships in migration 0052 — reach the table untyped until Lovable regenerates DB types.
const table = () => (supabase as unknown as { from: (t: string) => any }).from("stripe_credentials");

/** Whether this org has its own Stripe key saved. Never fetches the key itself. */
export async function hasStripeKey(orgId: string): Promise<boolean> {
  const { data, error } = await table().select("org_id").eq("org_id", orgId).maybeSingle();
  if (error) return false;
  return !!data;
}

/** Save (or replace) the org's own Stripe secret key. Owner/admin only, per RLS. */
export async function saveStripeKey(orgId: string, secretKey: string) {
  const { error } = await table().upsert({ org_id: orgId, secret_key: secretKey.trim(), updated_at: new Date().toISOString() });
  return { error: error ? new Error(error.message) : null };
}

/** Remove the org's stored Stripe key. */
export async function removeStripeKey(orgId: string) {
  const { error } = await table().delete().eq("org_id", orgId);
  return { error: error ? new Error(error.message) : null };
}
