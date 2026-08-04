import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  Boxes,
  Brain,
  CheckCircle2,
  Clock,
  Gauge,
  Globe,
  Home,
  Layers,
  LineChart,
  Package,
  PackagePlus,
  RefreshCw,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Bar, Delta, Reveal, Ring, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey =
  | "overview"
  | "products"
  | "forecast"
  | "reorder"
  | "movement"
  | "assistant"
  | "analytics";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Command center", icon: Home },
  { key: "products", label: "Products", icon: Boxes },
  { key: "forecast", label: "Forecast", icon: LineChart },
  { key: "reorder", label: "Smart reorder", icon: RefreshCw },
  { key: "movement", label: "Stock movement", icon: Activity },
  { key: "assistant", label: "AI assistant", icon: Bot },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

const GOLD = "oklch(0.84 0.14 84)";

type Status = "Healthy" | "Low" | "Critical" | "Overstock";
const statusColor: Record<Status, string> = {
  Healthy: "oklch(0.72 0.14 155)",
  Low: "oklch(0.84 0.14 84)",
  Critical: "oklch(0.68 0.16 25)",
  Overstock: "oklch(0.66 0.09 200)",
};

type Product = {
  id: string;
  name: string;
  category: string;
  stock: number;
  reorder: number;
  incoming: number;
  sold30: number;
  daysLeft: number;
  status: Status;
  velocity: "High" | "Medium" | "Low";
  price: number;
  history: number[];
  forecast: number[];
};

const products: Product[] = [
  { id: "SKU-1001", name: "Aurora Serum", category: "Serums", stock: 42, reorder: 60, incoming: 0, sold30: 210, daysLeft: 6, status: "Low", velocity: "High", price: 68, history: [48, 52, 46, 58, 60, 64, 70, 66, 72], forecast: [78, 84, 90, 96, 102] },
  { id: "SKU-1002", name: "Midnight Oil", category: "Oils", stock: 128, reorder: 80, incoming: 0, sold30: 168, daysLeft: 23, status: "Healthy", velocity: "High", price: 54, history: [40, 44, 46, 45, 50, 52, 55, 58, 60], forecast: [62, 63, 65, 66, 68] },
  { id: "SKU-1003", name: "Golden Hour Balm", category: "Balms", stock: 14, reorder: 40, incoming: 60, sold30: 132, daysLeft: 3, status: "Critical", velocity: "High", price: 42, history: [30, 34, 33, 38, 42, 44, 48, 46, 50], forecast: [53, 57, 61, 66, 70] },
  { id: "SKU-1004", name: "Silk Cleanser", category: "Cleansers", stock: 96, reorder: 50, incoming: 0, sold30: 88, daysLeft: 33, status: "Healthy", velocity: "Medium", price: 36, history: [26, 28, 27, 30, 29, 31, 33, 32, 34], forecast: [35, 36, 36, 37, 38] },
  { id: "SKU-1005", name: "Radiance Mask", category: "Masks", stock: 312, reorder: 90, incoming: 0, sold30: 54, daysLeft: 170, status: "Overstock", velocity: "Low", price: 48, history: [22, 20, 19, 18, 17, 16, 16, 15, 15], forecast: [14, 14, 13, 13, 12] },
  { id: "SKU-1006", name: "Dew Mist", category: "Mists", stock: 58, reorder: 55, incoming: 0, sold30: 121, daysLeft: 14, status: "Healthy", velocity: "Medium", price: 28, history: [30, 32, 34, 33, 36, 38, 40, 41, 43], forecast: [45, 47, 48, 50, 52] },
  { id: "SKU-1007", name: "Velvet Lip Oil", category: "Oils", stock: 22, reorder: 45, incoming: 0, sold30: 98, daysLeft: 5, status: "Low", velocity: "High", price: 24, history: [28, 30, 32, 34, 36, 40, 42, 45, 48], forecast: [51, 55, 59, 63, 67] },
  { id: "SKU-1008", name: "Clay Detox Bar", category: "Cleansers", stock: 240, reorder: 60, incoming: 0, sold30: 36, daysLeft: 200, status: "Overstock", velocity: "Low", price: 18, history: [18, 17, 16, 16, 15, 14, 14, 13, 12], forecast: [12, 11, 11, 10, 10] },
];

