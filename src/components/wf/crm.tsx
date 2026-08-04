import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  Bot,
  Brain,
  Building2,
  Crown,
  Filter,
  Gift,
  Heart,
  Home,
  Layers,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Send,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Delta, Donut, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useCountUp } from "@/hooks/use-count-up";
import { useInView } from "@/hooks/use-in-view";

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

const customers: Customer[] = [
  { id: "c1", name: "Ava Chen", company: "Northwind Co", email: "ava@northwind.co", ltv: 18420, health: 94, tier: "Champion", last: "2h ago", sentiment: "Positive", tags: ["High intent", "Upsell ready"], spark: [30, 34, 33, 40, 44, 51, 58, 66, 74], since: "2023", orders: 34 },
  { id: "c2", name: "Leo Park", company: "Brightloom", email: "leo@brightloom.io", ltv: 12960, health: 88, tier: "Loyal", last: "1d ago", sentiment: "Positive", tags: ["Renewal soon"], spark: [40, 41, 44, 43, 47, 49, 52, 55, 58], since: "2022", orders: 27 },
  { id: "c3", name: "Mara Silva", company: "Fjord Studio", email: "mara@fjord.design", ltv: 9840, health: 72, tier: "Potential", last: "3d ago", sentiment: "Neutral", tags: ["Price sensitive"], spark: [20, 26, 30, 28, 34, 36, 41, 44, 48], since: "2024", orders: 14 },
  { id: "c4", name: "Noah Reed", company: "Ridgeway", email: "noah@ridgeway.com", ltv: 21500, health: 91, tier: "Champion", last: "5h ago", sentiment: "Positive", tags: ["Advocate", "Case study"], spark: [50, 54, 58, 61, 66, 70, 76, 82, 90], since: "2021", orders: 41 },
  { id: "c5", name: "Priya Nair", company: "Solstice", email: "priya@solstice.co", ltv: 4120, health: 58, tier: "New", last: "6h ago", sentiment: "Neutral", tags: ["Onboarding"], spark: [8, 12, 18, 24, 30, 34, 38, 41, 44], since: "2025", orders: 4 },
  { id: "c6", name: "Sam Idris", company: "Halcyon", email: "sam@halcyon.app", ltv: 15230, health: 41, tier: "At risk", last: "21d ago", sentiment: "Negative", tags: ["Churn risk", "Ticket open"], spark: [60, 58, 55, 50, 44, 40, 34, 30, 26], since: "2022", orders: 22 },
  { id: "c7", name: "Ivy Zhou", company: "Meridian", email: "ivy@meridian.co", ltv: 7350, health: 66, tier: "Loyal", last: "2d ago", sentiment: "Positive", tags: ["Referral source"], spark: [30, 32, 35, 37, 40, 42, 45, 47, 50], since: "2023", orders: 18 },
  { id: "c8", name: "Dane Ford", company: "Cobalt", email: "dane@cobalt.io", ltv: 3010, health: 28, tier: "Dormant", last: "58d ago", sentiment: "Negative", tags: ["Win-back"], spark: [40, 36, 30, 26, 20, 16, 12, 10, 8], since: "2022", orders: 9 },
];

const segments = [
  { label: "Champions", count: 486, share: 34, trend: 8, color: GOLD, desc: "Buy often, spend the most, and advocate for you." },
  { label: "Loyal", count: 642, share: 28, trend: 5, color: "oklch(0.7 0.11 60)", desc: "Consistent repeat buyers with strong retention." },
  { label: "Potential", count: 398, share: 16, trend: 12, color: "oklch(0.66 0.09 200)", desc: "Recent buyers trending toward loyalty." },
  { label: "New", count: 512, share: 12, trend: 22, color: "oklch(0.75 0.13 150)", desc: "First purchase in the last 30 days." },
  { label: "At risk", count: 214, share: 7, trend: -6, color: "oklch(0.68 0.16 25)", desc: "Declining engagement — needs intervention." },
  { label: "Dormant", count: 589, share: 3, trend: -3, color: "oklch(0.62 0.02 260)", desc: "No activity in 60+ days. Win-back candidates." },
];

const journey = [
  { stage: "Awareness", count: 12480, conv: 42 },
  { stage: "Consideration", count: 5240, conv: 61 },
  { stage: "Purchase", count: 3196, conv: 89 },
  { stage: "Onboarding", count: 2845, conv: 96 },
  { stage: "Retention", count: 2731, conv: 74 },
  { stage: "Advocacy", count: 2021, conv: null as number | null },
];

type Thread = {
  id: string;
  name: string;
  channel: "email" | "chat" | "sms";
  snippet: string;
  time: string;
  unread: boolean;
};

