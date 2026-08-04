import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  Building2,
  Clock,
  DollarSign,
  Factory,
  FileText,
  Globe,
  Home,
  MapPin,
  Package,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Delta, Donut, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "overview" | "database" | "compare" | "orders" | "pricing" | "risk" | "assistant";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Command center", icon: Home },
  { key: "database", label: "Suppliers", icon: Building2 },
  { key: "compare", label: "Compare", icon: Scale },
  { key: "orders", label: "Purchase orders", icon: FileText },
  { key: "pricing", label: "Price intelligence", icon: DollarSign },
  { key: "risk", label: "Risk analysis", icon: ShieldAlert },
  { key: "assistant", label: "AI assistant", icon: Bot },
];

const GOLD = "oklch(0.84 0.14 84)";

type Risk = "Low" | "Medium" | "High";
const riskColor: Record<Risk, string> = {
  Low: "oklch(0.72 0.14 155)",
  Medium: "oklch(0.84 0.14 84)",
  High: "oklch(0.68 0.16 25)",
};

type Status = "Preferred" | "Active" | "Review";
const statusColor: Record<Status, string> = {
  Preferred: "oklch(0.84 0.14 84)",
  Active: "oklch(0.7 0.11 60)",
  Review: "oklch(0.68 0.16 25)",
};

type Supplier = {
  id: string;
  name: string;
  category: string;
  country: string;
  rating: number;
  reliability: number;
  onTime: number;
  leadTime: number;
  spend: number;
  risk: Risk;
  priceIndex: number; // % vs market (negative = cheaper)
  status: Status;
  products: number;
  since: string;
  impact: number; // risk matrix
  likelihood: number;
};

const suppliers: Supplier[] = [
  { id: "SUP-01", name: "Northwind Supply", category: "Packaging", country: "USA", rating: 4.8, reliability: 94, onTime: 97, leadTime: 4, spend: 428000, risk: "Low", priceIndex: -6, status: "Preferred", products: 34, since: "2021", impact: 82, likelihood: 18 },
  { id: "SUP-02", name: "Lumen Labs", category: "Ingredients", country: "Germany", rating: 4.6, reliability: 90, onTime: 93, leadTime: 7, spend: 356000, risk: "Low", priceIndex: -2, status: "Preferred", products: 28, since: "2020", impact: 74, likelihood: 22 },
  { id: "SUP-03", name: "Fjord Materials", category: "Oils", country: "Norway", rating: 4.2, reliability: 82, onTime: 86, leadTime: 9, spend: 214000, risk: "Medium", priceIndex: 4, status: "Active", products: 16, since: "2022", impact: 58, likelihood: 46 },
  { id: "SUP-04", name: "Halcyon Glass", category: "Packaging", country: "China", rating: 3.9, reliability: 74, onTime: 79, leadTime: 14, spend: 189000, risk: "Medium", priceIndex: -11, status: "Active", products: 22, since: "2022", impact: 52, likelihood: 54 },
  { id: "SUP-05", name: "Meridian Botanicals", category: "Ingredients", country: "India", rating: 4.4, reliability: 88, onTime: 91, leadTime: 11, spend: 167000, risk: "Low", priceIndex: -8, status: "Active", products: 19, since: "2023", impact: 46, likelihood: 24 },
  { id: "SUP-06", name: "Cobalt Print", category: "Labels", country: "USA", rating: 4.1, reliability: 80, onTime: 84, leadTime: 5, spend: 98000, risk: "Low", priceIndex: 1, status: "Active", products: 12, since: "2023", impact: 30, likelihood: 28 },
  { id: "SUP-07", name: "Solstice Freight", category: "Logistics", country: "USA", rating: 3.6, reliability: 68, onTime: 71, leadTime: 3, spend: 142000, risk: "High", priceIndex: 9, status: "Review", products: 1, since: "2022", impact: 78, likelihood: 68 },
  { id: "SUP-08", name: "Tidewater Caps", category: "Packaging", country: "Vietnam", rating: 4.0, reliability: 78, onTime: 82, leadTime: 16, spend: 76000, risk: "Medium", priceIndex: -14, status: "Active", products: 9, since: "2024", impact: 38, likelihood: 50 },
];

