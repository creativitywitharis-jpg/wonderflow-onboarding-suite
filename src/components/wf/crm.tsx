import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  Bot,
  Brain,
  Building2,
  Check,
  Crown,
  Gift,
  Heart,
  Home,
  Layers,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Power,
  Sliders,
  Search,
  Send,
  Sparkles,
  Star,
  Target,
  Ticket,
  Trash2,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Donut, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useCountUp } from "@/hooks/use-count-up";
import { useInView } from "@/hooks/use-in-view";
import { useOrg } from "@/lib/org-context";
import { createCustomer, insertCustomers, listCustomers, updateCustomer, type DbCustomer, type NewCustomer } from "@/lib/customers";
import { addInteraction, listCustomerInteractions, listInteractions, type DbInteraction, type InteractionChannel } from "@/lib/interactions";
import { CsvImport } from "@/components/wf/CsvImport";
import type { FieldSpec } from "@/lib/csv";
import { fireAutomationEvent } from "@/lib/automations";
import { resegmentCustomers } from "@/lib/segment";
import {
  DEFAULT_SETTINGS,
  gradeColor,
  gradeFor,
  getLoyaltySettings,
  issueRewardCodes,
  listRewardCodes,
  markCodeUsed,
  nextMilestone,
  pointsFor,
  saveLoyaltySettings,
  type LoyaltySettings,
  type RewardCode,
} from "@/lib/loyalty";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey =
  | "overview"
  | "customers"
  | "profiles"
  | "segments"
  | "journey"
  | "comms"
  | "loyalty";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "customers", label: "Customers", icon: Users },
  { key: "profiles", label: "AI Profiles", icon: Brain },
  { key: "segments", label: "Segments", icon: Layers },
  { key: "journey", label: "Journey", icon: Target },
  { key: "comms", label: "Communication", icon: MessageSquare },
  { key: "loyalty", label: "Loyalty", icon: Crown },
];

const GOLD = "oklch(0.84 0.14 84)";
const tierColor: Record<string, string> = {
  Champion: GOLD,
  Loyal: "oklch(0.7 0.11 60)",
  Potential: "oklch(0.66 0.09 200)",
  New: "oklch(0.75 0.13 150)",
  "At risk": "oklch(0.68 0.16 25)",
  Dormant: "oklch(0.62 0.02 260)",
};

type Customer = {
  id: string;
  name: string;
  company: string;
  email: string;
  ltv: number;
  health: number;
  tier: keyof typeof tierColor;
  last: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  tags: string[];
  spark: number[];
  since: string;
  orders: number;
};

// Sample data for the one-click "add sample customers" seed action.
const SAMPLE_CUSTOMERS: NewCustomer[] = [
  { name: "Ava Chen", company: "Northwind Co", email: "ava@northwind.co", ltv: 18420, health: 94, tier: "Champion", sentiment: "Positive", tags: ["High intent", "Upsell ready"], since: "2023", orders: 34 },
  { name: "Leo Park", company: "Brightloom", email: "leo@brightloom.io", ltv: 12960, health: 88, tier: "Loyal", sentiment: "Positive", tags: ["Renewal soon"], since: "2022", orders: 27 },
  { name: "Mara Silva", company: "Fjord Studio", email: "mara@fjord.design", ltv: 9840, health: 72, tier: "Potential", sentiment: "Neutral", tags: ["Price sensitive"], since: "2024", orders: 14 },
  { name: "Noah Reed", company: "Ridgeway", email: "noah@ridgeway.com", ltv: 21500, health: 91, tier: "Champion", sentiment: "Positive", tags: ["Advocate", "Case study"], since: "2021", orders: 41 },
  { name: "Priya Nair", company: "Solstice", email: "priya@solstice.co", ltv: 4120, health: 58, tier: "New", sentiment: "Neutral", tags: ["Onboarding"], since: "2025", orders: 4 },
  { name: "Sam Idris", company: "Halcyon", email: "sam@halcyon.app", ltv: 15230, health: 41, tier: "At risk", sentiment: "Negative", tags: ["Churn risk", "Ticket open"], since: "2022", orders: 22 },
  { name: "Ivy Zhou", company: "Meridian", email: "ivy@meridian.co", ltv: 7350, health: 66, tier: "Loyal", sentiment: "Positive", tags: ["Referral source"], since: "2023", orders: 18 },
  { name: "Dane Ford", company: "Cobalt", email: "dane@cobalt.io", ltv: 3010, health: 28, tier: "Dormant", sentiment: "Negative", tags: ["Win-back"], since: "2022", orders: 9 },
];

function genSpark(health: number): number[] {
  const b = Math.max(12, Math.min(88, health));
  return Array.from({ length: 9 }, (_, i) => Math.round(b * (0.55 + (i / 8) * 0.55)));
}

function toUi(c: DbCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    company: c.company ?? "",
    email: c.email ?? "",
    ltv: Number(c.ltv),
    health: c.health,
    tier: c.tier as Customer["tier"],
    last: "recently",
    sentiment: c.sentiment as Customer["sentiment"],
    tags: c.tags ?? [],
    spark: genSpark(c.health),
    since: c.since ?? "—",
    orders: c.orders,
  };
}

