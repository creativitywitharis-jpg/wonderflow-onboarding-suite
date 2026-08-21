import { supabase } from "./supabase";
import { listCustomers } from "./customers";
import { getLoyaltySettings, issueRewardCodes, listRewardCodes } from "./loyalty";

// Order roll-up — the engine that turns a static CRM into a living one. When an
// order arrives (logged in-app, imported, or received from a connected website),
// it's matched to a customer and folded into their running totals: orders + 1 and
// LTV += order total. That in turn drives loyalty points, grades, reward codes,
// segmentation and insights — all off real transactions.
//
// Matching order of preference: explicit customer_id → email → exact name.
// Batches are aggregated per customer first, so importing many orders applies one
// clean update each (no read-modify-write races).

export type RollupOrder = {
  customer_id?: string | null;
  customer_name?: string | null;
  email?: string | null;
  total?: number | null;
};

export type RollupResult = { customersUpdated: number; codesIssued: number };

export async function rollUpOrders(orgId: string, orders: RollupOrder[]): Promise<RollupResult> {
  const rows = orders.filter(Boolean);
  if (rows.length === 0) return { customersUpdated: 0, codesIssued: 0 };

  const customers = await listCustomers(orgId).catch(() => []);
  if (customers.length === 0) return { customersUpdated: 0, codesIssued: 0 };

  const byId = new Map(customers.map((c) => [c.id, c]));
  const byEmail = new Map(customers.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));
  const byName = new Map(customers.map((c) => [c.name.toLowerCase(), c]));

  // Aggregate deltas per matched customer.
  const deltas = new Map<string, { ltv: number; orders: number }>();
  for (const o of rows) {
    const match =
      (o.customer_id && byId.get(o.customer_id)) ||
      (o.email && byEmail.get(o.email.toLowerCase())) ||
      (o.customer_name && byName.get(o.customer_name.toLowerCase())) ||
      null;
    if (!match) continue;
    const d = deltas.get(match.id) ?? { ltv: 0, orders: 0 };
    d.ltv += Number(o.total || 0);
    d.orders += 1;
    deltas.set(match.id, d);
  }
  if (deltas.size === 0) return { customersUpdated: 0, codesIssued: 0 };

  // Apply one update per customer; collect new LTVs for reward issuance.
  const affected: { id: string; name: string; ltv: number }[] = [];
  await Promise.all(
    [...deltas.entries()].map(async ([id, d]) => {
      const c = byId.get(id)!;
      const newLtv = Number(c.ltv || 0) + d.ltv;
      const newOrders = Number(c.orders || 0) + d.orders;
      const { error } = await supabase.from("customers").update({ ltv: newLtv, orders: newOrders }).eq("id", id);
      if (!error) affected.push({ id, name: c.name, ltv: newLtv });
    }),
  );
  if (affected.length === 0) return { customersUpdated: 0, codesIssued: 0 };

  // Auto-issue any loyalty codes the new points unlock, per THIS org's program
  // (skips entirely if the business has loyalty turned off). Fails soft if unmigrated.
  const settings = await getLoyaltySettings(orgId);
  if (!settings.enabled) return { customersUpdated: affected.length, codesIssued: 0 };
  const affectedIds = new Set(affected.map((a) => a.id));
  const existing = (await listRewardCodes(orgId)).filter((rc) => affectedIds.has(rc.customer_id));
  const { issued } = await issueRewardCodes(orgId, affected, existing, settings);

  return { customersUpdated: affected.length, codesIssued: issued };
}

/** Convenience: roll up a single order. */
export function rollUpOrder(orgId: string, order: RollupOrder): Promise<RollupResult> {
  return rollUpOrders(orgId, [order]);
}
