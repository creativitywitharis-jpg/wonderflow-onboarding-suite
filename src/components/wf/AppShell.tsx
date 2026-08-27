import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Crown,
  LogOut,
  FileText,
  Factory,
  HelpCircle,
  Home,
  LayoutGrid,
  Lock,
  Megaphone,
  Menu,
  MessageSquare,
  Plug,
  Plus,
  Rocket,
  Search,
  Send,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Users,
  UsersRound,
  Wallet,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Backdrop } from "@/components/wf/Backdrop";
import { Mark } from "@/components/wf/Brand";
import { Ring } from "@/components/wf/primitives";
import { useOrg } from "@/lib/org-context";
import { signOut } from "@/lib/use-auth";
import { askAI } from "@/lib/ai";
import { listHelpMessages, saveHelpMessage } from "@/lib/help";
import { getAiUsage, planLimits } from "@/lib/billing";
import { buildInsights, type Insight } from "@/lib/insights";

/* ──────────────────────────────────────────────────────────────────────
 * Navigation model
 * ─────────────────────────────────────────────────────────────────── */

type NavItem = { label: string; to: string; icon: LucideIcon; tab?: string };
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: Home },
      { label: "CRM", to: "/crm", icon: Users },
      { label: "Finance", to: "/finance", icon: Wallet },
      { label: "Orders", to: "/orders", icon: ShoppingCart },
      { label: "Inventory", to: "/inventory", icon: Boxes },
      { label: "Suppliers", to: "/suppliers", icon: Factory },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "WonderGrowth", to: "/growth", icon: Rocket },
      { label: "Campaigns", to: "/growth", icon: Megaphone },
      { label: "Rewards", to: "/growth", icon: Crown },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Advisor", to: "/advisor", icon: BrainCircuit },
      { label: "Analytics", to: "/analytics", icon: BarChart3 },
      { label: "Reports", to: "/analytics", icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Automation", to: "/automation", icon: Workflow },
      { label: "Team", to: "/team", icon: UsersRound },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Integrations", to: "/admin", icon: Plug, tab: "integrations" },
      { label: "Administration", to: "/admin", icon: Shield, tab: "settings" },
    ],
  },
];

// Which module each nav destination belongs to (for enabled-module filtering).
const ROUTE_MODULE: Record<string, string> = {
  "/dashboard": "dashboard",
  "/crm": "crm",
  "/finance": "finance",
  "/orders": "orders",
  "/inventory": "inventory",
  "/suppliers": "suppliers",
  "/growth": "growth",
  "/advisor": "advisor",
  "/analytics": "analytics",
  "/automation": "automation",
  "/team": "team",
  "/admin": "admin",
};
const ALL_MODULES = Object.values(ROUTE_MODULE);
// Core modules are universal — always shown, regardless of an org's stored
// enabled_modules (which is snapshotted at signup and can go stale when new core
// modules ship, e.g. Finance). Only the commerce pack is industry-gated.
const CORE_ALWAYS = ["dashboard", "crm", "finance", "team", "analytics", "advisor", "automation", "admin"];

function healthTier(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Healthy & growing";
  if (score >= 50) return "Stable";
  return "Needs attention";
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "•";
}

type Command = { label: string; hint: string; to: string; icon: LucideIcon; ai?: boolean };
const commands: Command[] = [
  { label: "Go to Dashboard", hint: "Navigate", to: "/dashboard", icon: Home },
  { label: "Find a customer", hint: "CRM", to: "/crm", icon: Users },
  { label: "Create an invoice", hint: "Finance", to: "/finance", icon: Wallet },
  { label: "Create an order", hint: "Orders", to: "/orders", icon: ShoppingCart },
  { label: "Open inventory", hint: "Inventory", to: "/inventory", icon: Boxes },
  { label: "Launch a campaign", hint: "WonderGrowth", to: "/growth", icon: Megaphone },
  { label: "Generate a report", hint: "Analytics", to: "/analytics", icon: FileText },
  { label: "Create an automation", hint: "Automation", to: "/automation", icon: Workflow },
  { label: "Review suppliers", hint: "Suppliers", to: "/suppliers", icon: Factory },
  { label: "Manage the team", hint: "Team", to: "/team", icon: UsersRound },
  { label: "Open administration", hint: "System", to: "/admin", icon: Shield },
  { label: "Ask WonderFlow AI", hint: "AI Advisor", to: "/advisor", icon: Sparkles, ai: true },
];

/* ──────────────────────────────────────────────────────────────────────
 * Command palette / global search
 * ─────────────────────────────────────────────────────────────────── */

