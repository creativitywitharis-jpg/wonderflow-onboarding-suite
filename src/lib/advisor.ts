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

export type Sev = "High" | "Medium" | "Low";
export type Risk = { title: string; category: string; severity: Sev; likelihood: number; trend: "up" | "down" | "flat"; mitigation: string };

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

/** Surface real risks from the org's data + a portfolio risk score (higher = riskier). */
export async function buildRisks(orgId: string): Promise<{ risks: Risk[]; score: number; high: number }> {
  const [customers, invoices, expenses] = await Promise.all([
    listCustomers(orgId).catch(() => []),
    listInvoices(orgId).catch(() => []),
    listExpenses(orgId).catch(() => []),
  ]);

  const risks: Risk[] = [];
  const totalLtv = customers.reduce((a, c) => a + Number(c.ltv || 0), 0);
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.total || 0), 0);
  const unpaidAmt = invoices.filter((i) => i.status === "sent").reduce((a, i) => a + Number(i.total || 0), 0);
  const expTotal = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);

  // Customer concentration.
  if (customers.length === 1) {
    risks.push({ title: "Single-customer concentration — 100% of value in one client", category: "Revenue", severity: "High", likelihood: 80, trend: "flat", mitigation: "Add 3–5 more clients" });
  } else if (customers.length > 1 && totalLtv > 0) {
    const top = Math.max(...customers.map((c) => Number(c.ltv || 0)));
    const share = Math.round((top / totalLtv) * 100);
    if (share >= 40) risks.push({ title: `Customer concentration — top client = ${share}% of value`, category: "Revenue", severity: share >= 60 ? "High" : "Medium", likelihood: share, trend: "flat", mitigation: "Diversify acquisition" });
  }

  // Overdue invoices.
  const now = Date.now();
  const overdue = invoices.filter((i) => i.status === "sent" && i.due_date && new Date(i.due_date).getTime() < now);
  if (overdue.length > 0) {
    const amt = overdue.reduce((a, i) => a + Number(i.total || 0), 0);
    risks.push({ title: `${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"} — $${fmt(amt)} late`, category: "Cash flow", severity: amt > 1000 ? "High" : "Medium", likelihood: 70, trend: "up", mitigation: "Send payment reminders" });
  }

  // Low collection rate.
  const collRate = paidTotal + unpaidAmt > 0 ? Math.round((paidTotal / (paidTotal + unpaidAmt)) * 100) : 100;
  if (collRate < 70 && unpaidAmt > 0) {
    risks.push({ title: `Low collection rate — only ${collRate}% of billings collected`, category: "Cash flow", severity: "Medium", likelihood: 100 - collRate, trend: "flat", mitigation: "Tighten payment terms" });
  }

  // At-risk revenue.
  const atRisk = customers.filter((c) => c.tier === "At risk" || Number(c.health) < 50);
  if (atRisk.length > 0) {
    const atRiskLtv = atRisk.reduce((a, c) => a + Number(c.ltv || 0), 0);
    const share = totalLtv > 0 ? Math.round((atRiskLtv / totalLtv) * 100) : 0;
    risks.push({ title: `${atRisk.length} at-risk customer${atRisk.length === 1 ? "" : "s"} — $${fmt(atRiskLtv)} of value slipping`, category: "Retention", severity: share >= 30 ? "High" : "Medium", likelihood: 60, trend: "up", mitigation: "Proactive check-ins" });
  }

  // Cash position.
  if (expTotal > paidTotal && (paidTotal > 0 || expTotal > 0)) {
    risks.push({ title: `Expenses exceed collected revenue — $${fmt(expTotal)} vs $${fmt(paidTotal)}`, category: "Cash flow", severity: "High", likelihood: 75, trend: "up", mitigation: "Cut costs or accelerate billing" });
  }

  // Thin book.
  if (customers.length > 1 && customers.length < 5) {
    risks.push({ title: `Thin customer base — only ${customers.length} customers`, category: "Growth", severity: "Medium", likelihood: 50, trend: "flat", mitigation: "Build a lead pipeline" });
  }

  const weight: Record<Sev, number> = { High: 30, Medium: 15, Low: 5 };
  const score = Math.min(100, risks.reduce((a, r) => a + weight[r.severity], 0)) || 5;
  const high = risks.filter((r) => r.severity === "High").length;
  return { risks, score, high };
}
