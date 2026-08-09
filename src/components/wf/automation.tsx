import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Boxes,
  Brain,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileText,
  GitBranch,
  Home,
  LayoutTemplate,
  Mail,
  MessageSquare,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
  Split,
  Timer,
  Users,
  Wand2,
  Workflow,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Bar, Reveal, SectionLabel, StatTile, formatNum } from "@/components/wf/primitives";
import { useInView } from "@/hooks/use-in-view";
import { useOrg } from "@/lib/org-context";
import { createAutomation, insertAutomations, listAutomations, runAutomationNow, setAutomationEnabled, type ActionKey, type DbAutomation, type NewAutomation, type TriggerKey } from "@/lib/automations";

/* ──────────────────────────────────────────────────────────────────────
 * Types + data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "dashboard" | "builder" | "creator" | "templates" | "approvals" | "history" | "analytics";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "builder", label: "Workflow builder", icon: GitBranch },
  { key: "creator", label: "AI creator", icon: Wand2 },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
  { key: "approvals", label: "Approval center", icon: ClipboardCheck },
  { key: "history", label: "Execution history", icon: Clock },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

type BlockKind = "trigger" | "decision" | "action";
const kindColor: Record<BlockKind, string> = {
  trigger: "oklch(0.66 0.09 200)",
  decision: "oklch(0.84 0.14 84)",
  action: "oklch(0.72 0.14 155)",
};

const palette: { kind: BlockKind; label: string; icon: LucideIcon }[] = [
  { kind: "trigger", label: "New order", icon: ShoppingCart },
  { kind: "trigger", label: "Low stock", icon: Boxes },
  { kind: "trigger", label: "New customer", icon: Users },
  { kind: "trigger", label: "Scheduled", icon: Calendar },
  { kind: "decision", label: "AI risk check", icon: Brain },
  { kind: "decision", label: "AI sentiment", icon: Brain },
  { kind: "decision", label: "If / else", icon: Split },
  { kind: "action", label: "Send email", icon: Mail },
  { kind: "action", label: "Create PO", icon: FileText },
  { kind: "action", label: "Notify Slack", icon: MessageSquare },
  { kind: "action", label: "Update CRM", icon: Users },
  { kind: "action", label: "Wait", icon: Timer },
];


const templates = [
  { name: "Low-stock auto-reorder", cat: "Inventory", steps: 4, icon: Boxes, desc: "Reorder when stock dips below the point — with an AI demand check." },
  { name: "Abandoned cart recovery", cat: "Marketing", steps: 3, icon: ShoppingCart, desc: "Win back carts with a timed, personalized nudge." },
  { name: "New customer welcome", cat: "CRM", steps: 3, icon: Users, desc: "Onboard new customers with a warm multi-step sequence." },
  { name: "Churn-risk alert", cat: "CRM", steps: 4, icon: AlertTriangle, desc: "Detect at-risk customers and trigger a save play." },
  { name: "Daily revenue digest", cat: "Analytics", steps: 2, icon: BarChart3, desc: "AI-written revenue summary to your inbox each morning." },
  { name: "Refund approval flow", cat: "Finance", steps: 4, icon: DollarSign, desc: "Route refunds over a threshold for one-tap approval." },
];

const seedApprovals = [
  { title: "Reorder 120 units of Golden Hour Balm", detail: "$5,040 to Northwind Supply · stock in 3 days", from: "Low-stock auto-reorder", icon: FileText },
  { title: "Issue refund to Sam Idris", detail: "$142 · order #10422 · defective item", from: "Refund approval flow", icon: DollarSign },
  { title: "Send win-back offer to 148 dormant customers", detail: "20% off · projected +$31k", from: "Churn-risk alert", icon: Mail },
  { title: "Increase referral ad budget by $500", detail: "ROAS 5.2x · projected +$2.6k", from: "Growth optimizer", icon: Zap },
];

const historyLog = [
  { name: "Abandoned cart recovery", trigger: "Cart abandoned", status: "success", dur: "1.2s", time: "3m ago" },
  { name: "Low-stock auto-reorder", trigger: "Stock < reorder point", status: "approval", dur: "—", time: "12m ago" },
  { name: "New customer welcome", trigger: "New customer", status: "success", dur: "0.8s", time: "22m ago" },
  { name: "Churn-risk alert", trigger: "Risk score > 70", status: "success", dur: "2.1s", time: "1h ago" },
  { name: "Refund approval flow", trigger: "Refund requested", status: "failed", dur: "3.4s", time: "2h ago" },
  { name: "Daily revenue digest", trigger: "Schedule 6:00 AM", status: "success", dur: "4.0s", time: "5h ago" },
];
const runStatus: Record<string, { color: string; icon: LucideIcon; label: string }> = {
  success: { color: "oklch(0.72 0.14 155)", icon: CheckCircle2, label: "Success" },
  failed: { color: "oklch(0.68 0.16 25)", icon: XCircle, label: "Failed" },
  approval: { color: "oklch(0.84 0.14 84)", icon: ClipboardCheck, label: "Awaiting approval" },
};

const runsSeries = [180, 210, 195, 240, 268, 255, 290, 312, 305, 340, 358, 382];
const topAutomations = [
  { label: "Abandoned cart recovery", value: 340 },
  { label: "New customer welcome", value: 142 },
  { label: "Low-stock auto-reorder", value: 128 },
  { label: "Refund approval flow", value: 54 },
];

/* ──────────────────────────────────────────────────────────────────────
 * Builder pieces
 * ─────────────────────────────────────────────────────────────────── */

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="flow-line h-8 w-0.5" />
    </div>
  );
}

