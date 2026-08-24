import { listCustomers } from "./customers";
import { listInvoices, listExpenses } from "./finance";

// Data-driven business intelligence for the AI Advisor. Rule-based (like the
// segmentation + loyalty engines) so every opportunity/risk is grounded in the
// org's real numbers, deterministic, and free — not an AI guess.

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export type Conf = "High" | "Medium" | "Low";
export type Effort = "Low" | "Medium" | "High";

export type Opportunity = { title: string; category: string; value: string; conf: Conf; effort: Effort };
export const OPP_CATEGORIES = ["All", "Revenue", "Retention", "Cost", "Growth"];

/** Surface real growth/retention/cost opportunities from the org's own data. */
export async function buildOpportunities(orgId: string): Promise<Opportunity[]> {
  const [customers, invoices, expenses] = await Promise.all([
    listCustomers(orgId).catch(() => []),
    listInvoices(orgId).catch(() => []),
    listExpenses(orgId).catch(() => []),
  ]);

  const out: Opportunity[] = [];

  const unpaid = invoices.filter((i) => i.status === "sent");
  const outstanding = unpaid.reduce((a, i) => a + Number(i.total || 0), 0);
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.total || 0), 0);
  const expTotal = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);

  // Collect cash you're already owed — the fastest money.
  if (outstanding > 0) {
    out.push({ title: `Collect ${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`, category: "Revenue", value: `+$${fmt(outstanding)} now`, conf: "High", effort: "Low" });
  }

  // Upsell loyal, engaged accounts.
  const upsell = customers.filter((c) => (c.tier === "Champion" || c.tier === "Loyal") && Number(c.health) >= 70);
  if (upsell.length > 0) {
    out.push({ title: `Upsell ${upsell.length} loyal account${upsell.length === 1 ? "" : "s"}`, category: "Revenue", value: `$${fmt(upsell.reduce((a, c) => a + Number(c.ltv || 0), 0))} in play`, conf: "High", effort: "Medium" });
  }

  // Win back customers who are slipping.
  const atRisk = customers.filter((c) => c.tier === "At risk" || Number(c.health) < 50);
  if (atRisk.length > 0) {
    out.push({ title: `Win back ${atRisk.length} slipping customer${atRisk.length === 1 ? "" : "s"}`, category: "Retention", value: `$${fmt(atRisk.reduce((a, c) => a + Number(c.ltv || 0), 0))} at risk`, conf: "Medium", effort: "Low" });
  }

  // Reactivate dormant relationships.
  const dormant = customers.filter((c) => c.tier === "Dormant");
  if (dormant.length > 0) {
    out.push({ title: `Reactivate ${dormant.length} dormant customer${dormant.length === 1 ? "" : "s"}`, category: "Retention", value: `$${fmt(dormant.reduce((a, c) => a + Number(c.ltv || 0), 0))} lifetime value`, conf: "Medium", effort: "Low" });
  }

  // Convert contacts who've never bought.
  const noOrder = customers.filter((c) => Number(c.orders) === 0);
  if (noOrder.length > 0) {
    out.push({ title: `Convert ${noOrder.length} contact${noOrder.length === 1 ? "" : "s"} who haven't bought yet`, category: "Growth", value: `${noOrder.length} warm lead${noOrder.length === 1 ? "" : "s"}`, conf: "Medium", effort: "Medium" });
  }

  // Collections discipline.
  const collRate = paidTotal + outstanding > 0 ? Math.round((paidTotal / (paidTotal + outstanding)) * 100) : 100;
  if (collRate < 80 && outstanding > 0) {
    out.push({ title: `Tighten collections — only ${collRate}% collected`, category: "Cost", value: `unlock $${fmt(outstanding)}`, conf: "High", effort: "Low" });
  }

  // Expense ratio watch.
  if (paidTotal > 0 && expTotal / paidTotal > 0.4) {
    out.push({ title: `Review expenses — ${Math.round((expTotal / paidTotal) * 100)}% of revenue`, category: "Cost", value: `$${fmt(expTotal)} / period`, conf: "Medium", effort: "Medium" });
  }

  // Concentration / thin book.
  if (customers.length > 0 && customers.length < 10) {
    out.push({ title: `Grow beyond ${customers.length} customer${customers.length === 1 ? "" : "s"} — reduce concentration`, category: "Growth", value: "diversify revenue", conf: "High", effort: "High" });
  }

  return out;
}
