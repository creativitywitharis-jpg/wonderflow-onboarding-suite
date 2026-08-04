import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Boxes,
  Brain,
  Building2,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Globe,
  Home,
  Layers,
  Megaphone,
  Package,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Donut, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";

/* ──────────────────────────────────────────────────────────────────────
 * Chart toolkit
 * ─────────────────────────────────────────────────────────────────── */

const GOLD = "oklch(0.84 0.14 84)";
const palette = [GOLD, "oklch(0.7 0.11 60)", "oklch(0.66 0.09 200)", "oklch(0.75 0.13 150)", "oklch(0.62 0.12 300)"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Area chart with optional comparison (dashed) series. */
function AreaChart({ data, compare, height = 176 }: { data: number[]; compare?: number[]; height?: number }) {
  const { ref, inView } = useInView();
  const W = 340;
  const H = 150;
  const all = compare ? [...data, ...compare] : data;
  const min = Math.min(...all) * 0.9;
  const max = Math.max(...all) * 1.03;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const path = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${path(data)} L ${W} ${H} L 0 ${H} Z`;
  return (
    <div ref={ref} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="an-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.84 0.14 84 / 28%)" />
            <stop offset="100%" stopColor="oklch(0.84 0.14 84 / 0%)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#an-area)" style={{ opacity: inView ? 1 : 0, transition: "opacity 0.9s ease" }} />
        {compare && <path d={path(compare)} fill="none" stroke="oklch(0.7 0.015 85 / 55%)" strokeWidth="1.8" strokeDasharray="5 4" style={{ opacity: inView ? 1 : 0, transition: "opacity 0.9s ease 0.3s" }} />}
        <path d={path(data)} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="spark-draw" />
      </svg>
    </div>
  );
}

/** Vertical bars with optional labels. */
function Bars({ data, labels, height = 160 }: { data: number[]; labels?: string[]; height?: number }) {
  const { ref, inView } = useInView();
  const max = Math.max(...data);
  return (
    <div ref={ref}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col justify-end">
            <div className="rounded-t-md transition-all duration-700 ease-out" style={{ height: inView ? `${(v / max) * 100}%` : "0%", transitionDelay: `${i * 40}ms`, background: i === data.length - 1 ? "var(--gradient-gold)" : "oklch(0.84 0.14 84 / 22%)" }} />
          </div>
        ))}
      </div>
      {labels && <div className="mt-2 flex gap-1.5 text-[0.6rem] text-muted-foreground">{labels.map((l, i) => <span key={i} className="flex-1 text-center">{l}</span>)}</div>}
    </div>
  );
}

/** Horizontal ranking bars. */
function HBars({ items }: { items: { label: string; value: number; display?: string }[] }) {
  const { ref, inView } = useInView();
  const max = Math.max(...items.map((i) => i.value));
  return (
    <div ref={ref} className="space-y-3">
      {items.map((it, i) => (
        <div key={it.label}>
          <div className="flex items-baseline justify-between text-sm"><span className="truncate text-foreground/85">{it.label}</span><span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{it.display ?? formatNum(it.value)}</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: inView ? `${(it.value / max) * 100}%` : "0%", transitionDelay: `${i * 60}ms`, background: "var(--gradient-gold)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Intensity heatmap (e.g. cohort retention). */
function Heatmap({ rows, cols }: { rows: { label: string; cells: number[] }[]; cols: string[] }) {
  return (
    <div className="min-w-[28rem]">
      <div className="mb-1 flex gap-1 pl-10 text-[0.6rem] text-muted-foreground">{cols.map((c) => <span key={c} className="flex-1 text-center">{c}</span>)}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-1">
            <span className="w-10 text-xs text-muted-foreground">{r.label}</span>
            {r.cells.map((v, i) => (
              <div key={i} className="grid h-8 flex-1 place-items-center rounded text-[0.65rem] tabular-nums" style={{ background: v ? `oklch(0.84 0.14 84 / ${(v / 100) * 0.4 + 0.05})` : "transparent", color: v ? "var(--color-foreground)" : "transparent" }}>{v ? `${v}%` : ""}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ items }: { items: { label: string; share: number; color: string }[] }) {
  return (
    <ul className="min-w-0 flex-1 space-y-2">
      {items.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} /><span className="flex-1 truncate text-foreground/85">{s.label}</span><span className="tabular-nums text-muted-foreground">{s.share}%</span></li>
      ))}
    </ul>
  );
}

function ChartCard({ title, icon, children, className, right }: { title: string; icon: LucideIcon; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <Reveal className="h-full">
      <GlassCard className={cn("flex h-full flex-col p-6", className)}>
        <div className="flex items-baseline justify-between"><SectionLabel icon={icon}>{title}</SectionLabel>{right}</div>
        <div className="mt-5 flex-1">{children}</div>
      </GlassCard>
    </Reveal>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Data
 * ─────────────────────────────────────────────────────────────────── */

const revenueYr = [220, 238, 231, 255, 268, 281, 296, 312, 305, 331, 352, 374];
const revenueLastYr = [180, 192, 198, 205, 214, 220, 232, 240, 246, 258, 270, 285];

const salesChannels = [
  { label: "Online store", share: 58, color: palette[0] },
  { label: "POS", share: 22, color: palette[1] },
  { label: "Marketplace", share: 14, color: palette[2] },
  { label: "Social", share: 6, color: palette[3] },
];
const topProducts = [
  { label: "Aurora Serum", value: 23256, display: "$23.3k" },
  { label: "Midnight Oil", value: 15552, display: "$15.6k" },
  { label: "Golden Hour Balm", value: 8988, display: "$9.0k" },
  { label: "Radiance Mask", value: 8448, display: "$8.4k" },
];
const custSegments = [
  { label: "Champions", share: 34, color: palette[0] },
  { label: "Loyal", share: 28, color: palette[1] },
  { label: "New", share: 26, color: palette[2] },
  { label: "At risk", share: 12, color: palette[3] },
];
const retention = {
  cols: ["M0", "M1", "M2", "M3", "M4"],
  rows: [
    { label: "Mar", cells: [100, 88, 79, 72, 68] },
    { label: "Apr", cells: [100, 90, 82, 76, 0] },
    { label: "May", cells: [100, 91, 84, 0, 0] },
    { label: "Jun", cells: [100, 93, 0, 0, 0] },
  ],
};
const categories = [
  { label: "Serums", share: 32, color: palette[0] },
  { label: "Oils", share: 24, color: palette[1] },
  { label: "Cleansers", share: 18, color: palette[2] },
  { label: "Balms", share: 14, color: palette[3] },
  { label: "Masks", share: 12, color: palette[4] },
];
const spendByCategory = [
  { label: "Packaging", share: 38, color: palette[0] },
  { label: "Ingredients", share: 30, color: palette[1] },
  { label: "Oils", share: 13, color: palette[2] },
  { label: "Logistics", share: 12, color: palette[3] },
  { label: "Labels", share: 7, color: palette[4] },
];
const topSuppliers = [
  { label: "Northwind Supply", value: 428000, display: "$428k" },
  { label: "Lumen Labs", value: 356000, display: "$356k" },
  { label: "Fjord Materials", value: 214000, display: "$214k" },
  { label: "Halcyon Glass", value: 189000, display: "$189k" },
];
const marketingChannels = [
  { label: "Email", share: 34, color: palette[0] },
  { label: "Social", share: 24, color: palette[1] },
  { label: "Ads", share: 18, color: palette[2] },
  { label: "Referral", share: 14, color: palette[3] },
  { label: "SMS", share: 10, color: palette[4] },
];
const campaigns = [
  { label: "Champions VIP", value: 84, display: "8.4x" },
  { label: "Summer Glow", value: 52, display: "5.2x" },
  { label: "Cart Retarget", value: 41, display: "4.1x" },
  { label: "Referral Teaser", value: 33, display: "3.3x" },
];
const expenses = [
  { label: "COGS", share: 32, color: palette[0] },
  { label: "Marketing", share: 22, color: palette[1] },
  { label: "Payroll", share: 26, color: palette[2] },
  { label: "Ops", share: 12, color: palette[3] },
  { label: "Other", share: 8, color: palette[4] },
];

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

function ExecutiveView() {
  const scorecard = [
    { label: "Sales", value: 88, display: "88" },
    { label: "Marketing", value: 76, display: "76" },
    { label: "Operations", value: 82, display: "82" },
    { label: "Finance", value: 90, display: "90" },
    { label: "Product", value: 79, display: "79" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue (YTD)" value={3420000} prefix="$" delta="18%" icon={DollarSign} />
        <StatTile label="Orders (YTD)" value={28400} delta="12%" icon={ShoppingCart} />
        <StatTile label="Customers" value={2841} delta="6%" icon={Users} />
        <StatTile label="Gross margin" value={68} suffix="%" delta="2 pts" icon={TrendingUp} />
      </div>

      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative flex items-start gap-4">
            <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Brain className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">What's happening</p>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">You finally understand everything happening inside the company. Revenue is up <span className="text-gold">18% YTD</span>, driven by Champions and the Online store. Watch marketing efficiency — CAC is creeping up while ROAS holds at 5.4x.</p>
            </div>
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Revenue vs last year" icon={BarChart3} right={<span className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded" style={{ background: GOLD }} />This yr</span><span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-muted-foreground/50" />Last yr</span></span>}>
          <AreaChart data={revenueYr} compare={revenueLastYr} />
        </ChartCard>
        <ChartCard title="Department scorecard" icon={Target}>
          <HBars items={scorecard} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue by segment" icon={Users}>
          <div className="flex items-center gap-6"><Donut data={custSegments} size={150} /><Legend items={custSegments} /></div>
        </ChartCard>
        <ChartCard title="Top products" icon={Package}><HBars items={topProducts} /></ChartCard>
      </div>
    </div>
  );
}

function SalesView() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue (30d)" value={412908} prefix="$" delta="12.4%" icon={DollarSign} />
        <StatTile label="Orders (30d)" value={3284} delta="8.1%" icon={ShoppingCart} />
        <StatTile label="Avg order value" value={124} prefix="$" delta="3.1%" icon={Activity} />
        <StatTile label="Conversion" value={2.7} suffix="%" decimals={1} delta="0.3 pts" icon={Target} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Monthly revenue" icon={BarChart3} right={<span className="text-xs text-muted-foreground">$K</span>}><Bars data={revenueYr} labels={months} /></ChartCard>
        <ChartCard title="Sales by channel" icon={Globe}><div className="flex items-center gap-6"><Donut data={salesChannels} size={150} /><Legend items={salesChannels} /></div></ChartCard>
      </div>
      <ChartCard title="Top products by revenue" icon={Package}><HBars items={topProducts} /></ChartCard>
    </div>
  );
}

function CustomersView() {
  const acquisition = [64, 72, 68, 81, 88, 96, 104, 118, 112, 128, 136, 142];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="New (30d)" value={142} delta="18%" icon={Users} />
        <StatTile label="Active customers" value={2190} delta="4%" icon={Activity} />
        <StatTile label="Churn rate" value={2.4} suffix="%" decimals={1} delta="0.3 pts" positive icon={TrendingUp} />
        <StatTile label="Avg LTV" value={4820} prefix="$" delta="11%" icon={DollarSign} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="New customers / month" icon={TrendingUp}><AreaChart data={acquisition} /></ChartCard>
        <ChartCard title="Segments" icon={Users}><div className="flex items-center gap-6"><Donut data={custSegments} size={150} /><Legend items={custSegments} /></div></ChartCard>
      </div>
      <ChartCard title="Cohort retention" icon={Layers} className="overflow-x-auto"><Heatmap rows={retention.rows} cols={retention.cols} /></ChartCard>
    </div>
  );
}

function ProductsView() {
  const units = [420, 468, 512, 498, 540, 588, 612, 654];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active SKUs" value={912} delta="18" icon={Package} />
        <StatTile label="Units sold (30d)" value={4626} delta="9%" icon={ShoppingCart} />
        <StatTile label="Sell-through" value={68} suffix="%" delta="2.2 pts" icon={Target} />
        <StatTile label="Return rate" value={2.1} suffix="%" decimals={1} delta="0.4 pts" positive icon={Activity} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top products" icon={Package}><HBars items={topProducts} /></ChartCard>
        <ChartCard title="Sales by category" icon={Layers}><div className="flex items-center gap-6"><Donut data={categories} size={150} /><Legend items={categories} /></div></ChartCard>
      </div>
      <ChartCard title="Units sold trend" icon={BarChart3}><Bars data={units} labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]} /></ChartCard>
    </div>
  );
}

function InventoryView() {
  const value = [280, 292, 288, 305, 312, 320, 318, 332, 340, 352, 361, 374];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Inventory value" value={374200} prefix="$" delta="3.6%" icon={Layers} />
        <StatTile label="Turnover rate" value={5.4} suffix="x" decimals={1} delta="0.4x" icon={Activity} />
        <StatTile label="Low / critical" value={2} delta="1" positive={false} icon={Boxes} />
        <StatTile label="Deadstock" value={4.1} suffix="%" decimals={1} delta="0.6 pts" positive icon={TrendingUp} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Inventory value trend" icon={BarChart3} right={<span className="text-xs text-muted-foreground">$K</span>}><Bars data={value} labels={months} /></ChartCard>
        <ChartCard title="Stock by category" icon={Layers}><div className="flex items-center gap-6"><Donut data={categories} size={150} /><Legend items={categories} /></div></ChartCard>
      </div>
    </div>
  );
}

function SuppliersView() {
  const onTime = [86, 88, 87, 90, 89, 91, 90, 92, 91, 93, 92, 94];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Annual spend" value={1420000} prefix="$" delta="6.1%" positive={false} icon={DollarSign} />
        <StatTile label="On-time rate" value={91} suffix="%" delta="2.3 pts" icon={CheckCircle2} />
        <StatTile label="Avg lead time" value={8.4} suffix=" days" decimals={1} delta="0.7 days" icon={Activity} />
        <StatTile label="Active suppliers" value={48} delta="4" icon={Building2} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ChartCard title="Spend by category" icon={Globe}><div className="flex items-center gap-6"><Donut data={spendByCategory} size={150} /><Legend items={spendByCategory} /></div></ChartCard>
        <ChartCard title="On-time delivery trend" icon={TrendingUp}><AreaChart data={onTime} /></ChartCard>
      </div>
      <ChartCard title="Top suppliers by spend" icon={Building2}><HBars items={topSuppliers} /></ChartCard>
    </div>
  );
}

function MarketingView() {
  const spendRev = [3.8, 4.1, 4.0, 4.4, 4.6, 4.9, 5.1, 5.4];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visitors (30d)" value={48200} delta="12%" icon={Globe} />
        <StatTile label="Conversion" value={2.7} suffix="%" decimals={1} delta="0.3 pts" icon={Target} />
        <StatTile label="Avg CAC" value={86} prefix="$" delta="12%" positive icon={Activity} />
        <StatTile label="Blended ROAS" value={5.4} suffix="x" decimals={1} delta="0.5x" icon={TrendingUp} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="New customers by channel" icon={Globe}><div className="flex items-center gap-6"><Donut data={marketingChannels} size={150} /><Legend items={marketingChannels} /></div></ChartCard>
        <ChartCard title="Top campaigns by ROI" icon={Megaphone}><HBars items={campaigns} /></ChartCard>
      </div>
      <ChartCard title="Blended ROAS trend" icon={TrendingUp}><Bars data={spendRev} labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]} /></ChartCard>
    </div>
  );
}

function FinancialView() {
  const cash = [220, 232, 228, 245, 258, 266, 274, 288, 296, 312, 328, 342];
  const pnl = [
    { label: "Revenue", value: 374, display: "$374k" },
    { label: "Gross profit", value: 254, display: "$254k" },
    { label: "Operating profit", value: 128, display: "$128k" },
    { label: "Net profit", value: 96, display: "$96k" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue (mo)" value={374200} prefix="$" delta="6.3%" icon={DollarSign} />
        <StatTile label="Gross margin" value={68} suffix="%" delta="2 pts" icon={TrendingUp} />
        <StatTile label="Net margin" value={26} suffix="%" delta="1.4 pts" icon={Target} />
        <StatTile label="Cash on hand" value={342000} prefix="$" delta="4.9%" icon={Activity} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="P&L waterfall" icon={BarChart3}><HBars items={pnl} /></ChartCard>
        <ChartCard title="Expense breakdown" icon={Layers}><div className="flex items-center gap-6"><Donut data={expenses} size={150} /><Legend items={expenses} /></div></ChartCard>
      </div>
      <ChartCard title="Cash position trend" icon={TrendingUp} right={<span className="text-xs text-muted-foreground">$K</span>}><AreaChart data={cash} /></ChartCard>
    </div>
  );
}

const reportTypes = ["Executive summary", "Monthly business review", "Sales deep-dive", "Financial statement"];
const periods = ["This month", "Last month", "This quarter", "Year to date"];

function ReportView() {
  const [type, setType] = useState(reportTypes[0]);
  const [period, setPeriod] = useState(periods[0]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ title: string; body: string[] } | null>(null);
  const generate = () => {
    setBusy(true); setReport(null);
    window.setTimeout(() => {
      setReport({
        title: `${type} — ${period}`,
        body: [
          `Overall, the business is healthy and growing. Revenue reached $374k (${period.toLowerCase()}), up 6.3% with a 68% gross margin and 26% net margin.`,
          `Growth is led by the Champions segment and the Online store channel (58% of sales). New customer acquisition rose 18%, while churn held at a low 2.4%.`,
          `Operationally, fulfilment is at 97% on-time and inventory turnover improved to 5.4x. One supply risk (Solstice Freight) is being mitigated via dual-sourcing.`,
          `Recommendation: pursue the referral engine and an 8% price increase on hero SKUs — combined projected lift of +9% MRR at low risk.`,
        ],
      });
      setBusy(false);
    }, 1400);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <Reveal>
        <GlassCard className="glass-strong sticky top-6 overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2"><Wand2 className="size-4 text-gold" /><p className="text-sm font-semibold">AI report generator</p></div>
            <label className="mt-4 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Report type</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50">{reportTypes.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <label className="mt-3 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Period</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50">{periods.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <button onClick={generate} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}><Sparkles className="size-4" /> {busy ? "Writing…" : "Generate report"}</button>
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="flex min-h-[26rem] flex-col p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={FileText}>Report</SectionLabel>
            {report && !busy && <button className="flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 hover:border-gold/40"><Download className="size-3.5" /> Export</button>}
          </div>
          <div className="mt-5 flex-1">
            {busy && <div className="typing flex items-center gap-1 py-4"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div>}
            {!busy && report && (
              <div>
                <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{report.title}</h3>
                <div className="mt-4 space-y-3">{report.body.map((p, i) => <p key={i} className="text-sm leading-relaxed text-foreground/85">{p}</p>)}</div>
              </div>
            )}
            {!busy && !report && <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">Pick a type and period, then generate an AI-written report.</p>}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

const builderMetrics = ["Revenue", "Orders", "Customers", "AOV"] as const;
const builderDims = ["By month", "By channel", "By category", "By segment"] as const;
const builderCharts = ["Bars", "Area", "Donut"] as const;

function BuilderView() {
  const [metric, setMetric] = useState<(typeof builderMetrics)[number]>("Revenue");
  const [dim, setDim] = useState<(typeof builderDims)[number]>("By month");
  const [chart, setChart] = useState<(typeof builderCharts)[number]>("Bars");

  const dataset = useMemo(() => {
    const scale = metric === "Revenue" ? 1 : metric === "Orders" ? 0.09 : metric === "Customers" ? 0.008 : 0.33;
    if (dim === "By month") return { kind: "series" as const, values: revenueYr.map((v) => Math.round(v * scale)) };
    const map: Record<string, { label: string; share: number; color: string }[]> = { "By channel": salesChannels, "By category": categories, "By segment": custSegments };
    return { kind: "split" as const, split: map[dim] ?? salesChannels };
  }, [metric, dim]);

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-gold" /><p className="text-sm font-semibold">Build a view</p></div>
          {[
            { label: "Metric", opts: builderMetrics as readonly string[], val: metric, set: (v: string) => setMetric(v as never) },
            { label: "Dimension", opts: builderDims as readonly string[], val: dim, set: (v: string) => setDim(v as never) },
            { label: "Chart type", opts: builderCharts as readonly string[], val: chart, set: (v: string) => setChart(v as never) },
          ].map((row) => (
            <div key={row.label} className="mt-4">
              <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {row.opts.map((o) => (
                  <button key={o} onClick={() => row.set(o)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", row.val === o ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={row.val === o ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{o}</button>
                ))}
              </div>
            </div>
          ))}
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="flex min-h-[24rem] flex-col p-6">
          <div className="flex items-baseline justify-between">
            <SectionLabel icon={BarChart3}>{metric} · {dim.toLowerCase()}</SectionLabel>
            <button className="flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 hover:border-gold/40"><CheckCircle2 className="size-3.5 text-gold" /> Save view</button>
          </div>
          <div className="mt-6 flex-1">
            {dataset.kind === "series" && chart === "Bars" && <Bars data={dataset.values} labels={months} />}
            {dataset.kind === "series" && chart === "Area" && <AreaChart data={dataset.values} />}
            {dataset.kind === "series" && chart === "Donut" && (
              <div className="grid place-items-center py-6 text-center text-sm text-muted-foreground">Donut needs a categorical dimension — try “By channel”.</div>
            )}
            {dataset.kind === "split" && chart === "Donut" && <div className="flex items-center gap-6"><Donut data={dataset.split} size={160} /><Legend items={dataset.split} /></div>}
            {dataset.kind === "split" && chart === "Bars" && <Bars data={dataset.split.map((s) => s.share)} labels={dataset.split.map((s) => s.label)} />}
            {dataset.kind === "split" && chart === "Area" && <Bars data={dataset.split.map((s) => s.share)} labels={dataset.split.map((s) => s.label)} />}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "executive" | "sales" | "customers" | "products" | "inventory" | "suppliers" | "marketing" | "financial" | "report" | "builder";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "executive", label: "Executive", icon: Home },
  { key: "sales", label: "Sales", icon: ShoppingCart },
  { key: "customers", label: "Customers", icon: Users },
  { key: "products", label: "Products", icon: Package },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "suppliers", label: "Suppliers", icon: Building2 },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "financial", label: "Financial", icon: DollarSign },
  { key: "report", label: "AI Reports", icon: FileText },
  { key: "builder", label: "Builder", icon: SlidersHorizontal },
];

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  executive: { title: "Executive analytics", sub: "Understand everything, at a glance" },
  sales: { title: "Sales analytics", sub: "Where revenue comes from" },
  customers: { title: "Customer analytics", sub: "Who buys, and why they stay" },
  products: { title: "Product analytics", sub: "What sells and what stalls" },
  inventory: { title: "Inventory analytics", sub: "Value, turnover and coverage" },
  suppliers: { title: "Supplier analytics", sub: "Spend, reliability and lead time" },
  marketing: { title: "Marketing analytics", sub: "Every channel, measured" },
  financial: { title: "Financial analytics", sub: "Margins, cash and profit" },
  report: { title: "AI report generator", sub: "A written report in seconds" },
  builder: { title: "Custom analytics builder", sub: "Build any view you need" },
};

export function AnalyticsWorkspace() {
  const [active, setActive] = useState<ViewKey>("executive");
  const meta = viewMeta[active];
  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 lg:flex">
        <Brand subtle />
        <p className="mt-6 flex items-center gap-1.5 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-gold"><BarChart3 className="size-3" /> Intelligence</p>
        <nav className="mt-2 space-y-1 overflow-y-auto">
          {views.map((v) => (
            <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className={cn("size-4", active === v.key && "text-gold")} />
              {v.label}
            </button>
          ))}
        </nav>
        <Link to="/dashboard" className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground">
          <ArrowLeft className="size-4" /> Command center
        </Link>
      </aside>

      <section className="min-w-0 flex-1 space-y-5">
        <div className="rise flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{meta.sub}</p>
            <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}><span className="gold-text italic">{meta.title}</span></h1>
          </div>
          <button onClick={() => setActive("report")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <FileText className="size-4" stroke="oklch(0.2 0.02 70)" /> Generate report
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
          {views.map((v) => (
            <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        <div key={active} className="rise">
          {active === "executive" && <ExecutiveView />}
          {active === "sales" && <SalesView />}
          {active === "customers" && <CustomersView />}
          {active === "products" && <ProductsView />}
          {active === "inventory" && <InventoryView />}
          {active === "suppliers" && <SuppliersView />}
          {active === "marketing" && <MarketingView />}
          {active === "financial" && <FinancialView />}
          {active === "report" && <ReportView />}
          {active === "builder" && <BuilderView />}
        </div>
      </section>
    </div>
  );
}
