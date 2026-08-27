import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Building2,
  Check,
  Copy,
  CreditCard,
  Cpu,
  Database,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plug,
  ScrollText,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Bar, Reveal, SectionLabel, StatTile } from "@/components/wf/primitives";
import { useOrg } from "@/lib/org-context";
import { enabledModulesFor, INDUSTRIES, updateOrganization } from "@/lib/org";
import { connectSlack, disconnectSlack, listConnections, syncStripe, testSlack, type DbConnection } from "@/lib/connections";
import { disableIngest, enableIngest, getIngestKey, inboundUrl } from "@/lib/inbound";
import { EVENT_CATALOG, createWebhook, deleteWebhook, listWebhooks, testWebhook, toggleWebhook, type DbWebhookEndpoint } from "@/lib/webhooks";
import { PLANS, getSubscription, openBillingPortal, planLimits, startCheckout, type PlanId, type SubscriptionRow } from "@/lib/billing";
import { cancelInvitation, inviteMember, listInvitations, listMembers, setMemberStatus, updateMember, type Invitation, type Member } from "@/lib/team";

/* ──────────────────────────────────────────────────────────────────────
 * Primitives
 * ─────────────────────────────────────────────────────────────────── */

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40", on ? "border-transparent" : "border-border bg-background/40")}
      style={on ? { background: "var(--gradient-gold)" } : undefined}
    >
      <span className="absolute top-0.5 size-5 rounded-full transition-all duration-200" style={{ left: on ? "1.375rem" : "0.125rem", background: on ? "oklch(0.2 0.02 70)" : "oklch(0.8 0.015 85)" }} />
    </button>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-gold/50";

function StatusDot({ tone }: { tone: "ok" | "warn" | "err" }) {
  const c = tone === "ok" ? "oklch(0.72 0.14 155)" : tone === "warn" ? "oklch(0.84 0.14 84)" : "oklch(0.68 0.16 25)";
  return <span className="inline-block size-2 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />;
}

/* ──────────────────────────────────────────────────────────────────────
 * Data
 * ─────────────────────────────────────────────────────────────────── */

type ViewKey = "settings" | "billing" | "users" | "roles" | "permissions" | "ai" | "integrations" | "security" | "audit" | "monitoring";

const views: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "settings", label: "Business settings", icon: Building2 },
  { key: "billing", label: "Billing & plan", icon: CreditCard },
  { key: "users", label: "Users", icon: Users },
  { key: "roles", label: "Roles", icon: Shield },
  { key: "permissions", label: "Permissions", icon: KeyRound },
  { key: "ai", label: "AI configuration", icon: Bot },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "security", label: "Security", icon: Lock },
  { key: "audit", label: "Audit logs", icon: ScrollText },
  { key: "monitoring", label: "System monitoring", icon: Activity },
];


const roles = [
  { name: "Owner", members: 1, desc: "Full control, billing and data. Cannot be restricted.", perms: "All", locked: true },
  { name: "Admin", members: 2, desc: "Manage the platform, users and configuration.", perms: "18 / 20", locked: false },
  { name: "Manager", members: 4, desc: "Run operations — orders, inventory, customers.", perms: "12 / 20", locked: false },
  { name: "Analyst", members: 3, desc: "Read analytics and generate reports.", perms: "6 / 20", locked: false },
  { name: "Viewer", members: 6, desc: "View-only access to dashboards.", perms: "3 / 20", locked: false },
];

const capabilities = ["View analytics", "Manage orders", "Edit inventory", "Manage users", "Configure AI", "Billing & plans", "Delete data"];
const permRoles = ["Admin", "Manager", "Analyst", "Viewer"];
const defaultPerms: Record<string, Record<string, boolean>> = {
  "View analytics": { Admin: true, Manager: true, Analyst: true, Viewer: true },
  "Manage orders": { Admin: true, Manager: true, Analyst: false, Viewer: false },
  "Edit inventory": { Admin: true, Manager: true, Analyst: false, Viewer: false },
  "Manage users": { Admin: true, Manager: false, Analyst: false, Viewer: false },
  "Configure AI": { Admin: true, Manager: false, Analyst: false, Viewer: false },
  "Billing & plans": { Admin: true, Manager: false, Analyst: false, Viewer: false },
  "Delete data": { Admin: false, Manager: false, Analyst: false, Viewer: false },
};

const aiModels = [
  { id: "precision", name: "Precision", desc: "Most capable — deep reasoning for strategy & analysis." },
  { id: "balanced", name: "Balanced", desc: "Great quality at lower cost — the everyday default." },
  { id: "fast", name: "Fast", desc: "Instant responses for high-volume automations." },
];
const autonomyLevels = [
  { id: "suggest", name: "Suggest only", desc: "AI proposes; you do everything." },
  { id: "approve", name: "Ask approval", desc: "AI drafts actions and waits for your OK." },
  { id: "auto", name: "Autopilot", desc: "AI executes low-risk actions on its own." },
];

const PROVIDERS: { id: string; name: string; desc: string; icon: LucideIcon; kind: "sync" | "soon" }[] = [
  { id: "stripe", name: "Stripe", desc: "Import your customers & revenue into the CRM", icon: Zap, kind: "sync" },
  { id: "shopify", name: "Shopify", desc: "Sync orders, products & inventory", icon: Globe, kind: "soon" },
  { id: "quickbooks", name: "QuickBooks", desc: "Accounting & finance sync", icon: Database, kind: "soon" },
  { id: "klaviyo", name: "Klaviyo", desc: "Email & SMS marketing", icon: Mail, kind: "soon" },
  { id: "google_analytics", name: "Google Analytics", desc: "Web & marketing analytics", icon: Globe, kind: "soon" },
];

const sessions = [
  { device: "MacBook Pro · Chrome", loc: "Austin, TX", last: "Active now", current: true },
  { device: "iPhone 15 · Safari", loc: "Austin, TX", last: "2h ago", current: false },
  { device: "Windows · Edge", loc: "Denver, CO", last: "3d ago", current: false },
];

