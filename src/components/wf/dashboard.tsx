import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Command,
  Factory,
  FileText,
  Home,
  LineChart,
  MessageSquare,
  Package,
  Rocket,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  UsersRound,
  Wand2,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Delta, Reveal, SectionLabel, Sparkline, formatNum } from "@/components/wf/primitives";
import { useCountUp } from "@/hooks/use-count-up";
import { useInView } from "@/hooks/use-in-view";
import { useOrg } from "@/lib/org-context";
import { listCustomers, type DbCustomer } from "@/lib/customers";
import { listMembers, type Member } from "@/lib/team";

/* ──────────────────────────────────────────────────────────────────────
 * Data
 * ─────────────────────────────────────────────────────────────────── */

const nav: { icon: LucideIcon; label: string; to?: string }[] = [
  { icon: Home, label: "Overview" },
  { icon: Rocket, label: "Growth", to: "/growth" },
  { icon: BarChart3, label: "Analytics", to: "/analytics" },
  { icon: ShoppingCart, label: "Orders", to: "/orders" },
  { icon: Users, label: "Customers", to: "/crm" },
  { icon: UsersRound, label: "Team", to: "/team" },
  { icon: Boxes, label: "Inventory", to: "/inventory" },
  { icon: Factory, label: "Suppliers", to: "/suppliers" },
  { icon: Workflow, label: "Automations", to: "/automation" },
  { icon: Bot, label: "AI Advisor", to: "/advisor" },
  { icon: Settings, label: "Settings", to: "/admin" },
];

type Kpi = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta: string;
  positive: boolean;
  spark: number[];
};

const kpis: Kpi[] = [
  {
    label: "Net revenue",
    value: 412908,
    prefix: "$",
    delta: "12.4%",
    positive: true,
    spark: [32, 38, 35, 44, 42, 51, 49, 58, 55, 67, 72, 84],
  },
  {
    label: "Monthly recurring",
    value: 84200,
    prefix: "$",
    delta: "8.1%",
    positive: true,
    spark: [40, 42, 41, 46, 48, 47, 52, 54, 58, 61, 63, 68],
  },
  {
    label: "Gross margin",
    value: 68.4,
    suffix: "%",
    decimals: 1,
    delta: "2.3 pts",
    positive: true,
    spark: [58, 60, 59, 62, 61, 63, 64, 63, 66, 67, 67, 68],
  },
  {
    label: "Active customers",
    value: 2841,
    delta: "142",
    positive: true,
    spark: [22, 26, 30, 33, 37, 41, 46, 52, 58, 63, 69, 74],
  },
];

const inventory = {
  inStock: 94,
  lowStock: 12,
  outOfStock: 3,
  reorder: [
    { name: "Aurora Serum", left: "4 days of stock", pct: 18 },
    { name: "Midnight Oil", left: "6 days of stock", pct: 27 },
    { name: "Golden Hour Balm", left: "9 days of stock", pct: 41 },
  ],
};

const quickActions: { icon: LucideIcon; label: string }[] = [
  { icon: FileText, label: "Create invoice" },
  { icon: Package, label: "Add product" },
  { icon: Workflow, label: "New workflow" },
  { icon: MessageSquare, label: "Message customer" },
  { icon: LineChart, label: "Generate report" },
  { icon: Wand2, label: "Ask Copilot" },
];

/* ──────────────────────────────────────────────────────────────────────
 * Sections
 * ─────────────────────────────────────────────────────────────────── */