type CustomersState = {
  customers: Customer[];
  loading: boolean;
  addCustomer: (c: NewCustomer) => Promise<void>;
  editCustomer: (id: string, patch: Partial<NewCustomer>) => Promise<{ error: Error | null }>;
  importCustomers: (rows: NewCustomer[]) => Promise<{ error: Error | null }>;
  seed: () => Promise<void>;
  resegment: () => Promise<{ changed: number; total: number }>;
};
const CustomersCtx = createContext<CustomersState | null>(null);
function useCustomersData() {
  const ctx = useContext(CustomersCtx);
  if (!ctx) throw new Error("useCustomersData must be used within CustomersProvider");
  return ctx;
}
function CustomersProvider({ children }: { children: ReactNode }) {
  const { org } = useOrg();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listCustomers(org.id);
      setCustomers(rows.map(toUi));
    } catch {
      setCustomers([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCustomer = useCallback(
    async (c: NewCustomer) => {
      if (!org) return;
      const { data } = await createCustomer(org.id, c);
      await load();
      if (data) {
        void fireAutomationEvent(org.id, "customer.created", { customer_id: data.id, name: data.name, email: data.email });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );

  const editCustomer = useCallback(
    async (id: string, patch: Partial<NewCustomer>) => {
      const { error } = await updateCustomer(id, patch);
      await load();
      return { error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  const seed = useCallback(
    async () => {
      if (!org) return;
      await insertCustomers(org.id, SAMPLE_CUSTOMERS);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );

  const importCustomers = useCallback(
    async (rows: NewCustomer[]) => {
      if (!org) return { error: new Error("No active workspace.") };
      const { error } = await insertCustomers(org.id, rows);
      await load();
      return { error };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, load],
  );

  const resegment = useCallback(
    async () => {
      if (!org) return { changed: 0, total: 0 };
      const res = await resegmentCustomers(
        customers.map((c) => ({ id: c.id, ltv: c.ltv, orders: c.orders, health: c.health, tier: c.tier })),
      );
      await load();
      return res;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, customers, load],
  );

  return <CustomersCtx.Provider value={{ customers, loading, addCustomer, editCustomer, importCustomers, seed, resegment }}>{children}</CustomersCtx.Provider>;
}

// Segment metadata — real counts and revenue share are derived from the org's
// own customers (see deriveSegments), not hard-coded.
const SEGMENT_META: { label: string; tier: Customer["tier"]; color: string; desc: string }[] = [
  { label: "Champions", tier: "Champion", color: GOLD, desc: "Buy often, spend the most, and advocate for you." },
  { label: "Loyal", tier: "Loyal", color: "oklch(0.7 0.11 60)", desc: "Consistent repeat buyers with strong retention." },
  { label: "Potential", tier: "Potential", color: "oklch(0.66 0.09 200)", desc: "Recent buyers trending toward loyalty." },
  { label: "New", tier: "New", color: "oklch(0.75 0.13 150)", desc: "First purchase in the last 30 days." },
  { label: "At risk", tier: "At risk", color: "oklch(0.68 0.16 25)", desc: "Declining engagement — needs intervention." },
  { label: "Dormant", tier: "Dormant", color: "oklch(0.62 0.02 260)", desc: "No activity in 60+ days. Win-back candidates." },
];

type Segment = { label: string; tier: Customer["tier"]; color: string; desc: string; count: number; share: number; ltv: number };

// Group the org's real customers into segments by tier, with each segment's
// share of total lifetime value.
function deriveSegments(customers: Customer[]): Segment[] {
  const totalLtv = customers.reduce((a, c) => a + c.ltv, 0) || 1;
  return SEGMENT_META.map((m) => {
    const inTier = customers.filter((c) => c.tier === m.tier);
    const ltv = inTier.reduce((a, c) => a + c.ltv, 0);
    return { ...m, count: inTier.length, ltv, share: Math.round((ltv / totalLtv) * 100) };
  });
}

// Lifecycle stages in order — counts are derived from the org's real customers.
const LIFECYCLE_STAGES = ["New", "Potential", "Loyal", "Champion"] as const;

const channelIcon: Record<InteractionChannel, LucideIcon> = {
  note: MessageSquare,
  email: Mail,
  call: Phone,
  meeting: Users,
  chat: MessageSquare,
};

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// The loyalty points program (grades, thresholds, code values, earn rate) lives
// in src/lib/loyalty.ts so it stays the single source of truth for the engine.

/* ──────────────────────────────────────────────────────────────────────
 * Small viz primitives (CRM-specific)
 * ─────────────────────────────────────────────────────────────────── */

function MiniRing({ value, size = 56 }: { value: number; size?: number }) {
  const { ref, inView } = useInView();
  const shown = useCountUp(value, { start: inView });
  const r = 24;
  const circ = 2 * Math.PI * r;
  return (
    <div ref={ref} className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 56 56" className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 80ms linear" }}
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums">{Math.round(shown)}</span>
    </div>
  );
}

function TierPill({ tier }: { tier: string }) {
  const color = tierColor[tier] ?? GOLD;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium"
      style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {tier}
    </span>
  );
}

function SentimentDot({ sentiment }: { sentiment: Customer["sentiment"] }) {
  const map = {
    Positive: "oklch(0.72 0.14 155)",
    Neutral: "oklch(0.8 0.02 250)",
    Negative: "oklch(0.68 0.16 25)",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: map[sentiment] }} />
      {sentiment}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

function OverviewView() {
  const { customers } = useCustomersData();
  const total = customers.length;
  const totalLtv = customers.reduce((a, c) => a + c.ltv, 0);
  const avgLtv = total ? Math.round(totalLtv / total) : 0;
  const avgHealth = total ? Math.round(customers.reduce((a, c) => a + c.health, 0) / total) : 0;
  const atRisk = customers.filter((c) => c.tier === "At risk" || c.health < 50);
  const champions = customers.filter((c) => c.tier === "Champion");
  const upsell = customers.filter((c) => c.health >= 80);
  const atRiskLtv = atRisk.reduce((a, c) => a + c.ltv, 0);
  const upsellLtv = upsell.reduce((a, c) => a + c.ltv, 0);
  const championShare = totalLtv ? Math.round((champions.reduce((a, c) => a + c.ltv, 0) / totalLtv) * 100) : 0;
  const segs = deriveSegments(customers);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total customers" value={total} icon={Users} />
        <StatTile label="Avg lifetime value" value={avgLtv} prefix="$" icon={TrendingUp} />
        <StatTile label="Total lifetime value" value={totalLtv} prefix="$" icon={Crown} />
        <StatTile label="Avg health score" value={avgHealth} icon={Heart} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Layers}>Revenue by segment</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Donut
                data={segs}
                center={
                  <div>
                    <div className="text-2xl font-semibold tabular-nums gold-text">{formatNum(total)}</div>
                    <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                      customers
                    </div>
                  </div>
                }
              />
              <ul className="min-w-0 flex-1 space-y-2">
                {segs.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 truncate text-foreground/85">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">{s.count} · {s.share}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative">
              <SectionLabel icon={Sparkles}>Customer intelligence</SectionLabel>
              {total === 0 ? (
                <p className="mt-4 text-[0.95rem] leading-relaxed text-foreground/90">
                  Add your customers and I'll surface who's at risk, who's ready to upsell, and where your
                  revenue concentrates.
                </p>
              ) : (
                <p className="mt-4 text-[0.95rem] leading-relaxed text-foreground/90">
                  Across your <span className="text-gold">{total}</span> customer{total === 1 ? "" : "s"},{" "}
                  <span className="text-gold">{atRisk.length}</span> {atRisk.length === 1 ? "is" : "are"} at
                  risk and <span className="text-gold">{champions.length}</span>{" "}
                  {champions.length === 1 ? "is a champion" : "are champions"} driving{" "}
                  <span className="text-gold">{championShare}%</span> of lifetime value.
                </p>
              )}
              <div className="mt-5 space-y-3">
                {[
                  { icon: Zap, t: `${upsell.length} account${upsell.length === 1 ? "" : "s"} ready for an upsell`, d: `$${formatNum(upsellLtv)} in play` },
                  { icon: Heart, t: `Re-engage ${atRisk.length} at-risk customer${atRisk.length === 1 ? "" : "s"}`, d: `$${formatNum(atRiskLtv)} at stake` },
                  { icon: Star, t: `${champions.length} advocate${champions.length === 1 ? "" : "s"} could give referrals`, d: `${championShare}% of LTV` },
                ].map((r) => (
                  <div
                    key={r.t}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background/30 p-3 text-left"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-glass">
                      <r.icon className="size-4 text-gold" />
                    </span>
                    <span className="flex-1 text-sm text-foreground/85">{r.t}</span>
                    <span className="shrink-0 text-xs text-gold">{r.d}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Crown}>Highest-value customers</SectionLabel>
            <span className="text-xs text-muted-foreground">by lifetime value</span>
          </div>
          <div className="mt-4 space-y-1">
            {[...customers]
              .sort((a, b) => b.ltv - a.ltv)
              .slice(0, 4)
              .map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <Avatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.company}</p>
                  </div>
                  <TierPill tier={c.tier} />
                  <span className="w-24 text-right text-sm font-semibold tabular-nums text-gold">
                    ${formatNum(c.ltv)}
                  </span>
                </div>
              ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

const CRM_INPUT = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

const CUSTOMER_IMPORT_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", required: true, aliases: ["full name", "customer", "client", "contact name", "contact"] },
  { key: "company", label: "Company", aliases: ["organization", "organisation", "business", "account", "company name"] },
  { key: "email", label: "Email", aliases: ["e-mail", "email address", "mail"] },
  { key: "tier", label: "Tier", enum: ["Champion", "Loyal", "Potential", "New", "At risk", "Dormant"], aliases: ["segment", "status", "category"] },
  { key: "ltv", label: "Lifetime value", type: "number", aliases: ["ltv", "lifetime value", "total spent", "revenue", "value", "total"] },
  { key: "health", label: "Health", type: "number", aliases: ["health score", "score"] },
  { key: "orders", label: "Orders", type: "number", aliases: ["order count", "orders count", "purchases"] },
  { key: "since", label: "Since", aliases: ["customer since", "joined", "created", "start"] },
  { key: "tags", label: "Tags", type: "tags", aliases: ["labels", "tag"] },
];

function CustomersView({ onOpen }: { onOpen: (id: string) => void }) {
  const { org } = useOrg();
  const { customers, loading, addCustomer, importCustomers, seed } = useCustomersData();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<string>("All");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", tier: "New" });
  const tiers = ["All", "Champion", "Loyal", "Potential", "New", "At risk", "Dormant"];
  const filtered = customers.filter(
    (c) =>
      (tier === "All" || c.tier === tier) &&
      (q === "" ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.company.toLowerCase().includes(q.toLowerCase())),
  );

  const submitAdd = async () => {
    if (!form.name.trim() || busy) return;
    setBusy(true);
    await addCustomer({
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      email: form.email.trim() || undefined,
      tier: form.tier,
    });
    setBusy(false);
    setForm({ name: "", company: "", email: "", tier: "New" });
    setAdding(false);
  };

  const addForm = (
    <div className="grid gap-3 rounded-2xl border border-border bg-background/30 p-4 text-left sm:grid-cols-2">
      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name *" className={CRM_INPUT} />
      <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Company" className={CRM_INPUT} />
      <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={CRM_INPUT} />
      <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))} className={CRM_INPUT}>
        {tiers.slice(1).map((t) => <option key={t}>{t}</option>)}
      </select>
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={submitAdd} disabled={!form.name.trim() || busy} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>
          <Plus className="size-3.5" /> {busy ? "Saving…" : "Save customer"}
        </button>
        <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  );

  const importer =
    importing && org ? (
      <CsvImport
        entityLabel="customers"
        fields={CUSTOMER_IMPORT_FIELDS}
        orgId={org.id}
        onImport={(rows) => importCustomers(rows as NewCustomer[])}
        onClose={() => setImporting(false)}
      />
    ) : null;

  // Empty state — no customers in this workspace yet.
  if (!loading && customers.length === 0) {
    return (
      <Reveal>
        <GlassCard className="p-8 text-center sm:p-10">
          <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
            <Users className="size-6" stroke="oklch(0.2 0.02 70)" />
          </span>
          <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>No customers yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Your customer intelligence lives here. Add your first customer, or drop in a sample set to explore the CRM.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={async () => { setBusy(true); await seed(); setBusy(false); }} disabled={busy} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
              <Sparkles className="size-4" /> {busy ? "Adding…" : "Add sample customers"}
            </button>
            <button onClick={() => setAdding((a) => !a)} className="rounded-full border border-border bg-glass px-5 py-2.5 text-sm text-foreground/85 transition-colors hover:border-gold/40">
              Add manually
            </button>
            <button onClick={() => setImporting(true)} className="rounded-full border border-border bg-glass px-5 py-2.5 text-sm text-foreground/85 transition-colors hover:border-gold/40">
              Import CSV
            </button>
          </div>
          {adding && <div className="mx-auto mt-6 max-w-lg">{addForm}</div>}
        </GlassCard>
        {importer}
      </Reveal>
    );
  }

  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2.5 focus-within:border-gold/50">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customers or companies…"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </label>
          <button onClick={() => setImporting(true)} className="rounded-full border border-border bg-glass px-4 py-2.5 text-sm text-foreground/85 transition-colors hover:border-gold/40">
            Import CSV
          </button>
          <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
            <Plus className="size-4" stroke="oklch(0.2 0.02 70)" /> New customer
          </button>
        </div>

        {adding && <div className="mt-4">{addForm}</div>}

        <div className="mt-4 flex flex-wrap gap-2">
          {tiers.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                tier === t
                  ? "border-gold/50 text-foreground"
                  : "border-border bg-glass text-muted-foreground hover:text-foreground",
              )}
              style={tier === t ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {/* header */}
        <div className="mt-5 hidden grid-cols-[1.6fr_1fr_0.8fr_0.9fr_auto] gap-4 px-3 pb-2 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>Customer</span>
          <span>Tags</span>
          <span className="text-right">LTV</span>
          <span>Sentiment</span>
          <span className="text-center">Health</span>
        </div>

        <div className="space-y-1">
          {loading && <p className="py-10 text-center text-sm text-muted-foreground">Loading customers…</p>}
          {!loading &&
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="lift grid w-full grid-cols-1 items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left hover:border-gold/30 hover:bg-glass md:grid-cols-[1.6fr_1fr_0.8fr_0.9fr_auto]"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.company}</p>
                  </div>
                </div>
                <div className="hidden flex-wrap gap-1.5 md:flex">
                  {c.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-glass px-2 py-0.5 text-[0.65rem] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span className="hidden text-right text-sm font-semibold tabular-nums text-gold md:block">
                  ${formatNum(c.ltv)}
                </span>
                <div className="hidden md:block">
                  <SentimentDot sentiment={c.sentiment} />
                </div>
                <div className="hidden justify-self-center md:block">
                  <MiniRing value={c.health} />
                </div>
              </button>
            ))}
          {!loading && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No customers match that filter.</p>
          )}
        </div>
      </GlassCard>
      {importer}
    </Reveal>
  );
}

