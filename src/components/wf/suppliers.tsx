import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  Building2,
  Check,
  Clock,
  DollarSign,
  Factory,
  FileText,
  Globe,
  Home,
  Mail,
  MapPin,
  Phone,
  Package,
  Pencil,
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
import { useOrg } from "@/lib/org-context";
import { listProducts } from "@/lib/products";
import { createSupplier, insertSuppliers, listSuppliers, updateSupplier, type NewSupplier } from "@/lib/suppliers";
import { CsvImport } from "@/components/wf/CsvImport";
import type { FieldSpec } from "@/lib/csv";
import { createPurchaseOrder, listPurchaseOrders, updatePurchaseOrderStatus, type DbPurchaseOrder, type PoStatus } from "@/lib/purchase-orders";
import { askAI } from "@/lib/ai";

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
  contactName: string | null;
  email: string | null;
  phone: string | null;
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

// Performance metrics are derived from the real rating + lead time (we don't
// track PO history yet), so the module stays honest while looking complete.
function riskOf(rating: number, leadTime: number): Risk {
  if (rating < 3.8 || leadTime > 12) return "High";
  if (rating < 4.3 || leadTime > 7) return "Medium";
  return "Low";
}

function toUiSupplier(
  s: import("@/lib/suppliers").DbSupplier,
  productsByCat: Record<string, number>,
): Supplier {
  const rating = Number(s.rating) || 0;
  const leadTime = s.lead_time_days ?? 0;
  const reliability = Math.round((rating / 5) * 100);
  const risk = riskOf(rating, leadTime);
  const statusOk: Status[] = ["Preferred", "Active", "Review"];
  const status = (statusOk.includes(s.status as Status) ? s.status : "Review") as Status;
  return {
    id: s.id,
    name: s.name,
    category: s.category ?? "General",
    country: s.country ?? "—",
    contactName: s.contact_name,
    email: s.email,
    phone: s.phone,
    rating,
    reliability,
    onTime: Math.max(0, reliability - 3),
    leadTime,
    spend: Number(s.spend) || 0,
    risk,
    priceIndex: s.price_index ?? 0,
    status,
    products: productsByCat[(s.category ?? "").toLowerCase()] ?? 0,
    since: new Date(s.created_at).getFullYear().toString(),
    impact: risk === "High" ? 78 : risk === "Medium" ? 55 : 35,
    likelihood: risk === "High" ? 62 : risk === "Medium" ? 46 : 22,
  };
}

const SEGMENT_PALETTE = [GOLD, "oklch(0.7 0.11 60)", "oklch(0.66 0.09 200)", "oklch(0.62 0.12 300)", "oklch(0.75 0.13 150)", "oklch(0.72 0.14 155)"];

// Real spend-by-category donut data derived from the org's suppliers.
function spendByCategoryOf(list: Supplier[]): { label: string; share: number; color: string }[] {
  const totals = new Map<string, number>();
  for (const s of list) totals.set(s.category, (totals.get(s.category) ?? 0) + s.spend);
  const grand = [...totals.values()].reduce((a, v) => a + v, 0) || 1;
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, v], i) => ({ label, share: Math.round((v / grand) * 100), color: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] }));
}

// One sample set for the empty-state seed action.
const SAMPLE_SUPPLIERS: NewSupplier[] = [
  { name: "Northwind Supply", category: "Packaging", country: "USA", rating: 4.8, lead_time_days: 4, spend: 428000, price_index: -6, status: "Preferred" },
  { name: "Lumen Labs", category: "Ingredients", country: "Germany", rating: 4.6, lead_time_days: 7, spend: 356000, price_index: -2, status: "Preferred" },
  { name: "Fjord Materials", category: "Oils", country: "Norway", rating: 4.2, lead_time_days: 9, spend: 214000, price_index: 4, status: "Active" },
  { name: "Halcyon Glass", category: "Packaging", country: "China", rating: 3.9, lead_time_days: 14, spend: 189000, price_index: -11, status: "Active" },
  { name: "Meridian Botanicals", category: "Ingredients", country: "India", rating: 4.4, lead_time_days: 11, spend: 167000, price_index: -8, status: "Active" },
  { name: "Solstice Freight", category: "Logistics", country: "USA", rating: 3.6, lead_time_days: 3, spend: 142000, price_index: 9, status: "Review" },
];