const threads: Thread[] = [
  { id: "t1", name: "Ava Chen", channel: "email", snippet: "Re: Q3 renewal — the new pricing looks great, let's proceed.", time: "8m", unread: true },
  { id: "t2", name: "Leo Park", channel: "chat", snippet: "Can I upgrade to the Growth plan mid-cycle?", time: "24m", unread: true },
  { id: "t3", name: "Sam Idris", channel: "sms", snippet: "Still waiting on that support ticket…", time: "1h", unread: false },
  { id: "t4", name: "Ivy Zhou", channel: "email", snippet: "Sharing WonderFlow with two other founders 🙌", time: "3h", unread: false },
  { id: "t5", name: "Priya Nair", channel: "chat", snippet: "How do I connect my Shopify store?", time: "5h", unread: false },
];

const channelIcon: Record<Thread["channel"], LucideIcon> = { email: Mail, chat: MessageSquare, sms: Phone };

const loyaltyTiers = [
  { tier: "Platinum", members: 128, min: "10,000 pts", color: "oklch(0.9 0.05 250)" },
  { tier: "Gold", members: 486, min: "5,000 pts", color: GOLD },
  { tier: "Silver", members: 742, min: "2,000 pts", color: "oklch(0.8 0.02 250)" },
  { tier: "Bronze", members: 1103, min: "0 pts", color: "oklch(0.62 0.08 55)" },
];

const topMembers = [
  { name: "Noah Reed", pts: 24850, tier: "Platinum" },
  { name: "Ava Chen", pts: 19420, tier: "Platinum" },
  { name: "Leo Park", pts: 11200, tier: "Platinum" },
  { name: "Ivy Zhou", pts: 8640, tier: "Gold" },
];

