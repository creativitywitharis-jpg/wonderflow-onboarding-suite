import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
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
  Pencil,
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
import { Avatar, Bar, Delta, Reveal, Ring, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";
import { useOrg } from "@/lib/org-context";
import { askAI } from "@/lib/ai";
import { generateImage } from "@/lib/image-gen";
import { createCampaign, listCampaigns, sendCampaign, updateCampaign, type CampaignStatus, type DbCampaign } from "@/lib/campaigns";
import { listCustomers, type DbCustomer } from "@/lib/customers";
import { listInvoices, type DbInvoice } from "@/lib/finance";
import { DEFAULT_SETTINGS, getLoyaltySettings, gradeColor, gradeFor, listRewardCodes, pointsFor, type LoyaltySettings } from "@/lib/loyalty";
import { DatePicker } from "@/components/wf/DatePicker";

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
  scheduledAt: string | null;
  subject: string | null;
  body: string | null;
};

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

function toUiCampaign(c: DbCampaign): Campaign {
  return {
    id: c.id,
    name: c.name,
    channel: c.channel as Channel,
    status: c.status,
    audience: c.audience ?? "All customers",
    sent: c.sent,
    open: Number(c.open_rate),
    click: Number(c.click_rate),
    roi: Number(c.roi),
    scheduledAt: c.scheduled_at,
    subject: c.subject,
    body: c.body,
  };
}

const CAMPAIGN_STATUSES: CampaignStatus[] = ["Active", "Scheduled", "Draft", "Done"];