const auditLog = [
  { actor: "Marcus Reid", action: "updated AI autonomy to 'Ask approval'", cat: "AI", time: "8m ago", ip: "72.14.x.x" },
  { actor: "Aisha Imran", action: "invited sam@contractor.io as Viewer", cat: "Users", time: "22m ago", ip: "72.14.x.x" },
  { actor: "System", action: "auto-reorder created PO-2043", cat: "Orders", time: "1h ago", ip: "—" },
  { actor: "Priya Nair", action: "exported financial report (YTD)", cat: "Data", time: "3h ago", ip: "98.20.x.x" },
  { actor: "Marcus Reid", action: "connected Stripe integration", cat: "Integrations", time: "1d ago", ip: "72.14.x.x" },
  { actor: "Aisha Imran", action: "enabled 2-factor authentication", cat: "Security", time: "2d ago", ip: "72.14.x.x" },
];
const catColor: Record<string, string> = { AI: "oklch(0.84 0.14 84)", Users: "oklch(0.66 0.09 200)", Orders: "oklch(0.7 0.11 60)", Data: "oklch(0.62 0.12 300)", Integrations: "oklch(0.75 0.13 150)", Security: "oklch(0.68 0.16 25)" };

const services = [
  { name: "API gateway", tone: "ok" as const, note: "142ms avg" },
  { name: "Database", tone: "ok" as const, note: "healthy" },
  { name: "AI engine", tone: "ok" as const, note: "3 models live" },
  { name: "Webhooks", tone: "warn" as const, note: "elevated latency" },
  { name: "Storage", tone: "ok" as const, note: "41% used" },
];

/* ──────────────────────────────────────────────────────────────────────
 * Views
 * ─────────────────────────────────────────────────────────────────── */

const TIMEZONE_OPTS = ["America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "UTC"];
const CURRENCY_OPTS: { key: string; label: string }[] = [
  { key: "USD", label: "USD $" },
  { key: "EUR", label: "EUR €" },
  { key: "GBP", label: "GBP £" },
];

function SettingsView() {
  const { org, refresh } = useOrg();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState(false);
  const [timezone, setTimezone] = useState("America/Chicago");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (org) {
      setName(org.name ?? "");
      setIndustry(org.industry ?? "");
      setCustomIndustry(!!org.industry && !INDUSTRIES.includes(org.industry));
      setTimezone(org.timezone ?? "America/Chicago");
      setCurrency(org.currency ?? "USD");
    }
  }, [org?.id]);

  const save = async () => {
    if (!org || busy) return;
    setBusy(true);
    setSaved(false);
    const trimmedIndustry = industry.trim() || null;
    const patch: Parameters<typeof updateOrganization>[1] = { name: name.trim() || org.name, industry: trimmedIndustry, timezone, currency };
    // Re-provision the module set whenever industry actually changes, so
    // correcting a mistaken pick at signup properly shows/hides Orders,
    // Inventory, Suppliers & Growth instead of leaving the sidebar stale.
    if (trimmedIndustry !== org.industry) patch.enabled_modules = enabledModulesFor(trimmedIndustry ?? undefined);
    const { error } = await updateOrganization(org.id, patch);
    setBusy(false);
    if (!error) {
      setSaved(true);
      await refresh();
    }
  };

  return (
    <Reveal>
      <GlassCard className="p-6">
        <SectionLabel icon={Building2}>Business profile</SectionLabel>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Company name</span><input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} className={inputCls} /></label>
          <label className="block text-xs">
            <span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Industry</span>
            <select
              value={customIndustry ? "__other__" : industry}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__other__") { setCustomIndustry(true); setIndustry(""); }
                else { setCustomIndustry(false); setIndustry(v); }
                setSaved(false);
              }}
              className={inputCls}
            >
              <option value="">Select…</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              <option value="__other__">Other…</option>
            </select>
            {customIndustry && (
              <input value={industry} onChange={(e) => { setIndustry(e.target.value); setSaved(false); }} placeholder="Your industry — e.g. Banking, Legal, Agriculture" className={cn(inputCls, "mt-2")} />
            )}
          </label>
          <label className="block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Timezone</span>
            <select value={timezone} onChange={(e) => { setTimezone(e.target.value); setSaved(false); }} className={inputCls}>
              {TIMEZONE_OPTS.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </label>
          <label className="block text-xs"><span className="mb-1.5 block uppercase tracking-wide text-muted-foreground">Currency</span>
            <select value={currency} onChange={(e) => { setCurrency(e.target.value); setSaved(false); }} className={inputCls}>
              {CURRENCY_OPTS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Changing industry updates which modules appear in your sidebar — commerce industries (E-commerce, Retail, Manufacturing, Hospitality) get Orders, Inventory, Suppliers &amp; Growth; others get the core set. Timezone and currency are saved as preferences, but dashboards and reports don't reformat amounts by currency yet — they still display in $.</p>
        <button onClick={save} disabled={busy || !name.trim()} className="mt-5 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}>
          <Check className="size-4" /> {busy ? "Saving…" : saved ? "Saved ✓" : "Save profile"}
        </button>
      </GlassCard>
    </Reveal>
  );
}

const INVITE_ROLES = ["member", "manager", "analyst", "admin"];
const memberStatusColor: Record<string, string> = { active: "oklch(0.72 0.14 155)", invited: "oklch(0.84 0.14 84)", disabled: "oklch(0.7 0.02 250)" };

