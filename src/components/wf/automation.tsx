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
  Pencil,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
  Split,
  Timer,
  Users,
  Wand2,
  Workflow,
  X,
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
import { askAI } from "@/lib/ai";
import { createAutomation, deleteAutomation, insertAutomations, listAutomations, listExecutions, listPendingApprovals, listResolvedApprovals, resolveApproval, runAutomationNow, setAutomationEnabled, updateAutomation, type ActionKey, type ApprovalRun, type DbAutomation, type DbExecution, type NewAutomation, type TriggerKey, type WorkflowStep } from "@/lib/automations";

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


// Real, immediately-deployable templates — each maps to an actual trigger/action
// this engine supports today (no illustrative capabilities like "low stock" or
// "abandoned cart" that don't exist yet). "Use template" creates a real rule.
type Template = {
  name: string;
  cat: string;
  icon: LucideIcon;
  desc: string;
  trigger_key: TriggerKey;
  action_key: ActionKey;
  action_config: Record<string, unknown>;
  steps: WorkflowStep[] | null;
};
const templates: Template[] = [
  {
    name: "Welcome new customers",
    cat: "CRM",
    icon: Users,
    desc: "AI drafts an internal welcome note the moment a customer is added.",
    trigger_key: "customer.created",
    action_key: "ai_draft_note",
    action_config: { prompt: "Write a warm, brief welcome note for this new customer." },
    steps: null,
  },
  {
    name: "Welcome email to customer",
    cat: "CRM",
    icon: Mail,
    desc: "Sends a real branded welcome email the moment a customer is added.",
    trigger_key: "customer.created",
    action_key: "email_customer",
    action_config: { subject: "Welcome aboard!", prompt: "Write a short, warm welcome email thanking them for becoming a customer." },
    steps: null,
  },
  {
    name: "New order → AI summary",
    cat: "Sales",
    icon: ShoppingCart,
    desc: "AI summarizes each new order and flags a relevant upsell.",
    trigger_key: "order.created",
    action_key: "ai_draft_note",
    action_config: { prompt: "Summarize this new order in one line and suggest one relevant upsell." },
    steps: null,
  },
  {
    name: "Big order alert",
    cat: "Sales",
    icon: AlertTriangle,
    desc: "Emails you only when an order tops $500 — a condition step, not noise.",
    trigger_key: "order.created",
    action_key: "ai_draft_note",
    action_config: {},
    steps: [
      { kind: "condition", field: "total", op: ">", value: 500 },
      { kind: "action", action_key: "email_owner", action_config: { subject: "Big order received!" } },
    ],
  },
  {
    name: "Thank-you + review request",
    cat: "Finance",
    icon: Timer,
    desc: "Thanks the client when an invoice is paid, waits a week, then asks for a review.",
    trigger_key: "invoice.paid",
    action_key: "ai_draft_note",
    action_config: {},
    steps: [
      { kind: "action", action_key: "email_customer", action_config: { subject: "Thank you for your business!", prompt: "Write a short, warm thank-you email for this payment." } },
      { kind: "wait", hours: 168 },
      { kind: "action", action_key: "email_customer", action_config: { subject: "How did we do?", prompt: "Write a short, friendly email asking for a review or testimonial." } },
    ],
  },
  {
    name: "Notify owner of paid invoice",
    cat: "Finance",
    icon: Bell,
    desc: "Emails you the moment a client pays an invoice.",
    trigger_key: "invoice.paid",
    action_key: "email_owner",
    action_config: { subject: "Invoice paid 🎉" },
    steps: null,
  },
];

// Real status derived from an execution's ok/detail — "pending" covers both a
// timer wait and an awaiting-approval pause (both report ok:true with a
// recognisable detail string), distinct from a fully completed "success".
type RunStatus = "success" | "failed" | "pending";
function statusOf(e: { ok: boolean; detail: string | null }): RunStatus {
  if (!e.ok) return "failed";
  if (/paused|awaiting approval/i.test(e.detail ?? "")) return "pending";
  return "success";
}
const runStatusMeta: Record<RunStatus, { color: string; icon: LucideIcon; label: string }> = {
  success: { color: "oklch(0.72 0.14 155)", icon: CheckCircle2, label: "Success" },
  failed: { color: "oklch(0.68 0.16 25)", icon: XCircle, label: "Failed" },
  pending: { color: "oklch(0.84 0.14 84)", icon: ClipboardCheck, label: "Paused" },
};
function historyTimeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

function Node({
  kind,
  icon: Icon,
  title,
  subtitle,
  selected,
  onSelect,
  onRemove,
}: {
  kind: BlockKind;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}) {
  const color = kindColor[kind];
  const interactive = !!onSelect;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group lift relative w-full max-w-sm rounded-2xl border bg-background/50 p-4 backdrop-blur transition-shadow",
        interactive && "cursor-pointer",
      )}
      style={{
        borderColor: selected ? color : `color-mix(in oklch, ${color} 40%, var(--color-border))`,
        boxShadow: selected ? `0 0 0 2px color-mix(in oklch, ${color} 55%, transparent)` : undefined,
      }}
    >
      <span className="absolute left-0 top-4 h-8 w-1 rounded-r" style={{ background: color }} />
      <div className="flex items-center gap-3 pl-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklch, ${color} 16%, transparent)` }}>
          <Icon className="size-4" style={{ color }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color }}>{kind}</p>
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Remove"
            className="shrink-0 rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
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
  { key: "invoice.paid", label: "An invoice is paid" },
  { key: "manual", label: "Manually (run on demand)" },
];
const ACTION_OPTS: { key: ActionKey; label: string; sends?: boolean }[] = [
  { key: "ai_draft_note", label: "Draft an AI note (internal only)" },
  { key: "email_owner", label: "Email the owner" },
  { key: "email_customer", label: "Email the customer", sends: true },
  { key: "webhook", label: "Call a webhook" },
];
const triggerLabel = (k: string) => TRIGGER_OPTS.find((t) => t.key === k)?.label ?? k;
const actionLabel = (k: string) => ACTION_OPTS.find((a) => a.key === k)?.label ?? k;

