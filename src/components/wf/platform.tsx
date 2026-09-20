import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Building2, CreditCard, MessageSquare, ShieldAlert, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/wf/ui";
import { Brand } from "@/components/wf/Brand";
import { Avatar, Reveal, SectionLabel, StatTile } from "@/components/wf/primitives";
import {
  isPlatformAdmin,
  listAllFeedback,
  listAllOrgs,
  listAllSubscriptions,
  type PlatformFeedback,
  type PlatformOrg,
  type PlatformSubscription,
} from "@/lib/platform-admin";

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const statusColor: Record<string, string> = {
  active: "oklch(0.72 0.14 155)",
  trialing: "oklch(0.84 0.14 84)",
  past_due: "oklch(0.68 0.16 25)",
  canceled: "oklch(0.7 0.02 250)",
  incomplete: "oklch(0.7 0.02 250)",
  inactive: "oklch(0.7 0.02 250)",
};

const FEEDBACK_LABEL: Record<string, string> = { concern: "Concern", integration_request: "Integration request", review: "Review" };

type ViewKey = "businesses" | "subscriptions" | "feedback";
const views: { key: ViewKey; label: string; icon: typeof Building2 }[] = [
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { key: "feedback", label: "Suggestions & Reviews", icon: MessageSquare },
];

export function PlatformWorkspace() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [active, setActive] = useState<ViewKey>("businesses");
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [subs, setSubs] = useState<PlatformSubscription[]>([]);
  const [feedback, setFeedback] = useState<PlatformFeedback[]>([]);

  useEffect(() => {
    let alive = true;
    isPlatformAdmin().then((ok) => {
      if (!alive) return;
      setAllowed(ok);
      if (!ok) {
        navigate({ to: "/dashboard" });
        return;
      }
      Promise.all([listAllOrgs(), listAllSubscriptions(), listAllFeedback()]).then(([o, s, f]) => {
        if (!alive) return;
        setOrgs(o);
        setSubs(s);
        setFeedback(f);
        setLoading(false);
      });
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (allowed === null || allowed === false) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing").length;
  const reviews = feedback.filter((f) => f.type === "review" && f.rating);
  const avgRating = reviews.length ? Math.round((reviews.reduce((a, r) => a + (r.rating ?? 0), 0) / reviews.length) * 10) / 10 : null;

  return (
    <div className="mx-auto max-w-[100rem] space-y-5 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Brand subtle />
          <span className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-glass px-3 py-1.5 text-[0.65rem] uppercase tracking-wide text-gold"><ShieldAlert className="size-3" /> Platform owner</span>
        </div>
        <Link to="/dashboard" className="flex items-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to your workspace
        </Link>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Every business on WonderFlow</p>
        <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          <span className="gold-text italic">Platform</span>
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Businesses signed up" value={orgs.length} icon={Building2} />
        <StatTile label="Active subscriptions" value={activeSubs} icon={CreditCard} />
        <StatTile label="Suggestions & reviews" value={feedback.length} icon={MessageSquare} />
        <StatTile label="Avg. review rating" value={avgRating ?? 0} suffix={avgRating ? "/5" : ""} icon={Star} />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {views.map((v) => (
          <button key={v.key} onClick={() => setActive(v.key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", active === v.key ? "border-gold/50 text-foreground" : "border-border bg-glass text-muted-foreground")} style={active === v.key ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}>
            <v.icon className="size-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <GlassCard className="p-10 text-center text-sm text-muted-foreground">Loading…</GlassCard>
      ) : (
        <>
          {active === "businesses" && (
            <Reveal>
              <GlassCard className="p-5 sm:p-6">
                <SectionLabel icon={Building2}>Businesses</SectionLabel>
                {orgs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No businesses have signed up yet.</p>}
                <div className="mt-4 space-y-1">
                  {orgs.map((o) => (
                    <div key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl px-3 py-3 hover:bg-glass sm:grid-cols-[1.6fr_1fr_0.8fr_auto]">
                      <div className="flex items-center gap-3">
                        <Avatar name={o.name} />
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{o.name}</p><p className="truncate text-xs text-muted-foreground">{o.owner_name ?? o.owner_email ?? "No owner on record"}</p></div>
                      </div>
                      <span className="hidden truncate text-xs text-muted-foreground sm:block">{o.industry ?? "—"}</span>
                      <span className="hidden rounded-full border border-border px-2 py-0.5 text-center text-[0.65rem] capitalize text-muted-foreground sm:block">{o.plan}</span>
                      <span className="text-right text-xs text-muted-foreground">{timeAgo(o.created_at)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </Reveal>
          )}

          {active === "subscriptions" && (
            <Reveal>
              <GlassCard className="p-5 sm:p-6">
                <SectionLabel icon={CreditCard}>Subscriptions</SectionLabel>
                {subs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No subscription records yet.</p>}
                <div className="mt-4 space-y-1">
                  {subs.map((s) => (
                    <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl px-3 py-3 hover:bg-glass sm:grid-cols-[1.6fr_0.8fr_1fr_auto]">
                      <p className="truncate text-sm font-medium text-foreground">{s.org_name}</p>
                      <span className="hidden text-xs capitalize text-muted-foreground sm:block">{s.plan}</span>
                      <span className="hidden items-center gap-1.5 text-xs capitalize sm:flex" style={{ color: statusColor[s.status] ?? statusColor.inactive }}><span className="size-1.5 rounded-full" style={{ background: statusColor[s.status] ?? statusColor.inactive }} />{s.status.replace("_", " ")}</span>
                      <span className="text-right text-xs text-muted-foreground">{s.current_period_end ? `renews ${new Date(s.current_period_end).toLocaleDateString()}` : timeAgo(s.created_at)}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </Reveal>
          )}

          {active === "feedback" && (
            <Reveal>
              <GlassCard className="p-5 sm:p-6">
                <SectionLabel icon={MessageSquare}>Suggestions &amp; reviews</SectionLabel>
                {feedback.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing submitted yet.</p>}
                <div className="mt-4 space-y-2">
                  {feedback.map((f) => (
                    <div key={f.id} className="rounded-2xl border border-border bg-background/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border bg-glass px-2.5 py-0.5 text-[0.65rem] text-muted-foreground">{FEEDBACK_LABEL[f.type] ?? f.type}</span>
                          <span className="text-xs text-foreground/85">{f.org_name}</span>
                          <span className="text-xs text-muted-foreground">· {f.submitter_name ?? f.submitter_email ?? "Unknown"}</span>
                        </div>
                        <span className="text-[0.65rem] text-muted-foreground">{timeAgo(f.created_at)}</span>
                      </div>
                      {f.rating && <div className="mt-1.5 flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn("size-3.5", n <= f.rating! ? "fill-gold text-gold" : "text-muted-foreground/30")} />)}</div>}
                      <p className="mt-2 text-sm text-foreground/85">{f.message}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}