function UsersView() {
  const { org, role } = useOrg();
  const canManage = role === "owner" || role === "admin";
  const seats = planLimits(org?.plan).seats;

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteTitle, setInviteTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("member");
  const [editTitle, setEditTitle] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([listMembers(org.id), listInvitations(org.id)]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the team.");
    }
    setLoading(false);
  }, [org?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeCount = members.filter((m) => m.status !== "disabled").length;
  const usedSeats = activeCount + invites.length;
  const atCapacity = usedSeats >= seats;

  const filtered = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase()));

  async function submitInvite() {
    if (!org || !inviteEmail.trim() || busy) return;
    setError(null);
    setNotice(null);
    if (atCapacity) {
      setError(`You've used all ${seats} seat${seats === 1 ? "" : "s"} on the ${planLimits(org.plan).label} plan. Upgrade for more.`);
      return;
    }
    setBusy(true);
    const invited = inviteEmail.trim();
    const { error: err, sent, emailError } = await inviteMember(org.id, invited, inviteRole, inviteTitle);
    setBusy(false);
    if (err) { setError(err.message); return; }
    setInviteEmail("");
    setInviteTitle("");
    setNotice(
      sent
        ? `Invitation emailed to ${invited}.`
        : `${invited} was invited and a seat reserved, but the email couldn't be sent${emailError ? ` (${emailError})` : ""}.`,
    );
    await reload();
  }

  async function toggleStatus(m: Member) {
    if (m.role === "owner") return;
    await setMemberStatus(m.id, m.status === "disabled" ? "active" : "disabled");
    await reload();
  }

  async function removeInvite(id: string) {
    await cancelInvitation(id);
    await reload();
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditRole(m.role);
    setEditTitle(m.title ?? "");
    setError(null);
  }

  async function saveEdit() {
    if (!editingId || editBusy) return;
    setEditBusy(true);
    const { error: err } = await updateMember(editingId, { role: editRole, title: editTitle.trim() || null });
    setEditBusy(false);
    if (err) { setError(err.message); return; }
    setEditingId(null);
    await reload();
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-gold/25 bg-glass"><Users className="size-5 text-gold" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Seats used</p>
              <p className="mt-0.5 text-xl text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                <span className={atCapacity ? "text-rose-300" : "gold-text"}>{usedSeats}</span> <span className="text-muted-foreground text-base">/ {seats}</span>
              </p>
            </div>
          </div>
          {atCapacity && (
            <Link to="/admin" className="text-xs text-gold hover:underline">Need more seats? Upgrade your plan →</Link>
          )}
        </GlassCard>
      </Reveal>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="size-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-gold/30 bg-glass px-4 py-3 text-sm text-foreground/85">
          <Check className="size-4 text-gold" /> {notice}
        </div>
      )}

      <Reveal>
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2.5 focus-within:border-gold/50">
              <Search className="size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
            </label>
          </div>

          {canManage && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-[1fr_1fr_auto_auto]">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" placeholder="teammate@company.com" className={cn(inputCls, "pl-9")} />
              </div>
              <input value={inviteTitle} onChange={(e) => setInviteTitle(e.target.value)} placeholder="Job title (optional) — e.g. Sales Lead" className={inputCls} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={inputCls}>
                {INVITE_ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
              <button onClick={submitInvite} disabled={!inviteEmail.trim() || busy || atCapacity} className="flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>
                <UserPlus className="size-4" /> {busy ? "Inviting…" : "Invite"}
              </button>
              <p className="text-[0.65rem] text-muted-foreground sm:col-span-4">Job title is just a display label — the role dropdown is what actually controls permissions.</p>
            </div>
          )}

          <div className="mt-5 space-y-1">
            {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading team…</p>}
            {!loading && filtered.map((m) => editingId === m.id ? (
              <div key={m.id} className="grid gap-3 rounded-2xl border border-gold/30 bg-background/30 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Job title (optional)" className={inputCls} />
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={inputCls}>
                  {INVITE_ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
                <button onClick={saveEdit} disabled={editBusy} className="rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{editBusy ? "Saving…" : "Save"}</button>
                <button onClick={() => setEditingId(null)} className="rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            ) : (
              <div key={m.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-transparent px-3 py-3 hover:border-border sm:grid-cols-[1.6fr_0.8fr_0.8fr_auto]">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} />
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{m.name}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
                </div>
                <span className="hidden text-sm text-muted-foreground sm:block">
                  {m.title ? <><span className="text-foreground/85">{m.title}</span><span className="text-xs capitalize"> · {m.role}</span></> : <span className="capitalize">{m.role}</span>}
                </span>
                <span className="hidden items-center gap-1.5 text-xs capitalize sm:flex" style={{ color: memberStatusColor[m.status] ?? memberStatusColor.active }}><span className="size-1.5 rounded-full" style={{ background: memberStatusColor[m.status] ?? memberStatusColor.active }} />{m.status}</span>
                {canManage && m.role !== "owner" ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => startEdit(m)} aria-label="Edit member" className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"><Pencil className="size-3.5" /></button>
                    <button onClick={() => toggleStatus(m)} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-gold/40">{m.status === "disabled" ? "Enable" : "Disable"}</button>
                  </div>
                ) : <span />}
              </div>
            ))}
            {!loading && filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No team members match.</p>}
          </div>

          {invites.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-muted-foreground">Pending invitations</p>
              <div className="space-y-1">
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                    <span className="grid size-8 place-items-center rounded-full border border-gold/30 bg-glass"><Mail className="size-3.5 text-gold" /></span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm text-foreground/85">{i.email}</p><p className="text-xs text-muted-foreground">{i.title ? <>{i.title} · <span className="capitalize">{i.role}</span></> : <span className="capitalize">{i.role}</span>} · invited</p></div>
                    {canManage && (
                      <button onClick={() => removeInvite(i.id)} className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-rose-400/50 hover:text-rose-300"><Trash2 className="size-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Invites are emailed a join link (once <code>RESEND_API_KEY</code> is set) and count toward your seats until accepted.</p>
            </div>
          )}
        </GlassCard>
      </Reveal>
    </div>
  );
}

function RolesView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {roles.map((r, i) => (
        <Reveal key={r.name} delay={i * 50} className="h-full">
          <GlassCard className="lift flex h-full flex-col p-6 hover:border-gold/40">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Shield className="size-4 text-gold" />{r.name}</span>
              {r.locked && <Lock className="size-3.5 text-muted-foreground" />}
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs">
              <span className="text-muted-foreground">{r.members} member{r.members === 1 ? "" : "s"}</span>
              <span className="text-gold">{r.perms} permissions</span>
            </div>
          </GlassCard>
        </Reveal>
      ))}
    </div>
  );
}