function AiBriefing({ company }: { company: string }) {
  return (
    <Reveal>
      <GlassCard className="ai-glow glass-strong relative overflow-hidden p-6 sm:p-7">
        <div className="veil pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative flex items-start gap-4">
          <span
            className="orb grid size-11 shrink-0 place-items-center rounded-full"
            style={{ background: "var(--gradient-gold)" }}
          >
            <Sparkles className="size-5" stroke="oklch(0.2 0.02 70)" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                AI daily briefing
              </p>
              <span className="text-xs text-muted-foreground">· auto-generated 6:00 AM</span>
            </div>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-foreground/90 sm:text-base">
              Good news, {company}. Cash position is healthy and fulfilment latency dropped for the
              third week running. Revenue is pacing <span className="text-gold">12% ahead</span> of
              last month. I found <span className="text-gold">three moves</span> worth roughly{" "}
              <span className="text-gold">$45k</span> this quarter — I can execute the first two on
              your approval.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                { k: "Cash runway", v: "14.2 months", up: true },
                { k: "Fulfilment latency", v: "-31% wow", up: true },
                { k: "Churn risk", v: "27 accounts", up: false },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl border border-border bg-background/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{s.k}</p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-semibold tabular-nums",
                      s.up ? "text-foreground" : "text-gold",
                    )}
                  >
                    {s.v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </Reveal>
  );
}

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const { ref, inView } = useInView();
  const val = useCountUp(kpi.value, { start: inView });
  return (
    <div
      ref={ref}
      className={cn("reveal", inView && "reveal-in")}
      style={{ transitionDelay: `${index * 70}ms` }}
    >
      <GlassCard className="lift group h-full p-5 hover:border-gold/40">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{kpi.label}</p>
          {kpi.delta && <Delta value={kpi.delta} positive={kpi.positive} />}
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
          {kpi.prefix}
          {formatNum(val, kpi.decimals ?? 0)}
          {kpi.suffix}
        </p>
        <div className="mt-3">
          <Sparkline data={kpi.spark} id={`kpi-${index}`} />
        </div>
      </GlassCard>
    </div>
  );
}

function healthTierLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Healthy & growing";
  if (score >= 50) return "Stable";
  return "Needs attention";
}