function channelIconFor(ch: InteractionChannel): LucideIcon {
  return ch === "email" ? Mail : ch === "call" ? Phone : ch === "meeting" ? Users : MessageSquare;
}

function ProfilesView({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { customers, editCustomer } = useCustomersData();
  const c = customers.find((x) => x.id === selectedId) ?? customers[0];
  const [timeline, setTimeline] = useState<{ icon: LucideIcon; t: string; d: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [ef, setEf] = useState({ name: "", company: "", email: "", tier: "New", ltv: 0, orders: 0, health: 0, since: "" });

  const openEdit = () => {
    if (!c) return;
    setEf({
      name: c.name,
      company: c.company ?? "",
      email: c.email ?? "",
      tier: c.tier,
      ltv: c.ltv,
      orders: c.orders,
      health: c.health,
      since: c.since === "—" ? "" : c.since,
    });
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!c || savingEdit) return;
    setSavingEdit(true);
    await editCustomer(c.id, {
      name: ef.name.trim(),
      company: ef.company.trim() || undefined,
      email: ef.email.trim() || undefined,
      tier: ef.tier,
      ltv: Number(ef.ltv) || 0,
      orders: Number(ef.orders) || 0,
      health: Math.max(0, Math.min(100, Number(ef.health) || 0)),
      since: ef.since.trim() || undefined,
    });
    setSavingEdit(false);
    setEditing(false);
  };
  useEffect(() => {
    let alive = true;
    if (c?.id) {
      listCustomerInteractions(c.id)
        .then((rows) => alive && setTimeline(rows.map((r) => ({ icon: channelIconFor(r.channel), t: r.body, d: timeAgo(r.created_at) }))))
        .catch(() => alive && setTimeline([]));
    } else {
      setTimeline([]);
    }
    return () => {
      alive = false;
    };
  }, [c?.id]);

  if (!c) {
    return (
      <Reveal>
        <GlassCard className="p-10 text-center text-sm text-muted-foreground">
          Add a customer first — their AI profile will appear here.
        </GlassCard>
      </Reveal>
    );
  }

  return (
    <div className="space-y-4">
      {/* customer switcher */}
      <div className="flex flex-wrap gap-2">
        {customers.slice(0, 6).map((x) => (
          <button
            key={x.id}
            onClick={() => onSelect(x.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition-colors",
              x.id === c.id
                ? "border-gold/50 text-foreground"
                : "border-border bg-glass text-muted-foreground hover:text-foreground",
            )}
            style={x.id === c.id ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
          >
            <Avatar name={x.name} className="size-5 text-[0.55rem]" />
            {x.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* identity card */}
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col items-center p-6 text-center">
            <span
              className="grid size-20 place-items-center rounded-2xl text-2xl font-semibold"
              style={{ background: "var(--gradient-gold)", color: "oklch(0.2 0.02 70)" }}
            >
              {c.name.split(" ").map((p) => p[0]).join("")}
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {c.name}
            </h2>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-3.5" /> {c.company}
            </p>
            <div className="mt-3">
              <TierPill tier={c.tier} />
            </div>
            <div className="mt-6 grid w-full grid-cols-3 gap-3 border-t border-border pt-5 text-center">
              <div>
                <p className="text-lg font-semibold tabular-nums text-gold">${formatNum(c.ltv)}</p>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">LTV</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">{c.orders}</p>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">{c.since}</p>
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Since</p>
              </div>
            </div>
            <div className="mt-5 flex w-full gap-2">
              <button
                className="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: "var(--gradient-gold)" }}
              >
                <Mail className="size-3.5" /> Message
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border bg-glass px-4 py-2.5 text-xs text-foreground/80 hover:border-gold/40">
                <Sparkles className="size-3.5 text-gold" /> Ask AI
              </button>
            </div>
            <button
              onClick={editing ? () => setEditing(false) : openEdit}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              <Pencil className="size-3.5" /> {editing ? "Close editor" : "Edit details"}
            </button>

            {editing && (
              <div className="mt-4 w-full space-y-2.5 border-t border-border pt-4 text-left">
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="col-span-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Name
                    <input value={ef.name} onChange={(e) => setEf((f) => ({ ...f, name: e.target.value }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Company
                    <input value={ef.company} onChange={(e) => setEf((f) => ({ ...f, company: e.target.value }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Tier
                    <select value={ef.tier} onChange={(e) => setEf((f) => ({ ...f, tier: e.target.value }))} className={cn(CRM_INPUT, "mt-1")}>
                      {["Champion", "Loyal", "Potential", "New", "At risk", "Dormant"].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Email
                    <input value={ef.email} onChange={(e) => setEf((f) => ({ ...f, email: e.target.value }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-gold">
                    Lifetime value ($)
                    <input type="number" min={0} value={ef.ltv} onChange={(e) => setEf((f) => ({ ...f, ltv: Number(e.target.value) }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Orders
                    <input type="number" min={0} value={ef.orders} onChange={(e) => setEf((f) => ({ ...f, orders: Number(e.target.value) }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Health (0–100)
                    <input type="number" min={0} max={100} value={ef.health} onChange={(e) => setEf((f) => ({ ...f, health: Number(e.target.value) }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Customer since
                    <input value={ef.since} onChange={(e) => setEf((f) => ({ ...f, since: e.target.value }))} placeholder="e.g. 2023" className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                </div>
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

        {/* AI intelligence + timeline */}
        <div className="space-y-4">
          <Reveal>
            <GlassCard className="glass-strong relative overflow-hidden p-6">
              <div className="veil pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative flex items-start gap-4">
                <span className="orb grid size-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                  <Brain className="size-5" stroke="oklch(0.2 0.02 70)" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">AI profile summary</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                    {c.name} is one of your {c.tier.toLowerCase()} accounts — {c.orders} orders since{" "}
                    {c.since} and {c.sentiment.toLowerCase()} sentiment across recent touchpoints.{" "}
                    {c.health >= 80
                      ? "Engagement is strong; this is a prime upsell and referral candidate."
                      : c.health >= 50
                        ? "Engagement is steady but softening — a well-timed check-in would help."
                        : "Engagement is falling fast — prioritize a personal win-back within 48 hours."}
                  </p>
                </div>
              </div>
              <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { k: "Health score", node: <MiniRing value={c.health} size={44} /> },
                  { k: "Predicted next", v: c.health >= 80 ? "Upsell" : c.health >= 50 ? "Renewal" : "Churn risk" },
                  { k: "Sentiment", v: c.sentiment },
                ].map((s) => (
                  <div key={s.k} className="flex items-center gap-3 rounded-2xl border border-border bg-background/30 px-4 py-3">
                    {s.node ?? <span className="text-base font-semibold text-foreground">{s.v}</span>}
                    <span className="text-xs text-muted-foreground">{s.k}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal className="h-full">
              <GlassCard className="h-full p-6">
                <SectionLabel icon={Activity}>Activity timeline</SectionLabel>
                {timeline.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No activity logged yet. Log a note, call or email from the Communication tab and it'll appear here.</p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {timeline.map((e, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-glass">
                          <e.icon className="size-3.5 text-gold" />
                        </span>
                        <div>
                          <p className="text-sm text-foreground/85">{e.t}</p>
                          <p className="text-xs text-muted-foreground">{e.d}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </Reveal>

            <Reveal className="h-full" delay={80}>
              <GlassCard className="h-full p-6">
                <SectionLabel icon={Zap}>Recommended actions</SectionLabel>
                <ul className="mt-4 space-y-3">
                  {[
                    { t: "Send a personalized upgrade offer", d: "High impact" },
                    { t: "Invite to the advocacy program", d: "Medium" },
                    { t: "Schedule a quarterly check-in", d: "Low effort" },
                  ].map((a) => (
                    <li
                      key={a.t}
                      className="lift flex items-center justify-between gap-2 rounded-2xl border border-border bg-background/30 p-3 hover:border-gold/40"
                    >
                      <span className="text-sm text-foreground/85">{a.t}</span>
                      <span className="shrink-0 text-xs text-gold">{a.d}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}

function SegmentsView({ onExplore }: { onExplore: () => void }) {
  const { customers, resegment } = useCustomersData();
  const segs = deriveSegments(customers);
  const total = customers.length;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const runResegment = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { changed, total: n } = await resegment();
      setNote(changed === 0 ? `All ${n} customers already correctly tiered.` : `Re-tiered ${changed} of ${n} customers.`);
    } catch {
      setNote("Couldn't re-segment — please try again.");
    }
    setBusy(false);
  };
  return (
    <div className="space-y-5">
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
              <Layers className="size-5" stroke="oklch(0.2 0.02 70)" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Segmentation engine</p>
              <p className="mt-1 text-sm text-foreground/85">
                Your <span className="text-gold">{formatNum(total)}</span> customer{total === 1 ? "" : "s"}, grouped
                into 6 segments by tier and share of lifetime value.
              </p>
              {note && <p className="mt-1.5 text-xs text-gold">{note}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={runResegment}
                disabled={busy || total === 0}
                title="Auto-classify every customer by value, order frequency, and health"
                className="flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2.5 text-xs font-semibold text-gold transition-all hover:bg-gold/10 active:scale-[0.98] disabled:opacity-50"
              >
                <Sparkles className="size-3.5" /> {busy ? "Segmenting…" : "Smart re-segment"}
              </button>
              <button
                onClick={onExplore}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: "var(--gradient-gold)" }}
              >
                View customers <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {segs.map((s, i) => (
          <Reveal key={s.label} delay={i * 60} className="h-full">
            <GlassCard className="lift flex h-full flex-col p-6 hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-xs tabular-nums text-gold">${formatNum(s.ltv)}</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{formatNum(s.count)}</span>
                <span className="text-xs text-muted-foreground">customer{s.count === 1 ? "" : "s"} · {s.share}% of value</span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              <div className="mt-4">
                <Bar value={Math.min(100, s.share)} tone="gold" />
              </div>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function JourneyView() {
  const { customers } = useCustomersData();
  const countFor = (tier: string) => customers.filter((c) => c.tier === tier).length;
  const stages = LIFECYCLE_STAGES.map((stage, i) => {
    const count = countFor(stage);
    const nextCount = i < LIFECYCLE_STAGES.length - 1 ? countFor(LIFECYCLE_STAGES[i + 1]) : null;
    const conv = nextCount !== null && count > 0 ? Math.round((nextCount / count) * 100) : null;
    return { stage, count, conv };
  });
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  const total = customers.length;
  const advocacy = total ? Math.round((countFor("Champion") / total) * 100) : 0;
  const atRisk = countFor("At risk");
  const dormant = countFor("Dormant");

  return (
    <div className="space-y-5">
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Target}>Customer lifecycle</SectionLabel>
            <span className="text-xs text-muted-foreground">New → Champion</span>
          </div>
          {total === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Add customers and their lifecycle stages will map out here.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {stages.map((s, i) => {
                const width = 30 + (s.count / maxCount) * 70;
                return (
                  <JourneyStage key={s.stage} stage={s.stage} count={s.count} conv={s.conv} width={width} index={i} />
                );
              })}
            </div>
          )}
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: TrendingUp, k: "Advocacy rate", v: `${advocacy}%`, d: "customers who are champions" },
          { icon: Heart, k: "At-risk customers", v: String(atRisk), d: "need intervention" },
          { icon: Target, k: "Dormant customers", v: String(dormant), d: "win-back candidates" },
        ].map((m, i) => (
          <Reveal key={m.k} delay={i * 70} className="h-full">
            <GlassCard className="h-full p-5">
              <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass">
                <m.icon className="size-4 text-gold" />
              </span>
              <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{m.v}</p>
              <p className="mt-1 text-sm text-foreground/80">{m.k}</p>
              <p className="text-xs text-muted-foreground">{m.d}</p>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function JourneyStage({
  stage,
  count,
  conv,
  width,
  index,
}: {
  stage: string;
  count: number;
  conv: number | null;
  width: number;
  index: number;
}) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className="flex items-center gap-4">
      <div className="w-28 shrink-0 text-right text-sm text-foreground/80">{stage}</div>
      <div className="relative flex-1">
        <div
          className="flex h-12 items-center justify-between rounded-xl px-4 transition-all duration-1000 ease-out"
          style={{
            width: inView ? `${width}%` : "0%",
            transitionDelay: `${index * 90}ms`,
            background: `linear-gradient(90deg, oklch(0.84 0.14 84 / ${0.28 - index * 0.03}), oklch(0.84 0.14 84 / ${0.12 - index * 0.015}))`,
            border: "1px solid var(--color-border)",
          }}
        >
          <span className="text-sm font-semibold tabular-nums">{formatNum(count)}</span>
          {conv !== null && <span className="text-xs text-gold">{conv}% →</span>}
        </div>
      </div>
    </div>
  );
}

const CHANNELS: InteractionChannel[] = ["note", "call", "email", "meeting", "chat"];

function CommsView() {
  const { org } = useOrg();
  const { customers } = useCustomersData();
  const [items, setItems] = useState<DbInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<{ customerId: string; channel: InteractionChannel; body: string }>({
    customerId: "",
    channel: "note",
    body: "",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!org) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setItems(await listInteractions(org.id));
    } catch {
      setItems([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;

  const submit = async () => {
    if (!org || !form.body.trim() || busy) return;
    setBusy(true);
    await addInteraction(org.id, {
      customer_id: form.customerId || null,
      channel: form.channel,
      body: form.body.trim(),
    });
    setBusy(false);
    setForm({ customerId: "", channel: "note", body: "" });
    await load();
  };

  const nameOf = (i: DbInteraction) => i.customer?.name ?? "General";

  return (
    <Reveal>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <GlassCard className="flex flex-col p-2">
          <div className="flex items-center justify-between px-3 py-3">
            <SectionLabel icon={MessageSquare}>Activity log</SectionLabel>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-medium text-gold">
              {items.length}
            </span>
          </div>
          <div className="max-h-[24rem] space-y-1 overflow-y-auto">
            {loading && <p className="px-3 py-8 text-center text-xs text-muted-foreground">Loading…</p>}
            {!loading && items.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No interactions yet. Log your first one on the right.
              </p>
            )}
            {items.map((t) => {
              const Icon = channelIcon[t.channel];
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                    active && t.id === active.id ? "bg-glass" : "hover:bg-glass",
                  )}
                >
                  <Avatar name={nameOf(t)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{nameOf(t)}</span>
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">{timeAgo(t.created_at)}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Icon className="size-3 shrink-0" />
                      {t.body}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="flex min-h-[26rem] flex-col p-6">
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <Avatar name={nameOf(active)} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{nameOf(active)}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {active.channel} · {timeAgo(active.created_at)} ago
                  </p>
                </div>
              </div>
              <div className="flex-1 py-5">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-background/40 px-4 py-3 text-sm leading-relaxed text-foreground/85">
                  {active.body}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Log an interaction to start your activity history.
            </div>
          )}

          {/* Composer — logs a real interaction */}
          <div className="rounded-2xl border border-gold/25 bg-glass p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-gold">
              <Plus className="size-3.5" /> Log an interaction
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                value={form.customerId}
                onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                className={CRM_INPUT}
              >
                <option value="">General (no customer)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as InteractionChannel }))}
                className={CRM_INPUT}
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>{ch[0].toUpperCase() + ch.slice(1)}</option>
                ))}
              </select>
            </div>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="What happened? e.g. Called about renewal — wants a Q3 demo."
              rows={2}
              className={`${CRM_INPUT} mt-2 resize-none`}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={submit}
                disabled={!form.body.trim() || busy}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}
              >
                <Send className="size-3.5" /> {busy ? "Saving…" : "Log interaction"}
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </Reveal>
  );
}

function LoyaltyView() {
  const { customers } = useCustomersData();
  const { org } = useOrg();
  const [codes, setCodes] = useState<RewardCode[]>([]);
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const loadAll = useCallback(async () => {
    if (!org) return;
    const [c, s] = await Promise.all([listRewardCodes(org.id), getLoyaltySettings(org.id)]);
    setCodes(c);
    setSettings(s);
  }, [org?.id]);
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const grades = [...settings.grades].sort((a, b) => a.threshold - b.threshold);
  const topGradeName = grades.length ? grades[grades.length - 1].grade : "";

  // Members with points (lifetime spend) + current grade, ranked.
  const members = customers
    .map((c) => ({ ...c, points: pointsFor(c.ltv, settings), grade: gradeFor(pointsFor(c.ltv, settings), settings) }))
    .sort((a, b) => b.points - a.points);
  const top = members.slice(0, 5);

  // Exclusive count at each grade (the repeating "Elite" tier folds into the top grade).
  const gradeCount = (name: string) =>
    members.filter((m) => (m.grade ? (m.grade.grade === "Elite" ? topGradeName : m.grade.grade) : "") === name).length;

  const issued = codes.length;
  const used = codes.filter((c) => c.status === "used").length;
  const outstanding = codes.filter((c) => c.status === "issued").length;

  const runIssue = async () => {
    if (!org) return;
    setBusy(true);
    setNote(null);
    const { issued: n, error } = await issueRewardCodes(
      org.id,
      customers.map((c) => ({ id: c.id, name: c.name, ltv: c.ltv })),
      codes,
      settings,
    );
    if (error) setNote("Reward codes need the database update (0022) applied first.");
    else setNote(n === 0 ? "Everyone's rewards are up to date." : `Issued ${n} new reward code${n === 1 ? "" : "s"}.`);
    await loadAll();
    setBusy(false);
  };

  const toggleUsed = async (c: RewardCode) => {
    await markCodeUsed(c.id, c.status !== "used");
    await loadAll();
  };

  return (
    <div className="space-y-5">
      {/* Engine header */}
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
              <Crown className="size-5" stroke="oklch(0.2 0.02 70)" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Rewards engine</p>
              {settings.enabled ? (
                <p className="mt-1 text-sm text-foreground/85">
                  {settings.pointsPerDollar} point{settings.pointsPerDollar === 1 ? "" : "s"} per $1 spent · points only climb. A reward code
                  auto-issues at each milestone — <span className="text-gold">{formatNum(issued)}</span> issued, {formatNum(outstanding)}{" "}
                  outstanding, {formatNum(used)} used.
                </p>
              ) : (
                <p className="mt-1 text-sm text-foreground/70">Loyalty is turned off for this workspace. Open settings to enable it.</p>
              )}
              {note && <p className="mt-1.5 text-xs text-gold">{note}</p>}
            </div>
            <button
              onClick={() => setShowSettings((v) => !v)}
              title="Configure your loyalty program"
              className="flex items-center gap-2 rounded-full border border-border bg-glass px-4 py-2.5 text-xs font-semibold text-foreground/80 transition-all hover:border-gold/40 active:scale-[0.98]"
            >
              <Sliders className="size-3.5" /> Settings
            </button>
            {settings.enabled && (
              <button
                onClick={runIssue}
                disabled={busy || customers.length === 0}
                title="Check every customer and issue codes for milestones they've reached"
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}
              >
                <Sparkles className="size-3.5" /> {busy ? "Checking…" : "Check & issue rewards"}
              </button>
            )}
          </div>
        </GlassCard>
      </Reveal>

      {showSettings && org && (
        <LoyaltySettingsPanel orgId={org.id} settings={settings} onSaved={async () => { await loadAll(); }} onClose={() => setShowSettings(false)} />
      )}

      {!settings.enabled ? (
        <Reveal>
          <GlassCard className="flex flex-col items-center p-10 text-center">
            <span className="grid size-14 place-items-center rounded-full border border-border bg-glass">
              <Crown className="size-6 text-muted-foreground" />
            </span>
            <h3 className="mt-4 text-lg" style={{ fontFamily: "var(--font-display)" }}>Loyalty is off</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Turn on the rewards program to auto-issue codes as customers hit spending milestones. You control every threshold and value.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="mt-5 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: "var(--gradient-gold)" }}
            >
              <Power className="size-4" /> Turn on loyalty
            </button>
          </GlassCard>
        </Reveal>
      ) : (
      <>
      {/* Grade ladder */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {grades.map((g, i) => {
          const color = gradeColor(i);
          return (
          <Reveal key={`${g.grade}-${g.threshold}`} delay={i * 60} className="h-full">
            <GlassCard className="lift h-full p-5 hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass">
                  <Crown className="size-4" style={{ color }} />
                </span>
                <span className="text-xs text-muted-foreground">{formatNum(g.threshold)} pts → ${g.value}</span>
              </div>
              <p className="mt-4 text-sm font-semibold" style={{ color }}>
                {g.grade}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNum(gradeCount(g.grade))}</p>
              <p className="text-xs text-muted-foreground">member{gradeCount(g.grade) === 1 ? "" : "s"} at this grade</p>
            </GlassCard>
          </Reveal>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top members + progress to next milestone */}
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Award}>Top members</SectionLabel>
            <div className="mt-4 space-y-2.5">
              {top.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Add customers to rank your top members.</p>}
              {top.map((m, i) => {
                const nxt = nextMilestone(m.points, settings);
                return (
                  <div key={m.id} className="rounded-xl px-2 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                      <Avatar name={m.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.grade ? m.grade.grade : "No grade yet"} · {formatNum(m.points)} pts
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-gold">{formatNum(m.points)}</span>
                    </div>
                    {nxt && (
                      <div className="mt-2 pl-8">
                        <Bar value={nxt.pct} tone="gold" />
                        <p className="mt-1 text-[11px] text-muted-foreground">{formatNum(nxt.remaining)} pts to next reward</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </Reveal>

        {/* Rewards ledger */}
        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Ticket}>Rewards ledger</SectionLabel>
            <div className="mt-4 space-y-2.5">
              {codes.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No codes issued yet. Click <span className="text-gold">Check &amp; issue rewards</span> to award earned milestones.
                </p>
              )}
              {codes.slice(0, 12).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-glass">
                    <Gift className="size-4 text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.customer_name ?? "Customer"} · <span className="text-gold">${formatNum(Number(c.value))}</span>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.grade} · {c.code}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleUsed(c)}
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-[0.97]",
                      c.status === "used"
                        ? "border-emerald-500/40 text-emerald-400"
                        : "border-gold/40 text-gold hover:bg-gold/10",
                    )}
                    title={c.status === "used" ? "Mark as not used" : "Mark this code redeemed"}
                  >
                    {c.status === "used" ? (
                      <>
                        <Check className="size-3" /> Used
                      </>
                    ) : (
                      "Mark used"
                    )}
                  </button>
                </div>
              ))}
              {codes.length > 12 && (
                <p className="pt-1 text-center text-xs text-muted-foreground">+{codes.length - 12} more codes</p>
              )}
            </div>
          </GlassCard>
        </Reveal>
      </div>
      </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Loyalty settings editor
 * ─────────────────────────────────────────────────────────────────── */

function LoyaltySettingsPanel({
  orgId,
  settings,
  onSaved,
  onClose,
}: {
  orgId: string;
  settings: LoyaltySettings;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<LoyaltySettings>(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setGrade = (i: number, patch: Partial<{ grade: string; threshold: number; value: number }>) =>
    setDraft((d) => ({ ...d, grades: d.grades.map((g, idx) => (idx === i ? { ...g, ...patch } : g)) }));
  const addGrade = () =>
    setDraft((d) => ({ ...d, grades: [...d.grades, { grade: `Tier ${d.grades.length + 1}`, threshold: 0, value: 0 }] }));
  const removeGrade = (i: number) => setDraft((d) => ({ ...d, grades: d.grades.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const clean = {
      ...draft,
      pointsPerDollar: Math.max(0.01, Number(draft.pointsPerDollar) || 1),
      grades: draft.grades
        .map((g) => ({ grade: g.grade.trim() || "Tier", threshold: Math.max(0, Number(g.threshold) || 0), value: Math.max(0, Number(g.value) || 0) }))
        .sort((a, b) => a.threshold - b.threshold),
    };
    const { error } = await saveLoyaltySettings(orgId, clean);
    if (error) setMsg("Couldn't save — the loyalty_settings table (migration 0023) may not be applied yet.");
    else {
      setMsg("Saved.");
      await onSaved();
    }
    setSaving(false);
  };

  return (
    <Reveal>
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel icon={Sliders}>Loyalty settings</SectionLabel>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              className="size-4 accent-[oklch(0.84_0.14_84)]"
            />
            <span className={draft.enabled ? "text-gold" : "text-muted-foreground"}>{draft.enabled ? "Program on" : "Program off"}</span>
          </label>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Earn rate + grades */}
          <div className="space-y-3">
            <label className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              Earn rate — points per $1 spent
              <input
                type="number"
                min={0.01}
                step={0.5}
                value={draft.pointsPerDollar}
                onChange={(e) => setDraft((d) => ({ ...d, pointsPerDollar: Number(e.target.value) }))}
                className={cn(CRM_INPUT, "mt-1 max-w-[8rem]")}
              />
            </label>

            <div>
              <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Grades — points needed → code value</p>
              <div className="mt-2 space-y-2">
                {draft.grades.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={g.grade} onChange={(e) => setGrade(i, { grade: e.target.value })} placeholder="Name" className={cn(CRM_INPUT, "flex-1")} />
                    <input type="number" min={0} value={g.threshold} onChange={(e) => setGrade(i, { threshold: Number(e.target.value) })} title="Points threshold" className={cn(CRM_INPUT, "w-24")} />
                    <span className="text-xs text-muted-foreground">→ $</span>
                    <input type="number" min={0} value={g.value} onChange={(e) => setGrade(i, { value: Number(e.target.value) })} title="Code value ($)" className={cn(CRM_INPUT, "w-20")} />
                    <button onClick={() => removeGrade(i)} title="Remove grade" className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addGrade} className="mt-2 flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-gold/40">
                <Plus className="size-3.5" /> Add grade
              </button>
            </div>
          </div>

          {/* Repeating tier + save */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-background/30 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.repeat.enabled}
                  onChange={(e) => setDraft((d) => ({ ...d, repeat: { ...d.repeat, enabled: e.target.checked } }))}
                  className="size-4 accent-[oklch(0.84_0.14_84)]"
                />
                <span className="font-medium">Repeating top tier</span>
              </label>
              <p className="mt-1 text-xs text-muted-foreground">Keeps rewarding your biggest customers past the top grade.</p>
              {draft.repeat.enabled && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                    Starts at
                    <input type="number" min={0} value={draft.repeat.start} onChange={(e) => setDraft((d) => ({ ...d, repeat: { ...d.repeat, start: Number(e.target.value) } }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                    Every (pts)
                    <input type="number" min={1} value={draft.repeat.step} onChange={(e) => setDraft((d) => ({ ...d, repeat: { ...d.repeat, step: Number(e.target.value) } }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                  <label className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                    Code $
                    <input type="number" min={0} value={draft.repeat.value} onChange={(e) => setDraft((d) => ({ ...d, repeat: { ...d.repeat, value: Number(e.target.value) } }))} className={cn(CRM_INPUT, "mt-1")} />
                  </label>
                </div>
              )}
            </div>

            {msg && <p className="text-xs text-gold">{msg}</p>}
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}
              >
                <Check className="size-3.5" /> {saving ? "Saving…" : "Save settings"}
              </button>
              <button onClick={onClose} className="rounded-full border border-border px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                Close
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
    </Reveal>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: "Customer intelligence", sub: "The business understands every customer" },
  customers: { title: "Customer database", sub: "Every relationship, scored and searchable" },
  profiles: { title: "AI customer profiles", sub: "A 360° view powered by your data" },
  segments: { title: "Segmentation engine", sub: "Grouped by tier and lifetime value" },
  journey: { title: "Customer journey", sub: "From first touch to advocacy" },
  comms: { title: "Communication center", sub: "Log calls, notes and emails per customer" },
  loyalty: { title: "Loyalty system", sub: "Tiers, points and rewards" },
};

export function CrmWorkspace() {
  const [active, setActive] = useState<ViewKey>("overview");
  const [selectedId, setSelectedId] = useState("c1");
  const meta = viewMeta[active];

  const openProfile = (id: string) => {
    setSelectedId(id);
    setActive("profiles");
  };

  return (
    <CustomersProvider>
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">CRM</p>
        <nav className="mt-2 space-y-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active === v.key
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-glass hover:text-foreground",
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
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
          >
            <Bot className="size-4" stroke="oklch(0.2 0.02 70)" /> Ask the engine
          </button>
        </div>

        {/* mobile view switcher */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active === v.key
                  ? "border-gold/50 text-foreground"
                  : "border-border bg-glass text-muted-foreground",
              )}
              style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        {/* animated view swap */}
        <div key={active} className="rise">
          {active === "overview" && <OverviewView />}
          {active === "customers" && <CustomersView onOpen={openProfile} />}
          {active === "profiles" && <ProfilesView selectedId={selectedId} onSelect={setSelectedId} />}
          {active === "segments" && <SegmentsView onExplore={() => setActive("customers")} />}
          {active === "journey" && <JourneyView />}
          {active === "comms" && <CommsView />}
          {active === "loyalty" && <LoyaltyView />}
        </div>
      </section>
    </div>
    </CustomersProvider>
  );
}