function CommandPalette({ open, onClose, onAsk }: { open: boolean; onClose: () => void; onAsk: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter((c) => (c.label + c.hint).toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!open) return undefined;
    setQ("");
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const run = (c?: Command) => {
    const cmd = c ?? filtered[active];
    if (!cmd) return;
    onClose();
    if (cmd.ai) onAsk();
    navigate({ to: cmd.to });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong relative w-full max-w-xl overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); run(); }
            }}
            placeholder="Search customers, orders, actions…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          <p className="px-2 pb-1 pt-2 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">{q ? "Results" : "Suggested actions"}</p>
          {filtered.map((c, i) => (
            <button
              key={c.label}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(c)}
              className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors", i === active ? "bg-glass text-foreground" : "text-foreground/80")}
            >
              <span className="grid size-7 place-items-center rounded-lg border border-border bg-glass"><c.icon className="size-4 text-gold" /></span>
              <span className="flex-1">{c.label}</span>
              <span className="text-xs text-muted-foreground">{c.hint}</span>
              {i === active && <ArrowRight className="size-3.5 text-gold" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches. Try “order”, “report”, or “customer”.</p>}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Right AI panel
 * ─────────────────────────────────────────────────────────────────── */

type ChatMsg = { role: "ai" | "user"; text: string };
const quickPrompts = ["Summarize today", "Where am I losing money?", "What should I focus on?"];

function AiPanel({ onClose }: { onClose: () => void }) {
  const { org } = useOrg();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  const limit = planLimits(org?.plan).aiMonthly;
  const [usage, setUsage] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    if (org?.id && limit !== null) getAiUsage(org.id).then((u) => alive && setUsage(u)).catch(() => {});
    return () => { alive = false; };
  }, [org?.id, limit]);
  const remaining = limit === null ? null : Math.max(0, limit - (usage ?? 0));

  // Real "Today's insights" derived from this org's own data (fails soft to []).
  const [insights, setInsights] = useState<Insight[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (org?.id) {
      setInsights(null);
      buildInsights(org.id).then((r) => alive && setInsights(r)).catch(() => alive && setInsights([]));
    } else {
      setInsights([]);
    }
    return () => { alive = false; };
  }, [org?.id]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    const next: ChatMsg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const reply = await askAI(
        next.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }) as const),
        { id: org?.id, name: org?.name, industry: org?.industry },
      );
      setMessages((m) => [...m, { role: "ai", text: reply || "I don't have an answer for that yet." }]);
      if (org?.id && limit !== null) getAiUsage(org.id).then(setUsage).catch(() => {});
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: e instanceof Error ? e.message : "I couldn't reach the AI service. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Sparkles className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
          <div><p className="text-sm font-semibold tracking-tight">WonderFlow AI</p><p className="text-xs text-muted-foreground">{remaining === null ? "Your business partner" : `${remaining} of ${limit} messages left this month`}</p></div>
        </div>
        <button onClick={onClose} aria-label="Close AI panel" className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"><ChevronRight className="size-4" /></button>
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && !thinking && (
          <div>
            <p className="px-1 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">Today's insights</p>
            <div className="mt-2 space-y-2">
              {insights === null && (
                <div className="rounded-2xl border border-border bg-background/30 p-3 text-sm text-muted-foreground">Reading your data…</div>
              )}
              {insights?.length === 0 && (
                <div className="rounded-2xl border border-border bg-background/30 p-3 text-sm text-muted-foreground">
                  Add customers, products, or invoices and I'll surface what needs attention here.
                </div>
              )}
              {insights?.map((it) => (
                <div key={it.text} className="flex items-start gap-2 rounded-2xl border border-border bg-background/30 p-3 text-sm text-foreground/85">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: it.tone === "warn" ? "oklch(0.68 0.16 25)" : "oklch(0.84 0.14 84)" }} />{it.text}
                </div>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>{m.text}</div>
          </div>
        ))}
        {thinking && <div className="flex justify-start"><div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div></div>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickPrompts.map((p) => (<button key={p} onClick={() => send(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask WonderFlow AI…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
        <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-8 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-3.5" stroke="oklch(0.2 0.02 70)" /></button>
      </form>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Help — "how do I..." product Q&A, grounded in a written reference of how
 * WonderFlow's real features actually work (not business data, unlike
 * AiPanel). ai-chat's system prompt is a fixed business-advisor persona, so
 * the reference + role override are prepended to the user message itself.
 * ─────────────────────────────────────────────────────────────────── */

const HELP_STARTERS = [
  "How do I import customers from a CSV file?",
  "How do I create an automation rule?",
  "How do I invite a teammate?",
  "How do I connect Slack?",
];

const HELP_PROMPT = `You are now acting as WonderFlow OS's in-app Help assistant, not a business advisor — a user needs to know how to USE the software. Answer ONLY using the reference below, in short numbered steps naming the exact tab/button. If something isn't covered by the reference, say plainly you don't have exact steps for that yet and point to the closest relevant tab — never invent button labels or steps you're not certain of. Keep answers brief.

Reference — how WonderFlow OS actually works:

IMPORTING DATA (CSV):
- CRM → Customers: click "Import CSV" (top toolbar, or the empty-state button) to bulk-import customers from a spreadsheet.
- Team → People: click "Add staff" then choose the CSV import option to bulk-import your staff roster.

AUTOMATION — creating a rule (Automation module), four ways:
1. Dashboard tab → "New rule": pick a trigger (new order / new customer / invoice paid / manual) and an action (draft an AI note, email the owner, email the customer, call a webhook, send a Slack message). Toggle "Multi-step workflow" to chain actions with waits, conditions, or a human-approval step.
2. AI creator tab: describe the automation in plain English (e.g. "when an order is over $500, ask me to approve it"), review the generated steps, click "Open in builder" to save it.
3. Templates tab: one-click deploy a ready-made rule (welcome email, thank-you + review request, etc.).
4. Workflow builder tab: visually assemble a trigger + steps on a canvas, then click "Use this workflow" to open it in the Dashboard form and save.

TEAM WORKSPACE:
- People: add staff manually or via CSV import; each person has a status (Active/On leave/Offboarded).
- Tasks: create, assign, and track tasks on a board (To do/In progress/Review/Done).
- Schedule: click any day/employee cell to set shift hours or mark someone off, covers the full week.
- Performance: completion-rate and on-time stats derived from real tasks.
- Training: create courses, assign them to specific people, track completion.
- Communication: create channels and assign them to all team members or specific people; post messages.
- Staff Assistant: an AI chat grounded in real team data (who's working today, overdue tasks, etc.).

SETTINGS / ADMINISTRATION (gear icon in the sidebar):
- Business settings: company name, industry (changing it updates which modules are visible), timezone, currency.
- Billing & plan: choose or switch plans, manage payment via the Stripe customer portal.
- Users: invite a teammate by email (owner/admin only) — pick a role and an optional job title label; click the pencil icon next to an existing member to edit their role/title.
- Roles / Permissions: view-only reference for what each role can do — not editable, permissions are fixed.
- AI configuration: choose which Claude model tier (Precision/Balanced/Fast) powers every AI feature in the app.
- Integrations: connect Stripe (automatic), Slack (paste an Incoming Webhook URL from api.slack.com/apps), a website/form endpoint for capturing leads, and outbound webhooks for Zapier/Make/n8n.
- Security: enable two-factor authentication (scan a QR code with an authenticator app, confirm with a 6-digit code); sign out of other sessions.
- Audit logs: a real log of team-membership and integration changes.
- System monitoring: real seat and AI-message usage against your plan.

For anything about Finance, Orders, Inventory, Suppliers, Growth, Analytics, or AI Advisor, give general orientation (which tab it's under, what it's broadly for) without inventing specific button labels.

Question: `;

type HelpMsg = { role: "user" | "ai"; text: string };

function HelpPanel({ onClose }: { onClose: () => void }) {
  const { org } = useOrg();
  const [messages, setMessages] = useState<HelpMsg[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  // Private, per-person history — reloads the same conversation next time
  // this person opens Help, doesn't need re-asking.
  useEffect(() => {
    if (!org) { setLoadingHistory(false); return; }
    setLoadingHistory(true);
    listHelpMessages(org.id)
      .then((rows) => setMessages(rows.map((r) => ({ role: r.role, text: r.text }))))
      .finally(() => setLoadingHistory(false));
  }, [org?.id]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || thinking || !org) return;
    const next: HelpMsg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setThinking(true);
    void saveHelpMessage(org.id, "user", q);
    try {
      const reply = await askAI(
        [{ role: "user", content: `${HELP_PROMPT}${q}` }],
        { id: org?.id, name: org?.name, industry: org?.industry },
      );
      const text2 = reply || "I don't have an answer for that yet — try browsing the relevant tab.";
      setMessages((m) => [...m, { role: "ai", text: text2 }]);
      void saveHelpMessage(org.id, "ai", text2);
    } catch (e) {
      const text2 = e instanceof Error ? e.message : "I couldn't reach the help assistant. Please try again.";
      setMessages((m) => [...m, { role: "ai", text: text2 }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative flex h-[36rem] max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <span className="orb grid size-9 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><HelpCircle className="size-4" stroke="oklch(0.2 0.02 70)" /></span>
            <div><p className="text-sm font-semibold tracking-tight">Help</p><p className="text-xs text-muted-foreground">Ask how to do anything in WonderFlow</p></div>
          </div>
          <button onClick={onClose} aria-label="Close help" className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
          {loadingHistory && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
          {!loadingHistory && messages.length === 0 && !thinking && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Try asking</p>
              {HELP_STARTERS.map((q) => (
                <button key={q} onClick={() => send(q)} className="block w-full rounded-xl border border-border bg-background/30 px-3 py-2.5 text-left text-sm text-foreground/85 transition-colors hover:border-gold/40">{q}</button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-br-sm bg-glass text-foreground/90" : "rounded-bl-sm border border-border bg-background/40 text-foreground/85")}>{m.text}</div>
            </div>
          ))}
          {thinking && <div className="flex justify-start"><div className="typing flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-background/40 px-3.5 py-3"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div></div>}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2 border-t border-border p-4">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask how to do something…" className="min-w-0 flex-1 rounded-full border border-border bg-background/40 px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold/50" />
          <button type="submit" aria-label="Send" disabled={!input.trim() || thinking} className="grid size-9 shrink-0 place-items-center rounded-full transition-all hover:brightness-110 active:scale-95 disabled:opacity-40" style={{ background: "var(--gradient-gold)" }}><Send className="size-4" stroke="oklch(0.2 0.02 70)" /></button>
        </form>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Sidebar
 * ─────────────────────────────────────────────────────────────────── */

function Sidebar({ collapsed, onToggle, onHelp }: { collapsed: boolean; onToggle: () => void; onHelp: () => void }) {
  const { org, orgs, role, userName, userEmail, switchOrg } = useOrg();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const enabled = org?.enabled_modules ?? ALL_MODULES;
  const planMods = planLimits(org?.plan).modules;
  const groups = navGroups
    .map((g) => ({
      ...g,
      items: g.items
        // Keep destinations relevant to the org's industry.
        .filter((it) => {
          const m = ROUTE_MODULE[it.to];
          return !m || CORE_ALWAYS.includes(m) || enabled.includes(m);
        })
        // Flag those the industry enables but the current plan doesn't include.
        .map((it) => {
          const m = ROUTE_MODULE[it.to];
          const locked = !!m && m !== "admin" && !planMods.includes(m);
          return { ...it, locked };
        }),
    }))
    .filter((g) => g.items.length > 0);

  const health = org?.health_score ?? 80;
  const orgName = org?.name ?? "Your business";

  const pick = (id: string) => {
    setSwitcherOpen(false);
    if (id !== org?.id) {
      switchOrg(id);
      navigate({ to: "/dashboard" });
    }
  };

  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <aside
      style={{ width: collapsed ? "5rem" : "15rem" }}
      className="glass sticky top-0 hidden h-screen min-w-0 shrink-0 flex-col overflow-x-hidden p-3 transition-[width] duration-300 lg:flex"
    >
      {/* org switcher */}
      <div className="relative">
        <button
          onClick={() => !collapsed && setSwitcherOpen((o) => !o)}
          className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-glass", collapsed && "justify-center px-0")}
        >
          <Mark className="size-9" />
          {!collapsed && (
            <>
              <span className="flex min-w-0 flex-1 flex-col text-left leading-none">
                <span className="truncate text-sm font-semibold tracking-tight">{orgName}</span>
                <span className="mt-1 truncate text-[0.68rem] text-muted-foreground">WonderFlow OS</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
        {switcherOpen && !collapsed && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setSwitcherOpen(false)} />
            <div className="glass-strong absolute left-1 right-1 top-full z-40 mt-1 rounded-xl p-1.5">
              <p className="px-2 py-1 text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">Your businesses</p>
              {orgs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => pick(o.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-glass"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md text-[0.6rem] font-semibold" style={{ background: "var(--gradient-gold)", color: "oklch(0.2 0.02 70)" }}>
                    {initials(o.name)}
                  </span>
                  <span className="flex-1 truncate text-left text-foreground/90">{o.name}</span>
                  {o.id === org?.id && <Check className="size-3.5 shrink-0 text-gold" />}
                </button>
              ))}
              <button
                onClick={() => { setSwitcherOpen(false); navigate({ to: "/onboarding" }); }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="size-4" /> Add a business
              </button>
            </div>
          </>
        )}
      </div>

      {/* business health */}
      {!collapsed && (
        <div className="mx-1 mt-3 flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-2.5">
          <Ring value={health} size={40} stroke={4} label={<span className="text-xs font-semibold tabular-nums gold-text">{health}</span>} />
          <div>
            <p className="text-xs font-medium text-foreground">Business health</p>
            <p className="text-[0.65rem] text-muted-foreground">{healthTier(health)}</p>
          </div>
        </div>
      )}

      {/* nav (filtered by enabled modules) */}
      <nav className="mt-4 flex-1 space-y-4 overflow-y-auto pb-2">
        {groups.map((g) => (
          <div key={g.label}>
            {!collapsed && <p className="px-3 pb-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{g.label}</p>}
            <div className="space-y-0.5">
              {g.items.map((it) =>
                it.locked ? (
                  <Link
                    key={it.label + it.to}
                    to="/admin"
                    search={{ tab: "billing" }}
                    title={collapsed ? `${it.label} — upgrade to unlock` : undefined}
                    className={cn("group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground/45 transition-colors hover:bg-glass hover:text-foreground/70", collapsed && "justify-center px-0")}
                  >
                    <it.icon className="size-4 shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                    {!collapsed && <Lock className="size-3 shrink-0 text-muted-foreground/60 group-hover:text-gold" />}
                  </Link>
                ) : (
                  <Link
                    key={it.label + it.to}
                    to={it.to}
                    search={it.tab ? { tab: it.tab } : undefined}
                    title={collapsed ? it.label : undefined}
                    className={cn("group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground", collapsed && "justify-center px-0")}
                    activeProps={{ style: { background: "oklch(0.84 0.14 84 / 12%)", color: "var(--color-foreground)" } }}
                  >
                    <it.icon className="size-4 shrink-0 group-hover:text-gold" />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* bottom */}
      <div className="space-y-0.5 border-t border-border pt-2">
        <Link to="/admin" search={{ tab: "settings" }} title={collapsed ? "Settings" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground", collapsed && "justify-center px-0")}><Settings className="size-4 shrink-0" />{!collapsed && "Settings"}</Link>
        <button onClick={onHelp} title={collapsed ? "Help" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground", collapsed && "justify-center px-0")}><HelpCircle className="size-4 shrink-0" />{!collapsed && "Help"}</button>
        <button onClick={doSignOut} title={collapsed ? "Sign out" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground", collapsed && "justify-center px-0")}><LogOut className="size-4 shrink-0" />{!collapsed && "Sign out"}</button>
        <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2", collapsed && "justify-center px-0")}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-glass text-xs font-semibold text-foreground/80">{initials(userName)}</span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{userName}</p>
              <p className="truncate text-[0.65rem] capitalize text-muted-foreground">{role ?? userEmail}</p>
            </div>
          )}
          <button onClick={onToggle} aria-label="Collapse sidebar" className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Top command bar
 * ─────────────────────────────────────────────────────────────────── */

function TopBar({ onSearch, onToggleAi, onQuickCreate, onMenu }: { onSearch: () => void; onToggleAi: () => void; onQuickCreate: () => void; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/60 px-4 py-3 backdrop-blur-xl lg:px-6">
      <button onClick={onMenu} aria-label="Open menu" className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-glass text-foreground/80 transition-colors hover:border-gold/40 lg:hidden">
        <Menu className="size-4" />
      </button>
      <button onClick={onSearch} className="flex flex-1 items-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 sm:max-w-md">
        <Search className="size-4" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[0.65rem] sm:inline">⌘K</kbd>
      </button>
      <div className="hidden items-center gap-2 md:flex">
        <button className="flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-2 text-xs text-foreground/80 transition-colors hover:border-gold/40">Last 30 days<ChevronRight className="size-3 rotate-90" /></button>
      </div>
      <button onClick={onQuickCreate} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><Plus className="size-4" stroke="oklch(0.2 0.02 70)" /><span className="hidden sm:inline">Create</span></button>
      <button onClick={onToggleAi} aria-label="Toggle AI panel" className="grid size-9 place-items-center rounded-full border border-border bg-glass text-foreground/80 transition-colors hover:border-gold/40"><Sparkles className="size-4 text-gold" /></button>
      <button aria-label="Notifications" className="relative grid size-9 place-items-center rounded-full border border-border bg-glass text-foreground/80 transition-colors hover:border-gold/40"><Bell className="size-4" /><span className="absolute right-2 top-2 size-2 rounded-full bg-gold orb" /></button>
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-glass text-xs font-semibold text-foreground/80">AI</span>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Mobile navigation drawer
 * ─────────────────────────────────────────────────────────────────── */

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { org, role, userName, userEmail } = useOrg();
  const navigate = useNavigate();

  const enabled = org?.enabled_modules ?? ALL_MODULES;
  const planMods = planLimits(org?.plan).modules;
  const groups = navGroups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((it) => {
          const m = ROUTE_MODULE[it.to];
          return !m || CORE_ALWAYS.includes(m) || enabled.includes(m);
        })
        .map((it) => {
          const m = ROUTE_MODULE[it.to];
          return { ...it, locked: !!m && m !== "admin" && !planMods.includes(m) };
        }),
    }))
    .filter((g) => g.items.length > 0);

  if (!open) return null;

  const doSignOut = async () => {
    await signOut();
    onClose();
    navigate({ to: "/auth" });
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Mark className="size-7" />
            <span className="text-sm font-semibold tracking-tight">WonderFlow <span className="gold-text">OS</span></span>
          </span>
          <button onClick={onClose} aria-label="Close menu" className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-glass px-3 py-2.5">
          <p className="truncate text-sm font-medium text-foreground">{org?.name ?? "Your business"}</p>
          <p className="truncate text-xs capitalize text-muted-foreground">{role ?? userEmail}</p>
        </div>

        <nav className="mt-4 flex-1 space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-2 pb-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((it) =>
                  it.locked ? (
                    <Link key={it.label + it.to} to="/admin" onClick={onClose} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/45 hover:bg-glass hover:text-foreground/70">
                      <it.icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{it.label}</span>
                      <Lock className="size-3 shrink-0 text-muted-foreground/60" />
                    </Link>
                  ) : (
                    <Link key={it.label + it.to} to={it.to} search={it.tab ? { tab: it.tab } : undefined} onClick={onClose} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground" activeProps={{ style: { background: "oklch(0.84 0.14 84 / 12%)", color: "var(--color-foreground)" } }}>
                      <it.icon className="size-4 shrink-0 group-hover:text-gold" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border pt-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-glass text-xs font-semibold text-foreground/80">{initials(userName)}</span>
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{userName}</p>
          </div>
          <button onClick={doSignOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground">
            <LogOut className="size-4 shrink-0" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Shell
 * ─────────────────────────────────────────────────────────────────── */

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { signedIn, authLoading, loading, orgs } = useOrg();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
      else if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Signed in but no business yet → finish onboarding first.
  useEffect(() => {
    if (!authLoading && signedIn && !loading && orgs.length === 0) navigate({ to: "/onboarding" });
  }, [authLoading, signedIn, loading, orgs, navigate]);

  return (
    <div className="relative flex min-h-screen">
      <Backdrop intensity={0.22} />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onHelp={() => setHelpOpen(true)} />

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onSearch={() => setPaletteOpen(true)} onToggleAi={() => { setAiOpen((o) => !o); setMobileAiOpen(true); }} onQuickCreate={() => setPaletteOpen(true)} onMenu={() => setMobileNavOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
          {aiOpen && (
            <aside className="hidden h-[calc(100vh-3.75rem)] w-[21rem] shrink-0 overflow-hidden border-l border-border bg-background/40 xl:block sticky top-[3.75rem]">
              <AiPanel onClose={() => setAiOpen(false)} />
            </aside>
          )}
        </div>
      </div>

      {/* mobile AI drawer (phones / tablets — the docked panel is xl+ only) */}
      {mobileAiOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileAiOpen(false)} />
          <aside className="glass absolute inset-y-0 right-0 w-[22rem] max-w-[92vw] overflow-hidden">
            <AiPanel onClose={() => setMobileAiOpen(false)} />
          </aside>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onAsk={() => setAiOpen(true)} />

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}

      {/* floating AI open button when closed */}
      {!aiOpen && (
        <button onClick={() => setAiOpen(true)} aria-label="Open AI panel" className="orb fixed bottom-6 right-6 z-30 hidden size-12 place-items-center rounded-full xl:grid" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}><Sparkles className="size-5" stroke="oklch(0.2 0.02 70)" /></button>
      )}
    </div>
  );
}