type StepKind = "action" | "wait" | "condition" | "approval";
type WaitUnit = "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years";
const WAIT_UNITS: { key: WaitUnit; label: string; toHours: number }[] = [
  { key: "seconds", label: "Seconds", toHours: 1 / 3600 },
  { key: "minutes", label: "Minutes", toHours: 1 / 60 },
  { key: "hours", label: "Hours", toHours: 1 },
  { key: "days", label: "Days", toHours: 24 },
  { key: "weeks", label: "Weeks", toHours: 24 * 7 },
  { key: "months", label: "Months (~30d)", toHours: 24 * 30 },
  { key: "years", label: "Years (~365d)", toHours: 24 * 365 },
];
const waitUnitHours = (unit: WaitUnit) => WAIT_UNITS.find((u) => u.key === unit)?.toHours ?? 1;

type StepDraft = { id: string; kind: StepKind; action_key: ActionKey; prompt: string; subject: string; webhook_url: string; waitAmount: string; waitUnit: WaitUnit; field: string; op: "<" | ">" | "=" | ">=" | "<="; value: string; note: string };
// A rule handed off from the AI creator into the Dashboard's create form.
type PrefillDraft = { name: string; trigger_key: TriggerKey; steps: StepDraft[] };
let stepSeq = 0;
const newStepDraft = (kind: StepKind = "action"): StepDraft => ({
  id: `s${++stepSeq}`, kind, action_key: "ai_draft_note", prompt: "", subject: "", webhook_url: "", waitAmount: "1", waitUnit: "hours", field: "total", op: ">", value: "0", note: "",
});
function draftsToSteps(drafts: StepDraft[]): WorkflowStep[] {
  return drafts.map((sd) => {
    if (sd.kind === "wait") return { kind: "wait", hours: Math.max(0, (Number(sd.waitAmount) || 0) * waitUnitHours(sd.waitUnit)) };
    if (sd.kind === "condition") return { kind: "condition", field: sd.field.trim() || "total", op: sd.op, value: Number(sd.value) || 0 };
    if (sd.kind === "approval") return { kind: "approval", note: sd.note.trim() || undefined };
    const action_config =
      sd.action_key === "webhook" ? { webhook_url: sd.webhook_url.trim() }
      : sd.action_key === "email_owner" ? { subject: sd.subject.trim() || undefined }
      : sd.action_key === "email_customer" ? { subject: sd.subject.trim() || undefined, prompt: sd.prompt.trim() || undefined }
      : { prompt: sd.prompt.trim() || undefined };
    return { kind: "action", action_key: sd.action_key, action_config };
  });
}
// Reverse of draftsToSteps, used to populate the editor from a saved rule. The
// original unit chosen for a wait isn't stored (only hours), so pick whichever
// unit gives the cleanest round number back.
// Picks the cleanest wait unit back from stored hours (used both when loading a
// saved rule for editing, and when the AI creator hands off a generated wait step).
function hoursToDraft(h: number): { waitAmount: string; waitUnit: WaitUnit } {
  let unit: WaitUnit = "hours";
  let amount = h;
  if (h > 0 && h % (24 * 365) === 0) { unit = "years"; amount = h / (24 * 365); }
  else if (h > 0 && h % (24 * 30) === 0) { unit = "months"; amount = h / (24 * 30); }
  else if (h > 0 && h % (24 * 7) === 0) { unit = "weeks"; amount = h / (24 * 7); }
  else if (h > 0 && h % 24 === 0) { unit = "days"; amount = h / 24; }
  else if (h < 1 / 60) { unit = "seconds"; amount = Math.round(h * 3600); }
  else if (h < 1) { unit = "minutes"; amount = Math.round(h * 60 * 100) / 100; }
  return { waitAmount: String(Math.round(amount * 1000) / 1000), waitUnit: unit };
}

function stepsToDrafts(stepsIn: WorkflowStep[]): StepDraft[] {
  return stepsIn.map((s) => {
    const base = newStepDraft(s.kind);
    if (s.kind === "wait") return { ...base, ...hoursToDraft(s.hours) };
    if (s.kind === "condition") return { ...base, field: s.field, op: s.op, value: String(s.value) };
    if (s.kind === "approval") return { ...base, note: s.note ?? "" };
    const cfg = s.action_config ?? {};
    return {
      ...base,
      action_key: s.action_key,
      prompt: typeof cfg.prompt === "string" ? cfg.prompt : "",
      subject: typeof cfg.subject === "string" ? cfg.subject : "",
      webhook_url: typeof cfg.webhook_url === "string" ? cfg.webhook_url : "",
    };
  });
}

const SAMPLE_AUTOMATIONS: NewAutomation[] = [
  { name: "Welcome new customers", trigger: triggerLabel("customer.created"), action: actionLabel("ai_draft_note"), trigger_key: "customer.created", action_key: "ai_draft_note", action_config: { prompt: "Write a warm, brief welcome note for this new customer." }, enabled: true },
  { name: "New order → AI summary", trigger: triggerLabel("order.created"), action: actionLabel("ai_draft_note"), trigger_key: "order.created", action_key: "ai_draft_note", action_config: { prompt: "Summarize this new order in one line and suggest one relevant upsell." }, enabled: true },
  { name: "New order → email owner", trigger: triggerLabel("order.created"), action: actionLabel("email_owner"), trigger_key: "order.created", action_key: "email_owner", action_config: { subject: "New order received" }, enabled: false },
];