type SuppliersState = {
  suppliers: Supplier[];
  loading: boolean;
  addSupplier: (s: NewSupplier) => Promise<void>;
  editSupplier: (id: string, patch: Partial<NewSupplier>) => Promise<{ error: Error | null }>;
  importSuppliers: (rows: NewSupplier[]) => Promise<{ error: Error | null }>;
  setStatus: (id: string, status: Status) => Promise<void>;
  seed: () => Promise<void>;
};
const SuppliersCtx = createContext<SuppliersState | null>(null);
function useSuppliersData() {
  const ctx = useContext(SuppliersCtx);
  if (!ctx) throw new Error("useSuppliersData must be used within SuppliersProvider");
  return ctx;
}

function SuppliersProvider({ children }: { children: ReactNode }) {
  const { org } = useOrg();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [rows, prods] = await Promise.all([listSuppliers(org.id), listProducts(org.id).catch(() => [])]);
      const byCat: Record<string, number> = {};
      for (const p of prods) {
        const k = (p.category ?? "").toLowerCase();
        if (k) byCat[k] = (byCat[k] ?? 0) + 1;
      }
      setSuppliers(rows.map((r) => toUiSupplier(r, byCat)));
    } catch {
      setSuppliers([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSupplier = useCallback(
    async (s: NewSupplier) => {
      if (!org) return;
      await createSupplier(org.id, s);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );
  const setStatus = useCallback(
    async (id: string, status: Status) => {
      await updateSupplier(id, { status });
      await load();
    },
    [load],
  );
  const editSupplier = useCallback(
    async (id: string, patch: Partial<NewSupplier>) => {
      const { error } = await updateSupplier(id, patch);
      await load();
      return { error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );
  const importSuppliers = useCallback(
    async (rows: NewSupplier[]) => {
      if (!org) return { error: new Error("No active workspace.") };
      const { error } = await insertSuppliers(org.id, rows);
      await load();
      return { error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );
  const seed = useCallback(
    async () => {
      if (!org) return;
      await insertSuppliers(org.id, SAMPLE_SUPPLIERS);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );

  return (
    <SuppliersCtx.Provider value={{ suppliers, loading, addSupplier, editSupplier, importSuppliers, setStatus, seed }}>
      {children}
    </SuppliersCtx.Provider>
  );
}

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
  const { suppliers } = useSuppliersData();
  const maxSpend = Math.max(1, ...suppliers.map((s) => s.spend));
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
          const r = 4 + (s.spend / maxSpend) * 8;
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
  const { suppliers, loading, seed } = useSuppliersData();
  const [busy, setBusy] = useState(false);
  const alerts = suppliers.filter((s) => s.risk === "High" || s.status === "Review");
  const totalSpend = suppliers.reduce((a, s) => a + s.spend, 0);
  const avgLead = suppliers.length ? suppliers.reduce((a, s) => a + s.leadTime, 0) / suppliers.length : 0;
  const avgOnTime = suppliers.length ? Math.round(suppliers.reduce((a, s) => a + s.onTime, 0) / suppliers.length) : 0;
  const spendCats = spendByCategoryOf(suppliers);
  const spendLabel = totalSpend >= 1_000_000 ? `$${(totalSpend / 1_000_000).toFixed(1)}M` : `$${formatNum(totalSpend)}`;

  if (!loading && suppliers.length === 0) {
    return (
      <Reveal>
        <GlassCard className="p-8 text-center sm:p-10">
          <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
            <Factory className="size-6" stroke="oklch(0.2 0.02 70)" />
          </span>
          <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No suppliers yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Add your vendors to track spend, lead times and risk — or drop in a sample set to explore.
          </p>
          <button
            onClick={async () => { setBusy(true); await seed(); setBusy(false); }}
            disabled={busy}
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
          >
            <Sparkles className="size-4" /> {busy ? "Adding…" : "Add sample suppliers"}
          </button>
        </GlassCard>
      </Reveal>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active suppliers" value={suppliers.length} icon={Building2} />
        <StatTile label="Total spend" value={totalSpend} prefix="$" icon={DollarSign} />
        <StatTile label="Avg lead time" value={avgLead} suffix=" days" decimals={1} icon={Clock} />
        <StatTile label="Avg on-time rate" value={avgOnTime} suffix="%" icon={Truck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Globe}>Spend by category</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Donut
                data={spendCats}
                center={
                  <div>
                    <div className="text-xl font-semibold tabular-nums gold-text">{spendLabel}</div>
                    <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">total</div>
                  </div>
                }
              />
              <ul className="min-w-0 flex-1 space-y-2">
                {spendCats.map((s) => (
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
                  {alerts.length > 0 ? (
                    <>Across your <span className="text-gold">{suppliers.length}</span> suppliers, <span className="text-gold">{alerts.length}</span> need attention — high risk or under review. Avg lead time is <span className="text-gold">{avgLead.toFixed(1)} days</span>.</>
                  ) : (
                    <>Your <span className="text-gold">{suppliers.length}</span> suppliers are all in good standing. Avg lead time is <span className="text-gold">{avgLead.toFixed(1)} days</span> at <span className="text-gold">{avgOnTime}%</span> on-time.</>
                  )}
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

const SUP_INPUT = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

const SUPPLIER_IMPORT_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", required: true, aliases: ["supplier", "supplier name", "vendor", "company"] },
  { key: "category", label: "Category", aliases: ["type", "group", "goods"] },
  { key: "country", label: "Country", aliases: ["location", "region"] },
  { key: "contact_name", label: "Contact", aliases: ["contact", "contact name", "rep", "person"] },
  { key: "email", label: "Email", aliases: ["email", "e-mail", "email address"] },
  { key: "phone", label: "Phone", aliases: ["phone", "tel", "telephone", "mobile"] },
  { key: "lead_time_days", label: "Lead time (days)", type: "number", aliases: ["lead", "lead time", "lead days", "eta"] },
  { key: "spend", label: "Annual spend", type: "number", aliases: ["spend", "annual spend", "total spend", "cost"] },
];

function DatabaseView({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { org } = useOrg();
  const { suppliers, loading, addSupplier, importSuppliers } = useSuppliersData();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", country: "", contact_name: "", email: "", phone: "", lead_time_days: "7", rating: "4.0", status: "Active" as Status });

  if (selectedId) {
    const s = suppliers.find((x) => x.id === selectedId);
    if (s) return <SupplierProfile s={s} onBack={() => onSelect(null)} />;
    onSelect(null);
  }

  const submit = async () => {
    if (!form.name.trim() || busy) return;
    setBusy(true);
    await addSupplier({
      name: form.name.trim(),
      category: form.category.trim() || null,
      country: form.country.trim() || null,
      contact_name: form.contact_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      lead_time_days: Number(form.lead_time_days) || 7,
      rating: Number(form.rating) || 4,
      status: form.status,
    });
    setBusy(false);
    setForm({ name: "", category: "", country: "", contact_name: "", email: "", phone: "", lead_time_days: "7", rating: "4.0", status: "Active" });
    setAdding(false);
  };

  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <SectionLabel icon={Building2}>Suppliers</SectionLabel>
          <div className="flex gap-2">
            <button onClick={() => setImporting(true)} className="rounded-full border border-border bg-glass px-4 py-2 text-xs text-foreground/85 transition-colors hover:border-gold/40">Import CSV</button>
            <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
              <Package className="size-3.5" /> New supplier
            </button>
          </div>
        </div>
        {importing && org && (
          <CsvImport entityLabel="suppliers" fields={SUPPLIER_IMPORT_FIELDS} orgId={org.id} onImport={(rows) => importSuppliers(rows as NewSupplier[])} onClose={() => setImporting(false)} />
        )}
        {adding && (
          <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Supplier name *" className={SUP_INPUT} />
            <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category (e.g. Packaging)" className={SUP_INPUT} />
            <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Country" className={SUP_INPUT} />
            <input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} placeholder="Contact name" className={SUP_INPUT} />
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email — for reordering" className={SUP_INPUT} />
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className={SUP_INPUT} />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={form.lead_time_days} onChange={(e) => setForm((f) => ({ ...f, lead_time_days: e.target.value }))} placeholder="Lead days" className={SUP_INPUT} />
              <input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} placeholder="Rating" className={SUP_INPUT} />
            </div>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))} className={SUP_INPUT}>
              {(["Preferred", "Active", "Review"] as Status[]).map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={submit} disabled={!form.name.trim() || busy} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Saving…" : "Save supplier"}</button>
              <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}
        <div className="hidden grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.9fr] gap-4 px-3 pb-2 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>Supplier</span>
          <span>Rating</span>
          <span className="text-right">Lead</span>
          <span>Risk</span>
          <span className="text-right">Annual spend</span>
        </div>
        <div className="space-y-1">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading suppliers…</p>}
          {!loading && suppliers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No suppliers yet — add your first above.</p>}
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
  const { org } = useOrg();
  const { editSupplier } = useSuppliersData();
  const [poBusy, setPoBusy] = useState(false);
  const [poDone, setPoDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editNote, setEditNote] = useState<string | null>(null);
  const [ef, setEf] = useState({
    name: s.name, category: s.category, country: s.country,
    contact_name: s.contactName ?? "", email: s.email ?? "", phone: s.phone ?? "",
    lead_time_days: String(s.leadTime), rating: String(s.rating), spend: String(s.spend), status: s.status as Status,
  });
  const openEdit = () => {
    setEf({
      name: s.name, category: s.category, country: s.country,
      contact_name: s.contactName ?? "", email: s.email ?? "", phone: s.phone ?? "",
      lead_time_days: String(s.leadTime), rating: String(s.rating), spend: String(s.spend), status: s.status,
    });
    setEditNote(null);
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!ef.name.trim() || savingEdit) return;
    setSavingEdit(true);
    const { error } = await editSupplier(s.id, {
      name: ef.name.trim(),
      category: ef.category.trim() || null,
      country: ef.country.trim() || null,
      contact_name: ef.contact_name.trim() || null,
      email: ef.email.trim() || null,
      phone: ef.phone.trim() || null,
      lead_time_days: Number(ef.lead_time_days) || 0,
      rating: Number(ef.rating) || 0,
      spend: Number(ef.spend) || 0,
      status: ef.status,
    });
    setSavingEdit(false);
    if (error) setEditNote("Couldn't save — please try again.");
    else setEditing(false);
  };
  const metrics = [
    { k: "Reliability", v: s.reliability },
    { k: "On-time", v: s.onTime },
    { k: "Quality", v: Math.round((s.rating / 5) * 100) },
    { k: "Price vs market", v: Math.max(0, Math.min(100, 50 - s.priceIndex * 3)) },
  ];
  const raisePO = async () => {
    if (!org || poBusy) return;
    setPoBusy(true);
    const { error } = await createPurchaseOrder(org.id, { supplier_id: s.id, supplier_name: s.name, status: "Draft", items: 0, total: 0 });
    setPoBusy(false);
    if (!error) setPoDone(true);
  };
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

            <div className="mt-4 w-full space-y-1.5 border-t border-border pt-4 text-left">
              {s.contactName && <p className="truncate text-sm text-foreground/85">{s.contactName}</p>}
              {s.email ? (
                <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 text-sm text-gold transition-colors hover:underline">
                  <Mail className="size-3.5 shrink-0" /> <span className="truncate">{s.email}</span>
                </a>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="size-3.5 shrink-0" /> No email on file — add one via Edit details.</p>
              )}
              {s.phone && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="size-3.5 shrink-0" /> {s.phone}</p>}
            </div>
            <div className="mt-6 grid w-full grid-cols-3 gap-3 border-t border-border pt-5 text-center">
              <div><p className="text-lg font-semibold tabular-nums text-gold">${formatNum(s.spend)}</p><p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Spend</p></div>
              <div><p className="text-lg font-semibold tabular-nums">{s.products}</p><p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Products</p></div>
              <div><p className="text-lg font-semibold tabular-nums">{s.since}</p><p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Since</p></div>
            </div>
            <button onClick={raisePO} disabled={poBusy || poDone} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)" }}>
              <FileText className="size-3.5" /> {poDone ? "Draft PO created ✓" : poBusy ? "Creating…" : "New purchase order"}
            </button>
            {poDone && <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">Find it in the Orders tab to add items & send.</p>}

            <button
              onClick={editing ? () => setEditing(false) : openEdit}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              <Pencil className="size-3.5" /> {editing ? "Close editor" : "Edit details"}
            </button>

            {editing && (
              <div className="mt-4 w-full space-y-2.5 border-t border-border pt-4 text-left">
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Name
                  <input value={ef.name} onChange={(e) => setEf((f) => ({ ...f, name: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                </label>
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Contact name
                  <input value={ef.contact_name} onChange={(e) => setEf((f) => ({ ...f, contact_name: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                </label>
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Email — for reordering
                  <input type="email" value={ef.email} onChange={(e) => setEf((f) => ({ ...f, email: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                </label>
                <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Phone
                  <input type="tel" value={ef.phone} onChange={(e) => setEf((f) => ({ ...f, phone: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Category
                    <input value={ef.category} onChange={(e) => setEf((f) => ({ ...f, category: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Country
                    <input value={ef.country} onChange={(e) => setEf((f) => ({ ...f, country: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Status
                    <select value={ef.status} onChange={(e) => setEf((f) => ({ ...f, status: e.target.value as Status }))} className={cn(SUP_INPUT, "mt-1")}>
                      {(["Preferred", "Active", "Review"] as Status[]).map((st) => <option key={st}>{st}</option>)}
                    </select>
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Rating (0–5)
                    <input type="number" min={0} max={5} step="0.1" value={ef.rating} onChange={(e) => setEf((f) => ({ ...f, rating: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Lead time (days)
                    <input type="number" min={0} value={ef.lead_time_days} onChange={(e) => setEf((f) => ({ ...f, lead_time_days: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-gold">
                    Annual spend ($)
                    <input type="number" min={0} value={ef.spend} onChange={(e) => setEf((f) => ({ ...f, spend: e.target.value }))} className={cn(SUP_INPUT, "mt-1")} />
                  </label>
                </div>
                {editNote && <p className="text-xs text-gold">{editNote}</p>}
                <button
                  onClick={saveEdit}
                  disabled={!ef.name.trim() || savingEdit}
                  className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "var(--gradient-gold)" }}
                >
                  <Check className="size-3.5" /> {savingEdit ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
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
  const { suppliers } = useSuppliersData();
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds((prev) => (prev.length === 0 && suppliers.length > 0 ? suppliers.slice(0, 3).map((s) => s.id) : prev));
  }, [suppliers]);
  const chosen = suppliers.filter((s) => ids.includes(s.id));
  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev));

  if (suppliers.length === 0) {
    return <GlassCard className="p-10 text-center text-sm text-muted-foreground">Add suppliers first — you'll be able to compare them side by side here.</GlassCard>;
  }

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

const PO_STATUSES: PoStatus[] = ["Draft", "Sent", "Confirmed", "In transit", "Received", "Cancelled"];

function OrdersView() {
  const { org } = useOrg();
  const { suppliers } = useSuppliersData();
  const [pos, setPos] = useState<DbPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ supplierId: "", items: "1", total: "0", eta: "" });

  const load = useCallback(async () => {
    if (!org) {
      setPos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setPos(await listPurchaseOrders(org.id));
    } catch {
      setPos([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const openCount = pos.filter((p) => p.status !== "Received" && p.status !== "Cancelled").length;
  const inTransit = pos.filter((p) => p.status === "In transit").reduce((a, p) => a + Number(p.total), 0);
  const totalValue = pos.reduce((a, p) => a + Number(p.total), 0);

  const submit = async () => {
    if (!org || busy) return;
    setBusy(true);
    const sup = suppliers.find((s) => s.id === form.supplierId);
    await createPurchaseOrder(org.id, {
      supplier_id: form.supplierId || null,
      supplier_name: sup?.name ?? "Supplier",
      items: Number(form.items) || 0,
      total: Number(form.total) || 0,
      eta: form.eta.trim() || null,
      status: "Draft",
    });
    setBusy(false);
    setForm({ supplierId: "", items: "1", total: "0", eta: "" });
    setAdding(false);
    await load();
  };
  const changeStatus = async (id: string, status: PoStatus) => {
    await updatePurchaseOrderStatus(id, status);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Open POs" value={openCount} icon={FileText} />
        <StatTile label="In-transit value" value={inTransit} prefix="$" icon={Truck} />
        <StatTile label="Total PO value" value={totalValue} prefix="$" icon={DollarSign} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={FileText}>Purchase orders</SectionLabel>
            <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>New PO</button>
          </div>
          {adding && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
              <select value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))} className={SUP_INPUT}>
                <option value="">Select supplier…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={form.eta} onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))} placeholder="ETA (e.g. Aug 20)" className={SUP_INPUT} />
              <input type="number" value={form.items} onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))} placeholder="Items" className={SUP_INPUT} />
              <input type="number" value={form.total} onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))} placeholder="Total $" className={SUP_INPUT} />
              <div className="flex gap-2 sm:col-span-2">
                <button onClick={submit} disabled={busy} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Saving…" : "Create PO"}</button>
                <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-1">
            {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading purchase orders…</p>}
            {!loading && pos.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No purchase orders yet — create one, or raise a PO from a supplier's profile.</p>}
            {pos.map((o) => {
              const color = poStatusColor[o.status] ?? GOLD;
              return (
                <div key={o.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 hover:border-gold/20 hover:bg-glass sm:grid-cols-[auto_1.4fr_1fr_0.8fr_auto]">
                  <span className="font-mono text-xs text-muted-foreground">{o.number}</span>
                  <div className="flex items-center gap-3">
                    <Avatar name={o.supplier_name ?? "Supplier"} />
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{o.supplier_name ?? "Supplier"}</p><p className="text-xs text-muted-foreground">{o.items} items</p></div>
                  </div>
                  <select value={o.status} onChange={(e) => changeStatus(o.id, e.target.value as PoStatus)} className="hidden rounded-lg border border-border bg-background/40 px-2 py-1 text-xs outline-none focus:border-gold/50 sm:block" style={{ color }}>
                    {PO_STATUSES.map((s) => <option key={s} value={s} className="text-foreground">{s}</option>)}
                  </select>
                  <span className="hidden text-xs text-muted-foreground sm:block">{o.eta ? `ETA ${o.eta}` : "—"}</span>
                  <span className="text-right text-sm font-semibold tabular-nums text-gold">${formatNum(Number(o.total))}</span>
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
  const { suppliers } = useSuppliersData();
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
  const { org } = useOrg();
  const { suppliers } = useSuppliersData();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "I monitor your suppliers — pricing, reliability, lead times and risk. Ask me who to buy from, where to save, or what to watch." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const snapshot = suppliers.length
    ? suppliers
        .slice(0, 30)
        .map((s) => `${s.name} (${s.category}, ${s.country}): rating ${s.rating}, lead ${s.leadTime}d, ${s.risk} risk, $${s.spend} spend`)
        .join("; ")
    : "No suppliers added yet.";

  async function send(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    const next: ChatMsg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const convo = next
        .filter((m) => m.text.trim())
        .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
      const start = convo.findIndex((m) => m.role === "user");
      const trimmed = start >= 0 ? convo.slice(start) : convo;
      if (trimmed.length) {
        trimmed[0] = { ...trimmed[0], content: `You are the Suppliers/procurement assistant inside WonderFlow OS — advise on sourcing, cost savings, lead times and supplier risk. Current suppliers: ${snapshot}.\n\n${trimmed[0].content}` };
      }
      const reply = await askAI(trimmed, { id: org?.id, name: org?.name, industry: org?.industry });
      setMessages((m) => [...m, { role: "ai", text: reply || "I don't have an answer for that yet." }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: e instanceof Error ? e.message : "I couldn't reach the AI service. Please try again." }]);
    } finally {
      setThinking(false);
    }
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
    <SuppliersProvider>
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
    </SuppliersProvider>
  );
}
