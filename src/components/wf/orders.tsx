import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  Home,
  LayoutGrid,
  MapPin,
  Minus,
  Package,
  PackageCheck,
  Plus,
  Receipt,
  Search,
  Send,
  Sparkles,
  Store,
  Truck,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";
import { useOrg } from "@/lib/org-context";
import { listCustomers, type DbCustomer } from "@/lib/customers";
import { listProducts, type DbProduct } from "@/lib/products";
import {
  createOrder,
  insertOrders,
  listOrders,
  updateOrderStatus,
  type DbOrder,
  type NewOrder,
  type OrderItem,
  type OrderStatus,
} from "@/lib/orders";
import { CsvImport } from "@/components/wf/CsvImport";
import type { FieldSpec } from "@/lib/csv";
import { fireAutomationEvent } from "@/lib/automations";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey =
  | "overview"
  | "pipeline"
  | "details"
  | "create"
  | "fulfillment"
  | "delivery"
  | "analytics";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Command center", icon: Home },
  { key: "pipeline", label: "Live pipeline", icon: LayoutGrid },
  { key: "details", label: "Order details", icon: Receipt },
  { key: "create", label: "AI create order", icon: Wand2 },
  { key: "fulfillment", label: "Fulfillment", icon: PackageCheck },
  { key: "delivery", label: "Delivery tracking", icon: Truck },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

const GOLD = "oklch(0.84 0.14 84)";

const STAGES = ["New", "Paid", "Processing", "Packed", "Shipped", "Delivered"] as const;
type Stage = (typeof STAGES)[number];

const stageColor: Record<string, string> = {
  New: "oklch(0.7 0.02 250)",
  Paid: "oklch(0.66 0.09 200)",
  Processing: "oklch(0.75 0.13 90)",
  Packed: "oklch(0.72 0.12 65)",
  Shipped: "oklch(0.7 0.11 150)",
  Delivered: "oklch(0.72 0.14 155)",
  Cancelled: "oklch(0.6 0.02 20)",
};

/** The next fulfillment stage, or null at the end / for cancelled orders. */
function nextStage(stage: OrderStatus): OrderStatus | null {
  const i = (STAGES as readonly string[]).indexOf(stage);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1];
}

