import { listCustomers } from "./customers";
import { listProducts } from "./products";
import { listInvoices } from "./finance";

// "Today's insights" — real, prioritized signals derived from the org's own
// data (customers, inventory, invoices). Each source fails soft, so a workspace
// that hasn't set up a module simply contributes no insights from it. Returns at
// most 3, most-urgent first; an empty array means "nothing to surface yet".

export type Insight = { text: string; tone: "up" | "warn" };

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export async function buildInsights(orgId: string): Promise<Insight[]> {
  const [customers, products, invoices] = await Promise.all([
    listCustomers(orgId).catch(() => []),
    listProducts(orgId).catch(() => []),
    listInvoices(orgId).catch(() => []),
  ]);

  const out: Insight[] = [];

  // 1 — Low stock (operationally urgent).
  const low = products.filter((p) => Number(p.stock) <= Number(p.reorder_point));
  if (low.length > 0) {
    const lowest = [...low].sort((a, b) => Number(a.stock) - Number(b.stock))[0];
    out.push({
      tone: "warn",
      text:
        low.length === 1
          ? `${lowest.name} is at or below its reorder point — time to restock.`
          : `${low.length} products are at or below reorder point (incl. ${lowest.name}).`,
    });
  }

  // 2 — Cash you're owed.
  const unpaid = invoices.filter((i) => i.status === "sent");
  if (unpaid.length > 0) {
    const total = unpaid.reduce((a, i) => a + Number(i.total || 0), 0);
    out.push({
      tone: "warn",
      text: `$${fmt(total)} outstanding across ${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}.`,
    });
  }

  // 3 — Customers slipping.
  const atRisk = customers.filter((c) => c.tier === "At risk" || Number(c.health) < 50);
  if (atRisk.length > 0 && out.length < 3) {
    out.push({
      tone: "warn",
      text: `${atRisk.length} customer${atRisk.length === 1 ? "" : "s"} slipping — health under 50. A check-in would help.`,
    });
  }

  // 4 — Revenue collected this month.
  const period = new Date().toISOString().slice(0, 7);
  const paid = invoices.filter((i) => i.status === "paid" && (i.paid_at ?? "").slice(0, 7) === period);
  if (paid.length > 0 && out.length < 3) {
    const rev = paid.reduce((a, i) => a + Number(i.total || 0), 0);
    out.push({
      tone: "up",
      text: `$${fmt(rev)} collected this month across ${paid.length} paid invoice${paid.length === 1 ? "" : "s"}.`,
    });
  }

  // 5 — Upsell-ready accounts.
  const upsell = customers.filter((c) => (c.tier === "Champion" || c.tier === "Loyal") && Number(c.health) >= 70);
  if (upsell.length > 0 && out.length < 3) {
    const ltv = upsell.reduce((a, c) => a + Number(c.ltv || 0), 0);
    out.push({
      tone: "up",
      text: `${upsell.length} loyal account${upsell.length === 1 ? "" : "s"} primed for an upsell ($${fmt(ltv)} in LTV).`,
    });
  }

  // 6 — Portfolio summary (fallback so an active CRM never looks empty).
  if (out.length < 3 && customers.length > 0) {
    const ltv = customers.reduce((a, c) => a + Number(c.ltv || 0), 0);
    out.push({
      tone: "up",
      text: `Tracking ${fmt(customers.length)} customer${customers.length === 1 ? "" : "s"} worth $${fmt(ltv)} in lifetime value.`,
    });
  }

  return out.slice(0, 3);
}