const rewards = [
  { label: "$50 account credit", pts: "5,000 pts", icon: Gift },
  { label: "Priority support line", pts: "8,000 pts", icon: Zap },
  { label: "Early feature access", pts: "12,000 pts", icon: Star },
];

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
  const total = 2841;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total customers" value={2841} delta="6.2%" icon={Users} />
        <StatTile label="Avg lifetime value" value={4820} prefix="$" delta="11%" icon={TrendingUp} />
        <StatTile label="Retention rate" value={92} suffix="%" delta="2.1 pts" icon={Heart} />
        <StatTile label="Net promoter score" value={72} delta="6" icon={Star} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Layers}>Revenue by segment</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Donut
                data={segments}
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
                {segments.map((s) => (
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
            <div className="relative">
              <SectionLabel icon={Sparkles}>Customer intelligence</SectionLabel>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-foreground/90">
                The business understands every customer. This week I detected{" "}
                <span className="text-gold">27 accounts</span> drifting toward churn and{" "}
                <span className="text-gold">84 primed to upsell</span>. Champions now drive{" "}
                <span className="text-gold">61%</span> of revenue.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  { icon: Zap, t: "84 accounts ready for an upsell", d: "+$52k potential" },
                  { icon: Heart, t: "Re-engage 27 at-risk customers", d: "$41k retained" },
                  { icon: Star, t: "12 advocates could give referrals", d: "avg 2.3 leads each" },
                ].map((r) => (
                  <button
                    key={r.t}
                    className="lift flex w-full items-center gap-3 rounded-2xl border border-border bg-background/30 p-3 text-left hover:border-gold/40"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-glass">
                      <r.icon className="size-4 text-gold" />
                    </span>
                    <span className="flex-1 text-sm text-foreground/85">{r.t}</span>
                    <span className="shrink-0 text-xs text-gold">{r.d}</span>
                  </button>
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

function CustomersView({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<string>("All");
  const tiers = ["All", "Champion", "Loyal", "Potential", "New", "At risk", "Dormant"];
  const filtered = customers.filter(
    (c) =>
      (tier === "All" || c.tier === tier) &&
      (q === "" ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.company.toLowerCase().includes(q.toLowerCase())),
  );

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
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Filter className="size-4" />
          </div>
        </div>

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
          {filtered.map((c) => (
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
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No customers match that filter.</p>
          )}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function ProfilesView({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const c = customers.find((x) => x.id === selectedId) ?? customers[0];
  const timeline = [
    { icon: Star, t: "Left a 5-star review", d: "2 days ago" },
    { icon: TrendingUp, t: "Upgraded to Growth plan", d: "3 weeks ago" },
    { icon: Mail, t: "Opened renewal email · clicked pricing", d: "1 month ago" },
    { icon: Award, t: `Became a ${c.tier}`, d: "4 months ago" },
  ];

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
                <ul className="mt-4 space-y-4">
                  {timeline.map((e) => (
                    <li key={e.t} className="flex items-start gap-3">
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
                AI clustered <span className="text-gold">2,841 customers</span> into 6 living segments by
                behavior, value and momentum — recalculated every night.
              </p>
            </div>
            <button
              onClick={onExplore}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: "var(--gradient-gold)" }}
            >
              Build a segment <ArrowRight className="size-3.5" />
            </button>
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {segments.map((s, i) => (
          <Reveal key={s.label} delay={i * 60} className="h-full">
            <GlassCard className="lift flex h-full flex-col p-6 hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <Delta value={`${Math.abs(s.trend)}%`} positive={s.trend >= 0} />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{formatNum(s.count)}</span>
                <span className="text-xs text-muted-foreground">customers · {s.share}% of revenue</span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              <div className="mt-4">
                <Bar value={s.share * 2.4} tone={s.trend >= 0 ? "gold" : "muted"} />
              </div>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function JourneyView() {
  const maxCount = journey[0].count;
  return (
    <div className="space-y-5">
      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Target}>Customer journey</SectionLabel>
            <span className="text-xs text-muted-foreground">Awareness → Advocacy</span>
          </div>
          <div className="mt-6 space-y-3">
            {journey.map((s, i) => {
              const width = 30 + (s.count / maxCount) * 70;
              return (
                <JourneyStage key={s.stage} stage={s.stage} count={s.count} conv={s.conv} width={width} index={i} />
              );
            })}
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Target, k: "Overall conversion", v: "16.2%", d: "visitor → customer" },
          { icon: Heart, k: "Avg time to advocacy", v: "4.1 mo", d: "from first purchase" },
          { icon: TrendingUp, k: "Retention at stage 5", v: "74%", d: "12-month cohort" },
        ].map((m, i) => (
          <Reveal key={m.k} delay={i * 70} className="h-full">
            <GlassCard className="h-full p-5">
              <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass">
                <m.icon className="size-4 text-gold" />
              </span>
              <p className="mt-4 text-2xl font-semibold tracking-tight">{m.v}</p>
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

function CommsView() {
  const [activeId, setActiveId] = useState(threads[0].id);
  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  return (
    <Reveal>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <GlassCard className="flex flex-col p-2">
          <div className="flex items-center justify-between px-3 py-3">
            <SectionLabel icon={MessageSquare}>Inbox</SectionLabel>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-medium text-gold">
              {threads.filter((t) => t.unread).length} new
            </span>
          </div>
          <div className="space-y-1">
            {threads.map((t) => {
              const Icon = channelIcon[t.channel];
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                    t.id === active.id ? "bg-glass" : "hover:bg-glass",
                  )}
                >
                  <Avatar name={t.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{t.name}</span>
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">{t.time}</span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Icon className="size-3 shrink-0" />
                      {t.snippet}
                    </p>
                  </div>
                  {t.unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-gold" />}
                </button>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="flex min-h-[26rem] flex-col p-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <Avatar name={active.name} />
            <div>
              <p className="text-sm font-semibold text-foreground">{active.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{active.channel}</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 py-5">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-background/40 px-4 py-3 text-sm text-foreground/85">
              {active.snippet}
            </div>
          </div>
          <div className="rounded-2xl border border-gold/25 bg-glass p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-gold">
              <Sparkles className="size-3.5" /> AI suggested reply
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              “Thanks {active.name.split(" ")[0]} — happy to help. I've applied the change to your account
              and sent a confirmation. Anything else I can take care of?”
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: "var(--gradient-gold)" }}
              >
                <Send className="size-3.5" /> Send reply
              </button>
              <button className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                Edit
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </Reveal>
  );
}

function LoyaltyView() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loyaltyTiers.map((t, i) => (
          <Reveal key={t.tier} delay={i * 60} className="h-full">
            <GlassCard className="lift h-full p-5 hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass">
                  <Crown className="size-4" style={{ color: t.color }} />
                </span>
                <span className="text-xs text-muted-foreground">{t.min}</span>
              </div>
              <p className="mt-4 text-sm font-semibold" style={{ color: t.color }}>
                {t.tier}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNum(t.members)}</p>
              <p className="text-xs text-muted-foreground">members</p>
            </GlassCard>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Award}>Top members</SectionLabel>
            <div className="mt-4 space-y-1">
              {topMembers.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.tier}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-gold">
                    {formatNum(m.pts)} pts
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Gift}>Rewards catalog</SectionLabel>
            <div className="mt-4 space-y-3">
              {rewards.map((r) => (
                <div
                  key={r.label}
                  className="lift flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-4 hover:border-gold/40"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-glass">
                    <r.icon className="size-4 text-gold" />
                  </span>
                  <span className="flex-1 text-sm text-foreground/85">{r.label}</span>
                  <span className="shrink-0 text-xs font-medium text-gold">{r.pts}</span>
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
  overview: { title: "Customer intelligence", sub: "The business understands every customer" },
  customers: { title: "Customer database", sub: "Every relationship, scored and searchable" },
  profiles: { title: "AI customer profiles", sub: "A 360° view powered by your data" },
  segments: { title: "Segmentation engine", sub: "Living segments, recalculated nightly" },
  journey: { title: "Customer journey", sub: "From first touch to advocacy" },
  comms: { title: "Communication center", sub: "One inbox across every channel" },
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
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 lg:flex">
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
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
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
  );
}
