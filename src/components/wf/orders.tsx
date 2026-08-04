import { useMemo, useState } from "react";
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
import { Avatar, Bar, Delta, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";

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

const stageColor: Record<Stage, string> = {
  New: "oklch(0.7 0.02 250)",
  Paid: "oklch(0.66 0.09 200)",
  Processing: "oklch(0.75 0.13 90)",
  Packed: "oklch(0.72 0.12 65)",
  Shipped: "oklch(0.7 0.11 150)",
  Delivered: "oklch(0.72 0.14 155)",
};

type Order = {
  id: string;
  customer: string;
  items: number;
  total: number;
  stage: Stage;
  channel: "Online store" | "POS" | "Marketplace" | "Social";
  placed: string;
  priority: "High" | "Normal";
  city: string;
  eta: string;
};

const orders: Order[] = [
  { id: "#10428", customer: "Ava Chen", items: 3, total: 248, stage: "Processing", channel: "Online store", placed: "12m ago", priority: "High", city: "Austin, TX", eta: "Aug 6" },
  { id: "#10427", customer: "Leo Park", items: 1, total: 89, stage: "New", channel: "Social", placed: "18m ago", priority: "Normal", city: "Denver, CO", eta: "Aug 7" },
  { id: "#10426", customer: "Noah Reed", items: 5, total: 512, stage: "Packed", channel: "Online store", placed: "42m ago", priority: "High", city: "Seattle, WA", eta: "Aug 5" },
  { id: "#10425", customer: "Mara Silva", items: 2, total: 164, stage: "Paid", channel: "Marketplace", placed: "1h ago", priority: "Normal", city: "Miami, FL", eta: "Aug 8" },
  { id: "#10424", customer: "Ivy Zhou", items: 4, total: 327, stage: "Shipped", channel: "Online store", placed: "2h ago", priority: "Normal", city: "Chicago, IL", eta: "Aug 5" },
  { id: "#10423", customer: "Priya Nair", items: 1, total: 58, stage: "Processing", channel: "POS", placed: "3h ago", priority: "Normal", city: "Austin, TX", eta: "Aug 7" },
  { id: "#10422", customer: "Sam Idris", items: 2, total: 142, stage: "Delivered", channel: "Online store", placed: "5h ago", priority: "Normal", city: "Boston, MA", eta: "Delivered" },
  { id: "#10421", customer: "Dane Ford", items: 6, total: 689, stage: "Shipped", channel: "Marketplace", placed: "6h ago", priority: "High", city: "Portland, OR", eta: "Aug 5" },
  { id: "#10420", customer: "Ruth Vale", items: 2, total: 118, stage: "Packed", channel: "Online store", placed: "8h ago", priority: "Normal", city: "Reno, NV", eta: "Aug 6" },
  { id: "#10419", customer: "Omar Diaz", items: 3, total: 274, stage: "Paid", channel: "POS", placed: "9h ago", priority: "Normal", city: "Tucson, AZ", eta: "Aug 8" },
];

const products = [
  { id: "p1", name: "Aurora Serum", price: 68, tag: "Bestseller" },
  { id: "p2", name: "Midnight Oil", price: 54, tag: "Popular" },
  { id: "p3", name: "Golden Hour Balm", price: 42, tag: "New" },
  { id: "p4", name: "Silk Cleanser", price: 36, tag: "" },
  { id: "p5", name: "Radiance Mask", price: 48, tag: "" },
  { id: "p6", name: "Dew Mist", price: 28, tag: "" },
];

const channels = [
  { label: "Online store", share: 58, color: GOLD, icon: Globe },
  { label: "POS", share: 22, color: "oklch(0.7 0.11 60)", icon: Store },
  { label: "Marketplace", share: 14, color: "oklch(0.66 0.09 200)", icon: LayoutGrid },
  { label: "Social", share: 6, color: "oklch(0.75 0.13 150)", icon: Users },
];

const revenueSeries = [42, 48, 45, 58, 54, 66, 72, 68, 81, 77, 89, 96];
const topProducts = [
  { name: "Aurora Serum", sold: 342, revenue: 23256 },
  { name: "Midnight Oil", sold: 288, revenue: 15552 },
  { name: "Golden Hour Balm", sold: 214, revenue: 8988 },
  { name: "Radiance Mask", sold: 176, revenue: 8448 },
];

/* ──────────────────────────────────────────────────────────────────────
 * Viz primitives (orders-specific)
 * ─────────────────────────────────────────────────────────────────── */

function StagePill({ stage }: { stage: Stage }) {
  const color = stageColor[stage];
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

function OverviewView({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Orders today" value={148} delta="9%" icon={Package} />
        <StatTile label="Revenue today" value={18420} prefix="$" delta="12.4%" icon={CreditCard} />
        <StatTile label="Avg order value" value={124} prefix="$" decimals={0} delta="3.1%" icon={Receipt} />
        <StatTile label="Fulfillment rate" value={97} suffix="%" delta="1.2 pts" icon={PackageCheck} />
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
                  148 orders today, pacing <span className="text-gold">12% ahead</span> of yesterday.
                  <span className="text-gold"> 3 orders</span> need attention: 2 are past their pack SLA
                  and 1 flagged for address review. I've drafted fixes for each.
                </p>
              </div>
            </div>
            <div className="relative mt-5 space-y-2">
              {[
                { icon: AlertTriangle, t: "Order #10426 past pack SLA by 22m", d: "Expedite" },
                { icon: MapPin, t: "Order #10427 has an unverified address", d: "Review" },
                { icon: Truck, t: "Carrier delay may affect 4 shipments", d: "Reroute" },
              ].map((a) => (
                <button key={a.t} className="lift flex w-full items-center gap-3 rounded-2xl border border-border bg-background/30 p-3 text-left hover:border-gold/40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-glass">
                    <a.icon className="size-4 text-gold" />
                  </span>
                  <span className="flex-1 text-sm text-foreground/85">{a.t}</span>
                  <span className="shrink-0 text-xs text-gold">{a.d}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={LayoutGrid}>Orders by stage</SectionLabel>
            <div className="mt-5 space-y-4">
              {STAGES.map((s) => {
                const count = orders.filter((o) => o.stage === s).length;
                const pct = (count / orders.length) * 100;
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
            <span className="text-xs text-muted-foreground">live</span>
          </div>
          <div className="mt-4 space-y-1">
            {orders.slice(0, 6).map((o) => (
              <button
                key={o.id}
                onClick={() => onOpen(o.id)}
                className="lift grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left hover:border-gold/30 hover:bg-glass sm:grid-cols-[auto_1.4fr_1fr_0.8fr_auto]"
              >
                <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
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
    </div>
  );
}

function PipelineView({ onOpen }: { onOpen: (id: string) => void }) {
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
                  {col.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => onOpen(o.id)}
                      className="lift block w-full rounded-2xl border border-border bg-background/40 p-4 text-left hover:border-gold/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
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
                      <div className="mt-2 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                        <Clock className="size-3" /> {o.placed}
                        <span className="mx-1">·</span>
                        <MapPin className="size-3" /> {o.city}
                      </div>
                    </button>
                  ))}
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
  const o = orders.find((x) => x.id === orderId) ?? orders[0];
  const activeStage = STAGES.indexOf(o.stage);
  const lineItems = [
    { name: "Aurora Serum", qty: 1, price: 68 },
    { name: "Midnight Oil", qty: 1, price: 54 },
    { name: "Golden Hour Balm", qty: 2, price: 42 },
  ].slice(0, o.items || 3);
  const subtotal = lineItems.reduce((a, l) => a + l.qty * l.price, 0);
  const shipping = 12;
  const tax = Math.round(subtotal * 0.08);

  return (
    <div className="space-y-4">
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-foreground">{o.id}</span>
              <StagePill stage={o.stage} />
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
                <PackageCheck className="size-3.5" /> Fulfill order
              </button>
              <button className="rounded-full border border-border bg-glass px-4 py-2 text-xs text-foreground/80 hover:border-gold/40">Refund</button>
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
              {[["Subtotal", subtotal], ["Shipping", shipping], ["Tax", tax]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between text-muted-foreground">
                  <span>{k}</span>
                  <span className="tabular-nums">${formatNum(v as number)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums text-gold">${formatNum(subtotal + shipping + tax)}</span>
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
  const [cart, setCart] = useState<Record<string, number>>({ p1: 1, p3: 2 });
  const [customer, setCustomer] = useState("Ava Chen");
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
    () => Object.entries(cart).reduce((a, [id, q]) => a + (products.find((p) => p.id === id)?.price ?? 0) * q, 0),
    [cart],
  );
  const count = Object.values(cart).reduce((a, q) => a + q, 0);

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
                  Building an order for <span className="text-gold">{customer}</span>. Based on their history I'd
                  suggest the Aurora Serum and Dew Mist — tap to add.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["p6", "p5", "p2"].map((id) => {
                    const p = products.find((x) => x.id === id)!;
                    return (
                      <button
                        key={id}
                        onClick={() => add(id)}
                        className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-glass px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:border-gold/60"
                      >
                        <Plus className="size-3 text-gold" /> {p.name} · ${p.price}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal delay={60}>
          <GlassCard className="p-6">
            <SectionLabel icon={Package}>Product catalog</SectionLabel>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {products.map((p) => (
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
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
            </div>
          </label>

          <div className="mt-4 space-y-2">
            {Object.entries(cart).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No items yet — add from the catalog.</p>
            )}
            {Object.entries(cart).map(([id, q]) => {
              const p = products.find((x) => x.id === id)!;
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
            disabled={count === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
          >
            <Sparkles className="size-4" /> Create order
          </button>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function FulfillmentView() {
  const queue = orders.filter((o) => ["Paid", "Processing", "Packed"].includes(o.stage));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="To pick" value={14} icon={Package} />
        <StatTile label="To pack" value={9} icon={PackageCheck} />
        <StatTile label="To ship" value={6} icon={Truck} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={PackageCheck}>Fulfillment queue</SectionLabel>
            <span className="text-xs text-muted-foreground">SLA-sorted</span>
          </div>
          <div className="mt-4 space-y-2">
            {queue.map((o, i) => {
              const sla = ["12m left", "34m left", "1h 5m left", "past due", "2h left", "3h left"][i % 6];
              const past = sla === "past due";
              return (
                <div key={o.id} className="flex items-center gap-4 rounded-2xl border border-border bg-background/30 p-3">
                  <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={o.customer} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{o.customer}</p>
                      <p className="text-xs text-muted-foreground">{o.items} items · {o.city}</p>
                    </div>
                  </div>
                  <StagePill stage={o.stage} />
                  <span className={cn("flex w-24 items-center justify-end gap-1 text-xs", past ? "text-rose-300" : "text-muted-foreground")}>
                    <Clock className="size-3" /> {sla}
                  </span>
                  <button className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
                    Advance
                  </button>
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
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue (30d)" value={412908} prefix="$" delta="12.4%" icon={CreditCard} />
        <StatTile label="Orders (30d)" value={3284} delta="8.1%" icon={Package} />
        <StatTile label="Avg fulfillment" value={1.4} suffix=" days" decimals={1} delta="0.3 days" positive icon={Clock} />
        <StatTile label="Return rate" value={2.1} suffix="%" delta="0.4 pts" positive={false} icon={ArrowLeft} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="flex items-baseline justify-between">
              <SectionLabel icon={BarChart3}>Revenue trend</SectionLabel>
              <span className="text-xs text-muted-foreground">Last 12 weeks</span>
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
              {channels.map((c) => (
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
            {topProducts.map((p, i) => (
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
  const [orderId, setOrderId] = useState(orders[0].id);
  const meta = viewMeta[active];

  const openOrder = (id: string) => {
    setOrderId(id);
    setActive("details");
  };

  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 lg:flex">
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

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
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
  );
}
