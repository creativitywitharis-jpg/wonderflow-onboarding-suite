import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  Crown,
  DollarSign,
  Gift,
  Globe,
  Home,
  Layers,
  LineChart,
  Mail,
  Megaphone,
  MessageSquare,
  PenTool,
  Rocket,
  Send,
  Share2,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Delta, Donut, Reveal, Ring, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "overview" | "advisor" | "segments" | "campaigns" | "content" | "loyalty" | "revenue" | "analytics";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Command center", icon: Home },
  { key: "advisor", label: "Growth Advisor", icon: Brain },
  { key: "segments", label: "Segments", icon: Users },
  { key: "campaigns", label: "Campaign Studio", icon: Megaphone },
  { key: "content", label: "Content Studio", icon: PenTool },
  { key: "loyalty", label: "Loyalty", icon: Crown },
  { key: "revenue", label: "Revenue", icon: DollarSign },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

const GOLD = "oklch(0.84 0.14 84)";

const growthScore = {
  score: 78,
  tier: "Strong momentum",
  pillars: [
    { label: "Acquisition", value: 82 },
    { label: "Activation", value: 74 },
    { label: "Retention", value: 88 },
    { label: "Referral", value: 61 },
    { label: "Revenue", value: 79 },
  ],
};

const funnel = [
  { stage: "Visitors", count: 48200, conv: 20 },
  { stage: "Leads", count: 9640, conv: 33 },
  { stage: "Trials", count: 3196, conv: 40 },
  { stage: "Customers", count: 1284, conv: 38 },
  { stage: "Advocates", count: 486, conv: null as number | null },
];

const plays = [
  { title: "Launch a win-back flow for 148 dormant customers", impact: "+$31k", effort: "Low", confidence: "High" },
  { title: "Add a referral reward for your Champions segment", impact: "+220 referrals / mo", effort: "Medium", confidence: "High" },
  { title: "Retarget 1,240 cart abandoners on social", impact: "+$18k", effort: "Low", confidence: "Medium" },
  { title: "Upsell the Growth plan to 84 power users", impact: "+$22k MRR", effort: "Medium", confidence: "High" },
];

const segments = [
  { label: "High-value", count: 486, value: 34, growth: 8, color: GOLD, action: "Protect & upsell" },
  { label: "Rising stars", count: 398, value: 18, growth: 26, color: "oklch(0.75 0.13 150)", action: "Nurture to loyal" },
  { label: "New", count: 512, value: 12, growth: 22, color: "oklch(0.66 0.09 200)", action: "Onboard & activate" },
  { label: "At risk", count: 214, value: 9, growth: -6, color: "oklch(0.68 0.16 25)", action: "Re-engage now" },
  { label: "Win-back", count: 589, value: 7, growth: -3, color: "oklch(0.62 0.02 260)", action: "Reactivate offer" },
];

type Channel = "Email" | "Social" | "Ads" | "SMS";
const channelIcon: Record<Channel, LucideIcon> = { Email: Mail, Social: Share2, Ads: Megaphone, SMS: MessageSquare };

type Campaign = {
  id: string;
  name: string;
  channel: Channel;
  status: "Active" | "Scheduled" | "Draft" | "Done";
  audience: string;
  sent: number;
  open: number;
  click: number;
  roi: number;
};

const initialCampaigns: Campaign[] = [
  { id: "cmp1", name: "Summer Glow Launch", channel: "Email", status: "Active", audience: "All customers", sent: 12480, open: 42, click: 6.8, roi: 5.2 },
  { id: "cmp2", name: "Champions VIP Early Access", channel: "SMS", status: "Active", audience: "Champions", sent: 486, open: 68, click: 24, roi: 8.4 },
  { id: "cmp3", name: "Cart Abandon Retarget", channel: "Ads", status: "Active", audience: "Abandoners", sent: 1240, open: 0, click: 3.1, roi: 4.1 },
  { id: "cmp4", name: "Referral Program Teaser", channel: "Social", status: "Scheduled", audience: "Loyal", sent: 0, open: 0, click: 0, roi: 0 },
  { id: "cmp5", name: "Win-back — We miss you", channel: "Email", status: "Draft", audience: "Dormant", sent: 0, open: 0, click: 0, roi: 0 },
];

