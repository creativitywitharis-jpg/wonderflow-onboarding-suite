import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  DollarSign,
  Gauge,
  History,
  Home,
  Lightbulb,
  MessageSquare,
  Plus,
  Rocket,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Bar, Reveal, Ring, SectionLabel, Sparkline, StatTile, formatNum } from "@/components/wf/primitives";
import { useOrg } from "@/lib/org-context";
import { askAI } from "@/lib/ai";
import { listCustomers } from "@/lib/customers";
import { listInvoices, listExpenses } from "@/lib/finance";
import { buildOpportunities, buildRisks, OPP_CATEGORIES, type Opportunity, type Risk, type Sev } from "@/lib/advisor";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "overview" | "chat" | "predictions" | "strategy" | "opportunities" | "risks" | "decisions" | "memory";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "CEO dashboard", icon: Home },
  { key: "chat", label: "Advisor chat", icon: MessageSquare },
  { key: "predictions", label: "Predictions", icon: TrendingUp },
  { key: "strategy", label: "Strategy room", icon: Compass },
  { key: "opportunities", label: "Opportunities", icon: Lightbulb },
  { key: "risks", label: "Risk monitor", icon: ShieldAlert },
  { key: "decisions", label: "Decision history", icon: History },
  { key: "memory", label: "AI memory", icon: Database },
];



type Scenario = "Conservative" | "Base" | "Aggressive";
const scenarioFactor: Record<Scenario, number> = { Conservative: 0.9, Base: 1, Aggressive: 1.12 };

const predictions = [
  { k: "Revenue next quarter", base: 1320000, prefix: "$", dir: 1, conf: 86, trend: [58, 62, 60, 66, 70, 74, 82] },
  { k: "Customers (end of Q)", base: 3480, dir: 1, conf: 82, trend: [22, 30, 37, 46, 55, 64, 74] },
  { k: "Cash runway", base: 14.2, suffix: " mo", decimals: 1, dir: 1, conf: 91, trend: [10, 11, 11, 12, 13, 13, 14] },
  { k: "Projected churn", base: 3.2, suffix: "%", decimals: 1, dir: -1, conf: 79, trend: [5, 4.6, 4.2, 3.9, 3.6, 3.4, 3.2] },
];

const initiatives = [
  { title: "Launch referral engine", progress: 35, impact: 88, effort: 40, status: "In progress", plan: ["Design reward tiers", "Build referral tracking", "Seed with Champions", "Measure & iterate"] },
  { title: "Expand into wholesale", progress: 12, impact: 82, effort: 78, status: "Planning", plan: ["Validate 5 target accounts", "Build wholesale pricing", "Hire a partnerships lead"] },
  { title: "Automate fulfillment", progress: 64, impact: 70, effort: 45, status: "In progress", plan: ["Integrate 3PL", "Auto-route orders", "SLA monitoring"] },
  { title: "Raise a seed round", progress: 5, impact: 90, effort: 85, status: "Exploring", plan: ["Tighten metrics story", "Build data room", "Warm-intro 12 funds"] },
];

const sevColor: Record<Sev, string> = { High: "oklch(0.68 0.16 25)", Medium: "oklch(0.84 0.14 84)", Low: "oklch(0.72 0.14 155)" };

const decisions = [
  { title: "Increased ad spend on referral channel", date: "Jul 28", status: "Implemented", impact: "+$14k", result: "ROAS 5.2x, on track" },
  { title: "Renegotiated packaging with Northwind", date: "Jul 21", status: "Implemented", impact: "-9% COGS", result: "Saving $3.1k/mo" },
  { title: "Paused underperforming SMS campaign", date: "Jul 14", status: "Monitoring", impact: "neutral", result: "Reallocated to email" },
  { title: "Hired a part-time ops lead", date: "Jul 2", status: "Monitoring", impact: "+capacity", result: "Fulfillment SLA improving" },
  { title: "Delayed wholesale expansion", date: "Jun 20", status: "Paused", impact: "risk-off", result: "Revisit in Q4" },
];
const decisionStatusColor: Record<string, string> = { Implemented: "oklch(0.72 0.14 155)", Monitoring: "oklch(0.84 0.14 84)", Paused: "oklch(0.7 0.02 250)" };