function PermissionsView() {
  const [perms, setPerms] = useState(defaultPerms);
  const toggle = (cap: string, role: string) => setPerms((p) => ({ ...p, [cap]: { ...p[cap], [role]: !p[cap][role] } }));
  return (
    <Reveal>
      <GlassCard className="overflow-x-auto p-6">
        <SectionLabel icon={KeyRound}>Permission matrix</SectionLabel>
        <p className="mt-1 text-xs text-muted-foreground">Owner has every permission. Toggle capabilities for each role.</p>
        <div className="mt-5 min-w-[36rem]">
          <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] items-center gap-2 border-b border-border pb-2 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            <span>Capability</span>
            {permRoles.map((r) => <span key={r} className="text-center">{r}</span>)}
          </div>
          {capabilities.map((cap) => (
            <div key={cap} className="grid grid-cols-[1.4fr_repeat(4,1fr)] items-center gap-2 border-b border-border/60 py-2.5">
              <span className="text-sm text-foreground/85">{cap}</span>
              {permRoles.map((role) => {
                const on = perms[cap][role];
                return (
                  <div key={role} className="flex justify-center">
                    <button onClick={() => toggle(cap, role)} className={cn("grid size-7 place-items-center rounded-lg border transition-colors", on ? "border-transparent text-primary-foreground" : "border-border text-transparent hover:border-gold/40")} style={on ? { background: "var(--gradient-gold)" } : undefined} aria-pressed={on}>
                      <Check className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function AiConfigView() {
  const [model, setModel] = useState("balanced");
  const [autonomy, setAutonomy] = useState("approve");
  const [features, setFeatures] = useState<Record<string, boolean>>({ briefings: true, reorder: true, replies: false, alerts: true, content: true });
  const [learn, setLearn] = useState(true);
  const toggleF = (k: string) => setFeatures((f) => ({ ...f, [k]: !f[k] }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Cpu}>AI model</SectionLabel>
            <div className="mt-4 space-y-2">
              {aiModels.map((m) => (
                <button key={m.id} onClick={() => setModel(m.id)} className={cn("flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors", model === m.id ? "border-gold/50 bg-glass" : "border-border bg-background/30 hover:border-gold/30")}>
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", model === m.id ? "border-transparent" : "border-border")} style={model === m.id ? { background: "var(--gradient-gold)" } : undefined}>{model === m.id && <Check className="size-3.5" stroke="oklch(0.2 0.02 70)" />}</span>
                  <div><p className="text-sm font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.desc}</p></div>
                </button>
              ))}
            </div>
          </GlassCard>
        </Reveal>

        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Zap}>Autonomy level</SectionLabel>
            <div className="mt-4 space-y-2">
              {autonomyLevels.map((a) => (
                <button key={a.id} onClick={() => setAutonomy(a.id)} className={cn("flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors", autonomy === a.id ? "border-gold/50 bg-glass" : "border-border bg-background/30 hover:border-gold/30")}>
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", autonomy === a.id ? "border-transparent" : "border-border")} style={autonomy === a.id ? { background: "var(--gradient-gold)" } : undefined}>{autonomy === a.id && <Check className="size-3.5" stroke="oklch(0.2 0.02 70)" />}</span>
                  <div><p className="text-sm font-medium text-foreground">{a.name}</p><p className="text-xs text-muted-foreground">{a.desc}</p></div>
                </button>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>

      <Reveal>
        <GlassCard className="p-6">
          <SectionLabel icon={Bot}>AI features</SectionLabel>
          <div className="mt-2 grid gap-x-8 sm:grid-cols-2">
            {([["briefings", "Daily AI briefings", "Morning summaries across the business"], ["reorder", "Auto-reorder", "Draft POs when stock runs low"], ["replies", "AI-suggested replies", "Draft responses in the CRM inbox"], ["alerts", "Predictive alerts", "Warn before stockouts & churn"], ["content", "Content generation", "Draft marketing copy on demand"]] as const).map(([k, label, desc]) => (
              <div key={k} className="border-b border-border/60"><SettingRow label={label} desc={desc}><Toggle on={features[k]} onChange={() => toggleF(k)} /></SettingRow></div>
            ))}
            <div className="border-b border-border/60"><SettingRow label="Learn from my data" desc="Improve suggestions using your history"><Toggle on={learn} onChange={setLearn} /></SettingRow></div>
          </div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function FormEndpointCard() {
  const { org } = useOrg();
  const [key, setKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!org) return;
    getIngestKey(org.id).then((k) => { setKey(k); setLoaded(true); }).catch(() => setLoaded(true));
  }, [org?.id]);

  const url = key ? inboundUrl(key) : "";
  const snippet = `<form action="${url}" method="POST">
  <input name="name" placeholder="Name" required />
  <input name="email" type="email" placeholder="Email" />
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>`;
  const productExample = `POST ${url}
{ "type": "product", "name": "Aurora Serum", "sku": "SKU-1001",
  "category": "Serums", "price": 68, "cost": 22,
  "stock": 120, "reorder_point": 40 }`;
  const supplierExample = `POST ${url}
{ "type": "supplier", "name": "Northwind Supply",
  "category": "Packaging", "country": "USA",
  "email": "sales@northwind.co", "lead_time_days": 7, "spend": 42000 }`;

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(null), 1600); }).catch(() => {});
  };
  const generate = async () => { if (!org || busy) return; setBusy(true); const { key: k } = await enableIngest(org.id); if (k) setKey(k); setBusy(false); };
  const turnOff = async () => { if (!org || busy) return; setBusy(true); await disableIngest(org.id); setKey(null); setBusy(false); };

  return (
    <Reveal>
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-gold/25 bg-glass"><Link2 className="size-5 text-gold" /></span>
            <div>
              <p className="text-sm font-semibold text-foreground">Website &amp; forms</p>
              <p className="text-xs text-muted-foreground">Capture leads from your site straight into the CRM — and fire your automations.</p>
            </div>
          </div>
          {key
            ? <span className="flex items-center gap-1.5 text-xs text-emerald-300"><StatusDot tone="ok" /> Live</span>
            : <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-muted-foreground">Off</span>}
        </div>

        {!loaded ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
        ) : !key ? (
          <div className="mt-5">
            <p className="text-sm text-foreground/85">Generate a secure endpoint, then point any form (your website, Typeform, Zapier…) at it. Every submission becomes a new lead — and triggers your <span className="text-gold">customer.created</span> automations.</p>
            <button onClick={generate} disabled={busy} className="mt-4 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)" }}>
              <Link2 className="size-4" /> {busy ? "Generating…" : "Generate form endpoint"}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Your endpoint URL</p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/85">{url}</code>
                <button onClick={() => copy(url, "url")} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground">
                  {copied === "url" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />} {copied === "url" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Paste this on your website</p>
                <button onClick={() => copy(snippet, "html")} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground">
                  {copied === "html" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />} {copied === "html" ? "Copied" : "Copy HTML"}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-border bg-background/40 p-3 font-mono text-[0.7rem] leading-relaxed text-foreground/80">{snippet}</pre>
            </div>
            <p className="text-xs text-muted-foreground">Works with any tool that can POST a form — Webflow, WordPress, Framer, Typeform, Zapier/Make. Recognised fields: <span className="text-foreground/80">name, email, phone, company, message</span>. Add an <span className="text-foreground/80">amount</span> and it's logged as an order (rolling into loyalty).</p>

            {/* Catalog sync docs */}
            <div className="rounded-2xl border border-border bg-background/20 p-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-gold">Push products &amp; suppliers</p>
              <p className="mt-1 text-xs text-muted-foreground">Send the same endpoint a <span className="font-mono text-foreground/80">type</span> to sync your catalog from a store/Zapier/Make/n8n. Upserts by SKU/name, so repeat syncs update — not duplicate.</p>
              <div className="mt-2 space-y-2">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Product</span>
                    <button onClick={() => copy(productExample, "prod")} className="flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[0.6rem] text-muted-foreground hover:text-foreground">{copied === "prod" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />} {copied === "prod" ? "Copied" : "Copy"}</button>
                  </div>
                  <pre className="overflow-x-auto rounded-xl border border-border bg-background/40 p-3 font-mono text-[0.68rem] leading-relaxed text-foreground/80">{productExample}</pre>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Supplier</span>
                    <button onClick={() => copy(supplierExample, "sup")} className="flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[0.6rem] text-muted-foreground hover:text-foreground">{copied === "sup" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />} {copied === "sup" ? "Copied" : "Copy"}</button>
                  </div>
                  <pre className="overflow-x-auto rounded-xl border border-border bg-background/40 p-3 font-mono text-[0.68rem] leading-relaxed text-foreground/80">{supplierExample}</pre>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={generate} disabled={busy} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/80 hover:border-gold/40 disabled:opacity-60">Regenerate key</button>
              <button onClick={turnOff} disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-rose-300 disabled:opacity-60">Turn off</button>
            </div>
          </div>
        )}
      </GlassCard>
    </Reveal>
  );
}

function WebhooksCard() {
  const { org } = useOrg();
  const [hooks, setHooks] = useState<DbWebhookEndpoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(EVENT_CATALOG.map((e) => e.key));
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const toggleReveal = (id: string) =>
    setRevealed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const copySecret = (id: string, secret: string) => {
    void navigator.clipboard?.writeText(secret);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const load = () => {
    if (!org) return;
    listWebhooks(org.id).then((h) => { setHooks(h); setLoaded(true); }).catch(() => setLoaded(true));
  };
  useEffect(() => { load(); }, [org?.id]);

  const add = async () => {
    if (!org || !url.trim() || events.length === 0 || busy) return;
    setBusy(true);
    await createWebhook(org.id, url, events);
    setBusy(false);
    setUrl("");
    setAdding(false);
    load();
  };
  const test = async (h: DbWebhookEndpoint) => {
    if (!org) return;
    setTestMsg("Sending test…");
    const r = await testWebhook(org.id, h.id);
    setTestMsg(r.ok ? `✓ Test delivered (HTTP ${r.status})` : `Test failed${r.status ? ` (HTTP ${r.status})` : ""}${r.detail ? `: ${r.detail}` : ""}`);
    load();
  };

  return (
    <Reveal>
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-gold/25 bg-glass"><Zap className="size-5 text-gold" /></span>
            <div>
              <p className="text-sm font-semibold text-foreground">Outbound webhooks</p>
              <p className="text-xs text-muted-foreground">Send WonderFlow events to Zapier, Make, n8n, or any URL — each POST is HMAC-signed.</p>
            </div>
          </div>
          <button onClick={() => setAdding((a) => !a)} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110" style={{ background: "var(--gradient-gold)" }}>Add endpoint</button>
        </div>

        {adding && (
          <div className="mt-4 rounded-2xl border border-border bg-background/30 p-4">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a catch-hook URL from Zapier, Make, n8n, or your own server" className={inputCls} />
            <p className="mt-3 mb-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">Send these events</p>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATALOG.map((ev) => {
                const on = events.includes(ev.key);
                return (
                  <button key={ev.key} onClick={() => setEvents((s) => (s.includes(ev.key) ? s.filter((x) => x !== ev.key) : [...s, ev.key]))} title={ev.desc} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", on ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground hover:text-foreground")} style={on ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
                    {on && <Check className="mr-1 inline size-3 text-gold" />}{ev.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={add} disabled={busy || !url.trim() || events.length === 0} className="rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Adding…" : "Add webhook"}</button>
              <button onClick={() => setAdding(false)} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}

        {testMsg && <p className="mt-3 rounded-xl border border-gold/25 bg-glass px-3 py-2 text-xs text-foreground/85">{testMsg}</p>}

        <div className="mt-4 space-y-2">
          {loaded && hooks.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground">No webhooks yet. Add one to start pushing events out. Payloads are POSTed as JSON and signed with <code className="font-mono text-foreground/80">x-wonderflow-signature</code>.</p>
          )}
          {hooks.map((h) => (
            <div key={h.id} className="rounded-2xl border border-border bg-background/30 p-3">
              <div className="flex items-center gap-2">
                <StatusDot tone={h.enabled ? (h.failures > 0 ? "warn" : "ok") : "err"} />
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/85">{h.url}</code>
                <button onClick={() => test(h)} className="rounded-lg border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground">Test</button>
                <button onClick={async () => { await toggleWebhook(h.id, !h.enabled); load(); }} className="rounded-lg border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground">{h.enabled ? "Pause" : "Resume"}</button>
                <button onClick={async () => { await deleteWebhook(h.id); load(); }} aria-label="Delete" className="grid size-6 place-items-center rounded-lg border border-border text-muted-foreground hover:border-rose-400/50 hover:text-rose-300"><Trash2 className="size-3.5" /></button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {h.events.map((e) => <span key={e} className="rounded-full border border-border bg-glass px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground">{e}</span>)}
                {h.last_status != null && <span className="ml-auto text-[0.65rem] text-muted-foreground">last: HTTP {h.last_status}{h.failures > 0 ? ` · ${h.failures} fails` : ""}</span>}
              </div>
              {/* Signing secret — used to verify each request's x-wonderflow-signature */}
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-glass px-2 py-1.5">
                <span className="shrink-0 text-[0.6rem] uppercase tracking-wide text-muted-foreground">Signing secret</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[0.65rem] text-foreground/85">
                  {revealed.has(h.id) ? h.secret : `whsec_${"•".repeat(20)}`}
                </code>
                <button onClick={() => toggleReveal(h.id)} className="shrink-0 rounded-lg border border-border px-2 py-1 text-[0.6rem] text-muted-foreground hover:text-foreground">{revealed.has(h.id) ? "Hide" : "Reveal"}</button>
                <button onClick={() => copySecret(h.id, h.secret)} className="shrink-0 rounded-lg border border-border px-2 py-1 text-[0.6rem] text-muted-foreground hover:text-foreground">{copied === h.id ? "Copied ✓" : "Copy"}</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1.5 rounded-2xl border border-border bg-background/20 p-3 text-[0.7rem] text-muted-foreground">
          <p><b className="text-foreground/80">Works with any tool:</b> paste a catch-hook URL from <b>Zapier</b> (Webhooks → Catch Hook), <b>Make</b> (Custom webhook), <b>n8n</b> (Webhook node — cloud or self-hosted), or your own server.</p>
          <p>
            <b className="text-foreground/80">Verify each request</b> (optional but recommended): every POST carries a header{" "}
            <code className="font-mono text-foreground/80">x-wonderflow-signature: sha256=…</code>. Recompute{" "}
            <code className="font-mono text-foreground/80">HMAC-SHA256(secret, rawBody)</code> with the signing secret above and compare — a match proves it genuinely came from WonderFlow, unaltered. The secret never travels in the request.
          </p>
        </div>
      </GlassCard>
    </Reveal>
  );
}

// Real Slack connection via an Incoming Webhook URL (no OAuth app needed —
// the user creates one at api.slack.com/apps and pastes the URL here). A test
// message and every automation's slack_message action both post to it for real.
function SlackCard({ conn, onChange }: { conn?: DbConnection; onChange: () => void }) {
  const { org } = useOrg();
  const connected = conn?.status === "connected";
  const existingUrl = (conn?.config as { webhook_url?: string } | undefined)?.webhook_url ?? "";
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!org || !url.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await connectSlack(org.id, url.trim());
    setBusy(false);
    if (err) { setError(err.message); return; }
    setEditing(false);
    setUrl("");
    onChange();
  };
  const disconnect = async () => {
    if (!org || busy) return;
    setBusy(true);
    await disconnectSlack(org.id);
    setBusy(false);
    setTestMsg(null);
    onChange();
  };
  const sendTest = async () => {
    if (!org || busy) return;
    setBusy(true);
    setTestMsg(null);
    const r = await testSlack(org.id);
    setBusy(false);
    setTestMsg(r.ok ? "✓ Test message sent — check your Slack channel." : `Failed: ${r.detail ?? "unknown error"}`);
  };

  return (
    <Reveal className="h-full">
      <GlassCard className="flex h-full flex-col p-6">
        <div className="flex items-center justify-between">
          <span className="grid size-11 place-items-center rounded-2xl border border-border bg-glass"><Activity className="size-5 text-gold" /></span>
          {connected && <span className="flex items-center gap-1.5 text-xs text-emerald-300"><StatusDot tone="ok" /> Connected</span>}
        </div>
        <p className="mt-4 text-sm font-semibold text-foreground">Slack</p>
        <p className="mt-1 flex-1 text-xs text-muted-foreground">Send AI briefings and automation alerts to a Slack channel via an Incoming Webhook.</p>

        {!connected && !editing && (
          <button onClick={() => setEditing(true)} className="mt-4 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: "var(--gradient-gold)" }}>Connect</button>
        )}

        {editing && (
          <div className="mt-4 space-y-2">
            <p className="text-[0.7rem] text-muted-foreground">In Slack: create an app at api.slack.com/apps → Incoming Webhooks → Add New Webhook to Workspace → pick a channel → copy the URL below.</p>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/services/…" className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-foreground outline-none focus:border-gold/50" />
            {error && <p className="text-[0.7rem] text-rose-300">{error}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={busy || !url.trim()} className="rounded-full px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50" style={{ background: "var(--gradient-gold)" }}>{busy ? "Saving…" : "Save"}</button>
              <button onClick={() => { setEditing(false); setError(null); }} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </div>
        )}

        {connected && !editing && (
          <div className="mt-4 space-y-2">
            {testMsg && <p className="text-[0.7rem] text-muted-foreground">{testMsg}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={sendTest} disabled={busy} className="rounded-full border border-border bg-glass px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:border-gold/40 disabled:opacity-60">{busy ? "Sending…" : "Send test message"}</button>
              <button onClick={() => { setEditing(true); setUrl(existingUrl); }} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Change URL</button>
              <button onClick={disconnect} disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-rose-300 disabled:opacity-60">Disconnect</button>
            </div>
          </div>
        )}
      </GlassCard>
    </Reveal>
  );
}

function IntegrationsView() {
  const { org } = useOrg();
  const [conns, setConns] = useState<DbConnection[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    if (!org) return;
    try {
      setConns(await listConnections(org.id));
    } catch {
      /* connections table not applied yet — show all as available */
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  const statusOf = (id: string) => conns.find((c) => c.provider === id);

  const doSyncStripe = async () => {
    if (!org || busy) return;
    setBusy("stripe");
    setMsg(null);
    const { synced, error } = await syncStripe(org.id);
    setBusy(null);
    setMsg(error ? `Stripe sync failed: ${error.message}` : `✓ Synced ${synced} customer${synced === 1 ? "" : "s"} from Stripe into your CRM.`);
    await load();
  };

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-2xl border border-gold/25 bg-glass px-4 py-3 text-sm text-foreground/85">{msg}</p>}
      <FormEndpointCard />
      <WebhooksCard />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SlackCard conn={statusOf("slack")} onChange={load} />
        {PROVIDERS.map((p, i) => {
          const conn = statusOf(p.id);
          const connected = conn?.status === "connected";
          const lastSync = (conn?.config as { last_sync?: string } | undefined)?.last_sync;
          return (
            <Reveal key={p.id} delay={i * 50} className="h-full">
              <GlassCard className="flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl border border-border bg-glass"><p.icon className="size-5 text-gold" /></span>
                  {connected && <span className="flex items-center gap-1.5 text-xs text-emerald-300"><StatusDot tone="ok" /> Connected</span>}
                  {p.kind === "soon" && !connected && <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] text-muted-foreground">Setup required</span>}
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">{p.name}</p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">{p.desc}</p>
                {lastSync && <p className="mt-1 text-[0.65rem] text-muted-foreground">Last sync {new Date(lastSync).toLocaleString()}</p>}
                {p.kind === "sync" ? (
                  <button onClick={doSyncStripe} disabled={busy === p.id} className="mt-4 rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--gradient-gold)" }}>
                    {busy === p.id ? "Syncing…" : connected ? "Sync now" : "Connect & sync"}
                  </button>
                ) : (
                  <button disabled title="Needs a developer app — coming soon" className="mt-4 cursor-not-allowed rounded-full border border-border bg-glass px-4 py-2 text-xs text-muted-foreground/70">
                    Available soon
                  </button>
                )}
              </GlassCard>
            </Reveal>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Stripe reuses your existing key — no setup needed. OAuth connectors (Shopify, QuickBooks…) are on the roadmap.</p>
    </div>
  );
}

function SecurityView() {
  const [twoFa, setTwoFa] = useState(true);
  const [sso, setSso] = useState(false);
  const [strongPw, setStrongPw] = useState(true);
  const [ipAllow, setIpAllow] = useState(false);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Reveal className="h-full">
        <GlassCard className="h-full p-6">
          <SectionLabel icon={ShieldCheck}>Authentication</SectionLabel>
          <div className="mt-2 divide-y divide-border">
            <SettingRow label="Two-factor authentication" desc="Require 2FA for every team member"><Toggle on={twoFa} onChange={setTwoFa} /></SettingRow>
            <SettingRow label="Single sign-on (SAML)" desc="Log in with your identity provider"><Toggle on={sso} onChange={setSso} /></SettingRow>
            <SettingRow label="Strong password policy" desc="12+ chars, rotation every 90 days"><Toggle on={strongPw} onChange={setStrongPw} /></SettingRow>
            <SettingRow label="IP allowlist" desc="Restrict access to known networks"><Toggle on={ipAllow} onChange={setIpAllow} /></SettingRow>
            <SettingRow label="Session timeout" desc="Auto-logout after inactivity"><select className="rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-gold/50"><option>30 min</option><option>1 hour</option><option>8 hours</option></select></SettingRow>
          </div>
        </GlassCard>
      </Reveal>

      <Reveal className="h-full" delay={80}>
        <GlassCard className="h-full p-6">
          <SectionLabel icon={Lock}>Active sessions</SectionLabel>
          <div className="mt-4 space-y-2">
            {sessions.map((s) => (
              <div key={s.device} className="flex items-center gap-3 rounded-2xl border border-border bg-background/30 p-3">
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-glass"><Server className="size-4 text-gold" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm text-foreground/90">{s.device} {s.current && <span className="ml-1 text-xs text-gold">· this device</span>}</p><p className="text-xs text-muted-foreground">{s.loc} · {s.last}</p></div>
                {!s.current && <button className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-rose-400/50 hover:text-rose-300"><Trash2 className="size-3.5" /></button>}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-gold/25 bg-glass p-3 text-xs text-foreground/80"><ShieldCheck className="size-4 text-gold" /> Security posture: strong. No anomalies detected.</div>
        </GlassCard>
      </Reveal>
    </div>
  );
}

function AuditView() {
  const [q, setQ] = useState("");
  const filtered = auditLog.filter((l) => (l.actor + l.action + l.cat).toLowerCase().includes(q.toLowerCase()));
  return (
    <Reveal>
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel icon={ScrollText}>Audit log</SectionLabel>
          <label className="flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-2 focus-within:border-gold/50">
            <Search className="size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-32 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          </label>
        </div>
        <div className="mt-5 space-y-1">
          {filtered.map((l, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
              <Avatar name={l.actor === "System" ? "S Y" : l.actor} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm text-foreground/90"><span className="font-medium">{l.actor}</span> {l.action}</p><p className="text-xs text-muted-foreground">{l.time} · {l.ip}</p></div>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium" style={{ color: catColor[l.cat], background: `color-mix(in oklch, ${catColor[l.cat]} 14%, transparent)` }}>{l.cat}</span>
            </div>
          ))}
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No matching events.</p>}
        </div>
      </GlassCard>
    </Reveal>
  );
}

function MonitoringView() {
  const meters = [{ label: "API quota", value: 62, note: "620k / 1M calls" }, { label: "Storage", value: 41, note: "41 / 100 GB" }, { label: "Seats", value: 53, note: "8 / 15 used" }];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Uptime (30d)" value={99.98} suffix="%" decimals={2} icon={Activity} />
        <StatTile label="Avg latency" value={142} suffix=" ms" positive icon={Zap} />
        <StatTile label="Requests today" value={1240000} icon={Server} />
        <StatTile label="Error rate" value={0.02} suffix="%" decimals={2} positive icon={AlertTriangle} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="h-full">
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Server}>Service status</SectionLabel>
            <div className="mt-4 space-y-1">
              {services.map((s) => (
                <div key={s.name} className="flex items-center gap-3 rounded-xl px-2 py-3">
                  <StatusDot tone={s.tone} />
                  <span className="flex-1 text-sm text-foreground/90">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.note}</span>
                  <span className="text-xs" style={{ color: s.tone === "ok" ? "oklch(0.72 0.14 155)" : "oklch(0.84 0.14 84)" }}>{s.tone === "ok" ? "Operational" : "Degraded"}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
        <Reveal className="h-full" delay={80}>
          <GlassCard className="h-full p-6">
            <SectionLabel icon={Database}>Usage</SectionLabel>
            <div className="mt-5 space-y-5">
              {meters.map((m) => (
                <div key={m.label}>
                  <div className="flex items-baseline justify-between text-sm"><span className="text-foreground/85">{m.label}</span><span className="text-xs text-muted-foreground">{m.note}</span></div>
                  <div className="mt-2"><Bar value={m.value} /></div>
                </div>
              ))}
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}

function BillingView() {
  const { org, role } = useOrg();
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = role === "owner" || role === "admin";

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("billing");
    if (p === "success") setNotice("Payment received — your plan is activating. It'll refresh here in a moment.");
    if (p === "cancelled") setNotice("Checkout cancelled — no charge was made.");
  }, []);

  useEffect(() => {
    if (!org) return;
    let alive = true;
    let tries = 0;
    const justPaid = new URLSearchParams(window.location.search).get("billing") === "success";
    async function load() {
      const s = await getSubscription(org!.id);
      if (!alive) return;
      setSub(s);
      setLoading(false);
      // After a payment the webhook lands a moment later — poll until the
      // active plan appears (up to ~15s) so the page updates on its own.
      const active = s && (s.status === "active" || s.status === "trialing");
      if (justPaid && !active && tries < 6) {
        tries += 1;
        setTimeout(load, 2500);
      }
    }
    setLoading(true);
    void load();
    return () => {
      alive = false;
    };
  }, [org?.id]);

  const activePlan = sub && (sub.status === "active" || sub.status === "trialing") ? sub.plan : null;
  const renews = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

  async function choose(plan: PlanId) {
    if (!org) return;
    setError(null);
    setBusy(plan);
    try {
      await startCheckout(plan, org.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(null);
    }
  }

  const [portalBusy, setPortalBusy] = useState(false);
  async function manageBilling() {
    if (!org) return;
    setError(null);
    setPortalBusy(true);
    try {
      await openBillingPortal(org.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the billing portal.");
      setPortalBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {notice && (
        <Reveal>
          <div className="flex items-center gap-2 rounded-2xl border border-gold/30 bg-glass px-4 py-3 text-sm text-foreground/85">
            <Sparkles className="size-4 text-gold" /> {notice}
          </div>
        </Reveal>
      )}
      {error && (
        <Reveal>
          <div className="flex items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle className="size-4" /> {error}
          </div>
        </Reveal>
      )}

      <Reveal>
        <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl border border-gold/25 bg-glass"><CreditCard className="size-5 text-gold" /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
              {loading ? (
                <p className="mt-1 flex items-center gap-2 text-lg text-foreground/70"><Loader2 className="size-4 animate-spin" /> Loading…</p>
              ) : (
                <p className="mt-0.5 text-2xl text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                  {activePlan ? <span className="gold-text italic">{PLANS.find((p) => p.id === activePlan)?.name ?? activePlan}</span> : <span className="italic text-muted-foreground">No active plan</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right text-xs text-muted-foreground">
              {activePlan ? (
                <>
                  <p className="flex items-center justify-end gap-1.5 text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400" /> {sub?.status}</p>
                  {renews && <p className="mt-1">Renews {renews}</p>}
                </>
              ) : (
                <p>Choose a plan below to unlock your full workspace.</p>
              )}
            </div>
            {activePlan && canManage && (
              <button
                onClick={manageBilling}
                disabled={portalBusy}
                className="flex items-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-xs font-medium text-foreground/85 transition-colors hover:border-gold/40 disabled:opacity-50"
              >
                {portalBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
                Manage billing
              </button>
            )}
          </div>
        </GlassCard>
      </Reveal>

      {!canManage && (
        <p className="text-xs text-muted-foreground">Only owners and admins can change the plan.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan, i) => {
          const isCurrent = activePlan === plan.id;
          return (
            <Reveal key={plan.id} delay={i * 70} className="h-full">
              <GlassCard className={cn("flex h-full flex-col p-6", plan.popular ? "border-gold/50" : "", isCurrent && "ring-1 ring-gold/40")}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                  {plan.popular && <span className="rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground" style={{ background: "var(--gradient-gold)" }}>Most popular</span>}
                </div>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>${plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{plan.tagline}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/85">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => choose(plan.id)}
                  disabled={isCurrent || !canManage || busy !== null}
                  className={cn(
                    "mt-6 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed",
                    isCurrent
                      ? "border border-gold/40 bg-glass text-foreground/70"
                      : "text-primary-foreground hover:brightness-110 disabled:opacity-50",
                  )}
                  style={!isCurrent ? { background: "var(--gradient-gold)", boxShadow: plan.popular ? "var(--shadow-gold)" : undefined } : undefined}
                >
                  {busy === plan.id ? (
                    <><Loader2 className="size-4 animate-spin" /> Redirecting…</>
                  ) : isCurrent ? (
                    <><Check className="size-4" /> Current plan</>
                  ) : activePlan ? (
                    `Switch to ${plan.name}`
                  ) : (
                    `Choose ${plan.name}`
                  )}
                </button>
              </GlassCard>
            </Reveal>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Secure checkout by Stripe · Test mode · Cancel anytime. Prices in USD.
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Workspace shell
 * ─────────────────────────────────────────────────────────────────── */

const viewMeta: Record<ViewKey, { title: string; sub: string }> = {
  settings: { title: "Business settings", sub: "Complete control of your OS" },
  billing: { title: "Billing & plan", sub: "Your subscription" },
  users: { title: "Users", sub: "Manage your team" },
  roles: { title: "Roles", sub: "Who can do what" },
  permissions: { title: "Permissions", sub: "Fine-grained access control" },
  ai: { title: "AI configuration", sub: "Tune your AI's behavior" },
  integrations: { title: "Integrations", sub: "Connect your tools" },
  security: { title: "Security", sub: "Protect your business" },
  audit: { title: "Audit logs", sub: "Every action, recorded" },
  monitoring: { title: "System monitoring", sub: "Health of your platform" },
};

export function AdminWorkspace() {
  const [active, setActive] = useState<ViewKey>("settings");
  const meta = viewMeta[active];
  return (
    <div className="mx-auto flex max-w-[110rem] gap-6 px-4 py-6 lg:px-6">
      <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col rounded-3xl p-5 !hidden">
        <Brand subtle />
        <p className="mt-6 flex items-center gap-1.5 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-gold"><Shield className="size-3" /> Administration</p>
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
          <span className="flex items-center gap-2 rounded-full border border-gold/25 bg-glass px-4 py-2 text-xs text-foreground/80"><ShieldCheck className="size-4 text-gold" /> Owner access</span>
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
          {active === "settings" && <SettingsView />}
          {active === "billing" && <BillingView />}
          {active === "users" && <UsersView />}
          {active === "roles" && <RolesView />}
          {active === "permissions" && <PermissionsView />}
          {active === "ai" && <AiConfigView />}
          {active === "integrations" && <IntegrationsView />}
          {active === "security" && <SecurityView />}
          {active === "audit" && <AuditView />}
          {active === "monitoring" && <MonitoringView />}
        </div>
      </section>
    </div>
  );
}