const channelMix = [
  { label: "Email", share: 34, color: GOLD },
  { label: "Social", share: 24, color: "oklch(0.7 0.11 60)" },
  { label: "Ads", share: 18, color: "oklch(0.66 0.09 200)" },
  { label: "Referral", share: 14, color: "oklch(0.75 0.13 150)" },
  { label: "SMS", share: 10, color: "oklch(0.62 0.12 300)" },
];

const mrrSeries = [52, 55, 54, 58, 61, 60, 64, 68, 66, 72, 78, 84];
const revenueBreakdown = [
  { label: "New", value: 28, tone: "up" },
  { label: "Expansion", value: 19, tone: "up" },
  { label: "Contraction", value: -6, tone: "down" },
  { label: "Churn", value: -9, tone: "down" },
];
const cohorts = [
  { month: "Mar", retention: [100, 88, 79, 72, 68] },
  { month: "Apr", retention: [100, 90, 82, 76, 0] },
  { month: "May", retention: [100, 91, 84, 0, 0] },
  { month: "Jun", retention: [100, 93, 0, 0, 0] },
];

const loyaltyTiers = [
  { tier: "Platinum", members: 128, min: "10,000 pts", color: "oklch(0.9 0.05 250)" },
  { tier: "Gold", members: 486, min: "5,000 pts", color: GOLD },
  { tier: "Silver", members: 742, min: "2,000 pts", color: "oklch(0.8 0.02 250)" },
  { tier: "Bronze", members: 1103, min: "0 pts", color: "oklch(0.62 0.08 55)" },
];
const rewards = [
  { label: "$50 account credit", pts: "5,000 pts", icon: Gift },
  { label: "Refer a friend → 2,000 pts", pts: "Earn", icon: Share2 },
  { label: "Early feature access", pts: "12,000 pts", icon: Star },
];

const topCampaigns = [
  { name: "Champions VIP Early Access", roi: 8.4, rev: 41200 },
  { name: "Summer Glow Launch", roi: 5.2, rev: 62800 },
  { name: "Cart Abandon Retarget", roi: 4.1, rev: 18400 },
];

/* ──────────────────────────────────────────────────────────────────────
 * Charts
 * ─────────────────────────────────────────────────────────────────── */

function AreaChart({ data, height = 176 }: { data: number[]; height?: number }) {
  const { ref, inView } = useInView();
  const W = 340;
  const H = 150;
  const min = Math.min(...data) * 0.9;
  const max = Math.max(...data) * 1.02;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  return (
    <div ref={ref} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="growth-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.84 0.14 84 / 30%)" />
            <stop offset="100%" stopColor="oklch(0.84 0.14 84 / 0%)" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#growth-area)" style={{ opacity: inView ? 1 : 0, transition: "opacity 0.9s ease" }} />
        <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="spark-draw" />
      </svg>
    </div>
  );
}