const healthPillars = [
  { label: "Stock coverage", value: 88 },
  { label: "Turnover", value: 76 },
  { label: "Forecast accuracy", value: 91 },
  { label: "Deadstock control", value: 68 },
];

const movements = [
  { type: "Received", name: "Golden Hour Balm", sku: "SKU-1003", qty: 60, time: "12m ago" },
  { type: "Sold", name: "Aurora Serum", sku: "SKU-1001", qty: -8, time: "24m ago" },
  { type: "Sold", name: "Velvet Lip Oil", sku: "SKU-1007", qty: -5, time: "38m ago" },
  { type: "Returned", name: "Radiance Mask", sku: "SKU-1005", qty: 2, time: "1h ago" },
  { type: "Adjusted", name: "Midnight Oil", sku: "SKU-1002", qty: -3, time: "2h ago" },
  { type: "Transfer", name: "Silk Cleanser", sku: "SKU-1004", qty: -20, time: "3h ago" },
  { type: "Sold", name: "Dew Mist", sku: "SKU-1006", qty: -11, time: "4h ago" },
];

const movementTone: Record<string, { color: string; icon: LucideIcon }> = {
  Received: { color: "oklch(0.72 0.14 155)", icon: PackagePlus },
  Sold: { color: "oklch(0.84 0.14 84)", icon: TrendingDown },
  Returned: { color: "oklch(0.66 0.09 200)", icon: RefreshCw },
  Adjusted: { color: "oklch(0.7 0.02 250)", icon: Activity },
  Transfer: { color: "oklch(0.72 0.12 65)", icon: Truck },
};

const categories = [
  { label: "Serums", share: 32, color: GOLD },
  { label: "Oils", share: 24, color: "oklch(0.7 0.11 60)" },
  { label: "Cleansers", share: 18, color: "oklch(0.66 0.09 200)" },
  { label: "Balms", share: 14, color: "oklch(0.75 0.13 150)" },
  { label: "Masks", share: 12, color: "oklch(0.62 0.12 300)" },
];

const valueSeries = [280, 292, 288, 305, 312, 320, 318, 332, 340, 352, 361, 374];

/* ──────────────────────────────────────────────────────────────────────
 * Charts
 * ─────────────────────────────────────────────────────────────────── */

