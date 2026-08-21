import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  DollarSign,
  FileText,
  Home,
  Landmark,
  PieChart,
  Plus,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Donut, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useOrg } from "@/lib/org-context";
import { listCustomers } from "@/lib/customers";
import { fireAutomationEvent } from "@/lib/automations";
import { rollUpOrder } from "@/lib/rollup";
import {
  createExpense,
  createInvoice,
  insertExpenses,
  insertInvoices,
  isOverdue,
  listExpenses,
  listInvoices,
  setInvoiceStatus,
  type DbExpense,
  type DbInvoice,
  type InvoiceStatus,
  type NewExpense,
  type NewInvoice,
} from "@/lib/finance";

const GOLD = "oklch(0.84 0.14 84)";
const PALETTE = [GOLD, "oklch(0.7 0.11 60)", "oklch(0.66 0.09 200)", "oklch(0.75 0.13 150)", "oklch(0.62 0.12 300)"];

const invStatusColor: Record<string, string> = {
  draft: "oklch(0.7 0.02 250)",
  sent: "oklch(0.66 0.09 200)",
  paid: "oklch(0.72 0.14 155)",
  void: "oklch(0.6 0.02 260)",
  overdue: "oklch(0.68 0.16 25)",
};

const FIN_INPUT = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

type ViewKey = "overview" | "invoices" | "expenses" | "pnl";
const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "pnl", label: "Profit & loss", icon: PieChart },
];

const thisMonth = (iso: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth();
};

/* ── Provider ─────────────────────────────────────────────────────────── */

type FinState = {
  invoices: DbInvoice[];
  expenses: DbExpense[];
  customers: { id: string; name: string }[];
  loading: boolean;
  addInvoice: (inv: NewInvoice) => Promise<void>;
  setStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  addExpense: (e: NewExpense) => Promise<void>;
  seed: () => Promise<void>;
};
const FinCtx = createContext<FinState | null>(null);
function useFin() {
  const ctx = useContext(FinCtx);
  if (!ctx) throw new Error("useFin must be used within FinanceProvider");
  return ctx;
}