function BranchConnector() {
  return (
    <svg viewBox="0 0 200 40" className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <path d="M100 0 L100 14 Q100 20 60 20 L20 20 Q10 20 10 28 L10 40" fill="none" stroke="oklch(0.84 0.14 84 / 0.4)" strokeWidth="1.5" />
      <path d="M100 0 L100 14 Q100 20 140 20 L180 20 Q190 20 190 28 L190 40" fill="none" stroke="oklch(0.84 0.14 84 / 0.4)" strokeWidth="1.5" />
    </svg>
  );
}

function Node({ kind, icon: Icon, title, subtitle }: { kind: BlockKind; icon: LucideIcon; title: string; subtitle: string }) {
  const color = kindColor[kind];
  return (
    <div className="lift relative w-full max-w-sm rounded-2xl border bg-background/50 p-4 backdrop-blur" style={{ borderColor: `color-mix(in oklch, ${color} 40%, var(--color-border))` }}>
      <span className="absolute left-0 top-4 h-8 w-1 rounded-r" style={{ background: color }} />
      <div className="flex items-center gap-3 pl-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklch, ${color} 16%, transparent)` }}>
          <Icon className="size-4" style={{ color }} />
        </span>
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color }}>{kind}</p>
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

const AUTO_INPUT = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

const TRIGGER_OPTS: { key: TriggerKey; label: string }[] = [
  { key: "order.created", label: "A new order is created" },
  { key: "customer.created", label: "A new customer is added" },
  { key: "manual", label: "Manually (run on demand)" },
];
const ACTION_OPTS: { key: ActionKey; label: string }[] = [
  { key: "ai_draft_note", label: "Draft an AI note" },
  { key: "email_owner", label: "Email the owner" },
  { key: "webhook", label: "Call a webhook" },
];
const triggerLabel = (k: string) => TRIGGER_OPTS.find((t) => t.key === k)?.label ?? k;
const actionLabel = (k: string) => ACTION_OPTS.find((a) => a.key === k)?.label ?? k;

const SAMPLE_AUTOMATIONS: NewAutomation[] = [
  { name: "Welcome new customers", trigger: triggerLabel("customer.created"), action: actionLabel("ai_draft_note"), trigger_key: "customer.created", action_key: "ai_draft_note", action_config: { prompt: "Write a warm, brief welcome note for this new customer." }, enabled: true },
  { name: "New order → AI summary", trigger: triggerLabel("order.created"), action: actionLabel("ai_draft_note"), trigger_key: "order.created", action_key: "ai_draft_note", action_config: { prompt: "Summarize this new order in one line and suggest one relevant upsell." }, enabled: true },
  { name: "New order → email owner", trigger: triggerLabel("order.created"), action: actionLabel("email_owner"), trigger_key: "order.created", action_key: "email_owner", action_config: { subject: "New order received" }, enabled: false },
];

