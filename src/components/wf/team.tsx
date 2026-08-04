import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Gauge,
  GraduationCap,
  Hash,
  Home,
  LayoutGrid,
  MapPin,
  Megaphone,
  MessageSquare,
  Play,
  Search,
  Send,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Donut, Reveal, Ring, SectionLabel, StatTile } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "dashboard" | "people" | "tasks" | "assistant" | "schedule" | "performance" | "training" | "comms";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "people", label: "People", icon: Users },
  { key: "tasks", label: "Tasks", icon: LayoutGrid },
  { key: "assistant", label: "Staff assistant", icon: Bot },
  { key: "schedule", label: "Schedule", icon: CalendarDays },
  { key: "performance", label: "Performance", icon: Gauge },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "comms", label: "Communication", icon: MessageSquare },
];

type Status = "Online" | "Away" | "Offline";
const statusColor: Record<Status, string> = { Online: "oklch(0.72 0.14 155)", Away: "oklch(0.84 0.14 84)", Offline: "oklch(0.62 0.02 260)" };

type Employee = {
  id: string; name: string; role: string; dept: string; status: Status;
  tasks: number; perf: number; since: string; location: string; skills: string[];
};

const employees: Employee[] = [
  { id: "e1", name: "Ava Chen", role: "Head of Growth", dept: "Marketing", status: "Online", tasks: 5, perf: 94, since: "2021", location: "Austin, TX", skills: ["Paid ads", "Lifecycle", "Analytics"] },
  { id: "e2", name: "Marcus Reid", role: "Operations Lead", dept: "Operations", status: "Online", tasks: 8, perf: 88, since: "2020", location: "Denver, CO", skills: ["Fulfilment", "Suppliers", "Process"] },
  { id: "e3", name: "Priya Nair", role: "Product Manager", dept: "Product", status: "Away", tasks: 6, perf: 91, since: "2022", location: "Austin, TX", skills: ["Roadmap", "Research", "UX"] },
  { id: "e4", name: "Leo Park", role: "Data Analyst", dept: "Analytics", status: "Online", tasks: 4, perf: 86, since: "2023", location: "Remote", skills: ["SQL", "Dashboards", "Forecasting"] },
  { id: "e5", name: "Mara Silva", role: "Designer", dept: "Product", status: "Offline", tasks: 3, perf: 89, since: "2022", location: "Miami, FL", skills: ["Brand", "UI", "Motion"] },
  { id: "e6", name: "Sam Idris", role: "Support Specialist", dept: "Support", status: "Online", tasks: 11, perf: 82, since: "2023", location: "Boston, MA", skills: ["CX", "Tickets", "Retention"] },
  { id: "e7", name: "Ivy Zhou", role: "Content Lead", dept: "Marketing", status: "Away", tasks: 5, perf: 90, since: "2022", location: "Chicago, IL", skills: ["Copy", "Social", "SEO"] },
  { id: "e8", name: "Noah Reed", role: "Fulfilment Assoc.", dept: "Operations", status: "Online", tasks: 7, perf: 84, since: "2023", location: "Seattle, WA", skills: ["Warehouse", "Shipping", "QA"] },
];

const departments = [
  { label: "Operations", share: 30, color: "oklch(0.84 0.14 84)" },
  { label: "Marketing", share: 26, color: "oklch(0.7 0.11 60)" },
  { label: "Product", share: 20, color: "oklch(0.66 0.09 200)" },
  { label: "Support", share: 14, color: "oklch(0.75 0.13 150)" },
  { label: "Analytics", share: 10, color: "oklch(0.62 0.12 300)" },
];

const taskColumns = ["To do", "In progress", "Review", "Done"] as const;
type Col = (typeof taskColumns)[number];
type Task = { id: string; title: string; who: string; priority: "High" | "Normal"; due: string; col: Col };
const seedTasks: Task[] = [
  { id: "t1", title: "Launch referral email sequence", who: "Ava Chen", priority: "High", due: "Today", col: "In progress" },
  { id: "t2", title: "Q3 supplier contract review", who: "Marcus Reid", priority: "High", due: "Tomorrow", col: "To do" },
  { id: "t3", title: "Redesign onboarding screens", who: "Mara Silva", priority: "Normal", due: "Fri", col: "In progress" },
  { id: "t4", title: "Churn cohort analysis", who: "Leo Park", priority: "Normal", due: "Wed", col: "Review" },
  { id: "t5", title: "Restock hero SKUs", who: "Noah Reed", priority: "High", due: "Today", col: "To do" },
  { id: "t6", title: "Publish August content calendar", who: "Ivy Zhou", priority: "Normal", due: "Done", col: "Done" },
  { id: "t7", title: "Resolve top 5 support tickets", who: "Sam Idris", priority: "High", due: "Today", col: "In progress" },
];

const scheduleDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const shifts = [
  { who: "Ava Chen", cells: ["9–5", "9–5", "9–5", "—", "9–5"] },
  { who: "Marcus Reid", cells: ["8–4", "8–4", "8–4", "8–4", "—"] },
  { who: "Sam Idris", cells: ["10–6", "10–6", "—", "10–6", "10–6"] },
  { who: "Noah Reed", cells: ["7–3", "7–3", "7–3", "7–3", "7–3"] },
];

const leaderboard = [
  { label: "Ava Chen", value: 94 },
  { label: "Priya Nair", value: 91 },
  { label: "Ivy Zhou", value: 90 },
  { label: "Mara Silva", value: 89 },
  { label: "Marcus Reid", value: 88 },
];
const perfTrend = [78, 80, 79, 82, 84, 83, 86, 87, 88, 89, 90, 91];

const courses = [
  { id: "c1", title: "AI tools for daily work", cat: "Productivity", lessons: 8, progress: 62, icon: Sparkles },
  { id: "c2", title: "Customer conversations that convert", cat: "Sales", lessons: 6, progress: 100, icon: Users },
  { id: "c3", title: "Inventory & fulfilment basics", cat: "Operations", lessons: 10, progress: 30, icon: Building2 },
  { id: "c4", title: "Brand voice & content", cat: "Marketing", lessons: 5, progress: 0, icon: BookOpen },
];

const channels = [{ name: "general", unread: 0 }, { name: "operations", unread: 3 }, { name: "marketing", unread: 1 }, { name: "wins", unread: 0 }];
const seedMessages = [
  { author: "Marcus Reid", text: "Fulfilment SLA back to 97% — nice work team 💪", time: "12m" },
  { author: "Ava Chen", text: "Referral campaign is live. Early CTR looks great.", time: "34m" },
  { author: "WonderFlow AI", text: "Heads up: Thursday afternoon has a coverage gap in Support.", time: "1h" },
];