function FinanceProvider({ children }: { children: ReactNode }) {
  const { org } = useOrg();
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [expenses, setExpenses] = useState<DbExpense[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) {
      setInvoices([]);
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [inv, exp, cust] = await Promise.all([listInvoices(org.id), listExpenses(org.id), listCustomers(org.id)]);
      setInvoices(inv);
      setExpenses(exp);
      setCustomers(cust.map((c) => ({ id: c.id, name: c.name })));
    } catch {
      setInvoices([]);
      setExpenses([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const addInvoice = useCallback(
    async (inv: NewInvoice) => {
      if (!org) return;
      await createInvoice(org.id, inv);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );
  const setStatus = useCallback(
    async (id: string, status: InvoiceStatus) => {
      await setInvoiceStatus(id, status);
      if (status === "paid" && org) {
        const inv = invoices.find((i) => i.id === id);
        // A paid invoice is a services business's "purchase" — roll it up into
        // the client's LTV + order count (cascades to loyalty and segmentation).
        if (inv) {
          await rollUpOrder(org.id, {
            customer_id: inv.customer_id,
            customer_name: inv.customer_name,
            total: Number(inv.total),
          });
        }
        void fireAutomationEvent(org.id, "invoice.paid", {
          invoice_id: id,
          number: inv?.number ?? null,
          customer_name: inv?.customer_name ?? null,
          total: inv ? Number(inv.total) : null,
        });
      }
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, invoices, load],
  );
  const addExpense = useCallback(
    async (e: NewExpense) => {
      if (!org) return;
      await createExpense(org.id, e);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );
  const seed = useCallback(
    async () => {
      if (!org) return;
      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const plus = (days: number) => iso(new Date(today.getTime() + days * 86400000));
      await insertInvoices(org.id, [
        { customer_name: "Ava Chen", status: "paid", amount: 2400, tax: 0, issue_date: plus(-20), due_date: plus(-6) },
        { customer_name: "Northwind Co", status: "sent", amount: 1800, tax: 144, issue_date: plus(-12), due_date: plus(-2) },
        { customer_name: "Brightloom", status: "sent", amount: 3200, tax: 0, issue_date: plus(-4), due_date: plus(10) },
        { customer_name: "Solstice", status: "draft", amount: 950, tax: 0, issue_date: plus(0), due_date: plus(14) },
      ]);
      await insertExpenses(org.id, [
        { vendor: "Lumen Labs", category: "Supplies", amount: 820, date: plus(-15), status: "paid" },
        { vendor: "Meta Ads", category: "Marketing", amount: 640, date: plus(-9), status: "paid" },
        { vendor: "Payroll", category: "Payroll", amount: 4200, date: plus(-3), status: "paid" },
        { vendor: "Freight Co", category: "Operations", amount: 310, date: plus(-1), status: "pending" },
      ]);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );

  return <FinCtx.Provider value={{ invoices, expenses, customers, loading, addInvoice, setStatus, addExpense, seed }}>{children}</FinCtx.Provider>;
}

/* ── Shared bits ──────────────────────────────────────────────────────── */

function StatusBadge({ inv }: { inv: DbInvoice }) {
  const label = isOverdue(inv) ? "overdue" : inv.status;
  const color = invStatusColor[label] ?? GOLD;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium capitalize" style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────── */

function OverviewView() {
  const { invoices, expenses } = useFin();
  const outstanding = invoices.filter((i) => i.status === "sent").reduce((a, i) => a + Number(i.total), 0);
  const overdue = invoices.filter(isOverdue);
  const overdueTotal = overdue.reduce((a, i) => a + Number(i.total), 0);
  const revenuePaid = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.total), 0);
  const expTotal = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const net = revenuePaid - expTotal;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Outstanding (AR)" value={outstanding} prefix="$" icon={Wallet} />
        <StatTile label="Revenue collected" value={revenuePaid} prefix="$" icon={TrendingUp} />
        <StatTile label="Expenses" value={expTotal} prefix="$" icon={TrendingDown} />
        <StatTile label="Net profit" value={net} prefix="$" positive={net >= 0} icon={DollarSign} />
      </div>

      {overdue.length > 0 && (
        <Reveal>
          <GlassCard className="flex flex-wrap items-center justify-between gap-3 border-rose-400/25 p-5">
            <p className="flex items-center gap-2 text-sm text-foreground/90">
              <span className="grid size-8 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10"><FileText className="size-4 text-rose-300" /></span>
              <span><span className="font-semibold text-rose-200">{overdue.length}</span> overdue invoice{overdue.length === 1 ? "" : "s"} worth <span className="font-semibold text-gold">${formatNum(overdueTotal)}</span> — worth chasing today.</span>
            </p>
          </GlassCard>
        </Reveal>
      )}

      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={FileText}>Recent invoices</SectionLabel>
          <div className="mt-4 space-y-1">
            {invoices.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</p>}
            {invoices.slice(0, 6).map((i) => (
              <div key={i.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl px-3 py-3 hover:bg-glass sm:grid-cols-[auto_1.4fr_1fr_auto]">
                <span className="font-mono text-xs text-muted-foreground">{i.number}</span>
                <div className="flex items-center gap-3">
                  <Avatar name={i.customer_name ?? "Customer"} />
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{i.customer_name ?? "Customer"}</p><p className="text-xs text-muted-foreground">{i.due_date ? `due ${i.due_date}` : "no due date"}</p></div>
                </div>
                <div className="hidden sm:block"><StatusBadge inv={i} /></div>
                <span className="text-right text-sm font-semibold tabular-nums text-gold">${formatNum(Number(i.total))}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

/* ── Invoices ─────────────────────────────────────────────────────────── */

const INV_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

function InvoicesView() {
  const { invoices, customers, loading, addInvoice, setStatus, seed } = useFin();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ customer: "", amount: "", tax: "", due: "" });

  const submit = async () => {
    if (!form.customer.trim() || busy) return;
    setBusy(true);
    const cust = customers.find((c) => c.id === form.customer);
    await addInvoice({
      customer_id: cust?.id ?? null,
      customer_name: cust?.name ?? form.customer.trim(),
      amount: Number(form.amount) || 0,
      tax: Number(form.tax) || 0,
      due_date: form.due || null,
      status: "sent",
    });
    setBusy(false);
    setForm({ customer: "", amount: "", tax: "", due: "" });
    setAdding(false);
  };

  if (!loading && invoices.length === 0 && !adding) {
    return (
      <Reveal>
        <GlassCard className="p-8 text-center sm:p-10">
          <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><FileText className="size-6" stroke="oklch(0.2 0.02 70)" /></span>
          <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No invoices yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Bill your customers and track what you're owed. Create your first invoice, or drop in a sample set.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={async () => { setBusy(true); await seed(); setBusy(false); }} disabled={busy} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}><Sparkles className="size-4" /> {busy ? "Adding…" : "Add sample data"}</button>
            <button onClick={() => setAdding(true)} className="rounded-full border border-border bg-glass px-5 py-2.5 text-sm text-foreground/85 hover:border-gold/40">New invoice</button>
          </div>
        </GlassCard>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <SectionLabel icon={FileText}>Invoices</SectionLabel>
          <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><Plus className="size-4" stroke="oklch(0.2 0.02 70)" /> New invoice</button>
        </div>

        {adding && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block uppercase tracking-wide text-muted-foreground">Customer</span>
              {customers.length > 0 ? (
                <select value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} className={FIN_INPUT}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <input value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} placeholder="Customer name" className={FIN_INPUT} />
              )}
            </label>
            <label className="text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Due date</span><input type="date" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} className={FIN_INPUT} /></label>
            <label className="text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Amount</span><input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={FIN_INPUT} /></label>
            <label className="text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Tax</span><input type="number" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} placeholder="0.00" className={FIN_INPUT} /></label>
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={submit} disabled={busy || !form.customer.trim()} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Saving…" : "Create & send"}</button>
              <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-1">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
          {invoices.map((i) => (
            <div key={i.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 hover:border-gold/20 hover:bg-glass sm:grid-cols-[auto_1.4fr_1fr_0.8fr_auto]">
              <span className="font-mono text-xs text-muted-foreground">{i.number}</span>
              <div className="flex items-center gap-3">
                <Avatar name={i.customer_name ?? "Customer"} />
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{i.customer_name ?? "Customer"}</p><p className="text-xs text-muted-foreground">{i.due_date ? `due ${i.due_date}` : "—"}</p></div>
              </div>
              <div className="hidden sm:block"><StatusBadge inv={i} /></div>
              <select value={i.status} onChange={(e) => setStatus(i.id, e.target.value as InvoiceStatus)} className="hidden rounded-lg border border-border bg-background/40 px-2 py-1 text-xs text-foreground outline-none focus:border-gold/50 sm:block">
                {INV_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
              <span className="text-right text-sm font-semibold tabular-nums text-gold">${formatNum(Number(i.total))}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

/* ── Expenses ─────────────────────────────────────────────────────────── */

const EXP_CATEGORIES = ["Supplies", "Marketing", "Payroll", "Operations", "Software", "Rent", "Other"];

function ExpensesView() {
  const { expenses, loading, addExpense, seed } = useFin();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ vendor: "", category: "Supplies", amount: "", date: "" });

  const submit = async () => {
    if (!form.vendor.trim() || busy) return;
    setBusy(true);
    await addExpense({ vendor: form.vendor.trim(), category: form.category, amount: Number(form.amount) || 0, date: form.date || undefined, status: "paid" });
    setBusy(false);
    setForm({ vendor: "", category: "Supplies", amount: "", date: "" });
    setAdding(false);
  };

  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Receipt}>Expenses</SectionLabel>
          <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><Plus className="size-4" stroke="oklch(0.2 0.02 70)" /> Add expense</button>
        </div>

        {adding && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
            <input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Vendor / description *" className={FIN_INPUT} />
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={FIN_INPUT}>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount" className={FIN_INPUT} />
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={FIN_INPUT} />
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={submit} disabled={busy || !form.vendor.trim()} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Saving…" : "Save expense"}</button>
              <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-1">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && expenses.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No expenses logged yet.</p>
              <button onClick={async () => { setBusy(true); await seed(); setBusy(false); }} disabled={busy} className="mt-3 rounded-full border border-border bg-glass px-4 py-2 text-xs text-foreground/85 hover:border-gold/40">Add sample data</button>
            </div>
          )}
          {expenses.map((e) => (
            <div key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl px-3 py-3 hover:bg-glass sm:grid-cols-[1.4fr_1fr_0.8fr_auto]">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{e.vendor}</p><p className="text-xs text-muted-foreground">{e.date}</p></div>
              <span className="hidden text-xs text-muted-foreground sm:block">{e.category}</span>
              <span className="hidden text-xs capitalize sm:block" style={{ color: e.status === "paid" ? "oklch(0.72 0.14 155)" : "oklch(0.84 0.14 84)" }}>{e.status}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-foreground/90">${formatNum(Number(e.amount))}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

/* ── P&L ──────────────────────────────────────────────────────────────── */

function PnlView() {
  const { invoices, expenses } = useFin();
  const revenue = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.total), 0);
  const expTotal = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const net = revenue - expTotal;
  const margin = revenue ? Math.round((net / revenue) * 100) : 0;

  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(e.category ?? "Other", (byCat.get(e.category ?? "Other") ?? 0) + Number(e.amount));
  const expenseCats = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, v], i) => ({ label, value: v, share: expTotal ? Math.round((v / expTotal) * 100) : 0, color: PALETTE[i % PALETTE.length] }));

  const revThisMonth = invoices.filter((i) => i.status === "paid" && thisMonth(i.paid_at)).reduce((a, i) => a + Number(i.total), 0);
  const expThisMonth = expenses.filter((e) => thisMonth(e.date)).reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue" value={revenue} prefix="$" icon={TrendingUp} />
        <StatTile label="Expenses" value={expTotal} prefix="$" icon={TrendingDown} />
        <StatTile label="Net profit" value={net} prefix="$" positive={net >= 0} icon={DollarSign} />
        <StatTile label="Net margin" value={margin} suffix="%" positive={margin >= 0} icon={PieChart} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Landmark}>This month</SectionLabel>
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex justify-between text-sm"><span className="text-foreground/85">Revenue collected</span><span className="tabular-nums text-gold">${formatNum(revThisMonth)}</span></div>
                <div className="mt-1.5"><Bar value={revThisMonth + expThisMonth ? (revThisMonth / (revThisMonth + expThisMonth)) * 100 : 0} tone="gold" /></div>
              </div>
              <div>
                <div className="flex justify-between text-sm"><span className="text-foreground/85">Expenses</span><span className="tabular-nums text-foreground/70">${formatNum(expThisMonth)}</span></div>
                <div className="mt-1.5"><Bar value={revThisMonth + expThisMonth ? (expThisMonth / (revThisMonth + expThisMonth)) * 100 : 0} tone="muted" /></div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between text-base font-semibold"><span>Net this month</span><span className="tabular-nums" style={{ color: revThisMonth - expThisMonth >= 0 ? "oklch(0.72 0.14 155)" : "oklch(0.68 0.16 25)" }}>${formatNum(revThisMonth - expThisMonth)}</span></div>
              </div>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={PieChart}>Expenses by category</SectionLabel>
            {expenseCats.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">Log expenses to see where the money goes.</p>
            ) : (
              <div className="mt-4 flex items-center gap-6">
                <Donut data={expenseCats} center={<div><div className="text-lg font-semibold tabular-nums gold-text">${formatNum(expTotal)}</div><div className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">total</div></div>} />
                <ul className="min-w-0 flex-1 space-y-2">
                  {expenseCats.map((s) => (
                    <li key={s.label} className="flex items-center gap-2 text-sm">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 truncate text-foreground/85">{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">{s.share}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

/* ── Workspace shell ──────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: "Finance", sub: "Cash, invoices and profit at a glance" },
  invoices: { title: "Invoices", sub: "Bill customers and track what you're owed" },
  expenses: { title: "Expenses", sub: "Every cost, categorized" },
  pnl: { title: "Profit & loss", sub: "Revenue minus expenses, for real" },
};

export function FinanceWorkspace() {
  const [active, setActive] = useState<ViewKey>("overview");
  const meta = viewMeta[active];
  return (
    <FinanceProvider>
      <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
        <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
          <Brand subtle />
          <p className="mt-6 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Finance</p>
          <nav className="mt-2 space-y-1">
            {views.map((v) => (
              <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
                <v.icon className={cn("size-4", active === v.key && "text-gold")} />
                {v.label}
              </button>
            ))}
          </nav>
          <Link to="/dashboard" className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground"><ArrowLeft className="size-4" /> Command center</Link>
        </aside>

        <section className="min-w-0 flex-1 space-y-5">
          <div className="rise flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{meta.sub}</p>
              <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}><span className="gold-text italic">{meta.title}</span></h1>
            </div>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {views.map((v) => (
              <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
                <v.icon className="size-3.5" />
                {v.label}
              </button>
            ))}
          </div>

          <div key={active} className="rise">
            {active === "overview" && <OverviewView />}
            {active === "invoices" && <InvoicesView />}
            {active === "expenses" && <ExpensesView />}
            {active === "pnl" && <PnlView />}
          </div>
        </section>
      </div>
    </FinanceProvider>
  );
}