type Memory = { category: string; text: string };
const initialMemory: Memory[] = [
  { category: "Business context", text: "DTC skincare brand, founder-led, ~2,841 customers, $1.01M ARR." },
  { category: "Business context", text: "Core SKUs: Aurora Serum, Midnight Oil, Golden Hour Balm." },
  { category: "Goals", text: "Reach $1.5M ARR by end of next year." },
  { category: "Goals", text: "Improve gross margin from 68% to 72%." },
  { category: "Preferences", text: "Prefers low-risk, high-confidence moves; cash-flow conscious." },
  { category: "Preferences", text: "Wants weekly briefings, not daily noise." },
  { category: "Learned", text: "Champions segment drives 61% of revenue and responds to VIP early access." },
  { category: "Learned", text: "Referral is the biggest untapped growth lever (score 61)." },
];
const memoryCategories = ["Business context", "Goals", "Preferences", "Learned"];
const memoryIcon: Record<string, LucideIcon> = { "Business context": Target, Goals: Rocket, Preferences: Sparkles, Learned: Lightbulb };

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

type Priority = { t: string; d: string; icon: LucideIcon };

function OverviewView({ go }: { go: (v: ViewKey) => void }) {
  const { org } = useOrg();
  const [loading, setLoading] = useState(true);
  const [m, setM] = useState({
    revenueMtd: 0, outstanding: 0, unpaid: 0, expenses: 0, net: 0,
    customers: 0, totalLtv: 0, avgHealth: 0, atRisk: 0, collectionRate: 0, hasData: false,
  });
  const [briefing, setBriefing] = useState<string | null>(null);
  const [priorities, setPriorities] = useState<Priority[]>([]);

  useEffect(() => {
    let alive = true;
    if (!org) return;
    (async () => {
      setLoading(true);
      const [customers, invoices, expenses] = await Promise.all([
        listCustomers(org.id).catch(() => []),
        listInvoices(org.id).catch(() => []),
        listExpenses(org.id).catch(() => []),
      ]);
      const period = new Date().toISOString().slice(0, 7);
      const revenueMtd = invoices.filter((i) => i.status === "paid" && (i.paid_at ?? "").slice(0, 7) === period).reduce((a, i) => a + Number(i.total || 0), 0);
      const paidTotal = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.total || 0), 0);
      const unpaidList = invoices.filter((i) => i.status === "sent");
      const outstanding = unpaidList.reduce((a, i) => a + Number(i.total || 0), 0);
      const expensesTotal = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
      const totalLtv = customers.reduce((a, c) => a + Number(c.ltv || 0), 0);
      const avgHealth = customers.length ? Math.round(customers.reduce((a, c) => a + Number(c.health || 0), 0) / customers.length) : 0;
      const atRisk = customers.filter((c) => c.tier === "At risk" || Number(c.health) < 50).length;
      const upsell = customers.filter((c) => (c.tier === "Champion" || c.tier === "Loyal") && Number(c.health) >= 70);
      const collectionRate = paidTotal + outstanding > 0 ? Math.round((paidTotal / (paidTotal + outstanding)) * 100) : 0;
      const net = paidTotal - expensesTotal;
      const hasData = customers.length > 0 || invoices.length > 0;

      // Real, data-driven priorities.
      const pr: Priority[] = [];
      if (outstanding > 0) pr.push({ t: `Chase $${formatNum(outstanding)} across ${unpaidList.length} unpaid invoice${unpaidList.length === 1 ? "" : "s"}`, d: "collect cash", icon: DollarSign });
      if (atRisk > 0) pr.push({ t: `${atRisk} customer${atRisk === 1 ? "" : "s"} slipping — reach out`, d: "retain", icon: ShieldAlert });
      if (upsell.length > 0) pr.push({ t: `${upsell.length} account${upsell.length === 1 ? "" : "s"} ready for an upsell`, d: `$${formatNum(upsell.reduce((a, c) => a + Number(c.ltv || 0), 0))} in play`, icon: Rocket });
      if (pr.length === 0 && hasData) pr.push({ t: "Book more work — pipeline is quiet", d: "grow", icon: TrendingUp });

      if (!alive) return;
      setM({ revenueMtd, outstanding, unpaid: unpaidList.length, expenses: expensesTotal, net, customers: customers.length, totalLtv, avgHealth, atRisk, collectionRate, hasData });
      setPriorities(pr);
      setLoading(false);

      // Real AI briefing grounded in the numbers (skip if the workspace is empty).
      if (!hasData) {
        setBriefing(null);
        return;
      }
      const snapshot = `Snapshot for ${org.name || "the business"}: ${customers.length} customers worth $${formatNum(totalLtv)} lifetime value, average customer health ${avgHealth}/100, ${atRisk} at-risk. Finance: $${formatNum(revenueMtd)} collected this month, $${formatNum(outstanding)} outstanding across ${unpaidList.length} unpaid invoices, $${formatNum(expensesTotal)} expenses, net $${formatNum(net)}. Collection rate ${collectionRate}%.`;
      try {
        const reply = await askAI(
          [{ role: "user", content: `${snapshot}\n\nGive me a sharp 2–3 sentence daily CEO briefing. Lead with the single most important thing, cite the real numbers, and end with today's top priority. No greeting, no preamble.` }],
          { id: org.id, name: org.name, industry: org.industry },
        );
        if (alive) setBriefing(reply);
      } catch {
        if (alive) setBriefing(`You're tracking ${customers.length} customers worth $${formatNum(totalLtv)}. $${formatNum(outstanding)} is outstanding and net is $${formatNum(net)} this period. Priority: ${pr[0]?.t ?? "keep the pipeline moving"}.`);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  const healthLabel = m.avgHealth >= 75 ? "Healthy & growing" : m.avgHealth >= 50 ? "Stable — room to improve" : m.customers === 0 ? "No data yet" : "Needs attention";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue (MTD)" value={m.revenueMtd} prefix="$" icon={DollarSign} />
        <StatTile label="Outstanding (AR)" value={m.outstanding} prefix="$" icon={Activity} />
        <StatTile label="Customers" value={m.customers} icon={TrendingUp} />
        <StatTile label="At-risk" value={m.atRisk} positive={m.atRisk === 0} icon={ShieldAlert} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Gauge}>Business Health Score</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Ring value={m.avgHealth} size={128} label={<div><div className="text-3xl font-semibold tabular-nums gold-text">{m.avgHealth}</div><div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">/ 100</div></div>} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><TrendingUp className="size-4 text-gold" /> {healthLabel}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Based on your customers' average health across the book.</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
              <div><div className="flex items-baseline justify-between text-xs"><span className="text-foreground/80">Total LTV</span><span className="tabular-nums text-gold">${formatNum(m.totalLtv)}</span></div><div className="mt-1.5"><Bar value={Math.min(100, m.avgHealth)} /></div></div>
              <div><div className="flex items-baseline justify-between text-xs"><span className="text-foreground/80">Collection rate</span><span className="tabular-nums text-gold">{m.collectionRate}%</span></div><div className="mt-1.5"><Bar value={m.collectionRate} /></div></div>
              <div><div className="flex items-baseline justify-between text-xs"><span className="text-foreground/80">Net (period)</span><span className="tabular-nums text-gold">${formatNum(m.net)}</span></div><div className="mt-1.5"><Bar value={m.net >= 0 ? 80 : 20} /></div></div>
              <div><div className="flex items-baseline justify-between text-xs"><span className="text-foreground/80">At-risk</span><span className="tabular-nums text-gold">{m.atRisk}</span></div><div className="mt-1.5"><Bar value={m.customers ? Math.round((m.atRisk / m.customers) * 100) : 0} /></div></div>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><BrainCircuit className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Daily CEO briefing</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">
                  {!m.hasData
                    ? "Add customers and invoices and I'll brief you here every day — grounded in your real numbers."
                    : briefing ?? (loading ? "Reading your business…" : "Preparing your briefing…")}
                </p>
              </div>
            </div>
            {priorities.length > 0 && (
              <div className="relative mt-5 space-y-2">
                {priorities.map((d) => (
                  <button key={d.t} onClick={() => go("chat")} className="lift flex w-full items-center gap-3 rounded-2xl border border-border bg-background/30 p-3 text-left hover:border-gold/40">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-glass"><d.icon className="size-4 text-gold" /></span>
                    <span className="flex-1 text-sm text-foreground/85">{d.t}</span>
                    <span className="shrink-0 text-xs text-gold">{d.d}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => go("chat")} className="lift relative mt-4 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110" style={{ background: "var(--gradient-gold)" }}>
              <MessageSquare className="size-4" stroke="oklch(0.2 0.02 70)" /> Ask your advisor anything
            </button>
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

type ChatMsg = { role: "ai" | "user"; text: string };
const consultantPrompts = ["Should I raise prices?", "Where should I focus next quarter?", "Am I ready to hire?", "How do I improve margins?", "What's my biggest risk right now?"];
const threadHistory = ["Q4 pricing strategy", "Hiring plan review", "Cash runway scenarios", "Wholesale expansion"];

function ChatView() {
  const { org } = useOrg();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

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
        trimmed[0] = { ...trimmed[0], content: `You are the strategic Business Advisor inside WonderFlow OS — a sharp COO/consultant. Give specific, prioritized advice on strategy, pricing, hiring, margins, cash and risk.\n\n${trimmed[0].content}` };
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
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Reveal className="hidden lg:block">
        <GlassCard className="p-4">
          <p className="px-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Recent</p>
          <div className="mt-2 space-y-1">
            {threadHistory.map((t) => (
              <button key={t} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground">
                <MessageSquare className="size-3.5 shrink-0" /> <span className="truncate">{t}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <Reveal>
        <GlassCard className="glass-strong flex h-[34rem] flex-col p-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><BrainCircuit className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
            <div><p className="text-sm font-semibold tracking-tight">WonderFlow Advisor</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-400" /> Your 24/7 CEO consultant</p></div>
          </div>

          <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && !thinking && (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Sparkles className="size-6" stroke="oklch(0.2 0.02 70)" /></span>
                  <p className="mt-4 text-lg" style={{ fontFamily: "var(--font-display)" }}>How can I help you lead today?</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ask me anything about your business — strategy, money, people, risk.</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>{m.text}</div>
              </div>
            ))}
            {thinking && <div className="flex justify-start"><div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div></div>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {consultantPrompts.map((p) => (<button key={p} onClick={() => send(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your CEO advisor…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
            <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
          </form>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function PredictionsView() {
  const [scenario, setScenario] = useState<Scenario>("Base");
  const factor = scenarioFactor[scenario];
  const value = (base: number, dir: number) => (dir >= 0 ? base * factor : base / factor);
  return (
    <div className="space-y-5">
      <Reveal>
        <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Sparkles className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
            <p className="text-sm text-foreground/85">AI forecast · next 90 days · updated nightly</p>
          </div>
          <div className="flex gap-1.5">
            {(Object.keys(scenarioFactor) as Scenario[]).map((s) => (
              <button key={s} onClick={() => setScenario(s)} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", scenario === s ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={scenario === s ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{s}</button>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2">
        {predictions.map((p, i) => (
          <Reveal key={p.k} delay={i * 60}>
            <GlassCard className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{p.k}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {p.prefix}{formatNum(value(p.base, p.dir), p.decimals ?? 0)}{p.suffix}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Gauge className="size-3.5 text-gold" /> {p.conf}%</div>
                  <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">confidence</p>
                </div>
              </div>
              <div className="mt-3"><Sparkline data={p.trend} id={`pred-${i}`} /></div>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function StrategyView() {
  const [selected, setSelected] = useState(initiatives[0].title);
  const cur = initiatives.find((x) => x.title === selected) ?? initiatives[0];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={Compass}>Strategic initiatives</SectionLabel>
          <div className="mt-4 space-y-2">
            {initiatives.map((s) => (
              <button key={s.title} onClick={() => setSelected(s.title)} className={cn("w-full rounded-2xl border p-4 text-left transition-colors", s.title === selected ? "border-gold/40 bg-glass" : "border-border bg-background/30 hover:border-gold/30")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <span className="rounded-full bg-glass px-2 py-0.5 text-[0.65rem] text-muted-foreground">{s.status}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1"><Bar value={s.progress} /></div>
                  <span className="text-xs tabular-nums text-gold">{s.progress}%</span>
                </div>
                <div className="mt-2 flex gap-4 text-[0.7rem] text-muted-foreground"><span>Impact {s.impact}</span><span>Effort {s.effort}</span></div>
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="glass-strong sticky top-6 overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold"><BrainCircuit className="size-3.5" /> AI strategy plan</p>
            <h3 className="mt-3 text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>{cur.title}</h3>
            <ol className="mt-4 space-y-3">
              {cur.plan.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold text-primary-foreground" style={{ background: "var(--gradient-gold)" }}>{i + 1}</span>
                  <span className="text-sm text-foreground/85">{step}</span>
                </li>
              ))}
            </ol>
            <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>
              <Rocket className="size-4" /> Commit to this plan
            </button>
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function OpportunitiesView() {
  const { org } = useOrg();
  const [cat, setCat] = useState("All");
  const [opps, setOpps] = useState<Opportunity[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (org?.id) buildOpportunities(org.id).then((r) => alive && setOpps(r)).catch(() => alive && setOpps([]));
    else setOpps([]);
    return () => { alive = false; };
  }, [org?.id]);

  const filtered = (opps ?? []).filter((o) => cat === "All" || o.category === cat);
  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-wrap gap-2">
          {OPP_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", cat === c ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={cat === c ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{c}</button>
          ))}
        </div>
      </Reveal>
      {opps === null && <GlassCard className="p-8 text-center text-sm text-muted-foreground">Scanning your data for opportunities…</GlassCard>}
      {opps !== null && filtered.length === 0 && (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          {(opps.length === 0)
            ? "No opportunities surfaced yet — add customers, invoices and expenses and I'll spot where the money is."
            : "No opportunities in this category right now."}
        </GlassCard>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((o, i) => (
          <Reveal key={o.title} delay={i * 50} className="h-full">
            <GlassCard className="lift flex h-full flex-col p-6 hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-border bg-glass px-2.5 py-0.5 text-[0.65rem] text-muted-foreground">{o.category}</span>
                <Lightbulb className="size-4 text-gold" />
              </div>
              <p className="mt-4 flex-1 text-sm font-medium text-foreground/90">{o.title}</p>
              <p className="mt-3 text-xl font-semibold tabular-nums text-gold">{o.value}</p>
              <div className="mt-3 flex items-center justify-between text-[0.7rem] text-muted-foreground">
                <span>{o.conf} confidence · {o.effort} effort</span>
              </div>
              <button className="lift mt-4 flex items-center justify-center gap-2 rounded-full border border-gold/30 bg-glass py-2 text-xs font-semibold text-foreground/85 transition-colors hover:border-gold/60">
                Pursue <ArrowUpRight className="size-3.5 text-gold" />
              </button>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function RisksView() {
  const { org } = useOrg();
  const trendIcon = (t: string) => (t === "up" ? TrendingUp : t === "down" ? TrendingDown : Activity);
  const [data, setData] = useState<{ risks: Risk[]; score: number; high: number } | null>(null);
  useEffect(() => {
    let alive = true;
    if (org?.id) buildRisks(org.id).then((r) => alive && setData(r)).catch(() => alive && setData({ risks: [], score: 5, high: 0 }));
    else setData({ risks: [], score: 5, high: 0 });
    return () => { alive = false; };
  }, [org?.id]);

  const risks = data?.risks ?? [];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Portfolio risk score" value={data?.score ?? 0} suffix="/100" icon={ShieldCheck} positive={(data?.score ?? 0) < 40} />
        <StatTile label="High-severity risks" value={data?.high ?? 0} icon={ShieldAlert} positive={(data?.high ?? 0) === 0} />
        <StatTile label="Risks tracked" value={risks.length} icon={CheckCircle2} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={ShieldAlert}>Risk register</SectionLabel>
          {data === null && <p className="mt-4 py-6 text-center text-sm text-muted-foreground">Scanning your data for risks…</p>}
          {data !== null && risks.length === 0 && (
            <p className="mt-4 py-6 text-center text-sm text-muted-foreground">No material risks detected. Add more data and I'll keep watch.</p>
          )}
          <div className="mt-4 space-y-2">
            {risks.map((r) => {
              const T = trendIcon(r.trend);
              return (
                <div key={r.title} className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-[auto_1.6fr_1fr_auto]">
                  <span className="grid size-9 place-items-center rounded-lg" style={{ background: `color-mix(in oklch, ${sevColor[r.severity]} 15%, transparent)` }}><ShieldAlert className="size-4" style={{ color: sevColor[r.severity] }} /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{r.title}</p><p className="text-xs text-muted-foreground">{r.category}</p></div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="text-xs text-muted-foreground">Likelihood</span>
                    <div className="w-16"><Bar value={r.likelihood} tone={r.severity === "High" ? "gold" : "muted"} /></div>
                    <T className="size-3.5" style={{ color: r.trend === "down" ? "oklch(0.72 0.14 155)" : r.trend === "up" ? "oklch(0.68 0.16 25)" : "var(--color-muted-foreground)" }} />
                  </div>
                  <span className="hidden text-right text-xs text-gold sm:block">{r.mitigation}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function DecisionsView() {
  return (
    <Reveal>
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <SectionLabel icon={History}>Decision history</SectionLabel>
          <span className="text-xs text-muted-foreground">a journal of what you decided & why</span>
        </div>
        <div className="mt-5 space-y-0">
          {decisions.map((d, i) => (
            <div key={d.title} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-glass"><CheckCircle2 className="size-4" style={{ color: decisionStatusColor[d.status] }} /></span>
                {i < decisions.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
              </div>
              <div className="pb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-medium" style={{ color: decisionStatusColor[d.status], background: `color-mix(in oklch, ${decisionStatusColor[d.status]} 14%, transparent)` }}>{d.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground"><Clock className="mr-1 inline size-3" />{d.date} · impact {d.impact}</p>
                <p className="mt-1.5 text-sm text-foreground/80">{d.result}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function MemoryView() {
  const [mem, setMem] = useState<Memory[]>(initialMemory);
  const [text, setText] = useState("");
  const [cat, setCat] = useState("Learned");
  const add = () => {
    const t = text.trim(); if (!t) return;
    setMem((m) => [{ category: cat, text: t }, ...m]); setText("");
  };
  return (
    <div className="space-y-5">
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative flex items-start gap-4">
            <span className="orb grid size-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Database className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">AI memory</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">Everything I remember about your business — so every answer is personal. Teach me something and I'll factor it into future advice.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50">
                  {memoryCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. We're launching a men's line in Q1" className="min-w-0 flex-1 rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50" />
                <button onClick={add} className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><Plus className="size-4" /> Teach</button>
              </div>
            </div>
          </div>
        </GlassCard>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2">
        {memoryCategories.map((c) => {
          const Icon = memoryIcon[c] ?? Sparkles;
          const items = mem.filter((m) => m.category === c);
          return (
            <Reveal key={c} className="h-full">
              <GlassCard className="h-full p-6">
                <SectionLabel icon={Icon}>{c}</SectionLabel>
                <ul className="mt-4 space-y-2">
                  {items.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl border border-border bg-background/30 p-3 text-sm text-foreground/85">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" /> {m.text}
                    </li>
                  ))}
                  {items.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
                </ul>
              </GlassCard>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: "AI CEO dashboard", sub: "Your world-class consultant, 24/7" },
  chat: { title: "Advisor chat", sub: "Ask anything about your business" },
  predictions: { title: "Business predictions", sub: "See the next 90 days" },
  strategy: { title: "Strategy room", sub: "Turn goals into plans" },
  opportunities: { title: "Opportunity finder", sub: "Growth hiding in your data" },
  risks: { title: "Risk monitoring", sub: "See threats before they land" },
  decisions: { title: "Decision history", sub: "A journal of your calls" },
  memory: { title: "AI memory", sub: "What your advisor knows about you" },
};

export function AdvisorWorkspace() {
  const [active, setActive] = useState<ViewKey>("overview");
  const meta = viewMeta[active];
  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 flex items-center gap-1.5 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-gold"><BrainCircuit className="size-3" /> AI Advisor</p>
        <nav className="mt-2 space-y-1">
          {views.map((v) => (
            <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
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
          <button onClick={() => setActive("chat")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <MessageSquare className="size-4" stroke="oklch(0.2 0.02 70)" /> Talk to your advisor
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {views.map((v) => (
            <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>

        <div key={active} className="rise">
          {active === "overview" && <OverviewView go={setActive} />}
          {active === "chat" && <ChatView />}
          {active === "predictions" && <PredictionsView />}
          {active === "strategy" && <StrategyView />}
          {active === "opportunities" && <OpportunitiesView />}
          {active === "risks" && <RisksView />}
          {active === "decisions" && <DecisionsView />}
          {active === "memory" && <MemoryView />}
        </div>
      </section>
    </div>
  );
}