type UiOrder = {
  id: string; // real db id — key, lookup, mutations
  number: string; // display order number
  customer: string;
  items: number;
  total: number;
  stage: OrderStatus;
  channel: string;
  placed: string;
  priority: "High" | "Normal";
  city: string;
  eta: string;
  lineItems: OrderItem[];
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function toUi(o: DbOrder): UiOrder {
  return {
    id: o.id,
    number: o.number ?? `#${o.id.slice(0, 5)}`,
    customer: o.customer_name ?? "Guest",
    items: o.item_count,
    total: Number(o.total),
    stage: o.status,
    channel: o.channel ?? "Online store",
    placed: timeAgo(o.created_at),
    priority: o.priority,
    city: o.city ?? "—",
    eta: o.eta ?? "—",
    lineItems: Array.isArray(o.items) ? o.items : [],
  };
}

type OrdersState = {
  orders: UiOrder[];
  customers: DbCustomer[];
  products: DbProduct[];
  loading: boolean;
  addOrder: (o: NewOrder) => Promise<void>;
  importOrders: (rows: NewOrder[]) => Promise<{ error: Error | null }>;
  advance: (id: string, status: OrderStatus) => Promise<void>;
  seed: () => Promise<void>;
};
const OrdersCtx = createContext<OrdersState | null>(null);
function useOrdersData() {
  const ctx = useContext(OrdersCtx);
  if (!ctx) throw new Error("useOrdersData must be used within OrdersProvider");
  return ctx;
}

function OrdersProvider({ children }: { children: ReactNode }) {
  const { org } = useOrg();
  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) {
      setOrders([]);
      setCustomers([]);
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [os, cs, ps] = await Promise.all([listOrders(org.id), listCustomers(org.id), listProducts(org.id)]);
      setOrders(os.map(toUi));
      setCustomers(cs);
      setProducts(ps);
    } catch {
      setOrders([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addOrder = useCallback(
    async (o: NewOrder) => {
      if (!org) return;
      const { data } = await createOrder(org.id, o);
      await load();
      if (data) {
        void fireAutomationEvent(org.id, "order.created", {
          order_id: data.id,
          number: data.number,
          total: data.total,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );

  const advance = useCallback(async (id: string, status: OrderStatus) => {
    await updateOrderStatus(id, status);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, stage: status } : o)));
  }, []);

  const seed = useCallback(
    async () => {
      if (!org) return;
      await insertOrders(org.id, sampleOrders(customers));
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, customers, load],
  );

  const importOrders = useCallback(
    async (rows: NewOrder[]) => {
      if (!org) return { error: new Error("No active workspace.") };
      const { error } = await insertOrders(org.id, rows);
      await load();
      return { error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );

  return (
    <OrdersCtx.Provider value={{ orders, customers, products, loading, addOrder, importOrders, advance, seed }}>
      {children}
    </OrdersCtx.Provider>
  );
}

// Sample orders for the empty-state seed — link to real customers when present.
function sampleOrders(customers: DbCustomer[]): NewOrder[] {
  const link = (i: number, fallback: string) =>
    customers.length
      ? { customer_id: customers[i % customers.length].id, customer_name: customers[i % customers.length].name }
      : { customer_name: fallback };
  const rows: { stage: OrderStatus; total: number; items: number; channel: string; city: string; priority: "High" | "Normal"; fb: string; li: OrderItem[] }[] = [
    { stage: "Processing", total: 248, items: 3, channel: "Online store", city: "Austin, TX", priority: "High", fb: "Ava Chen", li: [{ name: "Aurora Serum", qty: 2, price: 68 }, { name: "Dew Mist", qty: 1, price: 28 }] },
    { stage: "New", total: 89, items: 1, channel: "Social", city: "Denver, CO", priority: "Normal", fb: "Leo Park", li: [{ name: "Midnight Oil", qty: 1, price: 54 }] },
    { stage: "Packed", total: 512, items: 5, channel: "Online store", city: "Seattle, WA", priority: "High", fb: "Noah Reed", li: [{ name: "Golden Hour Balm", qty: 3, price: 42 }] },
    { stage: "Paid", total: 164, items: 2, channel: "Marketplace", city: "Miami, FL", priority: "Normal", fb: "Mara Silva", li: [{ name: "Silk Cleanser", qty: 2, price: 36 }] },
    { stage: "Shipped", total: 327, items: 4, channel: "Online store", city: "Chicago, IL", priority: "Normal", fb: "Ivy Zhou", li: [{ name: "Radiance Mask", qty: 4, price: 48 }] },
    { stage: "Delivered", total: 142, items: 2, channel: "POS", city: "Boston, MA", priority: "Normal", fb: "Sam Idris", li: [{ name: "Dew Mist", qty: 2, price: 28 }] },
  ];
  return rows.map((r, i) => ({
    ...link(i, r.fb),
    status: r.stage,
    total: r.total,
    item_count: r.items,
    channel: r.channel,
    city: r.city,
    priority: r.priority,
    items: r.li,
    eta: "—",
  }));
}

const products = [
  { id: "p1", name: "Aurora Serum", price: 68, tag: "Bestseller" },
  { id: "p2", name: "Midnight Oil", price: 54, tag: "Popular" },
  { id: "p3", name: "Golden Hour Balm", price: 42, tag: "New" },
  { id: "p4", name: "Silk Cleanser", price: 36, tag: "" },
  { id: "p5", name: "Radiance Mask", price: 48, tag: "" },
  { id: "p6", name: "Dew Mist", price: 28, tag: "" },
];

const revenueSeries = [42, 48, 45, 58, 54, 66, 72, 68, 81, 77, 89, 96];

/* ──────────────────────────────────────────────────────────────────────
 * Viz primitives (orders-specific)
 * ─────────────────────────────────────────────────────────────────── */

function StagePill({ stage }: { stage: OrderStatus }) {
  const color = stageColor[stage] ?? GOLD;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium"
      style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {stage}
    </span>
  );
}

/** Animated vertical bar chart. */
function BarChart({ data, height = 160 }: { data: number[]; height?: number }) {
  const { ref, inView } = useInView();
  const max = Math.max(...data);
  return (
    <div ref={ref} className="flex items-end gap-2" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col justify-end">
          <div
            className="rounded-t-md transition-all duration-700 ease-out"
            style={{
              height: inView ? `${(v / max) * 100}%` : "0%",
              transitionDelay: `${i * 45}ms`,
              background: i === data.length - 1 ? "var(--gradient-gold)" : "oklch(0.84 0.14 84 / 22%)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** Horizontal status tracker for order / delivery progress. */
function StatusTracker({ steps, active }: { steps: string[]; active: number }) {
  const { ref, inView } = useInView();
  const pct = steps.length > 1 ? (active / (steps.length - 1)) * 100 : 0;
  return (
    <div ref={ref} className="relative">
      <div className="absolute left-0 right-0 top-3 h-0.5 bg-border" />
      <div
        className="absolute left-0 top-3 h-0.5 transition-all duration-1000 ease-out"
        style={{ width: inView ? `${pct}%` : "0%", background: "var(--gradient-gold)" }}
      />
      <div className="relative flex justify-between">
        {steps.map((s, i) => {
          const done = i <= active;
          return (
            <div key={s} className="flex flex-col items-center gap-2" style={{ flex: "0 0 auto" }}>
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border text-[0.6rem] transition-colors",
                  done ? "border-transparent text-primary-foreground" : "border-border bg-background text-muted-foreground",
                )}
                style={done ? { background: "var(--gradient-gold)" } : undefined}
              >
                {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("text-[0.65rem]", done ? "text-foreground" : "text-muted-foreground")}>
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

const ORDER_IMPORT_FIELDS: FieldSpec[] = [
  { key: "customer_name", label: "Customer", aliases: ["customer", "client", "name", "customer name", "buyer"] },
  { key: "number", label: "Order #", aliases: ["order", "order number", "order id", "reference"] },
  { key: "status", label: "Status", enum: ["New", "Paid", "Processing", "Packed", "Shipped", "Delivered", "Cancelled"], aliases: ["stage", "state"] },
  { key: "channel", label: "Channel", aliases: ["source", "sales channel"] },
  { key: "city", label: "City", aliases: ["location", "town"] },
  { key: "total", label: "Total", type: "number", required: true, aliases: ["amount", "order total", "revenue", "value", "grand total"] },
  { key: "item_count", label: "Items", type: "number", aliases: ["items", "quantity", "qty", "units", "line items"] },
  { key: "eta", label: "ETA", aliases: ["delivery", "expected", "eta date"] },
];

function OverviewView({ onOpen }: { onOpen: (id: string) => void }) {
  const { org } = useOrg();
  const { orders, loading, seed, importOrders } = useOrdersData();
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const importer = importing && org ? (
    <CsvImport entityLabel="orders" fields={ORDER_IMPORT_FIELDS} orgId={org.id} onImport={(rows) => importOrders(rows as NewOrder[])} onClose={() => setImporting(false)} />
  ) : null;
  const total = orders.length;
  const revenue = orders.reduce((a, o) => a + o.total, 0);
  const aov = total ? Math.round(revenue / total) : 0;
  const delivered = orders.filter((o) => o.stage === "Delivered").length;
  const fulfillRate = total ? Math.round((delivered / total) * 100) : 0;
  const attention = orders
    .filter((o) => o.priority === "High" && o.stage !== "Delivered" && o.stage !== "Cancelled")
    .slice(0, 3);

  if (!loading && total === 0) {
    return (
      <Reveal>
        <GlassCard className="p-8 text-center sm:p-10">
          <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
            <Package className="size-6" stroke="oklch(0.2 0.02 70)" />
          </span>
          <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No orders yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Create your first order, or drop in a sample set to explore the pipeline, fulfillment and analytics.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={async () => { setBusy(true); await seed(); setBusy(false); }}
              disabled={busy}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
            >
              <Sparkles className="size-4" /> {busy ? "Adding…" : "Add sample orders"}
            </button>
            <button onClick={() => setImporting(true)} className="rounded-full border border-border bg-glass px-5 py-2.5 text-sm text-foreground/85 transition-colors hover:border-gold/40">
              Import CSV
            </button>
          </div>
        </GlassCard>
        {importer}
      </Reveal>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total orders" value={total} icon={Package} />
        <StatTile label="Total revenue" value={revenue} prefix="$" icon={CreditCard} />
        <StatTile label="Avg order value" value={aov} prefix="$" decimals={0} icon={Receipt} />
        <StatTile label="Fulfillment rate" value={fulfillRate} suffix="%" icon={PackageCheck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                <Bot className="size-5" stroke="oklch(0.2 0.02 70)" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Operations briefing</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">
                  {total} order{total === 1 ? "" : "s"} worth <span className="text-gold">${formatNum(revenue)}</span>.{" "}
                  {attention.length > 0
                    ? `${attention.length} high-priority order${attention.length === 1 ? "" : "s"} still need fulfilling.`
                    : "No high-priority orders are waiting — you're on top of it."}
                </p>
              </div>
            </div>
            <div className="relative mt-5 space-y-2">
              {attention.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onOpen(o.id)}
                  className="lift flex w-full items-center gap-3 rounded-2xl border border-border bg-background/30 p-3 text-left hover:border-gold/40"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-glass">
                    <AlertTriangle className="size-4 text-gold" />
                  </span>
                  <span className="flex-1 text-sm text-foreground/85">{o.number} · {o.customer} — {o.stage}</span>
                  <span className="shrink-0 text-xs text-gold">${formatNum(o.total)}</span>
                </button>
              ))}
              {attention.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
              )}
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={LayoutGrid}>Orders by stage</SectionLabel>
            <div className="mt-5 space-y-4">
              {STAGES.map((s) => {
                const count = orders.filter((o) => o.stage === s).length;
                const pct = orders.length ? (count / orders.length) * 100 : 0;
                return (
                  <div key={s}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="flex items-center gap-2 text-foreground/85">
                        <span className="size-2 rounded-full" style={{ background: stageColor[s] }} />
                        {s}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{count}</span>
                    </div>
                    <div className="mt-1.5">
                      <Bar value={pct} />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Receipt}>Recent orders</SectionLabel>
            <button onClick={() => setImporting(true)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:border-gold/40">Import CSV</button>
          </div>
          <div className="mt-4 space-y-1">
            {orders.slice(0, 6).map((o) => (
              <button
                key={o.id}
                onClick={() => onOpen(o.id)}
                className="lift grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left hover:border-gold/30 hover:bg-glass sm:grid-cols-[auto_1.4fr_1fr_0.8fr_auto]"
              >
                <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
                <div className="flex items-center gap-3">
                  <Avatar name={o.customer} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{o.customer}</p>
                    <p className="truncate text-xs text-muted-foreground">{o.items} items · {o.channel}</p>
                  </div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{o.placed}</span>
                <div className="hidden sm:block"><StagePill stage={o.stage} /></div>
                <span className="text-right text-sm font-semibold tabular-nums text-gold">${formatNum(o.total)}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>
      {importer}
    </div>
  );
}

function PipelineView({ onOpen }: { onOpen: (id: string) => void }) {
  const { orders, advance } = useOrdersData();
  return (
    <Reveal>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-4">
          {STAGES.map((stage) => {
            const col = orders.filter((o) => o.stage === stage);
            return (
              <div key={stage} className="w-64 shrink-0">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-2 rounded-full" style={{ background: stageColor[stage] }} />
                    {stage}
                  </span>
                  <span className="rounded-full bg-glass px-2 py-0.5 text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-3">
                  {col.map((o) => {
                    const next = nextStage(o.stage);
                    return (
                      <div
                        key={o.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpen(o.id)}
                        onKeyDown={(e) => { if (e.key === "Enter") onOpen(o.id); }}
                        className="lift block w-full cursor-pointer rounded-2xl border border-border bg-background/40 p-4 text-left hover:border-gold/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
                          {o.priority === "High" && (
                            <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-medium text-gold" style={{ background: "oklch(0.84 0.14 84 / 12%)" }}>
                              Priority
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2.5">
                          <Avatar name={o.customer} className="size-7 text-[0.6rem]" />
                          <span className="truncate text-sm font-medium text-foreground">{o.customer}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{o.items} items</span>
                          <span className="text-sm font-semibold tabular-nums text-gold">${formatNum(o.total)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1 text-[0.7rem] text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="size-3" /> {o.placed}</span>
                          {next && (
                            <button
                              onClick={(e) => { e.stopPropagation(); void advance(o.id, next); }}
                              className="flex items-center gap-1 rounded-full border border-border bg-glass px-2 py-0.5 text-[0.65rem] text-foreground/80 transition-colors hover:border-gold/50 hover:text-gold"
                            >
                              {next} <ArrowRight className="size-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {col.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

function DetailsView({ orderId }: { orderId: string }) {
  const { orders, advance } = useOrdersData();
  const o = orders.find((x) => x.id === orderId) ?? orders[0];
  if (!o) {
    return (
      <Reveal>
        <GlassCard className="p-10 text-center text-sm text-muted-foreground">
          Create an order first — its details will appear here.
        </GlassCard>
      </Reveal>
    );
  }
  const activeStage = STAGES.indexOf(o.stage as Stage);
  const lineItems = o.lineItems.length ? o.lineItems : [{ name: `Order ${o.number}`, qty: o.items || 1, price: o.total }];
  const subtotal = lineItems.reduce((a, l) => a + l.qty * l.price, 0);
  const next = nextStage(o.stage);

  return (
    <div className="space-y-4">
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-foreground">{o.number}</span>
              <StagePill stage={o.stage} />
            </div>
            <div className="flex gap-2">
              {next ? (
                <button onClick={() => void advance(o.id, next)} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
                  <PackageCheck className="size-3.5" /> Advance to {next}
                </button>
              ) : (
                <span className="rounded-full border border-gold/30 bg-glass px-4 py-2 text-xs text-foreground/70">
                  {o.stage === "Cancelled" ? "Cancelled" : "Completed"}
                </span>
              )}
              {o.stage !== "Delivered" && o.stage !== "Cancelled" && (
                <button onClick={() => void advance(o.id, "Cancelled")} className="rounded-full border border-border bg-glass px-4 py-2 text-xs text-foreground/80 hover:border-rose-400/50 hover:text-rose-300">Cancel</button>
              )}
            </div>
          </div>
          <div className="mt-6">
            <StatusTracker steps={[...STAGES]} active={activeStage} />
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Package}>Items</SectionLabel>
            <div className="mt-4 space-y-2">
              {lineItems.map((l) => (
                <div key={l.name} className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-3">
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-glass">
                    <Package className="size-4 text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground/90">{l.name}</p>
                    <p className="text-xs text-muted-foreground">Qty {l.qty}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">${formatNum(l.qty * l.price)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Items subtotal</span>
                <span className="tabular-nums">${formatNum(subtotal)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Order total</span>
                <span className="tabular-nums text-gold">${formatNum(o.total)}</span>
              </div>
            </div>
          </GlassCard>
        </Reveal>

        <div className="space-y-4">
          <Reveal>
            <GlassCard className="glass-strong relative overflow-hidden p-6">
              <div className="veil pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative flex items-start gap-3">
                <span className="orb grid size-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                  <Brain className="size-4" stroke="oklch(0.2 0.02 70)" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Order intelligence</p>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/85">
                    <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-emerald-400" /> Fraud risk: low (score 4/100)</li>
                    <li className="flex items-center gap-2"><Truck className="size-3.5 text-gold" /> Predicted delivery: {o.eta}</li>
                    <li className="flex items-center gap-2"><Zap className="size-3.5 text-gold" /> Upsell: Dew Mist, bought with this 61% of the time</li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </Reveal>

          <Reveal delay={80}>
            <GlassCard className="p-6">
              <SectionLabel icon={Users}>Customer</SectionLabel>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={o.customer} />
                <div>
                  <p className="text-sm font-medium text-foreground">{o.customer}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" /> {o.city}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/30 p-3 text-xs text-muted-foreground">
                <CreditCard className="size-3.5 text-gold" /> Paid · Visa •••• 4242 · {o.channel}
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function CreateView() {
  const { customers, addOrder, products: dbProducts } = useOrdersData();
  const catalog = dbProducts.length
    ? dbProducts.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), tag: "" }))
    : products;
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const remove = (id: string) =>
    setCart((c) => {
      const n = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
  const total = useMemo(
    () => Object.entries(cart).reduce((a, [id, q]) => a + (catalog.find((p) => p.id === id)?.price ?? 0) * q, 0),
    [cart, catalog],
  );
  const count = Object.values(cart).reduce((a, q) => a + q, 0);

  const submit = async () => {
    if (count === 0 || busy) return;
    setBusy(true);
    const items: OrderItem[] = Object.entries(cart).map(([id, q]) => {
      const p = catalog.find((x) => x.id === id)!;
      return { name: p.name, qty: q, price: p.price };
    });
    const matched = customers.find((c) => c.name.toLowerCase() === customer.trim().toLowerCase());
    await addOrder({
      customer_name: customer.trim() || "Guest",
      customer_id: matched?.id ?? null,
      channel: "Online store",
      total,
      item_count: count,
      items,
      status: "New",
    });
    setBusy(false);
    setDone(true);
    setCart({});
    setCustomer("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <Reveal>
          <GlassCard className="glass-strong relative overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                <Wand2 className="size-5" stroke="oklch(0.2 0.02 70)" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">AI order assistant</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  Building an order{customer ? <> for <span className="text-gold">{customer}</span></> : ""}. Add
                  items from your catalog — top sellers are one tap away.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {catalog.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => add(p.id)}
                      className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-glass px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:border-gold/60"
                    >
                      <Plus className="size-3 text-gold" /> {p.name} · ${p.price}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal delay={60}>
          <GlassCard className="p-6">
            <SectionLabel icon={Package}>Product catalog</SectionLabel>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {catalog.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-3">
                  <span className="grid size-10 place-items-center rounded-xl border border-border bg-glass">
                    <Package className="size-4 text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">${p.price}{p.tag && <span className="ml-2 text-gold">{p.tag}</span>}</p>
                  </div>
                  <button
                    onClick={() => add(p.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-glass text-foreground/80 transition-colors hover:border-gold/50 hover:text-gold"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>

      {/* live order summary */}
      <Reveal delay={100}>
        <GlassCard className="glass-strong sticky top-6 p-6">
          <SectionLabel icon={Receipt}>Order summary</SectionLabel>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Customer</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                list="wf-customer-list"
                placeholder="Customer name"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
              <datalist id="wf-customer-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </label>

          <div className="mt-4 space-y-2">
            {Object.entries(cart).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No items yet — add from the catalog.</p>
            )}
            {Object.entries(cart).map(([id, q]) => {
              const p = catalog.find((x) => x.id === id)!;
              return (
                <div key={id} className="flex items-center gap-2 rounded-xl border border-border bg-background/30 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground/90">{p.name}</p>
                    <p className="text-xs text-muted-foreground">${p.price} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => remove(id)} className="grid size-6 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"><Minus className="size-3" /></button>
                    <span className="w-5 text-center text-sm tabular-nums">{q}</span>
                    <button onClick={() => add(id)} className="grid size-6 place-items-center rounded-full border border-border text-muted-foreground hover:text-gold"><Plus className="size-3" /></button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Items</span><span className="tabular-nums">{count}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums text-gold">${formatNum(total)}</span></div>
          </div>
          <button
            onClick={submit}
            disabled={count === 0 || busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
          >
            <Sparkles className="size-4" /> {busy ? "Creating…" : "Create order"}
          </button>
          {done && (
            <p className="mt-3 text-center text-xs text-emerald-300">
              Order created — find it in the pipeline &amp; command center.
            </p>
          )}
        </GlassCard>
      </Reveal>
    </div>
  );
}

function FulfillmentView() {
  const { orders, advance } = useOrdersData();
  const queue = orders.filter((o) => ["Paid", "Processing", "Packed"].includes(o.stage));
  const toPick = orders.filter((o) => o.stage === "Paid").length;
  const toPack = orders.filter((o) => o.stage === "Processing").length;
  const toShip = orders.filter((o) => o.stage === "Packed").length;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="To pick" value={toPick} icon={Package} />
        <StatTile label="To pack" value={toPack} icon={PackageCheck} />
        <StatTile label="To ship" value={toShip} icon={Truck} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={PackageCheck}>Fulfillment queue</SectionLabel>
            <span className="text-xs text-muted-foreground">{queue.length} in queue</span>
          </div>
          <div className="mt-4 space-y-2">
            {queue.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing to fulfill right now.</p>
            )}
            {queue.map((o) => {
              const next = nextStage(o.stage);
              return (
                <div key={o.id} className="flex items-center gap-4 rounded-2xl border border-border bg-background/30 p-3">
                  <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={o.customer} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{o.customer}</p>
                      <p className="text-xs text-muted-foreground">{o.items} items · {o.city}</p>
                    </div>
                  </div>
                  <StagePill stage={o.stage} />
                  <span className="hidden w-24 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
                    <Clock className="size-3" /> {o.placed}
                  </span>
                  {next && (
                    <button onClick={() => void advance(o.id, next)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
                      → {next}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function DeliveryView() {
  const steps = ["Ordered", "Packed", "Shipped", "Out for delivery", "Delivered"];
  const shipments = [
    { id: "#10426", customer: "Noah Reed", carrier: "FedEx", active: 2, eta: "Aug 5", city: "Seattle, WA" },
    { id: "#10424", customer: "Ivy Zhou", carrier: "UPS", active: 3, eta: "Today, 6 PM", city: "Chicago, IL" },
    { id: "#10421", customer: "Dane Ford", carrier: "DHL", active: 2, eta: "Aug 5", city: "Portland, OR" },
    { id: "#10422", customer: "Sam Idris", carrier: "USPS", active: 4, eta: "Delivered", city: "Boston, MA" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="In transit" value={38} icon={Truck} />
        <StatTile label="Out for delivery" value={12} icon={MapPin} />
        <StatTile label="On-time rate" value={96} suffix="%" delta="1.4 pts" icon={CheckCircle2} />
      </div>
      {shipments.map((s, i) => (
        <Reveal key={s.id} delay={i * 60}>
          <GlassCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={s.customer} />
                <div>
                  <p className="text-sm font-medium text-foreground">{s.customer} <span className="font-mono text-xs text-muted-foreground">{s.id}</span></p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Truck className="size-3" /> {s.carrier} · <MapPin className="size-3" /> {s.city}</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-glass px-3 py-1 text-xs text-gold"><Clock className="size-3" /> ETA {s.eta}</span>
            </div>
            <div className="mt-6">
              <StatusTracker steps={steps} active={s.active} />
            </div>
          </GlassCard>
        </Reveal>
      ))}
    </div>
  );
}

function AnalyticsView() {
  const { orders } = useOrdersData();
  const revenue = orders.reduce((a, o) => a + o.total, 0);
  const totalOrders = orders.length;
  const aov = totalOrders ? Math.round(revenue / totalOrders) : 0;
  const delivered = orders.filter((o) => o.stage === "Delivered").length;
  const fulfillRate = totalOrders ? Math.round((delivered / totalOrders) * 100) : 0;

  const chanMeta: Record<string, { color: string; icon: LucideIcon }> = {
    "Online store": { color: GOLD, icon: Globe },
    POS: { color: "oklch(0.7 0.11 60)", icon: Store },
    Marketplace: { color: "oklch(0.66 0.09 200)", icon: LayoutGrid },
    Social: { color: "oklch(0.75 0.13 150)", icon: Users },
  };
  const chanCount: Record<string, number> = {};
  for (const o of orders) chanCount[o.channel] = (chanCount[o.channel] ?? 0) + 1;
  const channelRows = Object.entries(chanCount)
    .map(([label, n]) => ({ label, share: totalOrders ? Math.round((n / totalOrders) * 100) : 0, ...(chanMeta[label] ?? { color: GOLD, icon: Globe }) }))
    .sort((a, b) => b.share - a.share);

  const prodAgg: Record<string, { sold: number; revenue: number }> = {};
  for (const o of orders) {
    for (const it of o.lineItems) {
      const k = it.name;
      if (!prodAgg[k]) prodAgg[k] = { sold: 0, revenue: 0 };
      prodAgg[k].sold += it.qty;
      prodAgg[k].revenue += it.qty * it.price;
    }
  }
  const topProds = Object.entries(prodAgg)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total revenue" value={revenue} prefix="$" icon={CreditCard} />
        <StatTile label="Total orders" value={totalOrders} icon={Package} />
        <StatTile label="Avg order value" value={aov} prefix="$" icon={Receipt} />
        <StatTile label="Fulfillment rate" value={fulfillRate} suffix="%" icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="flex items-baseline justify-between">
              <SectionLabel icon={BarChart3}>Revenue trend</SectionLabel>
              <span className="text-xs text-muted-foreground">Illustrative</span>
            </div>
            <div className="mt-6">
              <BarChart data={revenueSeries} />
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Globe}>Orders by channel</SectionLabel>
            <div className="mt-5 space-y-4">
              {channelRows.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
              {channelRows.map((c) => (
                <div key={c.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground/85">
                      <c.icon className="size-3.5" style={{ color: c.color }} /> {c.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{c.share}%</span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={c.share} />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={BarChart3}>Top products</SectionLabel>
          <div className="mt-4 space-y-1">
            {topProds.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No product sales yet.</p>}
            {topProds.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-glass"><Package className="size-4 text-gold" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatNum(p.sold)} sold</p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-gold">${formatNum(p.revenue)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: "Order command center", sub: "Your intelligent operations manager" },
  pipeline: { title: "Live order pipeline", sub: "Every order, in motion" },
  details: { title: "Order intelligence", sub: "A 360° view of the order" },
  create: { title: "AI order assistant", sub: "Create an order in seconds" },
  fulfillment: { title: "Fulfillment", sub: "Pick, pack and ship on time" },
  delivery: { title: "Delivery tracking", sub: "Every shipment, tracked live" },
  analytics: { title: "Order analytics", sub: "Where the commerce is trending" },
};

export function OrdersWorkspace() {
  const [active, setActive] = useState<ViewKey>("overview");
  const [orderId, setOrderId] = useState("");
  const meta = viewMeta[active];

  const openOrder = (id: string) => {
    setOrderId(id);
    setActive("details");
  };

  return (
    <OrdersProvider>
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Orders</p>
        <nav className="mt-2 space-y-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground",
              )}
              style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
            >
              <v.icon className={cn("size-4", active === v.key && "text-gold")} />
              {v.label}
            </button>
          ))}
        </nav>
        <Link
          to="/dashboard"
          className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Command center
        </Link>
      </aside>

      <section className="min-w-0 flex-1 space-y-5">
        <div className="rise flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{meta.sub}</p>
            <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              <span className="gold-text italic">{meta.title}</span>
            </h1>
          </div>
          <button
            onClick={() => setActive("create")}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
          >
            <Plus className="size-4" stroke="oklch(0.2 0.02 70)" /> New order
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground",
              )}
              style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        <div key={active} className="rise">
          {active === "overview" && <OverviewView onOpen={openOrder} />}
          {active === "pipeline" && <PipelineView onOpen={openOrder} />}
          {active === "details" && <DetailsView orderId={orderId} />}
          {active === "create" && <CreateView />}
          {active === "fulfillment" && <FulfillmentView />}
          {active === "delivery" && <DeliveryView />}
          {active === "analytics" && <AnalyticsView />}
        </div>
      </section>
    </div>
    </OrdersProvider>
  );
}