function DashboardView() {
  const { org } = useOrg();
  const [rules, setRules] = useState<DbAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", trigger_key: "order.created" as TriggerKey, action_key: "ai_draft_note" as ActionKey, prompt: "", webhook_url: "", subject: "" });

  const load = useCallback(async () => {
    if (!org) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRules(await listAutomations(org.id));
    } catch {
      setRules([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const enabledCount = rules.filter((r) => r.enabled).length;
  const totalRuns = rules.reduce((a, r) => a + r.runs, 0);

  const toggle = async (r: DbAutomation) => {
    await setAutomationEnabled(r.id, !r.enabled);
    await load();
  };
  const submit = async () => {
    if (!org || !form.name.trim() || busy) return;
    setBusy(true);
    const action_config =
      form.action_key === "webhook" ? { webhook_url: form.webhook_url.trim() }
      : form.action_key === "email_owner" ? { subject: form.subject.trim() || `Automation: ${form.name.trim()}` }
      : { prompt: form.prompt.trim() || "Draft a short, useful note for this event." };
    await createAutomation(org.id, {
      name: form.name.trim(),
      trigger: triggerLabel(form.trigger_key),
      action: actionLabel(form.action_key),
      trigger_key: form.trigger_key,
      action_key: form.action_key,
      action_config,
    });
    setBusy(false);
    setForm({ name: "", trigger_key: "order.created", action_key: "ai_draft_note", prompt: "", webhook_url: "", subject: "" });
    setAdding(false);
    await load();
  };

  const runNow = async (r: DbAutomation) => {
    if (!org || runningId) return;
    setRunningId(r.id);
    setToast(null);
    const res = await runAutomationNow(org.id, r.id);
    setRunningId(null);
    setToast(res.ok ? `✓ "${r.name}" ran — ${res.detail ?? "done"}` : `"${r.name}" didn't run: ${res.detail ?? "error"}`);
    await load();
  };
  const seed = async () => {
    if (!org) return;
    setBusy(true);
    await insertAutomations(org.id, SAMPLE_AUTOMATIONS);
    setBusy(false);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active automations" value={enabledCount} icon={Zap} />
        <StatTile label="Total automations" value={rules.length} icon={Workflow} />
        <StatTile label="Paused" value={rules.length - enabledCount} icon={Timer} />
        <StatTile label="Total runs" value={totalRuns} icon={CheckCircle2} />
      </div>

      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative flex items-start gap-4">
            <span className="orb grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Brain className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Nervous system</p>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">{rules.length === 0 ? "Define automation rules so the business runs itself — trigger an action when something happens (a low stock level, a new customer, a big order)." : <>You have <span className="text-gold">{rules.length}</span> automation{rules.length === 1 ? "" : "s"} defined, <span className="text-gold">{enabledCount}</span> currently active. Toggle any rule on or off below.</>}</p>
            </div>
          </div>
        </GlassCard>
      </Reveal>

      <Reveal>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Workflow}>Automation rules</SectionLabel>
            <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><Plus className="size-3.5" /> New rule</button>
          </div>

          {adding && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rule name *" className={`${AUTO_INPUT} sm:col-span-2`} />
              <label className="block text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">When…</span>
                <select value={form.trigger_key} onChange={(e) => setForm((f) => ({ ...f, trigger_key: e.target.value as TriggerKey }))} className={AUTO_INPUT}>
                  {TRIGGER_OPTS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label className="block text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Do…</span>
                <select value={form.action_key} onChange={(e) => setForm((f) => ({ ...f, action_key: e.target.value as ActionKey }))} className={AUTO_INPUT}>
                  {ACTION_OPTS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </label>
              {form.action_key === "ai_draft_note" && (
                <input value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} placeholder="AI instruction (optional)" className={`${AUTO_INPUT} sm:col-span-2`} />
              )}
              {form.action_key === "webhook" && (
                <input value={form.webhook_url} onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))} placeholder="Webhook URL (https://…)" className={`${AUTO_INPUT} sm:col-span-2`} />
              )}
              {form.action_key === "email_owner" && (
                <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Email subject (optional)" className={`${AUTO_INPUT} sm:col-span-2`} />
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button onClick={submit} disabled={busy || !form.name.trim()} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Saving…" : "Create rule"}</button>
                <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}

          {toast && <p className="mt-3 rounded-xl border border-gold/25 bg-glass px-3 py-2 text-xs text-foreground/85">{toast}</p>}

          <div className="mt-4 space-y-1">
            {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading automations…</p>}
            {!loading && rules.length === 0 && !adding && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No automations yet.</p>
                <button onClick={seed} disabled={busy} className="mt-3 rounded-full border border-border bg-glass px-5 py-2 text-sm text-foreground/85 transition-colors hover:border-gold/40 disabled:opacity-60">{busy ? "Adding…" : "Add starter automations"}</button>
              </div>
            )}
            {rules.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 hover:border-border sm:grid-cols-[1.6fr_0.6fr_auto_auto]">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass"><Workflow className="size-4 text-gold" /></span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{r.name}</p><p className="truncate text-xs text-muted-foreground">{r.trigger ?? "—"}{r.action ? ` → ${r.action}` : ""}</p></div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{formatNum(r.runs)} runs</span>
                <button onClick={() => runNow(r)} disabled={runningId === r.id} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:border-gold/40 disabled:opacity-50">
                  {runningId === r.id ? "Running…" : "Run"}
                </button>
                <button onClick={() => toggle(r)} className={cn("relative h-6 w-11 shrink-0 rounded-full border transition-colors", r.enabled ? "border-transparent" : "border-border bg-background/40")} style={r.enabled ? { background: "var(--gradient-gold)" } : undefined} aria-pressed={r.enabled} title={r.enabled ? "Enabled — click to pause" : "Paused — click to enable"}>
                  <span className="absolute top-0.5 size-5 rounded-full transition-all" style={{ left: r.enabled ? "1.375rem" : "0.125rem", background: r.enabled ? "oklch(0.2 0.02 70)" : "oklch(0.8 0.015 85)" }} />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function BuilderView() {
  const [extraActions, setExtraActions] = useState<{ label: string; icon: LucideIcon }[]>([]);
  const addAction = (label: string, icon: LucideIcon) => setExtraActions((a) => [...a, { label, icon }]);
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      {/* palette */}
      <Reveal>
        <GlassCard className="p-5">
          <p className="text-sm font-semibold">Blocks</p>
          <p className="mt-1 text-xs text-muted-foreground">Click an action to add it to the flow.</p>
          {(["trigger", "decision", "action"] as BlockKind[]).map((kind) => (
            <div key={kind} className="mt-4">
              <p className="mb-2 text-[0.65rem] uppercase tracking-wide" style={{ color: kindColor[kind] }}>{kind}s</p>
              <div className="space-y-1.5">
                {palette.filter((b) => b.kind === kind).map((b) => (
                  <button key={b.label} onClick={() => kind === "action" && addAction(b.label, b.icon)} className={cn("flex w-full items-center gap-2.5 rounded-xl border border-border bg-background/30 px-3 py-2 text-left text-sm text-foreground/85 transition-colors", kind === "action" ? "hover:border-gold/40 hover:text-foreground" : "opacity-90")}>
                    <b.icon className="size-4" style={{ color: kindColor[b.kind] }} />
                    <span className="flex-1 truncate">{b.label}</span>
                    {kind === "action" && <Plus className="size-3.5 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </GlassCard>
      </Reveal>

      {/* canvas */}
      <Reveal delay={80}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <SectionLabel icon={GitBranch}>Low-stock auto-reorder</SectionLabel>
            <button className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><Zap className="size-3.5" /> Activate</button>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <Node kind="trigger" icon={Boxes} title="Stock below reorder point" subtitle="Trigger · inventory" />
            <Connector />
            <Node kind="decision" icon={Brain} title="AI checks demand forecast" subtitle="Decision · is demand rising?" />
            <BranchConnector />
            <div className="grid w-full gap-4 sm:grid-cols-2">
              <div className="flex flex-col items-center gap-0">
                <span className="mb-2 rounded-full px-2 py-0.5 text-[0.6rem] font-medium text-emerald-300" style={{ background: "oklch(0.72 0.14 155 / 14%)" }}>If rising</span>
                <Node kind="action" icon={FileText} title="Create purchase order" subtitle="Action · Northwind Supply" />
                <Connector />
                <Node kind="action" icon={Bell} title="Notify supplier & Slack" subtitle="Action · #ops channel" />
                {extraActions.map((a, i) => (
                  <div key={i} className="flex w-full flex-col items-center"><Connector /><Node kind="action" icon={a.icon} title={a.label} subtitle="Action · added" /></div>
                ))}
              </div>
              <div className="flex flex-col items-center">
                <span className="mb-2 rounded-full px-2 py-0.5 text-[0.6rem] font-medium text-muted-foreground" style={{ background: "oklch(0.7 0.02 250 / 14%)" }}>If flat</span>
                <Node kind="action" icon={Timer} title="Add to watchlist" subtitle="Action · recheck in 3 days" />
              </div>
            </div>
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

const creatorPrompts = ["When a customer is at churn risk, send them an offer", "Every morning, email me a revenue summary", "When an order is over $500, ask me to approve it"];

function CreatorView() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<{ kind: BlockKind; icon: LucideIcon; title: string }[] | null>(null);
  const generate = (text: string) => {
    const q = text.trim(); if (!q) return;
    setBusy(true); setFlow(null); setInput(q);
    window.setTimeout(() => {
      const s = q.toLowerCase();
      let built: { kind: BlockKind; icon: LucideIcon; title: string }[];
      if (s.includes("churn") || s.includes("offer")) built = [{ kind: "trigger", icon: Users, title: "Customer risk score > 70" }, { kind: "decision", icon: Brain, title: "AI picks the best offer" }, { kind: "action", icon: Mail, title: "Send personalized win-back email" }];
      else if (s.includes("morning") || s.includes("summary") || s.includes("email me")) built = [{ kind: "trigger", icon: Calendar, title: "Every day at 6:00 AM" }, { kind: "decision", icon: Brain, title: "AI writes the summary" }, { kind: "action", icon: Mail, title: "Email the revenue digest" }];
      else if (s.includes("approve") || s.includes("$")) built = [{ kind: "trigger", icon: ShoppingCart, title: "New order placed" }, { kind: "decision", icon: Split, title: "If order total > $500" }, { kind: "action", icon: ClipboardCheck, title: "Request your approval" }];
      else built = [{ kind: "trigger", icon: Zap, title: "When the event happens" }, { kind: "decision", icon: Brain, title: "AI decides what to do" }, { kind: "action", icon: Send, title: "Run the right action" }];
      setFlow(built); setBusy(false);
    }, 1400);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2"><Wand2 className="size-4 text-gold" /><p className="text-sm font-semibold">Describe an automation</p></div>
            <p className="mt-2 text-sm text-muted-foreground">Tell me what should happen — I'll build the workflow.</p>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="When a customer leaves a 5-star review, thank them and offer a referral reward…" className="mt-4 w-full resize-none rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm text-foreground outline-none focus:border-gold/50" />
            <button onClick={() => generate(input)} disabled={busy || !input.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}><Sparkles className="size-4" /> {busy ? "Building…" : "Generate workflow"}</button>
            <div className="mt-4 flex flex-wrap gap-2">
              {creatorPrompts.map((p) => (<button key={p} onClick={() => generate(p)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">{p}</button>))}
            </div>
          </div>
        </GlassCard>
      </Reveal>

      <Reveal delay={80}>
        <GlassCard className="flex min-h-[22rem] flex-col p-6">
          <SectionLabel icon={GitBranch}>Generated workflow</SectionLabel>
          <div className="mt-5 flex-1">
            {busy && <div className="typing flex items-center gap-1 py-4"><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /><span className="size-1.5 rounded-full bg-gold" /></div>}
            {!busy && flow && (
              <div className="flex flex-col items-center">
                {flow.map((n, i) => (
                  <div key={i} className="flex w-full flex-col items-center">
                    {i > 0 && <Connector />}
                    <Node kind={n.kind} icon={n.icon} title={n.title} subtitle={`${n.kind} · AI-generated`} />
                  </div>
                ))}
                <button className="mt-5 flex items-center gap-2 rounded-full border border-gold/30 bg-glass px-4 py-2 text-xs font-semibold text-foreground/85 transition-colors hover:border-gold/60"><GitBranch className="size-3.5 text-gold" /> Open in builder</button>
              </div>
            )}
            {!busy && !flow && <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">Describe an automation and I'll draft the workflow.</p>}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function TemplatesView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((t, i) => (
        <Reveal key={t.name} delay={i * 50} className="h-full">
          <GlassCard className="lift flex h-full flex-col p-6 hover:border-gold/40">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-2xl border border-border bg-glass"><t.icon className="size-5 text-gold" /></span>
              <span className="rounded-full border border-border bg-glass px-2.5 py-0.5 text-[0.65rem] text-muted-foreground">{t.cat}</span>
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">{t.name}</p>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t.steps} steps</span>
              <button className="rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>Use template</button>
            </div>
          </GlassCard>
        </Reveal>
      ))}
    </div>
  );
}

function ApprovalsView() {
  const [items, setItems] = useState(seedApprovals);
  const [resolved, setResolved] = useState<{ title: string; ok: boolean }[]>([]);
  const resolve = (title: string, ok: boolean) => {
    setItems((its) => its.filter((i) => i.title !== title));
    setResolved((r) => [{ title, ok }, ...r]);
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Pending approvals" value={items.length} icon={ClipboardCheck} />
        <StatTile label="Approved today" value={resolved.filter((r) => r.ok).length + 6} icon={CheckCircle2} />
        <StatTile label="Avg response" value={4} suffix=" min" icon={Timer} />
      </div>
      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={ClipboardCheck}>Waiting for you</SectionLabel>
          <div className="mt-4 space-y-2">
            {items.map((a) => (
              <div key={a.title} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-background/30 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-glass"><a.icon className="size-4 text-gold" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail} · <span className="text-gold">{a.from}</span></p></div>
                <div className="flex gap-2">
                  <button onClick={() => resolve(a.title, false)} className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-rose-400/50 hover:text-rose-300">Reject</button>
                  <button onClick={() => resolve(a.title, true)} className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><CheckCircle2 className="size-3.5" /> Approve</button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">All caught up — nothing needs your approval. 🎉</p>}
          </div>
          {resolved.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Just resolved</p>
              <div className="mt-2 space-y-1">
                {resolved.map((r, i) => (
                  <p key={i} className="flex items-center gap-2 text-sm text-foreground/80">{r.ok ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <XCircle className="size-3.5 text-rose-300" />} {r.title} — <span className={r.ok ? "text-emerald-300" : "text-rose-300"}>{r.ok ? "approved" : "rejected"}</span></p>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </Reveal>
    </div>
  );
}

function HistoryView() {
  return (
    <Reveal>
      <GlassCard className="p-6">
        <SectionLabel icon={Clock}>Execution history</SectionLabel>
        <div className="mt-4 space-y-1">
          {historyLog.map((h, i) => {
            const st = runStatus[h.status];
            return (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl px-2 py-3 sm:grid-cols-[auto_1.6fr_1fr_auto_auto]">
                <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklch, ${st.color} 15%, transparent)` }}><st.icon className="size-4" style={{ color: st.color }} /></span>
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{h.name}</p><p className="truncate text-xs text-muted-foreground">{h.trigger}</p></div>
                <span className="hidden text-xs sm:block" style={{ color: st.color }}>{st.label}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{h.dur}</span>
                <span className="text-right text-xs text-muted-foreground">{h.time}</span>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function AnalyticsBars({ data }: { data: number[] }) {
  const { ref, inView } = useInView();
  const max = Math.max(...data);
  return (
    <div ref={ref} className="flex items-end gap-1.5" style={{ height: 160 }}>
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col justify-end">
          <div className="rounded-t-md transition-all duration-700 ease-out" style={{ height: inView ? `${(v / max) * 100}%` : "0%", transitionDelay: `${i * 40}ms`, background: i === data.length - 1 ? "var(--gradient-gold)" : "oklch(0.84 0.14 84 / 22%)" }} />
        </div>
      ))}
    </div>
  );
}

function AnalyticsView() {
  const maxTop = Math.max(...topAutomations.map((t) => t.value));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total runs (mo)" value={3482} delta="14%" icon={Zap} />
        <StatTile label="Time saved (mo)" value={186} suffix=" hrs" delta="22 hrs" icon={Timer} />
        <StatTile label="Success rate" value={98.2} suffix="%" decimals={1} delta="0.4 pts" icon={CheckCircle2} />
        <StatTile label="Avg run time" value={1.8} suffix="s" decimals={1} delta="0.3s" positive icon={Clock} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Reveal className="h-full">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="flex items-baseline justify-between"><SectionLabel icon={BarChart3}>Runs per month</SectionLabel><span className="text-xs text-muted-foreground">Last 12 months</span></div>
            <div className="mt-6"><AnalyticsBars data={runsSeries} /></div>
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="flex h-full flex-col p-6">
            <SectionLabel icon={Workflow}>Top automations by runs</SectionLabel>
            <div className="mt-5 space-y-4">
              {topAutomations.map((t) => (
                <div key={t.label}>
                  <div className="flex items-baseline justify-between text-sm"><span className="truncate text-foreground/85">{t.label}</span><span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{formatNum(t.value)}</span></div>
                  <div className="mt-1.5"><Bar value={(t.value / maxTop) * 100} /></div>
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
  dashboard: { title: "Automation Center", sub: "The nervous system of your business" },
  builder: { title: "Workflow builder", sub: "Design flows visually" },
  creator: { title: "AI workflow creator", sub: "Describe it, I'll build it" },
  templates: { title: "Automation templates", sub: "Start from a proven flow" },
  approvals: { title: "Approval center", sub: "One tap to keep things moving" },
  history: { title: "Execution history", sub: "Every run, logged" },
  analytics: { title: "Automation analytics", sub: "The work your OS did for you" },
};

export function AutomationWorkspace() {
  const [active, setActive] = useState<ViewKey>("dashboard");
  const meta = viewMeta[active];
  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 flex items-center gap-1.5 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-gold"><Workflow className="size-3" /> Automation</p>
        <nav className="mt-2 space-y-1 overflow-y-auto">
          {views.map((v) => (
            <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active === v.key ? "text-foreground" : "text-muted-foreground hover:bg-glass hover:text-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
              <v.icon className={cn("size-4", active === v.key && "text-gold")} />
              {v.label}
            </button>
          ))}
        </nav>
        <Link to="/dashboard" className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-glass hover:text-foreground">
          <ArrowLeft className="size-4" /> Command center
        </Link>
      </aside>

      <section className="min-w-0 flex-1 space-y-5">
        <div className="rise flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{meta.sub}</p>
            <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}><span className="gold-text italic">{meta.title}</span></h1>
          </div>
          <button onClick={() => setActive("creator")} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
            <Wand2 className="size-4" stroke="oklch(0.2 0.02 70)" /> New automation
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
          {active === "dashboard" && <DashboardView />}
          {active === "builder" && <BuilderView />}
          {active === "creator" && <CreatorView />}
          {active === "templates" && <TemplatesView />}
          {active === "approvals" && <ApprovalsView />}
          {active === "history" && <HistoryView />}
          {active === "analytics" && <AnalyticsView />}
        </div>
      </section>
    </div>
  );
}