function DashboardView({ prefill, onConsumePrefill }: { prefill: PrefillDraft | null; onConsumePrefill: () => void }) {
  const { org } = useOrg();
  const [rules, setRules] = useState<DbAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", trigger_key: "order.created" as TriggerKey, action_key: "ai_draft_note" as ActionKey, prompt: "", webhook_url: "", subject: "" });
  const [multiStep, setMultiStep] = useState(false);
  const [steps, setSteps] = useState<StepDraft[]>([newStepDraft()]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // A workflow handed off from the AI creator — open the form pre-filled, ready to review + save.
  useEffect(() => {
    if (!prefill) return;
    setEditingId(null);
    setForm({ name: prefill.name, trigger_key: prefill.trigger_key, action_key: "ai_draft_note", prompt: "", webhook_url: "", subject: "" });
    setSteps(prefill.steps.length ? prefill.steps : [newStepDraft()]);
    setMultiStep(true);
    setAdding(true);
    onConsumePrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

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
  const addStep = (kind: StepKind) => setSteps((s) => [...s, newStepDraft(kind)]);
  const removeStep = (id: string) => setSteps((s) => s.filter((st) => st.id !== id));
  const updateStep = (id: string, patch: Partial<StepDraft>) => setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));

  const resetForm = () => {
    setForm({ name: "", trigger_key: "order.created", action_key: "ai_draft_note", prompt: "", webhook_url: "", subject: "" });
    setSteps([newStepDraft()]);
    setMultiStep(false);
    setEditingId(null);
  };

  const submit = async () => {
    if (!org || !form.name.trim() || busy) return;
    setBusy(true);
    const built = multiStep ? draftsToSteps(steps) : null;
    const action_config = multiStep ? {} :
      form.action_key === "webhook" ? { webhook_url: form.webhook_url.trim() }
      : form.action_key === "email_owner" ? { subject: form.subject.trim() || `Automation: ${form.name.trim()}` }
      : form.action_key === "email_customer" ? { subject: form.subject.trim() || undefined, prompt: form.prompt.trim() || "Write a short, warm email to this customer for this event." }
      : { prompt: form.prompt.trim() || "Draft a short, useful note for this event." };
    const payload: NewAutomation = {
      name: form.name.trim(),
      trigger: triggerLabel(form.trigger_key),
      action: multiStep ? `Multi-step workflow (${built!.length} step${built!.length === 1 ? "" : "s"})` : actionLabel(form.action_key),
      trigger_key: form.trigger_key,
      action_key: multiStep ? "ai_draft_note" : form.action_key,
      action_config,
      steps: built,
    };
    if (editingId) await updateAutomation(editingId, payload);
    else await createAutomation(org.id, payload);
    setBusy(false);
    resetForm();
    setAdding(false);
    await load();
  };

  const openNew = () => {
    if (adding && !editingId) { setAdding(false); return; }
    resetForm();
    setAdding(true);
  };

  const startEdit = (r: DbAutomation) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      trigger_key: r.trigger_key,
      action_key: r.action_key,
      prompt: typeof r.action_config?.prompt === "string" ? r.action_config.prompt : "",
      webhook_url: typeof r.action_config?.webhook_url === "string" ? r.action_config.webhook_url : "",
      subject: typeof r.action_config?.subject === "string" ? r.action_config.subject : "",
    });
    if (r.steps && r.steps.length > 0) {
      setMultiStep(true);
      setSteps(stepsToDrafts(r.steps));
    } else {
      setMultiStep(false);
      setSteps([newStepDraft()]);
    }
    setAdding(true);
  };

  const remove = async (r: DbAutomation) => {
    await deleteAutomation(r.id);
    if (editingId === r.id) { resetForm(); setAdding(false); }
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
            <button onClick={openNew} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}><Plus className="size-3.5" /> New rule</button>
          </div>

          {adding && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-2">
              {editingId && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-gold sm:col-span-2"><Pencil className="size-3.5" /> Editing rule</p>
              )}
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rule name *" className={`${AUTO_INPUT} sm:col-span-2`} />
              <label className="block text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">When…</span>
                <select value={form.trigger_key} onChange={(e) => setForm((f) => ({ ...f, trigger_key: e.target.value as TriggerKey }))} className={AUTO_INPUT}>
                  {TRIGGER_OPTS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              {!multiStep && (
                <label className="block text-xs"><span className="mb-1 block uppercase tracking-wide text-muted-foreground">Do…</span>
                  <select value={form.action_key} onChange={(e) => setForm((f) => ({ ...f, action_key: e.target.value as ActionKey }))} className={AUTO_INPUT}>
                    {ACTION_OPTS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </label>
              )}
              <label className={cn("flex cursor-pointer items-center gap-2 text-xs", multiStep ? "sm:col-span-2" : "")}>
                <input type="checkbox" checked={multiStep} onChange={(e) => setMultiStep(e.target.checked)} className="size-4 accent-[oklch(0.84_0.14_84)]" />
                <span className={multiStep ? "text-gold" : "text-muted-foreground"}>Multi-step workflow — sequence actions, add waits &amp; conditions</span>
              </label>

              {!multiStep && (
                <>
                  {form.action_key === "ai_draft_note" && (
                    <input value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} placeholder="AI instruction (optional)" className={`${AUTO_INPUT} sm:col-span-2`} />
                  )}
                  {form.action_key === "webhook" && (
                    <input value={form.webhook_url} onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))} placeholder="Webhook URL (https://…)" className={`${AUTO_INPUT} sm:col-span-2`} />
                  )}
                  {form.action_key === "email_owner" && (
                    <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Email subject (optional)" className={`${AUTO_INPUT} sm:col-span-2`} />
                  )}
                  {form.action_key === "email_customer" && (
                    <>
                      <div className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/5 p-3 text-xs text-foreground/85 sm:col-span-2">
                        <Mail className="mt-0.5 size-3.5 shrink-0 text-gold" />
                        This sends a real email to the customer's inbox as soon as the trigger fires — no review step. Test with "Run now" on a customer whose email you control first.
                      </div>
                      <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Email subject (optional)" className={AUTO_INPUT} />
                      <input value={form.prompt} onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))} placeholder="What should the email say? (optional)" className={AUTO_INPUT} />
                    </>
                  )}
                </>
              )}

              {multiStep && (
                <div className="space-y-2.5 rounded-xl border border-border bg-background/20 p-3 sm:col-span-2">
                  <div className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/5 p-3 text-xs text-foreground/85">
                    <GitBranch className="mt-0.5 size-3.5 shrink-0 text-gold" />
                    Steps run in order. A <b>wait</b> pauses the rest of the flow and resumes later on its own — no need to keep this open. A failed <b>condition</b> stops the flow there.
                  </div>
                  {steps.map((sd, i) => (
                    <div key={sd.id} className="rounded-xl border border-border bg-background/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Step {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <select value={sd.kind} onChange={(e) => updateStep(sd.id, { kind: e.target.value as StepKind })} className="rounded-lg border border-border bg-background/40 px-2 py-1 text-xs text-foreground outline-none focus:border-gold/50">
                            <option value="action">Action</option>
                            <option value="wait">Wait</option>
                            <option value="condition">Condition</option>
                            <option value="approval">Approval</option>
                          </select>
                          <button onClick={() => removeStep(sd.id)} disabled={steps.length === 1} title="Remove step" className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-40"><X className="size-3.5" /></button>
                        </div>
                      </div>

                      {sd.kind === "action" && (
                        <div className="mt-2 space-y-2">
                          <select value={sd.action_key} onChange={(e) => updateStep(sd.id, { action_key: e.target.value as ActionKey })} className={AUTO_INPUT}>
                            {ACTION_OPTS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                          </select>
                          {sd.action_key === "webhook" && (
                            <input value={sd.webhook_url} onChange={(e) => updateStep(sd.id, { webhook_url: e.target.value })} placeholder="Webhook URL (https://…)" className={AUTO_INPUT} />
                          )}
                          {(sd.action_key === "email_owner" || sd.action_key === "email_customer") && (
                            <input value={sd.subject} onChange={(e) => updateStep(sd.id, { subject: e.target.value })} placeholder="Email subject (optional)" className={AUTO_INPUT} />
                          )}
                          {(sd.action_key === "ai_draft_note" || sd.action_key === "email_customer") && (
                            <input value={sd.prompt} onChange={(e) => updateStep(sd.id, { prompt: e.target.value })} placeholder={sd.action_key === "email_customer" ? "What should the email say? (optional)" : "AI instruction (optional)"} className={AUTO_INPUT} />
                          )}
                        </div>
                      )}

                      {sd.kind === "wait" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Wait</span>
                          <input type="number" min={0} step="any" value={sd.waitAmount} onChange={(e) => updateStep(sd.id, { waitAmount: e.target.value })} className={cn(AUTO_INPUT, "w-24")} />
                          <select value={sd.waitUnit} onChange={(e) => updateStep(sd.id, { waitUnit: e.target.value as WaitUnit })} className="rounded-xl border border-border bg-background/40 px-2 py-2.5 text-sm text-foreground outline-none focus:border-gold/50">
                            {WAIT_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
                          </select>
                          <span className="text-xs text-muted-foreground">before continuing (≈ {formatNum(Math.round((Number(sd.waitAmount) || 0) * waitUnitHours(sd.waitUnit) * 10) / 10)} hours)</span>
                        </div>
                      )}

                      {sd.kind === "condition" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Only continue if</span>
                          <input value={sd.field} onChange={(e) => updateStep(sd.id, { field: e.target.value })} placeholder="field (e.g. total)" className={cn(AUTO_INPUT, "w-36")} />
                          <select value={sd.op} onChange={(e) => updateStep(sd.id, { op: e.target.value as StepDraft["op"] })} className="rounded-xl border border-border bg-background/40 px-2 py-2.5 text-sm text-foreground outline-none focus:border-gold/50">
                            {[">", "<", "=", ">=", "<="].map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <input type="number" value={sd.value} onChange={(e) => updateStep(sd.id, { value: e.target.value })} className={cn(AUTO_INPUT, "w-24")} />
                        </div>
                      )}

                      {sd.kind === "approval" && (
                        <div className="mt-2 space-y-1.5">
                          <input value={sd.note} onChange={(e) => updateStep(sd.id, { note: e.target.value })} placeholder="What should the approver decide on? (optional)" className={AUTO_INPUT} />
                          <p className="text-[0.7rem] text-muted-foreground">Pauses here until someone approves or rejects it in the Approval center. Approving continues to the next step; rejecting stops the workflow.</p>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addStep("action")} className="flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-gold/40"><Plus className="size-3.5" /> Action</button>
                    <button onClick={() => addStep("wait")} className="flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-gold/40"><Timer className="size-3.5" /> Wait</button>
                    <button onClick={() => addStep("condition")} className="flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-gold/40"><Split className="size-3.5" /> Condition</button>
                    <button onClick={() => addStep("approval")} className="flex items-center gap-1.5 rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-gold/40"><ClipboardCheck className="size-3.5" /> Approval</button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 sm:col-span-2">
                <button onClick={submit} disabled={busy || !form.name.trim()} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Saving…" : editingId ? "Save changes" : "Create rule"}</button>
                <button onClick={() => { setAdding(false); resetForm(); }} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
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
              <div key={r.id} className="group grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 hover:border-border sm:grid-cols-[1.6fr_0.6fr_auto_auto_auto_auto]">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl border border-border bg-glass">{r.steps?.length ? <GitBranch className="size-4 text-gold" /> : <Workflow className="size-4 text-gold" />}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{r.name}</p><p className="truncate text-xs text-muted-foreground">{r.trigger ?? "—"}{r.action ? ` → ${r.action}` : ""}</p></div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{formatNum(r.runs)} runs</span>
                <button onClick={() => runNow(r)} disabled={runningId === r.id} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:border-gold/40 disabled:opacity-50">
                  {runningId === r.id ? "Running…" : "Run"}
                </button>
                <button onClick={() => toggle(r)} className={cn("relative h-6 w-11 shrink-0 rounded-full border transition-colors", r.enabled ? "border-transparent" : "border-border bg-background/40")} style={r.enabled ? { background: "var(--gradient-gold)" } : undefined} aria-pressed={r.enabled} title={r.enabled ? "Enabled — click to pause" : "Paused — click to enable"}>
                  <span className="absolute top-0.5 size-5 rounded-full transition-all" style={{ left: r.enabled ? "1.375rem" : "0.125rem", background: r.enabled ? "oklch(0.2 0.02 70)" : "oklch(0.8 0.015 85)" }} />
                </button>
                <button onClick={() => startEdit(r)} aria-label="Edit rule" className="hidden size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground opacity-0 transition-opacity hover:border-gold/40 hover:text-foreground group-hover:opacity-100 sm:grid">
                  <Pencil className="size-3.5" />
                </button>
                <button onClick={() => remove(r)} aria-label="Delete rule" className="hidden size-7 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground opacity-0 transition-opacity hover:border-rose-400/50 hover:text-rose-300 group-hover:opacity-100 sm:grid">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

type CanvasBlock = { id: string; kind: BlockKind; label: string; icon: LucideIcon; subtitle: string };
let blockSeq = 0;
const newBlockId = () => `b${++blockSeq}`;

const DEFAULT_CANVAS: CanvasBlock[] = [
  { id: newBlockId(), kind: "trigger", label: "Stock below reorder point", icon: Boxes, subtitle: "Trigger" },
  { id: newBlockId(), kind: "decision", label: "AI checks demand forecast", icon: Brain, subtitle: "Decision" },
  { id: newBlockId(), kind: "action", label: "Create purchase order", icon: FileText, subtitle: "Action" },
  { id: newBlockId(), kind: "action", label: "Notify supplier & Slack", icon: Bell, subtitle: "Action" },
];

function BuilderView() {
  const [blocks, setBlocks] = useState<CanvasBlock[]>(DEFAULT_CANVAS);
  const [selected, setSelected] = useState<string | null>(null);

  const addBlock = (kind: BlockKind, label: string, icon: LucideIcon) => {
    const block: CanvasBlock = { id: newBlockId(), kind, label, icon, subtitle: kind === "trigger" ? "Trigger" : kind === "decision" ? "Decision" : "Action" };
    setBlocks((bs) => (kind === "trigger" ? [block, ...bs.filter((b) => b.kind !== "trigger")] : [...bs, block]));
    setSelected(block.id);
  };
  const removeBlock = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    setSelected((s) => (s === id ? null : s));
  };
  const clearCanvas = () => { setBlocks([]); setSelected(null); };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      {/* palette */}
      <Reveal>
        <GlassCard className="p-5">
          <p className="text-sm font-semibold">Blocks</p>
          <p className="mt-1 text-xs text-muted-foreground">Click a block to add it to the flow below. Click a block on the canvas to select it; hover it to remove.</p>
          {(["trigger", "decision", "action"] as BlockKind[]).map((kind) => (
            <div key={kind} className="mt-4">
              <p className="mb-2 text-[0.65rem] uppercase tracking-wide" style={{ color: kindColor[kind] }}>{kind}s{kind === "trigger" ? " (one active)" : ""}</p>
              <div className="space-y-1.5">
                {palette.filter((b) => b.kind === kind).map((b) => (
                  <button key={b.label} onClick={() => addBlock(kind, b.label, b.icon)} className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background/30 px-3 py-2 text-left text-sm text-foreground/85 transition-colors hover:border-gold/40 hover:text-foreground">
                    <b.icon className="size-4" style={{ color: kindColor[b.kind] }} />
                    <span className="flex-1 truncate">{b.label}</span>
                    <Plus className="size-3.5 text-muted-foreground" />
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel icon={GitBranch}>Workflow sandbox</SectionLabel>
            <div className="flex gap-2">
              <button onClick={clearCanvas} disabled={blocks.length === 0} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">Clear</button>
              <button title="This canvas is a visual sandbox — build & run real automations from the Dashboard tab" className="flex items-center gap-2 rounded-full border border-gold/30 bg-glass px-4 py-2 text-xs font-semibold text-foreground/85 transition-colors hover:border-gold/60"><Zap className="size-3.5 text-gold" /> Preview only</button>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center">
            {blocks.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">Empty canvas — click a block on the left to start building.</p>
            )}
            {blocks.map((b, i) => (
              <div key={b.id} className="flex w-full flex-col items-center">
                {i > 0 && <Connector />}
                <Node kind={b.kind} icon={b.icon} title={b.label} subtitle={b.subtitle} selected={selected === b.id} onSelect={() => setSelected((s) => (s === b.id ? null : b.id))} onRemove={() => removeBlock(b.id)} />
              </div>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

const creatorPrompts = ["When a customer is at churn risk, send them an offer", "Every morning, email me a revenue summary", "When an order is over $500, ask me to approve it"];

// System-style instructions embedded in the user message (ai-chat's system prompt
// is a fixed business-advisor persona, so we get strict JSON compliance by being
// extremely explicit in the message itself rather than relying on a system role).
const CREATOR_SCHEMA_PROMPT = `You are generating a WonderFlow automation workflow. Respond with ONLY raw JSON — no markdown code fences, no explanation, no extra text before or after. Match exactly this shape:

{
  "name": "short rule name (a few words)",
  "trigger_key": "order.created" | "customer.created" | "invoice.paid" | "manual",
  "steps": [
    { "kind": "action", "action_key": "ai_draft_note", "action_config": { "prompt": "what the AI should write" } }
    | { "kind": "action", "action_key": "email_owner", "action_config": { "subject": "email subject" } }
    | { "kind": "action", "action_key": "email_customer", "action_config": { "subject": "email subject", "prompt": "what the email should say" } }
    | { "kind": "action", "action_key": "webhook", "action_config": { "webhook_url": "https://..." } }
    | { "kind": "wait", "hours": <number> }
    | { "kind": "condition", "field": "total", "op": ">" | "<" | "=" | ">=" | "<=", "value": <number> }
    | { "kind": "approval", "note": "what the approver should decide on" }
  ]
}

Rules: trigger_key must be one of the 4 listed (use "manual" if nothing else fits). Use "wait" for any delay described (convert to hours — e.g. "1 week" = 168, "3 days" = 72, "30 seconds" = 0.0083). Use "condition" only for a numeric threshold on the trigger's payload (e.g. order total). Use "approval" when the description asks for a human to review/approve/sign off before continuing (e.g. "ask me before...", "route for approval"). Keep steps to what's actually needed — 1 to 5 steps. Every action needs a sensible action_config for its type. Describe this automation: `;

type ParsedStep =
  | { kind: "action"; action_key: ActionKey; action_config?: Record<string, unknown> }
  | { kind: "wait"; hours: number }
  | { kind: "condition"; field: string; op: "<" | ">" | "=" | ">=" | "<="; value: number }
  | { kind: "approval"; note?: string };
type ParsedWorkflow = { name: string; trigger_key: TriggerKey; steps: ParsedStep[] };

function parseWorkflowJson(raw: string): ParsedWorkflow {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const obj = JSON.parse(cleaned);
  if (!obj || typeof obj !== "object") throw new Error("Not a JSON object");
  const steps = Array.isArray(obj.steps) ? obj.steps : [];
  if (steps.length === 0) throw new Error("No steps returned");
  const validTriggers: TriggerKey[] = ["order.created", "customer.created", "invoice.paid", "manual"];
  const validActions: ActionKey[] = ["ai_draft_note", "email_owner", "email_customer", "webhook"];
  return {
    name: typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "AI-generated automation",
    trigger_key: validTriggers.includes(obj.trigger_key) ? obj.trigger_key : "manual",
    steps: steps.map((s: Record<string, unknown>): ParsedStep => {
      if (s.kind === "wait") return { kind: "wait", hours: Math.max(1 / 3600, Number(s.hours) || 1) };
      if (s.kind === "condition") return { kind: "condition", field: typeof s.field === "string" ? s.field : "total", op: (["<", ">", "=", ">=", "<="].includes(s.op as string) ? s.op : ">") as "<" | ">" | "=" | ">=" | "<=", value: Number(s.value) || 0 };
      if (s.kind === "approval") return { kind: "approval", note: typeof s.note === "string" ? s.note : undefined };
      const action_key = validActions.includes(s.action_key as ActionKey) ? (s.action_key as ActionKey) : "ai_draft_note";
      return { kind: "action", action_key, action_config: (s.action_config as Record<string, unknown>) ?? {} };
    }),
  };
}

const stepKindMeta: Record<StepKind, { icon: LucideIcon; label: string }> = {
  action: { icon: Send, label: "action" },
  wait: { icon: Timer, label: "wait" },
  condition: { icon: Split, label: "condition" },
  approval: { icon: ClipboardCheck, label: "approval" },
};
const actionKindMeta: Record<ActionKey, { icon: LucideIcon; label: string }> = {
  ai_draft_note: { icon: FileText, label: "Draft an AI note" },
  email_owner: { icon: Mail, label: "Email the owner" },
  email_customer: { icon: Mail, label: "Email the customer" },
  webhook: { icon: Zap, label: "Call a webhook" },
};
function describeParsedStep(s: ParsedStep): { icon: LucideIcon; kind: BlockKind; title: string; subtitle: string } {
  if (s.kind === "wait") {
    const h = s.hours;
    const label = h >= 24 ? `${Math.round((h / 24) * 10) / 10} day(s)` : h >= 1 ? `${Math.round(h * 10) / 10} hour(s)` : `${Math.round(h * 3600)} sec`;
    return { icon: Timer, kind: "action", title: `Wait ${label}`, subtitle: "wait · pauses the sequence" };
  }
  if (s.kind === "condition") return { icon: Split, kind: "decision", title: `If ${s.field} ${s.op} ${s.value}`, subtitle: "condition · stops if false" };
  if (s.kind === "approval") return { icon: ClipboardCheck, kind: "decision", title: s.note ? `Approve: ${s.note}` : "Wait for approval", subtitle: "approval · pauses for a human decision" };
  const m = actionKindMeta[s.action_key];
  const cfg = s.action_config ?? {};
  const detail = typeof cfg.subject === "string" && cfg.subject ? cfg.subject : typeof cfg.prompt === "string" && cfg.prompt ? cfg.prompt.slice(0, 40) : typeof cfg.webhook_url === "string" ? cfg.webhook_url : "";
  return { icon: m.icon, kind: "action", title: m.label, subtitle: detail ? `action · ${detail}` : "action" };
}

function CreatorView({ onBuild }: { onBuild: (draft: PrefillDraft) => void }) {
  const { org } = useOrg();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState<ParsedWorkflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setFlow(null); setError(null); setInput(q);
    try {
      const reply = await askAI(
        [{ role: "user", content: CREATOR_SCHEMA_PROMPT + q }],
        { id: org?.id, name: org?.name, industry: org?.industry },
      );
      setFlow(parseWorkflowJson(reply));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate a workflow — try rephrasing.");
    }
    setBusy(false);
  };

  const openInBuilder = () => {
    if (!flow) return;
    const drafts: StepDraft[] = flow.steps.map((s) => {
      const base = newStepDraft(s.kind);
      if (s.kind === "wait") return { ...base, ...hoursToDraft(s.hours) };
      if (s.kind === "condition") return { ...base, field: s.field, op: s.op, value: String(s.value) };
      if (s.kind === "approval") return { ...base, note: s.note ?? "" };
      const cfg = s.action_config ?? {};
      return {
        ...base,
        action_key: s.action_key,
        prompt: typeof cfg.prompt === "string" ? cfg.prompt : "",
        subject: typeof cfg.subject === "string" ? cfg.subject : "",
        webhook_url: typeof cfg.webhook_url === "string" ? cfg.webhook_url : "",
      };
    });
    onBuild({ name: flow.name, trigger_key: flow.trigger_key, steps: drafts });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Reveal>
        <GlassCard className="glass-strong relative overflow-hidden p-6">
          <div className="veil pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex items-center gap-2"><Wand2 className="size-4 text-gold" /><p className="text-sm font-semibold">Describe an automation</p></div>
            <p className="mt-2 text-sm text-muted-foreground">Tell me what should happen — real Claude builds the workflow, ready to save.</p>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="When a customer leaves a 5-star review, thank them and offer a referral reward…" className="mt-4 w-full resize-none rounded-2xl border border-border bg-background/40 px-4 py-3 text-sm text-foreground outline-none focus:border-gold/50" />
            <button onClick={() => generate(input)} disabled={busy || !input.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}><Sparkles className="size-4" /> {busy ? "Thinking…" : "Generate workflow"}</button>
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
            {!busy && error && <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">{error}</p>}
            {!busy && !error && flow && (
              <div className="flex flex-col items-center">
                <div className="mb-3 rounded-full border border-border bg-glass px-3 py-1 text-xs text-muted-foreground">{flow.name} · {triggerLabel(flow.trigger_key)}</div>
                {flow.steps.map((s, i) => {
                  const d = describeParsedStep(s);
                  return (
                    <div key={i} className="flex w-full flex-col items-center">
                      {i > 0 && <Connector />}
                      <Node kind={d.kind} icon={d.icon} title={d.title} subtitle={d.subtitle} />
                    </div>
                  );
                })}
                <button onClick={openInBuilder} className="mt-5 flex items-center gap-2 rounded-full border border-gold/30 bg-glass px-4 py-2 text-xs font-semibold text-foreground/85 transition-colors hover:border-gold/60"><GitBranch className="size-3.5 text-gold" /> Open in builder</button>
              </div>
            )}
            {!busy && !error && !flow && <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">Describe an automation and I'll draft the workflow.</p>}
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function TemplatesView({ goToDashboard }: { goToDashboard: () => void }) {
  const { org } = useOrg();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const use = async (t: Template) => {
    if (!org || busy) return;
    setBusy(t.name);
    setError(null);
    const { error: err } = await createAutomation(org.id, {
      name: t.name,
      trigger: triggerLabel(t.trigger_key),
      action: t.steps ? `Multi-step workflow (${t.steps.length} steps)` : actionLabel(t.action_key),
      trigger_key: t.trigger_key,
      action_key: t.action_key,
      action_config: t.action_config,
      steps: t.steps,
    });
    setBusy(null);
    if (err) setError(`Couldn't add "${t.name}" — ${err.message}`);
    else setDone((d) => new Set(d).add(t.name));
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-border bg-glass px-3 py-2 text-xs text-rose-300">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t, i) => {
          const isDone = done.has(t.name);
          const steps = t.steps ? t.steps.length : 1;
          return (
            <Reveal key={t.name} delay={i * 50} className="h-full">
              <GlassCard className="lift flex h-full flex-col p-6 hover:border-gold/40">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl border border-border bg-glass"><t.icon className="size-5 text-gold" /></span>
                  <span className="rounded-full border border-border bg-glass px-2.5 py-0.5 text-[0.65rem] text-muted-foreground">{t.cat}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">{t.name}</p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{steps} step{steps === 1 ? "" : "s"}</span>
                  {isDone ? (
                    <button onClick={goToDashboard} className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 px-4 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10">
                      <CheckCircle2 className="size-3.5" /> Added — view
                    </button>
                  ) : (
                    <button onClick={() => use(t)} disabled={busy === t.name} className="rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)" }}>
                      {busy === t.name ? "Adding…" : "Use template"}
                    </button>
                  )}
                </div>
              </GlassCard>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

// A short, human-readable summary of what a paused run is waiting on, built
// from its trigger event + payload (real data, not a canned description).
function approvalSummary(a: ApprovalRun): string {
  const p = a.payload ?? {};
  const name = typeof p.customer_name === "string" ? p.customer_name : typeof p.name === "string" ? p.name : null;
  const total = typeof p.total === "number" ? p.total : Number(p.total) || null;
  const bits = [triggerLabel(a.event as TriggerKey)];
  if (name) bits.push(name);
  if (total) bits.push(`$${formatNum(total)}`);
  return bits.join(" · ");
}

function ApprovalsView() {
  const { org } = useOrg();
  const [pending, setPending] = useState<ApprovalRun[] | null>(null);
  const [resolvedRecent, setResolvedRecent] = useState<ApprovalRun[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!org) { setPending([]); return; }
    const [p, r] = await Promise.all([listPendingApprovals(org.id), listResolvedApprovals(org.id, 20)]);
    setPending(p);
    setResolvedRecent(r);
  }, [org?.id]);
  useEffect(() => { void load(); }, [load]);

  const resolve = async (a: ApprovalRun, approve: boolean) => {
    setBusyId(a.id);
    setError(null);
    const res = await resolveApproval(a.id, approve);
    if (!res.ok) setError(res.error ?? "Couldn't resolve this — the approval_steps migration (0028) may not be applied yet.");
    setBusyId(null);
    await load();
  };

  const items = pending ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const approvedToday = resolvedRecent.filter((r) => r.status === "approved" && (r.resolved_at ?? "").slice(0, 10) === todayStr).length;
  const responseTimes = resolvedRecent.filter((r) => r.resolved_at).map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 60000);
  const avgResponseMin = responseTimes.length ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10 : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Pending approvals" value={items.length} icon={ClipboardCheck} />
        <StatTile label="Approved today" value={approvedToday} icon={CheckCircle2} />
        <StatTile label="Avg response" value={avgResponseMin} suffix=" min" icon={Timer} />
      </div>
      {error && <p className="rounded-xl border border-border bg-glass px-3 py-2 text-xs text-rose-300">{error}</p>}
      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={ClipboardCheck}>Waiting for you</SectionLabel>
          <div className="mt-4 space-y-2">
            {pending === null && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
            {pending !== null && items.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-background/30 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-glass"><ClipboardCheck className="size-4 text-gold" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{a.note || "Approval needed"}</p>
                  <p className="text-xs text-muted-foreground">{approvalSummary(a)} · <span className="text-gold">{a.automations?.name ?? "Automation"}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resolve(a, false)} disabled={busyId === a.id} className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-50">Reject</button>
                  <button onClick={() => resolve(a, true)} disabled={busyId === a.id} className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}><CheckCircle2 className="size-3.5" /> {busyId === a.id ? "Working…" : "Approve"}</button>
                </div>
              </div>
            ))}
            {pending !== null && items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">All caught up — nothing needs your approval. 🎉</p>}
          </div>
          {resolvedRecent.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recently resolved</p>
              <div className="mt-2 space-y-1">
                {resolvedRecent.slice(0, 8).map((r) => (
                  <p key={r.id} className="flex items-center gap-2 text-sm text-foreground/80">
                    {r.status === "approved" ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <XCircle className="size-3.5 text-rose-300" />}
                    {r.note || r.automations?.name || "Automation"} — <span className={r.status === "approved" ? "text-emerald-300" : "text-rose-300"}>{r.status}</span>
                  </p>
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
  const { org } = useOrg();
  const [log, setLog] = useState<DbExecution[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (org?.id) listExecutions(org.id).then((r) => alive && setLog(r)).catch(() => alive && setLog([]));
    else setLog([]);
    return () => { alive = false; };
  }, [org?.id]);

  return (
    <Reveal>
      <GlassCard className="p-6">
        <SectionLabel icon={Clock}>Execution history</SectionLabel>
        <div className="mt-4 space-y-1">
          {log === null && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
          {log !== null && log.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No executions yet — run an automation and it'll show up here.</p>
          )}
          {(log ?? []).map((h) => {
            const status = statusOf(h);
            const st = runStatusMeta[status];
            return (
              <div key={h.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl px-2 py-3 sm:grid-cols-[auto_1.6fr_1fr_auto_auto]">
                <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklch, ${st.color} 15%, transparent)` }}><st.icon className="size-4" style={{ color: st.color }} /></span>
                <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{h.automation_name}</p><p className="truncate text-xs text-muted-foreground">{h.detail || triggerLabel(h.event)}</p></div>
                <span className="hidden text-xs sm:block" style={{ color: st.color }}>{st.label}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{h.duration_ms != null ? `${(h.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
                <span className="text-right text-xs text-muted-foreground">{historyTimeAgo(h.created_at)}</span>
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
  const [prefill, setPrefill] = useState<PrefillDraft | null>(null);
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
          {active === "dashboard" && <DashboardView prefill={prefill} onConsumePrefill={() => setPrefill(null)} />}
          {active === "builder" && <BuilderView />}
          {active === "creator" && <CreatorView onBuild={(draft) => { setPrefill(draft); setActive("dashboard"); }} />}
          {active === "templates" && <TemplatesView goToDashboard={() => setActive("dashboard")} />}
          {active === "approvals" && <ApprovalsView />}
          {active === "history" && <HistoryView />}
          {active === "analytics" && <AnalyticsView />}
        </div>
      </section>
    </div>
  );
}