function CampaignsView() {
  const { org } = useOrg();
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<Channel>("Email");
  const [audience, setAudience] = useState("Champions");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [subjBusy, setSubjBusy] = useState(false);

  // Any stale suggestion no longer matches once the inputs it was based on change.
  useEffect(() => setSubject(null), [channel, audience, name]);

  const suggestSubject = async () => {
    if (subjBusy) return;
    setSubjBusy(true);
    try {
      const prompt = `Write one short, compelling subject line for a ${channel} marketing campaign targeting the "${audience}" customer segment${name.trim() ? ` called "${name.trim()}"` : ""}. Return ONLY the subject line text — no quotes, no explanation.`;
      const reply = await askAI([{ role: "user", content: prompt }], { id: org?.id, name: org?.name, industry: org?.industry });
      setSubject((reply || "").trim().replace(/^["']|["']$/g, "") || null);
    } catch {
      setSubject(null);
    } finally {
      setSubjBusy(false);
    }
  };

  const load = useCallback(async () => {
    if (!org) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await listCampaigns(org.id);
      setList(rows.map(toUiCampaign));
    } catch {
      setList([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const launch = async () => {
    if (!org || busy) return;
    const n = name.trim() || `${channel} campaign to ${audience}`;
    setBusy(true);
    await createCampaign(org.id, { name: n, channel, audience, status: "Active" });
    setBusy(false);
    setName("");
    await load();
  };

  // Picking "Scheduled" opens a real date/time editor instead of silently
  // applying a status that has nothing behind it — every other status
  // still applies immediately.
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const startScheduling = (c: Campaign) => {
    setSchedulingId(c.id);
    const d = c.scheduledAt ? new Date(c.scheduledAt) : null;
    setSchedDate(d ? d.toISOString().slice(0, 10) : "");
    setSchedTime(d ? d.toTimeString().slice(0, 5) : "09:00");
  };
  const confirmSchedule = async () => {
    if (!schedulingId || !schedDate) return;
    const iso = new Date(`${schedDate}T${schedTime || "09:00"}`).toISOString();
    await updateCampaign(schedulingId, { status: "Scheduled", scheduled_at: iso });
    setSchedulingId(null);
    await load();
  };
  const changeStatus = async (id: string, status: CampaignStatus) => {
    if (status === "Scheduled") {
      const c = list.find((x) => x.id === id);
      if (c) startScheduling(c);
      return;
    }
    setSchedulingId(null);
    await updateCampaign(id, { status, scheduled_at: null });
    await load();
  };
  const statusColor: Record<Campaign["status"], string> = { Active: "oklch(0.72 0.14 155)", Scheduled: "oklch(0.66 0.09 200)", Draft: "oklch(0.7 0.02 250)", Done: "oklch(0.84 0.14 84)" };
  const fmtScheduled = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  // Compose + send real Email campaigns. Separate from the create panel
  // above — that's just a name/channel/audience shell; the actual subject
  // and message (what genuinely goes out via Resend) live here.
  const [composingId, setComposingId] = useState<string | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeGenBusy, setComposeGenBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const startCompose = (c: Campaign) => {
    setComposingId(c.id);
    setComposeSubject(c.subject ?? "");
    setComposeBody(c.body ?? "");
    setSendError(null);
    setSendResult(null);
  };
  const [composeSubjBusy, setComposeSubjBusy] = useState(false);
  const suggestComposeSubject = async () => {
    if (composeSubjBusy) return;
    setComposeSubjBusy(true);
    try {
      const c = list.find((x) => x.id === composingId);
      const prompt = `Write one short, compelling email subject line for a campaign targeting the "${c?.audience ?? "customers"}" segment${c?.name ? ` called "${c.name}"` : ""}. Return ONLY the subject line — no quotes, no explanation.`;
      const reply = await askAI([{ role: "user", content: prompt }], { id: org?.id, name: org?.name, industry: org?.industry });
      const clean = (reply || "").trim().replace(/^["']|["']$/g, "");
      if (clean) setComposeSubject(clean);
    } catch {
      // leave whatever the user already had
    } finally {
      setComposeSubjBusy(false);
    }
  };
  const generateBody = async () => {
    if (composeGenBusy) return;
    setComposeGenBusy(true);
    try {
      const c = list.find((x) => x.id === composingId);
      const prompt = `Write a short marketing email body (2-4 short paragraphs, no subject line, no sign-off placeholder) for a campaign targeting the "${c?.audience ?? "customers"}" segment${c?.name ? ` called "${c.name}"` : ""}. Return only the email body text.`;
      const reply = await askAI([{ role: "user", content: prompt }], { id: org?.id, name: org?.name, industry: org?.industry });
      if (reply) setComposeBody(reply.trim());
    } catch {
      // leave whatever the user already had
    } finally {
      setComposeGenBusy(false);
    }
  };
  const doSend = async () => {
    if (!composingId || sendBusy || !composeSubject.trim() || !composeBody.trim()) return;
    setSendBusy(true);
    setSendError(null);
    setSendResult(null);
    const { error: saveErr } = await updateCampaign(composingId, { subject: composeSubject.trim(), body: composeBody.trim() });
    if (saveErr) { setSendBusy(false); setSendError(saveErr.message); return; }
    const res = await sendCampaign(composingId);
    setSendBusy(false);
    if (res.error) { setSendError(res.error); return; }
    setSendResult({ sent: res.sent, failed: res.failed, skipped: res.skipped });
    await load();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={Megaphone}>Campaigns</SectionLabel>
          <div className="mt-4 space-y-2">
            {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading campaigns…</p>}
            {!loading && list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No campaigns yet — launch your first from the panel.</p>}
            {list.map((c) => {
              const Icon = channelIcon[c.channel] ?? Megaphone;
              if (schedulingId === c.id) {
                return (
                  <div key={c.id} className="space-y-3 rounded-2xl border border-gold/40 bg-background/30 p-3">
                    <p className="text-sm font-medium text-foreground">Schedule “{c.name}”</p>
                    <div className="flex flex-wrap gap-2">
                      <DatePicker value={schedDate} onChange={setSchedDate} className="rounded-lg border border-border bg-background/40 px-3 py-1.5 text-xs" />
                      <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="rounded-lg border border-border bg-background/40 px-3 py-1.5 text-xs text-foreground outline-none focus:border-gold/50" />
                    </div>
                    <p className="text-[0.7rem] text-muted-foreground">This records when you intend to launch it — Campaign Studio doesn't send anything on its own, so nothing fires automatically at this time.</p>
                    <div className="flex gap-2">
                      <button onClick={confirmSchedule} disabled={!schedDate} className="rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>Set schedule</button>
                      <button onClick={() => setSchedulingId(null)} className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  </div>
                );
              }
              if (composingId === c.id) {
                return (
                  <div key={c.id} className="space-y-3 rounded-2xl border border-gold/40 bg-background/30 p-4">
                    <p className="text-sm font-medium text-foreground">Compose “{c.name}” — sends to real {c.audience} customers with an email on file</p>
                    <div className="flex gap-2">
                      <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject line" className="min-w-0 flex-1 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50" />
                      <button onClick={suggestComposeSubject} disabled={composeSubjBusy} className="shrink-0 rounded-lg border border-border px-3 text-xs text-gold hover:border-gold/40 disabled:opacity-50">{composeSubjBusy ? "…" : "Suggest"}</button>
                    </div>
                    <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} rows={5} placeholder="Message…" className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50" />
                    <button onClick={generateBody} disabled={composeGenBusy} className="rounded-lg border border-border px-3 py-1.5 text-xs text-gold hover:border-gold/40 disabled:opacity-50">{composeGenBusy ? "Generating…" : "Generate with AI"}</button>
                    <p className="text-[0.7rem] text-muted-foreground">Every recipient gets a real unsubscribe link. Customers who've opted out, or have no email on file, are skipped automatically.</p>
                    {sendError && <p className="text-xs text-rose-300">{sendError}</p>}
                    {sendResult && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="size-3.5 shrink-0" /> Sent to {sendResult.sent} customer{sendResult.sent === 1 ? "" : "s"}{sendResult.failed ? `, ${sendResult.failed} failed` : ""}{sendResult.skipped ? `, ${sendResult.skipped} skipped (no email / unsubscribed)` : ""}.</p>
                    )}
                    <div className="flex gap-2">
                      {!sendResult && (
                        <button onClick={doSend} disabled={sendBusy || !composeSubject.trim() || !composeBody.trim()} className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" /> {sendBusy ? "Sending…" : "Send now"}</button>
                      )}
                      <button onClick={() => setComposingId(null)} className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">{sendResult ? "Close" : "Cancel"}</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={c.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-border bg-background/30 p-3 sm:grid-cols-[auto_1.4fr_1fr_1fr_auto]">
                  <span className="grid size-9 place-items-center rounded-lg border border-border bg-glass"><Icon className="size-4 text-gold" /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.channel} · {c.audience}</p></div>
                  <select value={c.status} onChange={(e) => changeStatus(c.id, e.target.value as CampaignStatus)} className="hidden rounded-lg border border-border bg-background/40 px-2 py-1 text-xs outline-none focus:border-gold/50 sm:block" style={{ color: statusColor[c.status] }}>
                    {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s} className="text-foreground">{s}</option>)}
                  </select>
                  {c.channel === "Email" && c.sent === 0 ? (
                    <button onClick={() => startCompose(c)} className="hidden items-center gap-1.5 text-xs text-gold hover:underline sm:flex">
                      <Send className="size-3 shrink-0" /> Compose &amp; send
                    </button>
                  ) : c.status === "Scheduled" ? (
                    <button onClick={() => startScheduling(c)} className="hidden items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground sm:flex">
                      <Clock className="size-3 shrink-0" /> {c.scheduledAt ? fmtScheduled(c.scheduledAt) : "Set date"} <Pencil className="size-3 shrink-0" />
                    </button>
                  ) : (
                    <span className="hidden text-xs text-muted-foreground sm:block">{c.sent ? `${formatNum(c.sent)} sent · ${c.open}% open` : "—"}</span>
                  )}
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
                <button key={c} onClick={() => setChannel(c)} title={c !== "Email" ? `${c} campaigns are tracked here but don't send yet` : undefined} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", channel === c ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={channel === c ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
                  {c}{c !== "Email" && <span className="ml-0.5 text-gold">*</span>}
                </button>
              ))}
            </div>
            {channel !== "Email" && <p className="mt-1.5 text-[0.65rem] text-muted-foreground">* {channel} campaigns are tracked here but don't send yet — only Email sends for real right now.</p>}
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-gold">AI subject line</span>
              <button type="button" onClick={suggestSubject} disabled={subjBusy} className="text-gold hover:underline disabled:opacity-50">{subjBusy ? "Thinking…" : subject ? "Regenerate" : "Suggest"}</button>
            </div>
            <p className="mt-1">{subjBusy ? "Generating…" : subject ? `“${subject}”` : "Click “Suggest” for a real AI subject line for this campaign."}</p>
          </div>
          <button onClick={launch} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <Rocket className="size-4" /> {busy ? "Launching…" : "Launch campaign"}
          </button>
        </GlassCard>
      </Reveal>
    </div>
  );
}

const contentTypes = ["Email", "Social post", "Ad copy", "Blog intro", "Design (image)"] as const;
const tones = ["Bold", "Friendly", "Professional", "Playful"] as const;

function ContentView() {
  const { org } = useOrg();
  const [type, setType] = useState<(typeof contentTypes)[number]>("Social post");
  const [tone, setTone] = useState<(typeof tones)[number]>("Bold");
  const [topic, setTopic] = useState("Summer product launch");
  const [output, setOutput] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isImage = type === "Design (image)";
  // Image generation costs real money per call (OpenAI) — gated to orgs with
  // an actual paid plan, not the free trial default.
  const isSubscribed = !!org?.plan && org.plan !== "trial";
  const imageLocked = isImage && !isSubscribed;

  const generate = async () => {
    if (busy || imageLocked) return;
    setBusy(true);
    setOutput(null);
    setImageUrl(null);
    setError(null);
    setCopied(false);
    const forBiz = org?.name ? ` for ${org.name}` : "";

    if (isImage) {
      if (!org) { setBusy(false); return; }
      const prompt = `A ${tone.toLowerCase()}, professional marketing image${forBiz}. Subject: ${topic}. Clean, high-quality, suitable for social media or advertising — no text or logos in the image.`;
      const { dataUrl, error: err } = await generateImage(org.id, prompt);
      if (err) setError(err);
      else setImageUrl(dataUrl);
      setBusy(false);
      return;
    }

    const shape =
      type === "Email"
        ? "a short marketing email including a subject line"
        : type === "Social post"
          ? "a social media post (with a couple of fitting hashtags)"
          : type === "Ad copy"
            ? "a short, punchy ad"
            : "an engaging blog intro paragraph";
    const prompt = `Write ${shape} in a ${tone.toLowerCase()} tone${forBiz}. Topic: ${topic}. Keep it concise and ready to publish. Return only the copy — no preamble or explanation.`;
    try {
      const reply = await askAI([{ role: "user", content: prompt }], { id: org?.id, name: org?.name, industry: org?.industry });
      setOutput(reply || "No content came back — try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate content. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2"><Wand2 className="size-4 text-gold" /><p className="text-sm font-semibold">AI Content Studio</p></div>
            <label className="mt-4 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Type</span>
              <div className="flex flex-wrap gap-1.5">
                {contentTypes.map((t) => (<button key={t} onClick={() => setType(t)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", type === t ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={type === t ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{t}</button>))}
                <button type="button" disabled title="Video generation — coming soon" className="cursor-not-allowed rounded-full border border-border bg-glass px-2.5 py-1 text-xs text-muted-foreground/50">
                  Video <span className="text-gold">*</span>
                </button>
              </div>
              {imageLocked && <p className="mt-1.5 text-[0.65rem] text-muted-foreground">Image generation is a paid-plan feature — costs real money per image, so it's not on the free trial.</p>}
            </label>
            <label className="mt-3 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Tone</span>
              <div className="flex flex-wrap gap-1.5">{tones.map((t) => (<button key={t} onClick={() => setTone(t)} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", tone === t ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={tone === t ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>{t}</button>))}</div>
            </label>
            <label className="mt-3 block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Topic</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full rounded-xl border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50" />
            </label>
            {imageLocked ? (
              <Link to="/admin" search={{ tab: "billing" }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-gold/40 bg-glass px-4 py-2.5 text-sm font-semibold text-foreground/85 transition-colors hover:border-gold/70">
                <Sparkles className="size-4 text-gold" /> Upgrade to generate images
              </Link>
            ) : (
              <button onClick={generate} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
                <Sparkles className="size-4" /> {busy ? "Generating…" : "Generate content"}
              </button>
            )}
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="flex min-h-[20rem] flex-col p-6">
          <SectionLabel icon={PenTool}>{isImage ? "Generated design" : "Generated draft"}</SectionLabel>
          <div className="mt-4 flex-1">
            {busy && (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <div className="typing flex items-center gap-1"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div>
                {isImage && <p className="text-xs text-muted-foreground">Images can take up to 20-30 seconds…</p>}
              </div>
            )}
            {!busy && error && <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
            {!busy && output && <p className="whitespace-pre-line rounded-2xl border border-border bg-background/30 p-4 text-sm leading-relaxed text-foreground/90">{output}</p>}
            {!busy && imageUrl && <img src={imageUrl} alt={topic} className="w-full rounded-2xl border border-border" />}
            {!busy && !output && !imageUrl && !error && <p className="py-10 text-center text-sm text-muted-foreground">Pick a type and tone, then generate a draft.</p>}
          </div>
          {output && !busy && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable */ } }}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110"
                style={{ background: "var(--gradient-gold)" }}
              >
                <CheckCircle2 className="size-3.5" /> {copied ? "Copied to clipboard ✓" : "Use draft"}
              </button>
              <button onClick={generate} className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Regenerate</button>
            </div>
          )}
          {imageUrl && !busy && (
            <div className="mt-4 flex gap-2">
              <a
                href={imageUrl}
                download={`${topic.trim().replace(/\s+/g, "-").toLowerCase() || "design"}.png`}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110"
                style={{ background: "var(--gradient-gold)" }}
              >
                <CheckCircle2 className="size-3.5" /> Download image
              </a>
              <button onClick={generate} className="rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Regenerate</button>
            </div>
          )}
        </GlassCard>
      </Reveal>
    </div>
  );
}

// A real view into the same loyalty engine CRM -> Loyalty manages (real
// points from real customer spend, real reward codes) -- this used to be an
// entirely separate hardcoded tab with fake tier counts and made-up names.
function LoyaltyView() {
  const { org } = useOrg();
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_SETTINGS);
  const [codeCount, setCodeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) { setLoading(false); return; }
    setLoading(true);
    Promise.all([listCustomers(org.id), getLoyaltySettings(org.id), listRewardCodes(org.id)])
      .then(([cs, s, codes]) => { setCustomers(cs); setSettings(s); setCodeCount(codes.length); })
      .finally(() => setLoading(false));
  }, [org?.id]);

  const withPoints = customers.map((c) => {
    const pts = pointsFor(Number(c.ltv) || 0, settings);
    return { name: c.name, pts, grade: gradeFor(pts, settings) };
  });
  const ladder = [...settings.grades].sort((a, b) => a.threshold - b.threshold);
  const countByGrade: Record<string, number> = {};
  for (const c of withPoints) if (c.grade) countByGrade[c.grade.grade] = (countByGrade[c.grade.grade] ?? 0) + 1;
  const topMembers = [...withPoints].filter((c) => c.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 6);

  if (!loading && !settings.enabled) {
    return (
      <Reveal>
        <GlassCard className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Your loyalty program is currently turned off — enable it in CRM → Loyalty to start earning members points from real spend.</p>
        </GlassCard>
      </Reveal>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ladder.map((t, i) => (
          <Reveal key={t.grade} delay={i * 60} className="h-full">
            <GlassCard className="lift h-full p-5 hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass"><Crown className="size-4" style={{ color: gradeColor(i) }} /></span>
                <span className="text-xs text-muted-foreground">{formatNum(t.threshold)} pts</span>
              </div>
              <p className="mt-4 text-sm font-semibold" style={{ color: gradeColor(i) }}>{t.grade}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "—" : formatNum(countByGrade[t.grade] ?? 0)}</p>
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
              {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
              {!loading && topMembers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No customers have earned points yet.</p>}
              {topMembers.map((m, i) => (
                <div key={m.name + i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.grade?.grade ?? "Unranked"}</p></div>
                  <span className="text-sm font-semibold tabular-nums text-gold">{formatNum(m.pts)} pts</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Gift}>Reward ladder</SectionLabel>
            <div className="mt-4 space-y-3">
              {ladder.map((t, i) => (
                <div key={t.grade} className="lift flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-4 hover:border-gold/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-glass"><Gift className="size-4" style={{ color: gradeColor(i) }} /></span>
                  <span className="flex-1 text-sm text-foreground/85">{t.grade} — ${formatNum(t.value)} reward code</span>
                  <span className="shrink-0 text-xs font-medium text-gold">{formatNum(t.threshold)} pts</span>
                </div>
              ))}
              {settings.repeat.enabled && (
                <div className="lift flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-4 hover:border-gold/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-glass"><Star className="size-4 text-gold" /></span>
                  <span className="flex-1 text-sm text-foreground/85">Elite — ${formatNum(settings.repeat.value)} every +{formatNum(settings.repeat.step)} pts</span>
                  <span className="shrink-0 text-xs font-medium text-gold">from {formatNum(settings.repeat.start)} pts</span>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{formatNum(codeCount)} reward code{codeCount === 1 ? "" : "s"} issued to date.</p>
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// Real revenue from real paid invoices — the exact same "paid" total Finance
// itself uses, just viewed from Growth. Previously a fully fabricated MRR/
// ARR/NRR dashboard with numbers that never moved and a subscription-style
// framing that doesn't fit every business here.
function RevenueView() {
  const { org } = useOrg();
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) { setLoading(false); return; }
    setLoading(true);
    listInvoices(org.id).then(setInvoices).finally(() => setLoading(false));
  }, [org?.id]);

  const paid = invoices.filter((i) => i.status === "paid");
  const totalRevenue = paid.reduce((a, i) => a + Number(i.total), 0);
  const now = new Date();
  const revenueInMonth = (d: Date) => paid.filter((i) => i.paid_at && sameMonth(new Date(i.paid_at), d)).reduce((a, i) => a + Number(i.total), 0);
  const thisMonthRev = revenueInMonth(now);
  const lastMonthRev = revenueInMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const momDelta = lastMonthRev > 0 ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100) : null;
  const avgInvoice = paid.length ? totalRevenue / paid.length : 0;
  const outstanding = invoices.filter((i) => i.status === "sent").reduce((a, i) => a + Number(i.total), 0);

  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
    return { label: d.toLocaleDateString(undefined, { month: "short" }), value: revenueInMonth(d) };
  });

  const byCustomer = new Map<string, number>();
  for (const i of paid) {
    const key = i.customer_name ?? "Unknown";
    byCustomer.set(key, (byCustomer.get(key) ?? 0) + Number(i.total));
  }
  const topCustomers = [...byCustomer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue collected" value={totalRevenue} prefix="$" icon={DollarSign} />
        <StatTile label="This month" value={thisMonthRev} prefix="$" delta={momDelta !== null ? `${momDelta > 0 ? "+" : ""}${momDelta}%` : undefined} icon={TrendingUp} />
        <StatTile label="Avg invoice" value={Math.round(avgInvoice)} prefix="$" icon={Layers} />
        <StatTile label="Outstanding" value={outstanding} prefix="$" positive={false} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="flex items-baseline justify-between"><SectionLabel icon={LineChart}>Revenue trend</SectionLabel><span className="text-xs text-muted-foreground">Last 6 months</span></div>
            {loading ? (
              <p className="mt-5 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : totalRevenue === 0 ? (
              <p className="mt-5 py-8 text-center text-sm text-muted-foreground">No paid invoices yet — this fills in once Finance records real payments.</p>
            ) : (
              <>
                <div className="mt-5"><AreaChart data={months.map((m) => m.value)} /></div>
                <div className="mt-2 flex justify-between text-[0.65rem] text-muted-foreground">{months.map((m) => <span key={m.label}>{m.label}</span>)}</div>
              </>
            )}
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Users}>Top customers by revenue</SectionLabel>
            <div className="mt-4 space-y-1">
              {!loading && topCustomers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No paid invoices yet.</p>}
              {topCustomers.map(([name, total], i) => (
                <div key={name} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="w-5 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                  <Avatar name={name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
                  <span className="text-sm font-semibold tabular-nums text-gold">${formatNum(total)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

// Visitors, conversion rate, CAC, ROAS, and channel attribution have no real
// data source anywhere in this app — no web traffic tracking, no ad spend
// tracking. Rather than show fabricated-looking numbers with nothing behind
// them, this is an honest explanation of what's missing and why.
function AnalyticsView() {
  return (
    <Reveal>
      <GlassCard className="p-10 text-center">
        <span className="orb mx-auto grid size-14 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
          <Globe className="size-6" stroke="oklch(0.2 0.02 70)" />
        </span>
        <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-display)" }}>Nothing real to show here yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Visitors, conversion rate, cost per acquisition, ROAS, and channel attribution all need data WonderFlow doesn't collect yet — real website traffic tracking (like Google Analytics) and real ad spend from a connected ad platform. Neither exists in the app right now, so rather than show numbers with nothing behind them, this tab is honestly empty.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">Real revenue and campaign performance you can already trust live in the Revenue and Campaigns tabs.</p>
      </GlassCard>
    </Reveal>
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
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
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
