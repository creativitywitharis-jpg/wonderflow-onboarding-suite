import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Command,
  Factory,
  FileText,
  Home,
  LineChart,
  MessageSquare,
  Package,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
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

/* ──────────────────────────────────────────────────────────────────────
 * Data
 * ─────────────────────────────────────────────────────────────────── */

const nav: { icon: LucideIcon; label: string; to?: string }[] = [
  { icon: Home, label: "Overview" },
  { icon: CircleDollarSign, label: "Revenue" },
  { icon: ShoppingCart, label: "Orders", to: "/orders" },
  { icon: Users, label: "Customers", to: "/crm" },
  { icon: Boxes, label: "Inventory", to: "/inventory" },
  { icon: Factory, label: "Suppliers", to: "/suppliers" },
  { icon: Workflow, label: "Automations" },
  { icon: Bot, label: "Copilot" },
  { icon: Settings, label: "Settings" },
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

const health = {
  score: 87,
  tier: "Excellent",
  pillars: [
    { label: "Financial", value: 92 },
    { label: "Operations", value: 84 },
    { label: "Customer", value: 88 },
    { label: "Growth", value: 79 },
  ],
};

const customerSegments = [
  { label: "Champions", value: 34 },
  { label: "Loyal", value: 28 },
  { label: "New", value: 26 },
  { label: "At risk", value: 12 },
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

const recommendations = [
  { title: "Renegotiate two supplier contracts", impact: "$14.2k / quarter", confidence: "High" },
  { title: "Automate invoice reconciliation", impact: "9 hrs / week", confidence: "High" },
  { title: "Launch a bundle for the Champions segment", impact: "+$22k / month", confidence: "Medium" },
];

const activity = [
  { who: "Ava Chen", what: "closed Northwind Co — $12,000", when: "8m", icon: CircleDollarSign },
  { who: "Copilot", what: "reconciled 42 invoices automatically", when: "22m", icon: Bot },
  { who: "Marcus Reid", what: "updated the Q3 revenue forecast", when: "1h", icon: LineChart },
  { who: "Automation", what: "shipped churn-watch v2 to production", when: "2h", icon: Workflow },
  { who: "Priya Nair", what: "added 3 products to the catalog", when: "3h", icon: Package },
];

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
      <GlassCard className="glass-strong relative overflow-hidden p-6 sm:p-7">
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
          <Delta value={kpi.delta} positive={kpi.positive} />
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

function HealthScore() {
  const { ref, inView } = useInView();
  const shown = useCountUp(health.score, { start: inView, duration: 1400 });
  const circumference = 2 * Math.PI * 70;
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
              <TrendingUp className="size-4 text-gold" /> {health.tier}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Top 8% of comparable operators. Up 4 points this month.
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
          {health.pillars.map((p) => (
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
  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <SectionLabel icon={Users}>Customer intelligence</SectionLabel>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { k: "New (30d)", v: "142", d: "+18%" },
            { k: "NPS", v: "72", d: "+6" },
            { k: "At risk", v: "27", d: "watch" },
          ].map((m) => (
            <div key={m.k} className="rounded-2xl border border-border bg-background/30 px-3 py-3">
              <p className="text-[0.7rem] text-muted-foreground">{m.k}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{m.v}</p>
              <p className="text-[0.7rem] text-gold">{m.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {customerSegments.map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-foreground/80">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">{s.value}%</span>
              </div>
              <div className="mt-1.5">
                <Bar value={s.value} tone={s.label === "At risk" ? "muted" : "gold"} />
              </div>
            </div>
          ))}
        </div>
        <button className="lift mt-5 flex items-center justify-between rounded-2xl border border-gold/25 bg-glass px-4 py-3 text-left text-sm transition-colors hover:border-gold/50">
          <span className="text-foreground/85">
            Re-engage <span className="text-gold">148 dormant accounts</span>
          </span>
          <span className="flex items-center gap-1 text-xs text-gold">
            $31k pipeline <ArrowUpRight className="size-3.5" />
          </span>
        </button>
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
  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <SectionLabel icon={Zap}>Growth recommendations</SectionLabel>
          <span className="text-xs text-muted-foreground">AI-generated</span>
        </div>
        <ul className="mt-4 space-y-3">
          {recommendations.map((r) => (
            <li
              key={r.title}
              className="lift rounded-2xl border border-border bg-background/30 p-4 hover:border-gold/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground/90">{r.title}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
                    r.confidence === "High" ? "text-emerald-300" : "text-gold",
                  )}
                  style={{
                    background:
                      r.confidence === "High"
                        ? "oklch(0.72 0.14 155 / 12%)"
                        : "oklch(0.84 0.14 84 / 12%)",
                  }}
                >
                  {r.confidence}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gold">{r.impact}</span>
                <div className="flex items-center gap-2">
                  <button className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Dismiss
                  </button>
                  <button
                    className="rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{ background: "var(--gradient-gold)" }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </Reveal>
  );
}

function TeamActivity() {
  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <SectionLabel icon={Activity}>Team activity</SectionLabel>
        <ul className="mt-5 space-y-4">
          {activity.map((a) => (
            <li key={a.what} className="flex items-center gap-3">
              <Avatar name={a.who} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground/85">
                  <span className="font-medium text-foreground">{a.who}</span> {a.what}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {a.when}
              </span>
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
    <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 lg:flex">
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
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <Sidebar />

      <section className="min-w-0 flex-1 space-y-5">
        <Topbar company={company} greeting={greeting} dateStr={dateStr} />

        <AiBriefing company={company} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k, i) => (
            <KpiCard key={k.label} kpi={k} index={i} />
          ))}
        </div>

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
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[22rem] shrink-0 2xl:block">
        <CopilotPanel />
      </aside>
    </div>
  );
}