function HealthScore() {
  const { ref, inView } = useInView();
  const s = useDash();
  const score = s.healthScore;
  const shown = useCountUp(score, { start: inView, duration: 1400 });
  const circumference = 2 * Math.PI * 70;
  const pillars = [
    { label: "Customer health", value: s.avgHealth },
    { label: "Champions", value: pct(s.champions, s.total) },
    { label: "Retention", value: s.total ? Math.round(((s.total - s.dormant) / s.total) * 100) : 0 },
    { label: "Engagement", value: s.total ? 100 - pct(s.atRisk, s.total) : 0 },
  ];
  return (
    <div ref={ref} className={cn("reveal h-full", inView && "reveal-in")}>
      <GlassCard className="flex h-full flex-col p-6">
        <SectionLabel icon={Activity}>Business health</SectionLabel>
        <div className="mt-4 flex items-center gap-6">
          <div className="relative grid size-36 shrink-0 place-items-center">
            <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="var(--color-border)" strokeWidth="9" />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - shown / 100)}
                style={{ transition: "stroke-dashoffset 80ms linear" }}
              />
            </svg>
            <div className="text-center">
              <div className="text-4xl font-semibold tracking-tight gold-text tabular-nums">
                {Math.round(shown)}
              </div>
              <div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                / 100
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="size-4 text-gold" /> {healthTierLabel(score)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A blended score across your customer base and workspace activity.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
          {pillars.map((p) => (
            <div key={p.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-foreground/80">{p.label}</span>
                <span className="tabular-nums text-gold">{p.value}</span>
              </div>
              <div className="mt-1.5">
                <Bar value={p.value} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function CustomerIntelligence() {
  const s = useDash();
  const stats = [
    { k: "New", v: s.newC },
    { k: "Champions", v: s.champions },
    { k: "At risk", v: s.atRisk },
  ];
  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <SectionLabel icon={Users}>Customer intelligence</SectionLabel>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map((m) => (
            <div key={m.k} className="rounded-2xl border border-border bg-background/30 px-3 py-3">
              <p className="text-[0.7rem] text-muted-foreground">{m.k}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {s.segments.map((seg) => (
            <div key={seg.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-foreground/80">{seg.label}</span>
                <span className="tabular-nums text-muted-foreground">{seg.value}%</span>
              </div>
              <div className="mt-1.5">
                <Bar value={seg.value} tone={seg.label === "At risk" ? "muted" : "gold"} />
              </div>
            </div>
          ))}
        </div>
        <Link
          to="/crm"
          className="lift mt-5 flex items-center justify-between rounded-2xl border border-gold/25 bg-glass px-4 py-3 text-left text-sm transition-colors hover:border-gold/50"
        >
          <span className="text-foreground/85">
            {s.dormant > 0 ? (
              <>Re-engage <span className="text-gold">{s.dormant} dormant customer{s.dormant === 1 ? "" : "s"}</span></>
            ) : (
              <>Open the <span className="text-gold">customer database</span></>
            )}
          </span>
          <ArrowUpRight className="size-3.5 text-gold" />
        </Link>
      </GlassCard>
    </Reveal>
  );
}

function InventoryHealth() {
  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <SectionLabel icon={Boxes}>Inventory health</SectionLabel>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { k: "In stock", v: `${inventory.inStock}%`, tone: "text-emerald-300" },
            { k: "Low stock", v: `${inventory.lowStock}`, tone: "text-gold" },
            { k: "Out of stock", v: `${inventory.outOfStock}`, tone: "text-rose-300" },
          ].map((m) => (
            <div key={m.k} className="rounded-2xl border border-border bg-background/30 px-3 py-3">
              <p className="text-[0.7rem] text-muted-foreground">{m.k}</p>
              <p className={cn("mt-1 text-lg font-semibold tabular-nums", m.tone)}>{m.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Reorder soon
        </p>
        <ul className="mt-3 space-y-3">
          {inventory.reorder.map((item) => (
            <li key={item.name} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="truncate text-foreground/85">{item.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{item.left}</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={item.pct} tone="muted" />
                </div>
              </div>
              <button className="shrink-0 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-gold/40 hover:text-foreground">
                Reorder
              </button>
            </li>
          ))}
        </ul>
      </GlassCard>
    </Reveal>
  );
}

function GrowthRecommendations() {
  const s = useDash();
  const recs: { title: string; impact: string; confidence: "High" | "Medium" }[] = [];
  if (s.atRisk > 0) recs.push({ title: `Re-engage ${s.atRisk} at-risk customer${s.atRisk === 1 ? "" : "s"}`, impact: "Protect revenue", confidence: "High" });
  if (s.champions > 0) recs.push({ title: `Ask ${s.champions} champion${s.champions === 1 ? "" : "s"} for a referral`, impact: `${s.champions} warm intro${s.champions === 1 ? "" : "s"}`, confidence: "High" });
  if (s.newC > 0) recs.push({ title: `Finish onboarding ${s.newC} new customer${s.newC === 1 ? "" : "s"}`, impact: "Lift retention", confidence: "Medium" });
  if (s.dormant > 0) recs.push({ title: `Win back ${s.dormant} dormant customer${s.dormant === 1 ? "" : "s"}`, impact: "Recover lost value", confidence: "Medium" });
  const top = recs.slice(0, 3);
  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Zap}>Growth recommendations</SectionLabel>
          <span className="text-xs text-muted-foreground">From your customers</span>
        </div>
        {top.length === 0 ? (
          <p className="mt-6 flex-1 text-sm text-muted-foreground">
            Add customers and I'll surface where to focus — churn risks, upsells and referrals.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {top.map((r) => (
              <li key={r.title} className="rounded-2xl border border-border bg-background/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground/90">{r.title}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
                      r.confidence === "High" ? "text-emerald-300" : "text-gold",
                    )}
                    style={{
                      background:
                        r.confidence === "High" ? "oklch(0.72 0.14 155 / 12%)" : "oklch(0.84 0.14 84 / 12%)",
                    }}
                  >
                    {r.confidence}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gold">{r.impact}</span>
                  <Link
                    to="/crm"
                    className="rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{ background: "var(--gradient-gold)" }}
                  >
                    Open CRM
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </Reveal>
  );
}

function TeamActivity() {
  const { org } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    let alive = true;
    if (org?.id) listMembers(org.id).then((m) => alive && setMembers(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [org?.id]);
  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Users}>Your team</SectionLabel>
          <Link to="/admin" className="text-xs text-gold hover:underline">Manage →</Link>
        </div>
        <ul className="mt-5 space-y-3">
          {members.length === 0 && (
            <li className="text-sm text-muted-foreground">Just you so far — invite teammates from Administration → Users.</li>
          )}
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">{m.role}{m.status === "disabled" ? " · disabled" : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </Reveal>
  );
}

function QuickActions() {
  return (
    <Reveal>
      <GlassCard className="p-6">
        <SectionLabel icon={Command}>Quick actions</SectionLabel>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((a) => (
            <button
              key={a.label}
              className="lift group flex items-center gap-3 rounded-2xl border border-border bg-background/30 px-4 py-3.5 text-left text-sm transition-colors hover:border-gold/40"
            >
              <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass transition-colors group-hover:border-gold/40">
                <a.icon className="size-4 text-gold" />
              </span>
              <span className="text-foreground/85 group-hover:text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

/* ── AI Copilot rail ─────────────────────────────────────────────────── */

type ChatMsg = { role: "ai" | "user"; text: string };

const suggestedPrompts = [
  "Summarize this week",
  "Where am I losing money?",
  "Draft an investor update",
  "Forecast next month",
];

function CopilotPanel() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "ai",
      text: "I'm watching 6 systems in real time. Ask me anything about your business.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function send(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      setThinking(false);
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Pulling that together from your live data — I'll have a full breakdown ready in the workspace in a moment.",
        },
      ]);
    }, 1300);
  }

  return (
    <GlassCard className="glass-strong flex h-full flex-col p-5">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span
          className="orb grid size-9 place-items-center rounded-full"
          style={{ background: "var(--gradient-gold)" }}
        >
          <Bot className="size-4" stroke="oklch(0.2 0.02 70)" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">WonderFlow Copilot</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-400" /> Online · learning your ops
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "rounded-br-sm bg-glass text-foreground/90"
                  : "rounded-bl-sm border border-border bg-background/40 text-foreground/85",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3">
              <span className="size-1.5 rounded-full bg-gold" />
              <span className="size-1.5 rounded-full bg-gold" />
              <span className="size-1.5 rounded-full bg-gold" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestedPrompts.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your Copilot…"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="submit"
          aria-label="Send"
          className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
          style={{ background: "var(--gradient-gold)" }}
          disabled={!input.trim() || thinking}
        >
          <Send className="size-3.5" stroke="oklch(0.2 0.02 70)" />
        </button>
      </form>
    </GlassCard>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Layout shell
 * ─────────────────────────────────────────────────────────────────── */

function Sidebar() {
  return (
    <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
      <Brand subtle />
      <nav className="mt-8 space-y-1">
        {nav.map((n, i) => {
          const cls = cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            i === 0
              ? "text-foreground"
              : "text-muted-foreground hover:bg-glass hover:text-foreground",
          );
          const style = i === 0 ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined;
          const inner = (
            <>
              <n.icon className={cn("size-4", i === 0 && "text-gold")} />
              {n.label}
            </>
          );
          return n.to ? (
            <Link key={n.label} to={n.to} className={cls} style={style}>
              {inner}
            </Link>
          ) : (
            <button key={n.label} className={cls} style={style}>
              {inner}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-border p-4">
        <p className="flex items-center gap-2 text-xs font-medium text-foreground">
          <span className="size-1.5 rounded-full bg-gold orb" /> 6 systems live
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Your assistant is monitoring revenue, inventory and churn in real time.
        </p>
      </div>
    </aside>
  );
}

function Topbar({ company, greeting, dateStr }: { company: string; greeting: string; dateStr: string }) {
  return (
    <div className="rise flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {dateStr || "Executive briefing"}
        </p>
        <h1
          className="mt-2 text-3xl tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {greeting}, <span className="gold-text italic">{company}</span>
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <label className="hidden items-center gap-2 rounded-full border border-border bg-glass px-3.5 py-2.5 text-sm text-muted-foreground md:flex">
          <Search className="size-4" />
          <input
            placeholder="Ask or search…"
            className="w-40 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
            ⌘K
          </kbd>
        </label>
        <button className="relative grid size-11 place-items-center rounded-full border border-border bg-glass text-foreground/80 transition-colors hover:border-gold/40 hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-gold orb" />
        </button>
        <button className="grid size-11 place-items-center rounded-full border border-border bg-glass text-sm font-semibold text-foreground/80">
          {company.slice(0, 1).toUpperCase()}
        </button>
      </div>
    </div>
  );
}

const revThisYear = [220, 238, 231, 255, 268, 281, 296, 312, 305, 331, 352, 374];
const revLastYear = [180, 192, 198, 205, 214, 220, 232, 240, 246, 258, 270, 285];
const revMonths = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function RevenueCard() {
  const { ref, inView } = useInView();
  const W = 720;
  const H = 200;
  const all = [...revThisYear, ...revLastYear];
  const min = Math.min(...all) * 0.85;
  const max = Math.max(...all) * 1.04;
  const x = (i: number) => (i / (revThisYear.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const line = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line(revThisYear)} L ${W} ${H} L 0 ${H} Z`;
  return (
    <Reveal>
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionLabel icon={LineChart}>Revenue</SectionLabel>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">$3.42M</span>
              <Delta value="18%" />
              <span className="text-xs text-muted-foreground">YTD vs last year</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: "var(--gold)" }} /> This year</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-muted-foreground/50" /> Last year</span>
          </div>
        </div>
        <div ref={ref} className="mt-5">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="dash-rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.84 0.14 84 / 30%)" />
                <stop offset="100%" stopColor="oklch(0.84 0.14 84 / 0%)" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#dash-rev)" style={{ opacity: inView ? 1 : 0, transition: "opacity 0.9s ease" }} />
            <path d={line(revLastYear)} fill="none" stroke="oklch(0.7 0.015 85 / 55%)" strokeWidth="1.8" strokeDasharray="5 4" style={{ opacity: inView ? 1 : 0, transition: "opacity 0.9s ease 0.3s" }} />
            <path d={line(revThisYear)} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="spark-draw" />
          </svg>
          <div className="mt-2 flex justify-between px-1 text-[0.6rem] text-muted-foreground">
            {revMonths.map((m, i) => <span key={i}>{m}</span>)}
          </div>
        </div>
      </GlassCard>
    </Reveal>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Real per-tenant stats (derived from the org's customers + org record)
 * ─────────────────────────────────────────────────────────────────── */

type DashStats = {
  total: number;
  totalLtv: number;
  avgLtv: number;
  avgHealth: number;
  champions: number;
  loyal: number;
  newC: number;
  dormant: number;
  atRisk: number;
  healthScore: number;
  segments: { label: string; value: number }[];
};

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function computeStats(customers: DbCustomer[], healthScore: number): DashStats {
  const total = customers.length;
  const countTier = (t: string) => customers.filter((c) => c.tier === t).length;
  const totalLtv = customers.reduce((a, c) => a + Number(c.ltv), 0);
  const atRisk = customers.filter((c) => c.tier === "At risk" || c.health < 50).length;
  return {
    total,
    totalLtv,
    avgLtv: total ? Math.round(totalLtv / total) : 0,
    avgHealth: total ? Math.round(customers.reduce((a, c) => a + c.health, 0) / total) : 0,
    champions: countTier("Champion"),
    loyal: countTier("Loyal"),
    newC: countTier("New"),
    dormant: countTier("Dormant"),
    atRisk,
    healthScore,
    segments: [
      { label: "Champions", value: pct(countTier("Champion"), total) },
      { label: "Loyal", value: pct(countTier("Loyal"), total) },
      { label: "New", value: pct(countTier("New"), total) },
      { label: "At risk", value: pct(atRisk, total) },
    ],
  };
}

const EMPTY_STATS = computeStats([], 0);
const DashCtx = createContext<DashStats>(EMPTY_STATS);
function useDash() {
  return useContext(DashCtx);
}

function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { org } = useOrg();
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  useEffect(() => {
    let alive = true;
    if (org?.id) listCustomers(org.id).then((cs) => alive && setCustomers(cs)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [org?.id]);
  const stats = useMemo(() => computeStats(customers, org?.health_score ?? 0), [customers, org?.health_score]);
  return <DashCtx.Provider value={stats}>{children}</DashCtx.Provider>;
}

function KpiRow() {
  const s = useDash();
  const spark = (i: number) => kpis[i]?.spark ?? [];
  const live: Kpi[] = [
    { label: "Total customers", value: s.total, delta: s.newC ? `${s.newC} new` : "", positive: true, spark: spark(3) },
    { label: "Total lifetime value", value: s.totalLtv, prefix: "$", delta: "", positive: true, spark: spark(0) },
    { label: "Avg lifetime value", value: s.avgLtv, prefix: "$", delta: "", positive: true, spark: spark(1) },
    { label: "Avg health score", value: s.avgHealth, delta: "", positive: true, spark: spark(2) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {live.map((k, i) => (
        <KpiCard key={k.label} kpi={k} index={i} />
      ))}
    </div>
  );
}

export function ExecutiveDashboard({ company }: { company: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const hour = now?.getHours() ?? 9;
  const greeting = !now
    ? "Welcome back"
    : hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";
  const dateStr = now
    ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <DashboardProvider>
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <Sidebar />

      <section className="min-w-0 flex-1 space-y-5">
        <Topbar company={company} greeting={greeting} dateStr={dateStr} />

        <AiBriefing company={company} />

        <KpiRow />

        <RevenueCard />

        <div className="grid gap-4 lg:grid-cols-2">
          <HealthScore />
          <CustomerIntelligence />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <InventoryHealth />
          <GrowthRecommendations />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TeamActivity />
          <QuickActions />
        </div>
      </section>

      {/* AI Copilot rail — sticky on wide screens */}
      <aside className="!hidden h-[calc(100vh-3rem)] w-[22rem] shrink-0">
        <CopilotPanel />
      </aside>
    </div>
    </DashboardProvider>
  );
}