/** Historical + forecast line chart with a confidence band. */
function ForecastChart({ history, forecast }: { history: number[]; forecast: number[] }) {
  const { ref, inView } = useInView();
  const W = 340;
  const H = 150;
  const fWithJoin = [history[history.length - 1], ...forecast];
  const all = [...history, ...forecast];
  const min = Math.min(...all) * 0.85;
  const max = Math.max(...all, ...forecast.map((v) => v * 1.12)) * 1.02;
  const n = all.length;
  const xStep = W / (n - 1);
  const x = (i: number) => i * xStep;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;

  const histPath = history.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const fStart = history.length - 1;
  const forePath = fWithJoin.map((v, i) => `${i ? "L" : "M"}${x(fStart + i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  const bandUpper = fWithJoin.map((v, i) => `${i ? "L" : "M"}${x(fStart + i).toFixed(1)} ${y(v * 1.1).toFixed(1)}`).join(" ");
  const bandLower = [...fWithJoin].reverse().map((v, i) => `L${x(n - 1 - i).toFixed(1)} ${y(v * 0.9).toFixed(1)}`).join(" ");
  const band = `${bandUpper} ${bandLower} Z`;
  const dividerX = x(fStart);

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        {/* confidence band */}
        <path d={band} fill="oklch(0.84 0.14 84 / 12%)" style={{ opacity: inView ? 1 : 0, transition: "opacity 0.9s ease" }} />
        {/* now divider */}
        <line x1={dividerX} y1="0" x2={dividerX} y2={H} stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 3" />
        {/* history */}
        <path d={histPath} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="spark-draw" />
        {/* forecast (dashed) */}
        <path d={forePath} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" style={{ opacity: inView ? 0.75 : 0, transition: "opacity 0.9s ease 0.4s" }} />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: GOLD }} /> Actual</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: GOLD, opacity: 0.6 }} /> Forecast</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: "oklch(0.84 0.14 84 / 20%)" }} /> Confidence</span>
      </div>
    </div>
  );
}

function BarChart({ data, height = 150 }: { data: number[]; height?: number }) {
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

function StatusPill({ status }: { status: Status }) {
  const color = statusColor[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium"
      style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

/** Compact coverage bar: stock vs reorder point. */
function CoverageBar({ p }: { p: Product }) {
  const { ref, inView } = useInView();
  const cap = Math.max(p.stock, p.reorder * 2);
  const stockPct = (p.stock / cap) * 100;
  const reorderPct = (p.reorder / cap) * 100;
  return (
    <div ref={ref} className="relative h-1.5 overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{ width: inView ? `${stockPct}%` : "0%", background: statusColor[p.status] }}
      />
      <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-foreground/60" style={{ left: `${reorderPct}%` }} title="Reorder point" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

function OverviewView({ onOpen }: { onOpen: (id: string) => void }) {
  const atRisk = products.filter((p) => p.status === "Low" || p.status === "Critical");
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active SKUs" value={912} delta="18" icon={Boxes} />
        <StatTile label="Inventory value" value={374200} prefix="$" delta="3.6%" icon={Layers} />
        <StatTile label="Low / critical" value={2} delta="1" positive={false} icon={AlertTriangle} />
        <StatTile label="Turnover rate" value={5.4} suffix="x" decimals={1} delta="0.4x" icon={RefreshCw} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* Inventory health score */}
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Gauge}>Inventory health</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Ring
                value={82}
                size={128}
                label={
                  <div>
                    <div className="text-3xl font-semibold tabular-nums gold-text">82</div>
                    <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">/ 100</div>
                  </div>
                }
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TrendingUp className="size-4 text-gold" /> Well-stocked
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Coverage is strong. Two SKUs need reordering this week to stay ahead of demand.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
              {healthPillars.map((p) => (
                <div key={p.label}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-foreground/80">{p.label}</span>
                    <span className="tabular-nums text-gold">{p.value}</span>
                  </div>
                  <div className="mt-1.5"><Bar value={p.value} /></div>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>

        {/* AI briefing */}
        <Reveal className="h-full" delay={80}>
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                <Brain className="size-5" stroke="oklch(0.2 0.02 70)" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Predictive briefing</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">
                  The business knows what it needs before it runs out. <span className="text-gold">Golden Hour Balm</span> will
                  stock out in <span className="text-gold">3 days</span> — I've queued a reorder. Two SKUs are overstocked,
                  tying up <span className="text-gold">$18k</span> you could redeploy.
                </p>
              </div>
            </div>
            <div className="relative mt-5 space-y-2">
              {atRisk.map((p) => (
                <button key={p.id} onClick={() => onOpen(p.id)} className="lift flex w-full items-center gap-3 rounded-2xl border border-border bg-background/30 p-3 text-left hover:border-gold/40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-glass">
                    <Package className="size-4 text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground/85">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.stock} in stock · {p.daysLeft} days left</p>
                  </div>
                  <StatusPill status={p.status} />
                </button>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

function ProductsView({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  if (selectedId) {
    const p = products.find((x) => x.id === selectedId) ?? products[0];
    return <ProductDetail p={p} onBack={() => onSelect(null)} />;
  }
  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="hidden grid-cols-[1.6fr_0.9fr_0.7fr_0.8fr_1fr] gap-4 px-3 pb-2 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>Product</span>
          <span>Category</span>
          <span className="text-right">Stock</span>
          <span>Status</span>
          <span>Coverage</span>
        </div>
        <div className="space-y-1">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="lift grid w-full grid-cols-1 items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left hover:border-gold/30 hover:bg-glass md:grid-cols-[1.6fr_0.9fr_0.7fr_0.8fr_1fr]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-glass"><Package className="size-4 text-gold" /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{p.id}</p>
                </div>
              </div>
              <span className="hidden text-sm text-muted-foreground md:block">{p.category}</span>
              <span className="hidden text-right text-sm font-semibold tabular-nums md:block">{formatNum(p.stock)}</span>
              <div className="hidden md:block"><StatusPill status={p.status} /></div>
              <div className="hidden md:block"><CoverageBar p={p} /></div>
            </button>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function ProductDetail({ p, onBack }: { p: Product; onBack: () => void }) {
  const cover = Math.round((p.stock / (p.sold30 / 30)) || 0);
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> All products
      </button>

      <Reveal>
        <GlassCard className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl" style={{ background: "var(--gradient-gold)" }}>
                <Package className="size-6" stroke="oklch(0.2 0.02 70)" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{p.name}</h2>
                <p className="font-mono text-xs text-muted-foreground">{p.id} · {p.category}</p>
              </div>
            </div>
            <StatusPill status={p.status} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "In stock", v: formatNum(p.stock) },
              { k: "Days of cover", v: `${cover}d` },
              { k: "Sold (30d)", v: formatNum(p.sold30) },
              { k: "Velocity", v: p.velocity },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-border bg-background/30 px-4 py-3">
                <p className="text-lg font-semibold tabular-nums">{s.v}</p>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{s.k}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={LineChart}>Demand forecast</SectionLabel>
            <div className="mt-4"><ForecastChart history={p.history} forecast={p.forecast} /></div>
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="glass-strong relative h-full overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                <Brain className="size-3.5" /> AI recommendation
              </p>
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                {p.status === "Overstock"
                  ? `Demand is softening. Hold reorders and consider a promo to clear ~${Math.round(p.stock * 0.4)} units.`
                  : `Demand is trending up. Reorder ${Math.max(p.reorder * 2 - p.stock, p.reorder)} units now to avoid a stockout in ${p.daysLeft} days.`}
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Reorder point</span><span className="tabular-nums">{p.reorder}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Incoming</span><span className="tabular-nums">{p.incoming}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Unit price</span><span className="tabular-nums">${p.price}</span></div>
              </div>
              <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
                <RefreshCw className="size-3.5" /> Reorder now
              </button>
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

function ForecastView() {
  const [id, setId] = useState(products[0].id);
  const p = products.find((x) => x.id === id) ?? products[0];
  const predicted = p.forecast.reduce((a, v) => a + v, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {products.map((x) => (
          <button
            key={x.id}
            onClick={() => setId(x.id)}
            className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", x.id === p.id ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")}
            style={x.id === p.id ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
          >
            {x.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Predicted 5-wk demand" value={predicted} suffix=" units" icon={TrendingUp} />
        <StatTile label="Projected stockout" value={p.daysLeft} suffix=" days" icon={Clock} positive={false} />
        <StatTile label="Forecast confidence" value={91} suffix="%" icon={Gauge} />
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-baseline justify-between">
            <SectionLabel icon={LineChart}>Demand forecast — {p.name}</SectionLabel>
            <span className="text-xs text-muted-foreground">9 weeks actual · 5 weeks predicted</span>
          </div>
          <div className="mt-5"><ForecastChart history={p.history} forecast={p.forecast} /></div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function ReorderView() {
  const suggestions = useMemo(
    () =>
      products
        .filter((p) => p.status === "Low" || p.status === "Critical")
        .concat(products.filter((p) => p.status === "Healthy" && p.daysLeft < 16))
        .map((p) => ({
          p,
          qty: Math.max(p.reorder * 2 - p.stock - p.incoming, p.reorder),
          lead: p.velocity === "High" ? "3 days" : "6 days",
          supplier: p.category === "Oils" ? "Lumen Labs" : "Northwind Supply",
        })),
    [],
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(suggestions.map((s) => [s.p.id, true])),
  );
  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const totalCost = suggestions.filter((s) => selected[s.p.id]).reduce((a, s) => a + s.qty * s.p.price, 0);
  const totalUnits = suggestions.filter((s) => selected[s.p.id]).reduce((a, s) => a + s.qty, 0);
  const chosen = suggestions.filter((s) => selected[s.p.id]).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center gap-3">
            <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
              <Sparkles className="size-4" stroke="oklch(0.2 0.02 70)" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">AI-suggested purchase orders</p>
              <p className="text-xs text-muted-foreground">Optimized for lead time, velocity and cash</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {suggestions.map((s) => (
              <label
                key={s.p.id}
                className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border p-3 transition-colors", selected[s.p.id] ? "border-gold/40 bg-glass" : "border-border bg-background/30")}
              >
                <input type="checkbox" checked={!!selected[s.p.id]} onChange={() => toggle(s.p.id)} className="size-4 accent-[oklch(0.84_0.14_84)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{s.p.name}</p>
                  <p className="text-xs text-muted-foreground">{s.supplier} · lead {s.lead}</p>
                </div>
                <StatusPill status={s.p.status} />
                <div className="w-20 text-right">
                  <p className="text-sm font-semibold tabular-nums text-gold">{s.qty}</p>
                  <p className="text-[0.65rem] text-muted-foreground">units</p>
                </div>
                <span className="w-20 text-right text-sm font-semibold tabular-nums">${formatNum(s.qty * s.p.price)}</span>
              </label>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={100}>
        <GlassCard className="glass-strong sticky top-6 p-6">
          <SectionLabel icon={RefreshCw}>Purchase summary</SectionLabel>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>POs selected</span><span className="tabular-nums">{chosen}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Total units</span><span className="tabular-nums">{formatNum(totalUnits)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total cost</span><span className="tabular-nums text-gold">${formatNum(totalCost)}</span></div>
          </div>
          <button disabled={chosen === 0} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <CheckCircle2 className="size-4" /> Approve {chosen} order{chosen === 1 ? "" : "s"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Restocks arrive in 3–6 days</p>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function MovementView() {
  const inbound = movements.filter((m) => m.qty > 0).reduce((a, m) => a + m.qty, 0);
  const outbound = movements.filter((m) => m.qty < 0).reduce((a, m) => a + Math.abs(m.qty), 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Units in (today)" value={inbound} icon={PackagePlus} />
        <StatTile label="Units out (today)" value={outbound} icon={TrendingDown} />
        <StatTile label="Net movement" value={inbound - outbound} icon={Activity} positive={inbound - outbound >= 0} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={Activity}>Stock movement</SectionLabel>
          <div className="mt-4 space-y-1">
            {movements.map((m, i) => {
              const tone = movementTone[m.type];
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-glass">
                    <tone.icon className="size-4" style={{ color: tone.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground/90"><span className="font-medium">{m.type}</span> · {m.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{m.sku}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: m.qty > 0 ? "oklch(0.72 0.14 155)" : "oklch(0.84 0.14 84)" }}>
                    {m.qty > 0 ? "+" : ""}{m.qty}
                  </span>
                  <span className="flex w-20 items-center justify-end gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> {m.time}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

type ChatMsg = { role: "ai" | "user"; text: string };
const suggestedPrompts = ["What will I run out of?", "What's overstocked?", "Optimize reorders for next month", "Which SKUs are slowing down?"];

function AssistantView() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "I track every SKU and predict demand nightly. Ask me what to reorder, what's overstocked, or what's trending." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const answerFor = (q: string) => {
    const s = q.toLowerCase();
    if (s.includes("run out") || s.includes("stock out"))
      return "Golden Hour Balm stocks out in 3 days and Velvet Lip Oil in 5. I've drafted reorders for both in Smart reorder.";
    if (s.includes("overstock"))
      return "Radiance Mask (170 days cover) and Clay Detox Bar (200 days) are overstocked — about $18k tied up. I'd run a clearance promo.";
    if (s.includes("slow")) return "Radiance Mask and Clay Detox Bar are decelerating — velocity down 20%+ month over month.";
    return "Based on tonight's forecast, reorder Golden Hour Balm, Aurora Serum and Velvet Lip Oil — total 220 units, ~$9.8k, arriving in 3–6 days.";
  };

  function send(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      setThinking(false);
      setMessages((m) => [...m, { role: "ai", text: answerFor(q) }]);
    }, 1200);
  }

  return (
    <Reveal>
      <GlassCard className="glass-strong mx-auto flex h-[32rem] max-w-3xl flex-col p-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
            <Bot className="size-4" stroke="oklch(0.2 0.02 70)" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Inventory Copilot</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-400" /> Forecasting 912 SKUs</p>
          </div>
        </div>

        <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>
                {m.text}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3">
                <span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedPrompts.map((p) => (
            <button key={p} onClick={() => send(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your inventory…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}>
            <Send className="size-3.5" stroke="oklch(0.2 0.02 70)" />
          </button>
        </form>
      </GlassCard>
    </Reveal>
  );
}

function AnalyticsView() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Inventory value" value={374200} prefix="$" delta="3.6%" icon={Layers} />
        <StatTile label="Turnover rate" value={5.4} suffix="x" decimals={1} delta="0.4x" icon={RefreshCw} />
        <StatTile label="Sell-through" value={68} suffix="%" delta="2.2 pts" icon={TrendingUp} />
        <StatTile label="Deadstock" value={4.1} suffix="%" decimals={1} delta="0.6 pts" positive icon={TrendingDown} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="flex items-baseline justify-between">
              <SectionLabel icon={BarChart3}>Inventory value trend</SectionLabel>
              <span className="text-xs text-muted-foreground">Last 12 weeks · $K</span>
            </div>
            <div className="mt-6"><BarChart data={valueSeries} /></div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Globe}>Stock by category</SectionLabel>
            <div className="mt-5 space-y-4">
              {categories.map((c) => (
                <div key={c.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground/85"><span className="size-2.5 rounded-full" style={{ background: c.color }} /> {c.label}</span>
                    <span className="tabular-nums text-muted-foreground">{c.share}%</span>
                  </div>
                  <div className="mt-1.5"><Bar value={c.share * 3} /></div>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Zap}>Top movers</SectionLabel>
            <div className="mt-4 space-y-1">
              {[...products].sort((a, b) => b.sold30 - a.sold30).slice(0, 4).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-glass"><Package className="size-4 text-gold" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{formatNum(p.sold30)} sold / 30d</p></div>
                  <Delta value={p.velocity} positive={p.velocity !== "Low"} />
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={AlertTriangle}>Deadstock watch</SectionLabel>
            <div className="mt-4 space-y-1">
              {products.filter((p) => p.status === "Overstock").map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-glass"><Package className="size-4" style={{ color: statusColor.Overstock }} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{formatNum(p.stock)} units · {Math.round(p.stock / (p.sold30 / 30))}d cover</p></div>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">${formatNum(p.stock * p.price)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: "Inventory command center", sub: "Knows what you need before you run out" },
  products: { title: "Product intelligence", sub: "Every SKU, scored and forecast" },
  forecast: { title: "Demand forecasting", sub: "See demand before it arrives" },
  reorder: { title: "Smart reorder", sub: "AI-optimized purchase orders" },
  movement: { title: "Stock movement", sub: "Every unit in and out" },
  assistant: { title: "AI inventory assistant", sub: "Ask your predictive copilot" },
  analytics: { title: "Inventory analytics", sub: "Value, turnover and deadstock" },
};

export function InventoryWorkspace() {
  const [active, setActive] = useState<ViewKey>("overview");
  const [productId, setProductId] = useState<string | null>(null);
  const meta = viewMeta[active];

  const openProduct = (id: string) => {
    setProductId(id);
    setActive("products");
  };

  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 lg:flex">
        <Brand subtle />
        <p className="mt-6 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Inventory</p>
        <nav className="mt-2 space-y-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => { setActive(v.key); if (v.key !== "products") setProductId(null); }}
              className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")}
              style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
            >
              <v.icon className={cn("size-4", active === v.key && "text-gold")} />
              {v.label}
            </button>
          ))}
        </nav>
        <Link to="/dashboard" className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground">
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
          <button onClick={() => setActive("reorder")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <RefreshCw className="size-4" stroke="oklch(0.2 0.02 70)" /> Smart reorder
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => { setActive(v.key); if (v.key !== "products") setProductId(null); }}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")}
              style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        <div key={active + (productId ?? "")} className="rise">
          {active === "overview" && <OverviewView onOpen={openProduct} />}
          {active === "products" && <ProductsView selectedId={productId} onSelect={setProductId} />}
          {active === "forecast" && <ForecastView />}
          {active === "reorder" && <ReorderView />}
          {active === "movement" && <MovementView />}
          {active === "assistant" && <AssistantView />}
          {active === "analytics" && <AnalyticsView />}
        </div>
      </section>
    </div>
  );
}