/* ──────────────────────────────────────────────────────────────────────
 * Small pieces
 * ─────────────────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: Status }) {
  const c = statusColor[status];
  return <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: c }}><span className="size-1.5 rounded-full" style={{ background: c }} />{status}</span>;
}

function Bars({ data }: { data: number[] }) {
  const { ref, inView } = useInView();
  const max = Math.max(...data);
  const min = Math.min(...data) * 0.9;
  return (
    <div ref={ref} className="flex items-end gap-1.5" style={{ height: 150 }}>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col justify-end">
          <div className="rounded-t-md transition-all duration-700 ease-out" style={{ height: inView ? `${((v - min) / (max - min)) * 90 + 10}%` : "0%", transitionDelay: `${i * 40}ms`, background: i === data.length - 1 ? "var(--gradient-gold)" : "oklch(0.84 0.14 84 / 22%)" }} />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

function DashboardView({ open }: { open: (id: string) => void }) {
  const online = employees.filter((e) => e.status === "Online").length;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Team members" value={employees.length} delta="2" icon={Users} />
        <StatTile label="Online now" value={online} icon={Zap} />
        <StatTile label="Open tasks" value={49} delta="6" positive={false} icon={LayoutGrid} />
        <StatTile label="Avg performance" value={88} suffix="%" delta="2 pts" icon={Gauge} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="glass-strong relative flex h-full flex-col overflow-hidden p-6">
            <div className="veil pointer-events-none absolute inset-0 opacity-60" />
            <div className="relative flex items-start gap-4">
              <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Brain className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Team briefing</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">Every employee has an intelligent assistant helping them succeed. Morale is high and performance is up 2 points. I spotted a <span className="text-gold">Thursday coverage gap</span> in Support and drafted a fix. <span className="text-gold">3 people</span> finished training this week.</p>
              </div>
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Building2}>By department</SectionLabel>
            <div className="mt-4 flex items-center gap-6">
              <Donut data={departments} size={140} center={<div><div className="text-xl font-semibold tabular-nums gold-text">{employees.length}</div><div className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">people</div></div>} />
              <ul className="min-w-0 flex-1 space-y-2">
                {departments.map((d) => (<li key={d.label} className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="flex-1 truncate text-foreground/85">{d.label}</span><span className="tabular-nums text-muted-foreground">{d.share}%</span></li>))}
              </ul>
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={Users}>Team</SectionLabel>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {employees.slice(0, 6).map((e) => (
              <button key={e.id} onClick={() => open(e.id)} className="lift flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left hover:border-gold/30 hover:bg-glass">
                <Avatar name={e.name} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{e.name}</p><p className="truncate text-xs text-muted-foreground">{e.role}</p></div>
                <StatusPill status={e.status} />
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function PeopleView({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  if (selectedId) {
    const e = employees.find((x) => x.id === selectedId) ?? employees[0];
    return <EmployeeProfile e={e} onBack={() => onSelect(null)} />;
  }
  const filtered = employees.filter((e) => (e.name + e.role + e.dept).toLowerCase().includes(q.toLowerCase()));
  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <label className="flex items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2.5 focus-within:border-gold/50">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
        </label>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <button key={e.id} onClick={() => onSelect(e.id)} className="lift flex flex-col items-start rounded-2xl border border-border bg-background/30 p-4 text-left hover:border-gold/40">
              <div className="flex w-full items-center gap-3">
                <Avatar name={e.name} className="size-10 text-xs" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{e.name}</p><p className="truncate text-xs text-muted-foreground">{e.role}</p></div>
              </div>
              <div className="mt-3 flex w-full items-center justify-between text-xs"><span className="text-muted-foreground">{e.dept}</span><StatusPill status={e.status} /></div>
            </button>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function EmployeeProfile({ e, onBack }: { e: Employee; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> All people</button>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col items-center p-6 text-center">
            <span className="grid size-20 place-items-center rounded-2xl text-2xl font-semibold" style={{ background: "var(--gradient-gold)", color: "oklch(0.2 0.02 70)" }}>{e.name.split(" ").map((p) => p[0]).join("")}</span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{e.name}</h2>
            <p className="text-sm text-muted-foreground">{e.role}</p>
            <div className="mt-2"><StatusPill status={e.status} /></div>
            <div className="mt-5 grid w-full grid-cols-3 gap-2 border-t border-border pt-5 text-center">
              <div><p className="text-lg font-semibold tabular-nums">{e.tasks}</p><p className="text-[0.6rem] uppercase text-muted-foreground">Tasks</p></div>
              <div><p className="text-lg font-semibold tabular-nums text-gold">{e.perf}</p><p className="text-[0.6rem] uppercase text-muted-foreground">Perf</p></div>
              <div><p className="text-lg font-semibold tabular-nums">{e.since}</p><p className="text-[0.6rem] uppercase text-muted-foreground">Since</p></div>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" /> {e.location} · {e.dept}</p>
          </GlassCard>
        </Reveal>

        <div className="space-y-4">
          <Reveal>
            <GlassCard className="glass-strong relative overflow-hidden p-6">
              <div className="veil pointer-events-none absolute inset-0 opacity-60" />
              <div className="relative flex items-start gap-4">
                <span className="orb grid size-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Sparkles className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">AI assistant for {e.name.split(" ")[0]}</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">{e.name.split(" ")[0]} is performing well ({e.perf}/100). I've prioritized their {e.tasks} open tasks, flagged 1 blocker, and suggested a training module to level up {e.skills[0]}.</p>
                </div>
              </div>
            </GlassCard>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal className="h-full"><GlassCard className="h-full p-6"><SectionLabel icon={Gauge}>Performance</SectionLabel><div className="mt-4 grid place-items-center"><Ring value={e.perf} size={120} /></div></GlassCard></Reveal>
            <Reveal className="h-full" delay={80}><GlassCard className="h-full p-6"><SectionLabel icon={Star}>Skills</SectionLabel><div className="mt-4 flex flex-wrap gap-2">{e.skills.map((s) => <span key={s} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/85">{s}</span>)}</div><p className="mt-4 text-xs text-muted-foreground">Suggested next: advanced {e.skills[0].toLowerCase()} certification.</p></GlassCard></Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksView() {
  const [tasks, setTasks] = useState(seedTasks);
  const advance = (id: string) => setTasks((ts) => ts.map((t) => {
    if (t.id !== id) return t;
    const i = taskColumns.indexOf(t.col);
    return i < taskColumns.length - 1 ? { ...t, col: taskColumns[i + 1] } : t;
  }));
  return (
    <Reveal>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-4">
          {taskColumns.map((col) => {
            const list = tasks.filter((t) => t.col === col);
            return (
              <div key={col} className="w-64 shrink-0">
                <div className="mb-3 flex items-center justify-between px-1"><span className="text-sm font-semibold">{col}</span><span className="rounded-full bg-glass px-2 py-0.5 text-xs text-muted-foreground">{list.length}</span></div>
                <div className="space-y-3">
                  {list.map((t) => (
                    <div key={t.id} className="lift rounded-2xl border border-border bg-background/40 p-4">
                      <div className="flex items-center justify-between">
                        {t.priority === "High" ? <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-medium text-gold" style={{ background: "oklch(0.84 0.14 84 / 12%)" }}>High</span> : <span className="text-[0.65rem] text-muted-foreground">Normal</span>}
                        <span className="flex items-center gap-1 text-[0.7rem] text-muted-foreground"><Clock className="size-3" /> {t.due}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground">{t.title}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2"><Avatar name={t.who} className="size-6 text-[0.55rem]" /><span className="text-xs text-muted-foreground">{t.who.split(" ")[0]}</span></div>
                        {t.col !== "Done" && <button onClick={() => advance(t.id)} className="rounded-full border border-border bg-glass px-2.5 py-1 text-[0.7rem] text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">Advance →</button>}
                        {t.col === "Done" && <CheckCircle2 className="size-4 text-emerald-400" />}
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

type ChatMsg = { role: "ai" | "user"; text: string };
const assistantPrompts = ["How many PTO days do I have?", "What are my tasks today?", "Who's on call this weekend?", "Start onboarding a new hire"];

function AssistantView() {
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "ai", text: "Hi! I'm your work assistant. Ask me about your tasks, schedule, PTO, policies, or getting a new hire set up." }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);
  const answerFor = (q: string) => {
    const s = q.toLowerCase();
    if (s.includes("pto") || s.includes("vacation")) return "You have 14 PTO days remaining this year, plus 3 sick days. Want me to draft a request?";
    if (s.includes("task")) return "Today you have 3 tasks: launch the referral sequence (high), review the Q3 supplier contract, and resolve the top 5 support tickets.";
    if (s.includes("call") || s.includes("weekend")) return "This weekend Noah Reed covers fulfilment and Sam Idris is on support. No gaps detected.";
    if (s.includes("onboard") || s.includes("hire")) return "I'll set up a new-hire checklist: accounts, role & permissions, a training path, and a buddy. Who are we onboarding?";
    return "I've noted that. I can help with tasks, scheduling, PTO, policies, and onboarding — just say the word.";
  };
  function send(text: string) { const q = text.trim(); if (!q || thinking) return; setMessages((m) => [...m, { role: "user", text: q }]); setInput(""); setThinking(true); window.setTimeout(() => { setThinking(false); setMessages((m) => [...m, { role: "ai", text: answerFor(q) }]); }, 1200); }
  return (
    <Reveal>
      <GlassCard className="glass-strong mx-auto flex h-[32rem] max-w-3xl flex-col p-5">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Bot className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
          <div><p className="text-sm font-semibold tracking-tight">Staff Assistant</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-400" /> Here to help you succeed</p></div>
        </div>
        <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (<div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>{m.text}</div></div>))}
          {thinking && <div className="flex justify-start"><div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div></div>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{assistantPrompts.map((p) => <button key={p} onClick={() => send(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your assistant…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
        </form>
      </GlassCard>
    </Reveal>
  );
}

function ScheduleView() {
  return (
    <div className="space-y-4">
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-5">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative flex items-center gap-3">
            <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Sparkles className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
            <p className="text-sm text-foreground/85">AI found a <span className="text-gold">coverage gap Thursday afternoon</span> in Support — I suggest shifting Sam Idris to 12–8. <button className="ml-1 text-gold underline-offset-2 hover:underline">Apply fix</button></p>
          </div>
        </GlassCard>
      </Reveal>
      <Reveal delay={60}>
        <GlassCard className="overflow-x-auto p-6">
          <SectionLabel icon={CalendarDays}>This week</SectionLabel>
          <div className="mt-4 min-w-[36rem]">
            <div className="grid grid-cols-[8rem_repeat(5,1fr)] gap-2 border-b border-border pb-2 text-[0.7rem] uppercase tracking-wide text-muted-foreground"><span>Member</span>{scheduleDays.map((d) => <span key={d} className="text-center">{d}</span>)}</div>
            {shifts.map((s) => (
              <div key={s.who} className="grid grid-cols-[8rem_repeat(5,1fr)] items-center gap-2 border-b border-border/60 py-2.5">
                <span className="flex items-center gap-2 text-sm text-foreground/85"><Avatar name={s.who} className="size-6 text-[0.55rem]" /> {s.who.split(" ")[0]}</span>
                {s.cells.map((c, i) => <div key={i} className="grid h-8 place-items-center rounded-lg text-xs tabular-nums" style={{ background: c === "—" ? "transparent" : "oklch(0.84 0.14 84 / 12%)", color: c === "—" ? "var(--color-muted-foreground)" : "var(--color-foreground)" }}>{c}</div>)}
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function PerformanceView() {
  const maxLb = Math.max(...leaderboard.map((l) => l.value));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Avg performance" value={88} suffix="%" delta="2 pts" icon={Gauge} />
        <StatTile label="Tasks completed (mo)" value={642} delta="11%" icon={CheckCircle2} />
        <StatTile label="On-time rate" value={94} suffix="%" delta="1.5 pts" icon={Target} />
        <StatTile label="Engagement" value={4.6} suffix="/5" decimals={1} delta="0.2" icon={Star} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Reveal className="h-full"><GlassCard className="flex h-full flex-col p-6"><div className="flex items-baseline justify-between"><SectionLabel icon={TrendingUp}>Team performance trend</SectionLabel><span className="text-xs text-muted-foreground">Last 12 months</span></div><div className="mt-6"><Bars data={perfTrend} /></div></GlassCard></Reveal>
        <Reveal className="h-full" delay={80}><GlassCard className="flex h-full flex-col p-6"><SectionLabel icon={Award}>Top performers</SectionLabel><div className="mt-5 space-y-4">{leaderboard.map((l) => (<div key={l.label}><div className="flex items-baseline justify-between text-sm"><span className="truncate text-foreground/85">{l.label}</span><span className="ml-2 shrink-0 tabular-nums text-gold">{l.value}</span></div><div className="mt-1.5"><Bar value={(l.value / maxLb) * 100} /></div></div>))}</div></GlassCard></Reveal>
      </div>
    </div>
  );
}

function TrainingView() {
  const [list, setList] = useState(courses);
  const cont = (id: string) => setList((cs) => cs.map((c) => (c.id === id ? { ...c, progress: Math.min(100, c.progress + 20) } : c)));
  const completed = list.filter((c) => c.progress === 100).length;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Courses completed" value={completed} icon={GraduationCap} />
        <StatTile label="In progress" value={list.filter((c) => c.progress > 0 && c.progress < 100).length} icon={Play} />
        <StatTile label="Team completion" value={Math.round(list.reduce((a, c) => a + c.progress, 0) / list.length)} suffix="%" icon={Target} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((c, i) => (
          <Reveal key={c.id} delay={i * 50} className="h-full">
            <GlassCard className="flex h-full flex-col p-6">
              <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl border border-border bg-glass"><c.icon className="size-5 text-gold" /></span><span className="rounded-full border border-border bg-glass px-2.5 py-0.5 text-[0.65rem] text-muted-foreground">{c.cat}</span></div>
              <p className="mt-4 text-sm font-semibold text-foreground">{c.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.lessons} lessons</p>
              <div className="mt-4"><div className="flex items-baseline justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="tabular-nums text-gold">{c.progress}%</span></div><div className="mt-1.5"><Bar value={c.progress} /></div></div>
              <button onClick={() => cont(c.id)} disabled={c.progress === 100} className="mt-4 flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50" style={c.progress === 100 ? { border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)" } : { background: "var(--gradient-gold)", color: "oklch(0.2 0.02 70)" }}>
                {c.progress === 100 ? <><CheckCircle2 className="size-3.5" /> Completed</> : c.progress === 0 ? <><Play className="size-3.5" /> Start course</> : <><Play className="size-3.5" /> Continue</>}
              </button>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function CommsView() {
  const [active, setActive] = useState("operations");
  const [messages, setMessages] = useState(seedMessages);
  const [input, setInput] = useState("");
  const post = () => { const t = input.trim(); if (!t) return; setMessages((m) => [...m, { author: "You", text: t, time: "now" }]); setInput(""); };
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Reveal className="hidden lg:block">
        <GlassCard className="p-4">
          <p className="px-2 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Channels</p>
          <div className="mt-2 space-y-1">
            {channels.map((c) => (
              <button key={c.name} onClick={() => setActive(c.name)} className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors", active === c.name ? "bg-glass text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")}>
                <Hash className="size-3.5 shrink-0" /><span className="flex-1 truncate">{c.name}</span>{c.unread > 0 && <span className="rounded-full bg-gold/20 px-1.5 text-[0.6rem] text-gold">{c.unread}</span>}
              </button>
            ))}
          </div>
        </GlassCard>
      </Reveal>

      <Reveal>
        <GlassCard className="flex h-[32rem] flex-col p-6">
          <div className="flex items-center gap-2 border-b border-border pb-4"><Hash className="size-4 text-gold" /><p className="text-sm font-semibold">{active}</p></div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-gold/25 bg-glass p-3"><Megaphone className="size-4 shrink-0 text-gold" /><p className="text-xs text-foreground/80">Pinned: All-hands Friday 10 AM. AI notes will be shared after.</p></div>
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <Avatar name={m.author === "You" ? "Y O" : m.author} />
                <div className="min-w-0"><p className="flex items-center gap-2 text-sm"><span className="font-medium text-foreground">{m.author}</span><span className="text-[0.65rem] text-muted-foreground">{m.time}</span></p><p className="mt-0.5 text-sm text-foreground/85">{m.text}</p></div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); post(); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Message #${active}…`} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
            <button type="submit" aria-label="Send" disabled={!input.trim()} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
          </form>
        </GlassCard>
      </Reveal>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  dashboard: { title: "Team Operations", sub: "An assistant for every employee" },
  people: { title: "People", sub: "Your team, at a glance" },
  tasks: { title: "AI task management", sub: "Work that moves itself forward" },
  assistant: { title: "Staff assistant", sub: "Help for everyone, on tap" },
  schedule: { title: "Scheduling intelligence", sub: "The right people at the right time" },
  performance: { title: "Performance analytics", sub: "How the team is growing" },
  training: { title: "Training center", sub: "Level up every skill" },
  comms: { title: "Internal communication", sub: "Keep everyone in sync" },
};

export function TeamWorkspace() {
  const [active, setActive] = useState<ViewKey>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const meta = viewMeta[active];
  const open = (id: string) => { setSelectedId(id); setActive("people"); };
  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 flex items-center gap-1.5 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-gold"><UsersRound className="size-3" /> Team Ops</p>
        <nav className="mt-2 space-y-1 overflow-y-auto">
          {views.map((v) => (
            <button key={v.key} onClick={() => { setActive(v.key); if (v.key !== "people") setSelectedId(null); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className={cn("size-4", active === v.key && "text-gold")} />
              {v.label}
            </button>
          ))}
        </nav>
        <Link to="/dashboard" className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground"><ArrowLeft className="size-4" /> Command center</Link>
      </aside>

      <section className="min-w-0 flex-1 space-y-5">
        <div className="rise flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{meta.sub}</p>
            <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}><span className="gold-text italic">{meta.title}</span></h1>
          </div>
          <button onClick={() => setActive("assistant")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}><Bot className="size-4" stroke="oklch(0.2 0.02 70)" /> Staff assistant</button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {views.map((v) => (
            <button key={v.key} onClick={() => { setActive(v.key); if (v.key !== "people") setSelectedId(null); }} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className="size-3.5" />{v.label}
            </button>
          ))}
        </div>

        <div key={active + (selectedId ?? "")} className="rise">
          {active === "dashboard" && <DashboardView open={open} />}
          {active === "people" && <PeopleView selectedId={selectedId} onSelect={setSelectedId} />}
          {active === "tasks" && <TasksView />}
          {active === "assistant" && <AssistantView />}
          {active === "schedule" && <ScheduleView />}
          {active === "performance" && <PerformanceView />}
          {active === "training" && <TrainingView />}
          {active === "comms" && <CommsView />}
        </div>
      </section>
    </div>
  );
}