const spendByCategory = [
  { label: "Packaging", share: 38, color: GOLD },
  { label: "Ingredients", share: 30, color: "oklch(0.7 0.11 60)" },
  { label: "Oils", share: 13, color: "oklch(0.66 0.09 200)" },
  { label: "Logistics", share: 12, color: "oklch(0.62 0.12 300)" },
  { label: "Labels", share: 7, color: "oklch(0.75 0.13 150)" },
];

type PO = { id: string; supplier: string; items: number; total: number; status: string; placed: string; eta: string };
const purchaseOrders: PO[] = [
  { id: "PO-2043", supplier: "Northwind Supply", items: 6, total: 24800, status: "Confirmed", placed: "2d ago", eta: "Aug 8" },
  { id: "PO-2042", supplier: "Lumen Labs", items: 4, total: 18600, status: "In transit", placed: "3d ago", eta: "Aug 6" },
  { id: "PO-2041", supplier: "Meridian Botanicals", items: 8, total: 12400, status: "Sent", placed: "4d ago", eta: "Aug 12" },
  { id: "PO-2040", supplier: "Halcyon Glass", items: 3, total: 9200, status: "Draft", placed: "5d ago", eta: "—" },
  { id: "PO-2039", supplier: "Cobalt Print", items: 2, total: 4100, status: "Received", placed: "6d ago", eta: "Delivered" },
  { id: "PO-2038", supplier: "Fjord Materials", items: 5, total: 15800, status: "In transit", placed: "6d ago", eta: "Aug 7" },
];
const poStatusColor: Record<string, string> = {
  Draft: "oklch(0.7 0.02 250)",
  Sent: "oklch(0.66 0.09 200)",
  Confirmed: "oklch(0.84 0.14 84)",
  "In transit": "oklch(0.72 0.12 65)",
  Received: "oklch(0.72 0.14 155)",
};

const materials = [
  { name: "Amber Glass Bottle", your: 0.82, market: 0.94, trend: [0.9, 0.92, 0.89, 0.86, 0.84, 0.83, 0.82], change: -4 },
  { name: "Jojoba Oil (per L)", your: 12.4, market: 11.8, trend: [10.8, 11.1, 11.4, 11.9, 12.0, 12.2, 12.4], change: 3 },
  { name: "Kraft Box", your: 0.36, market: 0.41, trend: [0.4, 0.39, 0.39, 0.38, 0.37, 0.36, 0.36], change: -2 },
  { name: "Pump Dispenser", your: 0.28, market: 0.33, trend: [0.34, 0.33, 0.32, 0.31, 0.3, 0.29, 0.28], change: -6 },
];

/* ──────────────────────────────────────────────────────────────────────
 * Small viz
 * ─────────────────────────────────────────────────────────────────── */

function RiskPill({ risk }: { risk: Risk }) {
  const color = riskColor[risk];
  const Icon = risk === "High" ? ShieldAlert : ShieldCheck;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium" style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}>
      <Icon className="size-3" /> {risk}
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const color = statusColor[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium" style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}>
      <span className="size-1.5 rounded-full" style={{ background: color }} /> {status}
    </span>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-gold">
      <Star className="size-3.5 fill-current" />
      <span className="text-sm tabular-nums text-foreground">{value.toFixed(1)}</span>
    </span>
  );
}

