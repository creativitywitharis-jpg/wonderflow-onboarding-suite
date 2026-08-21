import { supabase } from "./supabase";

// Rule-based (RFM-style) customer tiering. Classifies each customer from their
// real signals — lifetime value, order frequency, and health (engagement/recency
// proxy) — relative to the rest of the org's book, so it works for any business
// size. Deterministic, instant, and free (no AI tokens).

export type Tier = "Champion" | "Loyal" | "Potential" | "New" | "At risk" | "Dormant";

type Signals = { ltv: number; orders: number; health: number };
export type SegmentContext = { ltvP50: number; ltvP80: number };

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const i = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[i];
}

/** Value thresholds derived from the org's own customers (relative, not absolute). */
export function segmentContext(customers: { ltv: number }[]): SegmentContext {
  const ltvs = customers.map((c) => Number(c.ltv) || 0).sort((a, b) => a - b);
  return { ltvP50: percentile(ltvs, 50), ltvP80: percentile(ltvs, 80) };
}

/** Assign a tier from a customer's signals. Order matters: risk/dormant first. */
export function classifyTier(c: Signals, ctx: SegmentContext): Tier {
  const health = Number(c.health) || 0;
  const orders = Number(c.orders) || 0;
  const ltv = Number(c.ltv) || 0;

  if (health < 30) return "Dormant"; // disengaged for a while
  if (health < 50) return "At risk"; // slipping — needs attention
  if (orders <= 2 && ltv <= ctx.ltvP50) return "New"; // barely started
  if (ltv > 0 && ltv >= ctx.ltvP80 && health >= 70) return "Champion"; // top value + engaged
  if (health >= 60 && orders >= 3 && ltv >= ctx.ltvP50) return "Loyal"; // steady repeat buyer
  return "Potential"; // trending, not there yet
}

/** Re-classify every customer and persist any tier changes. Returns how many moved. */
export async function resegmentCustomers(
  customers: { id: string; ltv: number; orders: number; health: number; tier: string }[],
): Promise<{ changed: number; total: number }> {
  const ctx = segmentContext(customers);
  const updates = customers
    .map((c) => ({ id: c.id, next: classifyTier(c, ctx), prev: c.tier }))
    .filter((u) => u.next !== u.prev);
  await Promise.all(updates.map((u) => supabase.from("customers").update({ tier: u.next }).eq("id", u.id)));
  return { changed: updates.length, total: customers.length };
}