function FunnelStage({ stage, count, conv, width, index }: { stage: string; count: number; conv: number | null; width: number; index: number }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className="flex items-center gap-4">
      <div className="w-24 shrink-0 text-right text-sm text-foreground/80">{stage}</div>
      <div className="flex flex-1 justify-center">
        <div
          className="flex h-11 items-center justify-between rounded-xl px-4 transition-all duration-1000 ease-out"
          style={{
            width: inView ? `${width}%` : "0%",
            transitionDelay: `${index * 90}ms`,
            background: `linear-gradient(90deg, oklch(0.84 0.14 84 / ${0.3 - index * 0.04}), oklch(0.84 0.14 84 / ${0.12 - index * 0.02}))`,
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

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

function OverviewView({ go }: { go: (v: ViewKey) => void }) {
  const maxFunnel = funnel[0].count;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="MRR" value={84200} prefix="$" delta="8.1%" icon={DollarSign} />
        <StatTile label="New customers (30d)" value={142} delta="18%" icon={Users} />
        <StatTile label="LTV : CAC" value={4.8} suffix="x" decimals={1} delta="0.6x" icon={TrendingUp} />
        <StatTile label="Growth rate" value={14} suffix="%" delta="2 pts" icon={Rocket} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* Growth Score */}
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Rocket}>Growth Score</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Ring
                value={growthScore.score}
                size={128}
                label={<div><div className="text-3xl font-semibold tabular-nums gold-text">{growthScore.score}</div><div className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">/ 100</div></div>}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><TrendingUp className="size-4 text-gold" /> {growthScore.tier}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Up 6 points this month. Referral is your biggest untapped lever.</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
              {growthScore.pillars.map((p) => (
                <div key={p.label}>
                  <div className="flex items-baseline justify-between text-xs"><span className="text-foreground/80">{p.label}</span><span className="tabular-nums text-gold">{p.value}</span></div>
                  <div className="mt-1.5"><Bar value={p.value} /></div>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>

        {/* AI Growth Director briefing */}
        <Reveal className="h-full" delay={80}>
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Brain className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Growth Director briefing</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">
                  You have an AI marketing and growth team. This week I'd prioritize a <span className="text-gold">win-back flow</span> (+$31k)
                  and a <span className="text-gold">referral reward</span> for Champions. Combined projected lift: <span className="text-gold">+9% MRR</span>.
                </p>
              </div>
            </div>
            <button onClick={() => go("advisor")} className="lift relative mt-5 flex items-center justify-between rounded-2xl border border-gold/25 bg-glass p-3 text-left hover:border-gold/50">
              <span className="text-sm text-foreground/85">See all {plays.length} growth plays</span>
              <ArrowUpRight className="size-4 text-gold" />
            </button>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Target}>Growth funnel</SectionLabel>
            <span className="text-xs text-muted-foreground">visitor → advocate</span>
          </div>
          <div className="mt-6 space-y-3">
            {funnel.map((s, i) => (
              <FunnelStage key={s.stage} stage={s.stage} count={s.count} conv={s.conv} width={35 + (s.count / maxFunnel) * 65} index={i} />
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

type ChatMsg = { role: "ai" | "user"; text: string };
const advisorPrompts = ["What should I focus on this week?", "How do I grow MRR?", "Why is referral low?", "Draft a win-back email"];

function AdvisorView() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "ai", text: "I'm your AI Growth Director. I watch acquisition, activation, retention, referral and revenue — and turn them into plays. Ask me where to focus." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  const answerFor = (q: string) => {
    const s = q.toLowerCase();
    if (s.includes("focus")) return "This week: launch the win-back flow (+$31k) and the Champions referral reward (+220 referrals/mo). Both are low effort, high confidence.";
    if (s.includes("mrr") || s.includes("revenue")) return "Fastest MRR path: upsell the Growth plan to 84 power users (+$22k) and reduce churn with the at-risk re-engagement flow.";
    if (s.includes("referral")) return "Referral scores 61 because there's no incentive loop. Add a 2,000-point reward for successful referrals — modeled to lift referral 30%+.";
    if (s.includes("draft") || s.includes("email")) return "Draft: Subject — 'We saved your glow ✨'. Body — 'It's been a while. Here's 20% off your next order plus free shipping. Come back and pick up where you left off.'";
    return "Your retention is strong (88), so pour fuel on acquisition and referral. I'd run the referral reward first — highest ROI for the effort.";
  };
  function send(text: string) {
    const q = text.trim(); if (!q || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q }]); setInput(""); setThinking(true);
    window.setTimeout(() => { setThinking(false); setMessages((m) => [...m, { role: "ai", text: answerFor(q) }]); }, 1200);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Reveal>
        <GlassCard className="glass-strong flex h-[32rem] flex-col p-5">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Brain className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
            <div><p className="text-sm font-semibold tracking-tight">Growth Director</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-400" /> Analyzing 5 growth levers</p></div>
          </div>
          <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>{m.text}</div>
              </div>
            ))}
            {thinking && <div className="flex justify-start"><div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div></div>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {advisorPrompts.map((p) => (<button key={p} onClick={() => send(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your Growth Director…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
            <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
          </form>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="p-5">
          <SectionLabel icon={Zap}>Prioritized plays</SectionLabel>
          <div className="mt-4 space-y-2">
            {plays.map((p) => (
              <div key={p.title} className="lift rounded-2xl border border-border bg-background/30 p-3 hover:border-gold/40">
                <p className="text-sm font-medium text-foreground/90">{p.title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gold">{p.impact}</span>
                  <span className="flex items-center gap-2 text-[0.65rem] text-muted-foreground"><span>{p.effort} effort</span>·<span>{p.confidence}</span></span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function SegmentsView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {segments.map((s, i) => (
        <Reveal key={s.label} delay={i * 60} className="h-full">
          <GlassCard className="lift flex h-full flex-col p-6 hover:border-gold/40">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <Delta value={`${Math.abs(s.growth)}%`} positive={s.growth >= 0} />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{formatNum(s.count)}</span>
              <span className="text-xs text-muted-foreground">customers · {s.value}% of value</span>
            </div>
            <div className="mt-4"><Bar value={s.value * 2.6} tone={s.growth >= 0 ? "gold" : "muted"} /></div>
            <button className="lift mt-4 flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3 text-left text-sm hover:border-gold/40">
              <span className="text-foreground/85">{s.action}</span>
              <ArrowUpRight className="size-4 text-gold" />
            </button>
          </GlassCard>
        </Reveal>
      ))}
    </div>
  );
}

function CampaignsView() {
  const [list, setList] = useState<Campaign[]>(initialCampaigns);
  const [channel, setChannel] = useState<Channel>("Email");
  const [audience, setAudience] = useState("Champions");
  const [name, setName] = useState("");
  const launch = () => {
    const n = name.trim() || `${channel} campaign to ${audience}`;
    setList((l) => [{ id: `cmp${Date.now()}`, name: n, channel, status: "Active", audience, sent: 0, open: 0, click: 0, roi: 0 }, ...l]);
    setName("");
  };
  const statusColor: Record<Campaign["status"], string> = { Active: "oklch(0.72 0.14 155)", Scheduled: "oklch(0.66 0.09 200)", Draft: "oklch(0.7 0.02 250)", Done: "oklch(0.84 0.14 84)" };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={Megaphone}>Campaigns</SectionLabel>
          <div className="mt-4 space-y-2">
            {list.map((c) => {
              const Icon = channelIcon[c.channel];
              return (
                <div key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-border bg-background/30 p-3 sm:grid-cols-[auto_1.4fr_1fr_1fr_auto]">
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-glass"><Icon className="size-4 text-gold" /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.channel} · {c.audience}</p></div>
                  <span className="hidden items-center gap-1.5 text-xs sm:flex" style={{ color: statusColor[c.status] }}><span className="size-1.5 rounded-full" style={{ background: statusColor[c.status] }} />{c.status}</span>
                  <span className="hidden text-xs text-muted-foreground sm:block">{c.sent ? `${formatNum(c.sent)} sent · ${c.open}% open` : "—"}</span>
                  <span className="text-right text-sm font-semibold tabular-nums text-gold">{c.roi ? `${c.roi}x` : "—"}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="glass-strong sticky top-6 p-5">
          <div className="flex items-center gap-2"><Sparkles className="size-4 text-gold" /><p className="text-sm font-semibold">New campaign</p></div>
          <label className="mt-4 block text-xs">
            <span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Channel</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(channelIcon) as Channel[]).map((c) => (
                <button key={c} onClick={() => setChannel(c)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", channel === c ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={channel === c ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{c}</button>
              ))}
            </div>
          </label>
          <label className="mt-3 block text-xs">
            <span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Audience</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50">
              {["Champions", "Loyal", "New", "At risk", "Dormant", "All customers"].map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-xs">
            <span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Glow Launch" className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50" />
          </label>
          <div className="mt-3 rounded-xl border border-gold/25 bg-glass p-3 text-xs text-foreground/80">
            <span className="text-gold">AI subject:</span> “Something glowing is coming for {audience.toLowerCase()} ✨”
          </div>
          <button onClick={launch} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <Rocket className="size-4" /> Launch campaign
          </button>
        </GlassCard>
      </Reveal>
    </div>
  );
}

const contentTypes = ["Email", "Social post", "Ad copy", "Blog intro"] as const;
const tones = ["Bold", "Friendly", "Professional", "Playful"] as const;

function ContentView() {
  const [type, setType] = useState<(typeof contentTypes)[number]>("Social post");
  const [tone, setTone] = useState<(typeof tones)[number]>("Bold");
  const [topic, setTopic] = useState("Summer Glow serum launch");
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = () => {
    setBusy(true); setOutput(null);
    window.setTimeout(() => {
      const map: Record<string, string> = {
        "Email": `Subject: Your glow, upgraded ✨\n\nHi there — meet ${topic}. ${tone === "Playful" ? "Warning: dangerously radiant." : "Crafted for visibly brighter skin in 7 days."} Tap in for early access and 15% off your first bottle.`,
        "Social post": `${topic} is here ✨ ${tone === "Bold" ? "The glow you've been waiting for." : "Soft, radiant, undeniably you."} Limited first drop — link in bio. #WonderGlow`,
        "Ad copy": `${topic}. Clinically-loved, founder-made. Get 15% off your first order — glow guaranteed or your money back.`,
        "Blog intro": `There's a moment every morning when your skin either works with you or against you. ${topic} was built for the former — here's the science behind the glow.`,
      };
      setOutput(map[type]); setBusy(false);
    }, 1300);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2"><Wand2 className="size-4 text-gold" /><p className="text-sm font-semibold">AI Content Studio</p></div>
            <label className="mt-4 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Type</span>
              <div className="flex flex-wrap gap-1.5">{contentTypes.map((t) => (<button key={t} onClick={() => setType(t)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", type === t ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={type === t ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{t}</button>))}</div>
            </label>
            <label className="mt-3 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Tone</span>
              <div className="flex flex-wrap gap-1.5">{tones.map((t) => (<button key={t} onClick={() => setTone(t)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", tone === t ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={tone === t ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{t}</button>))}</div>
            </label>
            <label className="mt-3 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Topic</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50" />
            </label>
            <button onClick={generate} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
              <Sparkles className="size-4" /> {busy ? "Generating…" : "Generate content"}
            </button>
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="flex min-h-[20rem] flex-col p-6">
          <SectionLabel icon={PenTool}>Generated draft</SectionLabel>
          <div className="mt-4 flex-1">
            {busy && <div className="typing flex items-center gap-1 py-4"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div>}
            {!busy && output && <p className="whitespace-pre-line rounded-2xl border border-border bg-background/30 p-4 text-sm leading-relaxed text-foreground/90">{output}</p>}
            {!busy && !output && <p className="py-10 text-center text-sm text-muted-foreground">Pick a type and tone, then generate a draft.</p>}
          </div>
          {output && !busy && (
            <div className="mt-4 flex gap-2">
              <button className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110" style={{ background: "var(--gradient-gold)" }}><CheckCircle2 className="size-3.5" /> Use draft</button>
              <button onClick={generate} className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Regenerate</button>
            </div>
          )}
        </GlassCard>
      </Reveal>
    </div>
  );
}

function LoyaltyView() {
  const topMembers = [
    { name: "Noah Reed", pts: 24850, tier: "Platinum" },
    { name: "Ava Chen", pts: 19420, tier: "Platinum" },
    { name: "Leo Park", pts: 11200, tier: "Platinum" },
    { name: "Ivy Zhou", pts: 8640, tier: "Gold" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loyaltyTiers.map((t, i) => (
          <Reveal key={t.tier} delay={i * 60} className="h-full">
            <GlassCard className="lift h-full p-5 hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass"><Crown className="size-4" style={{ color: t.color }} /></span>
                <span className="text-xs text-muted-foreground">{t.min}</span>
              </div>
              <p className="mt-4 text-sm font-semibold" style={{ color: t.color }}>{t.tier}</p>
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
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.tier}</p></div>
                  <span className="text-sm font-semibold tabular-nums text-gold">{formatNum(m.pts)} pts</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Gift}>Rewards & referrals</SectionLabel>
            <div className="mt-4 space-y-3">
              {rewards.map((r) => (
                <div key={r.label} className="lift flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-4 hover:border-gold/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-glass"><r.icon className="size-4 text-gold" /></span>
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

function RevenueView() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="MRR" value={84200} prefix="$" delta="8.1%" icon={DollarSign} />
        <StatTile label="ARR" value={1010400} prefix="$" delta="8.1%" icon={TrendingUp} />
        <StatTile label="Net revenue retention" value={112} suffix="%" delta="3 pts" icon={Layers} />
        <StatTile label="Avg revenue / user" value={124} prefix="$" delta="4%" icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="flex items-baseline justify-between"><SectionLabel icon={LineChart}>MRR trend</SectionLabel><span className="text-xs text-muted-foreground">Last 12 months · $K</span></div>
            <div className="mt-5"><AreaChart data={mrrSeries} /></div>
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={BarChart3}>MRR movement</SectionLabel>
            <div className="mt-5 space-y-4">
              {revenueBreakdown.map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between text-sm"><span className="text-foreground/80">{r.label}</span><span className={cn("tabular-nums", r.tone === "up" ? "text-emerald-300" : "text-rose-300")}>{r.value > 0 ? "+" : ""}{r.value}%</span></div>
                  <div className="mt-1.5"><Bar value={Math.abs(r.value) * 3} tone={r.tone === "up" ? "gold" : "muted"} /></div>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="overflow-x-auto p-6">
          <SectionLabel icon={Users}>Cohort retention</SectionLabel>
          <div className="mt-4 min-w-[30rem] space-y-1">
            {cohorts.map((c) => (
              <div key={c.month} className="flex items-center gap-2">
                <span className="w-10 text-sm text-muted-foreground">{c.month}</span>
                {c.retention.map((v, i) => (
                  <div key={i} className="grid h-9 flex-1 place-items-center rounded-md text-xs tabular-nums" style={{ background: v ? `oklch(0.84 0.14 84 / ${(v / 100) * 0.35 + 0.05})` : "transparent", color: v ? "var(--color-foreground)" : "transparent" }}>
                    {v ? `${v}%` : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visitors (30d)" value={48200} delta="12%" icon={Globe} />
        <StatTile label="Conversion rate" value={2.7} suffix="%" decimals={1} delta="0.3 pts" icon={Target} />
        <StatTile label="Avg CAC" value={86} prefix="$" delta="12%" positive icon={DollarSign} />
        <StatTile label="Blended ROAS" value={5.4} suffix="x" decimals={1} delta="0.5x" icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Globe}>New customers by channel</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Donut data={channelMix} size={150} center={<div><div className="text-lg font-semibold tabular-nums gold-text">142</div><div className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">new</div></div>} />
              <ul className="min-w-0 flex-1 space-y-2">
                {channelMix.map((c) => (<li key={c.label} className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} /><span className="flex-1 truncate text-foreground/85">{c.label}</span><span className="tabular-nums text-muted-foreground">{c.share}%</span></li>))}
              </ul>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Megaphone}>Top campaigns by ROI</SectionLabel>
            <div className="mt-4 space-y-1">
              {topCampaigns.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{c.name}</p><p className="text-xs text-muted-foreground">${formatNum(c.rev)} revenue</p></div>
                  <span className="text-sm font-semibold tabular-nums text-gold">{c.roi}x</span>
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
  overview: { title: "Growth command center", sub: "Your AI marketing & growth team" },
  advisor: { title: "AI Growth Advisor", sub: "Your always-on Growth Director" },
  segments: { title: "Customer segmentation", sub: "Grow each cohort intentionally" },
  campaigns: { title: "Campaign Studio", sub: "Launch across every channel" },
  content: { title: "Content Studio", sub: "AI-generated, on-brand content" },
  loyalty: { title: "Loyalty system", sub: "Reward, retain and refer" },
  revenue: { title: "Revenue intelligence", sub: "Where growth turns into revenue" },
  analytics: { title: "Growth analytics", sub: "Every lever, measured" },
};

export function GrowthWorkspace() {
  const [active, setActive] = useState<ViewKey>("overview");
  const meta = viewMeta[active];
  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 lg:flex">
        <Brand subtle />
        <p className="mt-6 flex items-center gap-1.5 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-gold"><Sparkles className="size-3" /> WonderGrowth</p>
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
          <button onClick={() => setActive("advisor")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <Brain className="size-4" stroke="oklch(0.2 0.02 70)" /> Ask the Advisor
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
          {active === "overview" && <OverviewView go={setActive} />}
          {active === "advisor" && <AdvisorView />}
          {active === "segments" && <SegmentsView />}
          {active === "campaigns" && <CampaignsView />}
          {active === "content" && <ContentView />}
          {active === "loyalty" && <LoyaltyView />}
          {active === "revenue" && <RevenueView />}
          {active === "analytics" && <AnalyticsView />}
        </div>
      </section>
    </div>
  );
}