/** Tiny inline price sparkline. */
function PriceLine({ data, up }: { data: number[]; up: boolean }) {
  const { ref, inView } = useInView();
  const w = 100;
  const h = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const line = data.map((v, i) => `${i ? "L" : "M"}${((i / (data.length - 1)) * w).toFixed(1)} ${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`).join(" ");
  const color = up ? "oklch(0.68 0.16 25)" : "oklch(0.72 0.14 155)";
  return (
    <svg ref={ref as never} viewBox={`0 0 ${w} ${h}`} className="h-8 w-24" preserveAspectRatio="none" aria-hidden>
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={inView ? "spark-draw" : ""} style={{ opacity: inView ? 1 : 0 }} />
    </svg>
  );
}

/** Risk matrix scatter: impact (x) vs likelihood (y). */
function RiskMatrix() {
  const { ref, inView } = useInView();
  return (
    <div ref={ref}>
      <svg viewBox="0 0 220 200" className="w-full">
        {/* quadrant background */}
        <rect x="110" y="0" width="110" height="100" fill="oklch(0.68 0.16 25 / 8%)" />
        {/* grid */}
        <line x1="110" y1="0" x2="110" y2="200" stroke="var(--color-border)" strokeDasharray="3 3" />
        <line x1="0" y1="100" x2="220" y2="100" stroke="var(--color-border)" strokeDasharray="3 3" />
        {/* dots */}
        {suppliers.map((s, i) => {
          const cx = (s.impact / 100) * 220;
          const cy = 200 - (s.likelihood / 100) * 200;
          const r = 4 + (s.spend / 428000) * 8;
          return (
            <g key={s.id} style={{ opacity: inView ? 1 : 0, transition: `opacity 0.5s ease ${i * 70}ms` }}>
              <circle cx={cx} cy={cy} r={inView ? r : 0} fill={`color-mix(in oklch, ${riskColor[s.risk]} 65%, transparent)`} stroke={riskColor[s.risk]} strokeWidth="1.5" style={{ transition: `r 0.6s cubic-bezier(0.2,0.8,0.2,1) ${i * 70}ms` }} />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[0.65rem] text-muted-foreground">
        <span>← lower impact</span>
        <span>higher impact →</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

function OverviewView({ onOpen }: { onOpen: (id: string) => void }) {
  const alerts = suppliers.filter((s) => s.risk === "High" || s.status === "Review");
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active suppliers" value={48} delta="4" icon={Building2} />
        <StatTile label="Annual spend" value={1420000} prefix="$" delta="6.1%" positive={false} icon={DollarSign} />
        <StatTile label="Avg lead time" value={8.4} suffix=" days" decimals={1} delta="0.7 days" icon={Clock} />
        <StatTile label="On-time rate" value={91} suffix="%" delta="2.3 pts" icon={Truck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Globe}>Spend by category</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Donut
                data={spendByCategory}
                center={
                  <div>
                    <div className="text-xl font-semibold tabular-nums gold-text">$1.4M</div>
                    <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">annual</div>
                  </div>
                }
              />
              <ul className="min-w-0 flex-1 space-y-2">
                {spendByCategory.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate text-foreground/85">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">{s.share}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                <Brain className="size-5" stroke="oklch(0.2 0.02 70)" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Procurement briefing</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">
                  You have an AI procurement manager. I found <span className="text-gold">$42k</span> in annual
                  savings by shifting glass volume to Tidewater. <span className="text-gold">Solstice Freight</span> is
                  trending high-risk — on-time dropped to 71%.
                </p>
              </div>
            </div>
            <div className="relative mt-5 space-y-2">
              {alerts.map((s) => (
                <button key={s.id} onClick={() => onOpen(s.id)} className="lift flex w-full items-center gap-3 rounded-2xl border border-border bg-background/30 p-3 text-left hover:border-gold/40">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-glass"><Factory className="size-4 text-gold" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground/85">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.category} · {s.onTime}% on-time</p>
                  </div>
                  <RiskPill risk={s.risk} />
                </button>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Star}>Preferred suppliers</SectionLabel>
            <span className="text-xs text-muted-foreground">by reliability</span>
          </div>
          <div className="mt-4 space-y-1">
            {[...suppliers].sort((a, b) => b.reliability - a.reliability).slice(0, 4).map((s) => (
              <button key={s.id} onClick={() => onOpen(s.id)} className="lift grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left hover:border-gold/30 hover:bg-glass sm:grid-cols-[1.6fr_0.8fr_0.8fr_auto]">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} />
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.category} · {s.country}</p></div>
                </div>
                <span className="hidden sm:block"><Rating value={s.rating} /></span>
                <span className="hidden text-sm text-muted-foreground sm:block">{s.reliability}% reliable</span>
                <span className="text-right text-sm font-semibold tabular-nums text-gold">${formatNum(s.spend)}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function DatabaseView({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  if (selectedId) {
    const s = suppliers.find((x) => x.id === selectedId) ?? suppliers[0];
    return <SupplierProfile s={s} onBack={() => onSelect(null)} />;
  }
  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="hidden grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.9fr] gap-4 px-3 pb-2 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>Supplier</span>
          <span>Rating</span>
          <span className="text-right">Lead</span>
          <span>Risk</span>
          <span className="text-right">Annual spend</span>
        </div>
        <div className="space-y-1">
          {suppliers.map((s) => (
            <button key={s.id} onClick={() => onSelect(s.id)} className="lift grid w-full grid-cols-1 items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left hover:border-gold/30 hover:bg-glass md:grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.9fr]">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} />
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.category} · {s.country}</p></div>
              </div>
              <span className="hidden md:block"><Rating value={s.rating} /></span>
              <span className="hidden text-right text-sm tabular-nums md:block">{s.leadTime}d</span>
              <span className="hidden md:block"><RiskPill risk={s.risk} /></span>
              <span className="hidden text-right text-sm font-semibold tabular-nums text-gold md:block">${formatNum(s.spend)}</span>
            </button>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function SupplierProfile({ s, onBack }: { s: Supplier; onBack: () => void }) {
  const metrics = [
    { k: "Reliability", v: s.reliability },
    { k: "On-time", v: s.onTime },
    { k: "Quality", v: Math.round((s.rating / 5) * 100) },
    { k: "Price vs market", v: Math.max(0, Math.min(100, 50 - s.priceIndex * 3)) },
  ];
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> All suppliers
      </button>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col items-center p-6 text-center">
            <span className="grid size-20 place-items-center rounded-2xl text-2xl font-semibold" style={{ background: "var(--gradient-gold)", color: "oklch(0.2 0.02 70)" }}>
              {s.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{s.name}</h2>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5" /> {s.country}</p>
            <div className="mt-3 flex items-center gap-2"><StatusPill status={s.status} /><RiskPill risk={s.risk} /></div>
            <div className="mt-6 grid w-full grid-cols-3 gap-3 border-t border-border pt-5 text-center">
              <div><p className="text-lg font-semibold tabular-nums text-gold">${formatNum(s.spend)}</p><p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Spend</p></div>
              <div><p className="text-lg font-semibold tabular-nums">{s.products}</p><p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Products</p></div>
              <div><p className="text-lg font-semibold tabular-nums">{s.since}</p><p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Since</p></div>
            </div>
            <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
              <FileText className="size-3.5" /> New purchase order
            </button>
          </GlassCard>
        </Reveal>

        <div className="space-y-4">
          <Reveal>
            <GlassCard className="glass-strong relative overflow-hidden p-6">
              <div className="veil pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative flex items-start gap-3">
                <span className="orb grid size-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Brain className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">AI supplier summary</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                    {s.name} is a {s.status.toLowerCase()} {s.category.toLowerCase()} supplier with {s.reliability}% reliability and {s.onTime}% on-time delivery.
                    {" "}Pricing runs {s.priceIndex < 0 ? `${Math.abs(s.priceIndex)}% below` : `${s.priceIndex}% above`} market.
                    {s.risk === "High" ? " Risk is elevated — I'd dual-source before the next cycle." : s.risk === "Medium" ? " Risk is moderate — worth monitoring lead times." : " A dependable, low-risk partner."}
                  </p>
                </div>
              </div>
            </GlassCard>
          </Reveal>

          <Reveal delay={80}>
            <GlassCard className="p-6">
              <SectionLabel icon={BarChart3}>Performance</SectionLabel>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {metrics.map((m) => (
                  <div key={m.k}>
                    <div className="flex items-baseline justify-between text-sm"><span className="text-foreground/80">{m.k}</span><span className="tabular-nums text-gold">{m.v}</span></div>
                    <div className="mt-1.5"><Bar value={m.v} /></div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

const criteria = [
  { key: "price", label: "Price competitiveness", get: (s: Supplier) => Math.max(0, Math.min(100, 50 - s.priceIndex * 3)) },
  { key: "reliability", label: "Reliability", get: (s: Supplier) => s.reliability },
  { key: "onTime", label: "On-time delivery", get: (s: Supplier) => s.onTime },
  { key: "lead", label: "Lead time", get: (s: Supplier) => Math.max(0, 100 - s.leadTime * 4) },
  { key: "quality", label: "Quality", get: (s: Supplier) => Math.round((s.rating / 5) * 100) },
];

function CompareView() {
  const [ids, setIds] = useState<string[]>(["SUP-01", "SUP-02", "SUP-04"]);
  const chosen = suppliers.filter((s) => ids.includes(s.id));
  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev));

  const scores = chosen.map((s) => ({ s, total: criteria.reduce((a, c) => a + c.get(s), 0) }));
  const winner = scores.sort((a, b) => b.total - a.total)[0]?.s;

  return (
    <div className="space-y-4">
      <Reveal>
        <GlassCard className="p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pick up to 3 suppliers</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                disabled={!ids.includes(s.id) && ids.length >= 3}
                className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-40", ids.includes(s.id) ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")}
                style={ids.includes(s.id) ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
              >
                {s.name}
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      {chosen.length > 0 && (
        <Reveal>
          <GlassCard className="glass-strong relative overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative flex items-center gap-3">
              <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Sparkles className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
              <p className="text-sm text-foreground/90">
                AI verdict: <span className="font-semibold text-gold">{winner?.name}</span> is the strongest overall —
                best balance of price, reliability and delivery. Consider it your primary for {winner?.category.toLowerCase()}.
              </p>
            </div>
          </GlassCard>
        </Reveal>
      )}

      <Reveal>
        <GlassCard className="overflow-x-auto p-6">
          <div className="min-w-[32rem]">
            <div className="grid items-center gap-4 border-b border-border pb-3" style={{ gridTemplateColumns: `10rem repeat(${chosen.length}, 1fr)` }}>
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Criteria</span>
              {chosen.map((s) => (
                <span key={s.id} className="text-center text-sm font-semibold text-foreground">{s.name}</span>
              ))}
            </div>
            {criteria.map((c) => {
              const best = Math.max(...chosen.map((s) => c.get(s)));
              return (
                <div key={c.key} className="grid items-center gap-4 border-b border-border/50 py-3" style={{ gridTemplateColumns: `10rem repeat(${chosen.length}, 1fr)` }}>
                  <span className="text-sm text-foreground/80">{c.label}</span>
                  {chosen.map((s) => {
                    const v = c.get(s);
                    const isBest = v === best;
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full" style={{ width: `${v}%`, background: isBest ? "var(--gradient-gold)" : "oklch(0.7 0.015 85 / 50%)" }} />
                        </div>
                        <span className={cn("w-8 text-right text-xs tabular-nums", isBest ? "text-gold" : "text-muted-foreground")}>{v}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function OrdersView() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Open POs" value={18} icon={FileText} />
        <StatTile label="In transit value" value={64200} prefix="$" icon={Truck} />
        <StatTile label="Avg approval time" value={4.2} suffix=" hrs" decimals={1} delta="1.1 hrs" icon={Clock} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={FileText}>Purchase orders</SectionLabel>
            <button className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>New PO</button>
          </div>
          <div className="mt-4 space-y-1">
            {purchaseOrders.map((o) => {
              const color = poStatusColor[o.status];
              return (
                <div key={o.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 hover:border-gold/20 hover:bg-glass sm:grid-cols-[auto_1.4fr_1fr_0.8fr_auto]">
                  <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                  <div className="flex items-center gap-3">
                    <Avatar name={o.supplier} />
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{o.supplier}</p><p className="text-xs text-muted-foreground">{o.items} items · {o.placed}</p></div>
                  </div>
                  <span className="hidden items-center gap-1.5 text-xs sm:flex" style={{ color }}><span className="size-1.5 rounded-full" style={{ background: color }} />{o.status}</span>
                  <span className="hidden text-xs text-muted-foreground sm:block">ETA {o.eta}</span>
                  <span className="text-right text-sm font-semibold tabular-nums text-gold">${formatNum(o.total)}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function PricingView() {
  const savings = materials.filter((m) => m.your < m.market).reduce((a, m) => a + (m.market - m.your), 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Tracked materials" value={64} icon={Package} />
        <StatTile label="Below market" value={72} suffix="%" delta="5 pts" icon={TrendingDown} />
        <StatTile label="Est. monthly savings" value={8400} prefix="$" delta="3.2%" icon={DollarSign} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={DollarSign}>Price intelligence</SectionLabel>
            <span className="text-xs text-muted-foreground">your price vs market</span>
          </div>
          <div className="mt-4 space-y-2">
            {materials.map((m) => {
              const cheaper = m.your < m.market;
              const diff = Math.round(((m.your - m.market) / m.market) * 100);
              return (
                <div key={m.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-2xl border border-border bg-background/30 p-3 sm:grid-cols-[1.4fr_auto_auto_auto]">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">market ${m.market.toFixed(2)}</p></div>
                  <div className="hidden sm:block"><PriceLine data={m.trend} up={m.change > 0} /></div>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">${m.your.toFixed(2)}</span>
                  <Delta value={`${Math.abs(diff)}%`} positive={cheaper} />
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex items-center gap-2 rounded-2xl border border-gold/25 bg-glass p-3 text-sm text-foreground/85">
            <Zap className="size-4 shrink-0 text-gold" />
            You're beating market on 3 of 4 key materials — locking Jojoba Oil now could avoid a projected 6% Q4 rise.
          </p>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function RiskView() {
  const high = suppliers.filter((s) => s.risk === "High");
  const categoriesRisk = [
    { label: "Delivery risk", value: 28 },
    { label: "Financial risk", value: 16 },
    { label: "Geographic concentration", value: 42 },
    { label: "Single-source exposure", value: 34 },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="High-risk suppliers" value={1} icon={ShieldAlert} positive={false} />
        <StatTile label="Portfolio risk score" value={22} suffix="/100" icon={ShieldCheck} />
        <StatTile label="Single-sourced items" value={11} icon={AlertTriangle} positive={false} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={ShieldAlert}>Risk matrix</SectionLabel>
            <p className="mt-1 text-xs text-muted-foreground">Bubble size = annual spend · color = risk</p>
            <div className="mt-4 flex-1"><RiskMatrix /></div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={BarChart3}>Risk exposure</SectionLabel>
            <div className="mt-5 space-y-4">
              {categoriesRisk.map((c) => (
                <div key={c.label}>
                  <div className="flex items-baseline justify-between text-sm"><span className="text-foreground/80">{c.label}</span><span className="tabular-nums text-muted-foreground">{c.value}%</span></div>
                  <div className="mt-1.5"><Bar value={c.value * 2} tone={c.value > 35 ? "gold" : "muted"} /></div>
                </div>
              ))}
            </div>
            {high.map((s) => (
              <div key={s.id} className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-3">
                <span className="grid size-8 place-items-center rounded-lg" style={{ background: "oklch(0.68 0.16 25 / 15%)" }}><ShieldAlert className="size-4" style={{ color: riskColor.High }} /></span>
                <p className="flex-1 text-sm text-foreground/85"><span className="font-medium">{s.name}</span> — on-time at {s.onTime}%, recommend dual-sourcing</p>
              </div>
            ))}
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

type ChatMsg = { role: "ai" | "user"; text: string };
const suggestedPrompts = ["Who's my most reliable supplier?", "Where can I cut costs?", "Any supplier risks this month?", "Draft a PO for glass bottles"];

function AssistantView() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "I monitor 48 suppliers — pricing, reliability, lead times and risk. Ask me who to buy from, where to save, or what to watch." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const answerFor = (q: string) => {
    const s = q.toLowerCase();
    if (s.includes("reliable")) return "Northwind Supply leads at 94% reliability and 97% on-time — your most dependable partner, and a preferred vendor.";
    if (s.includes("cut cost") || s.includes("save")) return "Shift glass volume to Tidewater Caps (14% below market) and lock Jojoba Oil before Q4. Combined, that's ~$42k/yr.";
    if (s.includes("risk")) return "Solstice Freight is trending high-risk — on-time fell to 71%. I'd dual-source logistics before the next cycle.";
    if (s.includes("draft") || s.includes("po")) return "Drafted PO-2044 to Northwind Supply for amber glass bottles — 5,000 units at $0.82, total $4,100. Ready for your approval.";
    return "Across your portfolio, spend is concentrated in Packaging (38%). Diversifying one glass supplier would cut geographic risk meaningfully.";
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
          <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Bot className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Procurement Copilot</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-400" /> Monitoring 48 suppliers</p>
          </div>
        </div>
        <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>{m.text}</div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedPrompts.map((p) => (
            <button key={p} onClick={() => send(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your procurement copilot…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
        </form>
      </GlassCard>
    </Reveal>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: "Supplier command center", sub: "Your AI procurement manager" },
  database: { title: "Supplier intelligence", sub: "Every vendor, scored" },
  compare: { title: "Comparison engine", sub: "Pick the right supplier, objectively" },
  orders: { title: "Purchase orders", sub: "From draft to received" },
  pricing: { title: "Price intelligence", sub: "Your price vs the market" },
  risk: { title: "Risk analysis", sub: "See exposure before it bites" },
  assistant: { title: "AI procurement assistant", sub: "Ask your procurement copilot" },
};

export function SuppliersWorkspace() {
  const [active, setActive] = useState<ViewKey>("overview");
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const meta = viewMeta[active];

  const openSupplier = (id: string) => {
    setSupplierId(id);
    setActive("database");
  };

  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Suppliers</p>
        <nav className="mt-2 space-y-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => { setActive(v.key); if (v.key !== "database") setSupplierId(null); }}
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
          <button onClick={() => setActive("compare")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <Scale className="size-4" stroke="oklch(0.2 0.02 70)" /> Compare suppliers
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => { setActive(v.key); if (v.key !== "database") setSupplierId(null); }}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")}
              style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        <div key={active + (supplierId ?? "")} className="rise">
          {active === "overview" && <OverviewView onOpen={openSupplier} />}
          {active === "database" && <DatabaseView selectedId={supplierId} onSelect={setSupplierId} />}
          {active === "compare" && <CompareView />}
          {active === "orders" && <OrdersView />}
          {active === "pricing" && <PricingView />}
          {active === "risk" && <RiskView />}
          {active === "assistant" && <AssistantView />}
        </div>
      </section>
    </div>
  );
}
