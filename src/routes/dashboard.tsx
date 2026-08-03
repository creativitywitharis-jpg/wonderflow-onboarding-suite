import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CircleDollarSign,
  Home,
  Inbox,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { GhostButton, GlassCard } from "@/components/wf/ui";
import { loadOnboarding } from "@/lib/onboarding-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — WonderFlow OS" },
      {
        name: "description",
        content:
          "Your WonderFlow command center: live revenue signals, AI-run workflows and a daily executive briefing from your digital chief of staff.",
      },
      { property: "og:title", content: "Command Center — WonderFlow OS" },
      {
        property: "og:description",
        content: "Live signals, AI-run workflows and a daily executive briefing.",
      },
    ],
  }),
  component: Dashboard,
});

const nav = [
  { icon: Home, label: "Overview" },
  { icon: Workflow, label: "Workflows" },
  { icon: CircleDollarSign, label: "Revenue" },
  { icon: Users, label: "People" },
  { icon: Inbox, label: "Briefings" },
  { icon: Settings, label: "Settings" },
];

const metrics = [
  { label: "Net revenue", value: "$412,908", delta: "+12.4%" },
  { label: "Operating drag", value: "18.2 hrs", delta: "-24%" },
  { label: "Automations live", value: "23", delta: "+7" },
  { label: "Decision velocity", value: "3.4x", delta: "+0.8" },
];

const spark = [32, 40, 36, 52, 48, 61, 58, 72, 69, 84, 79, 96];

const actions = [
  { title: "Renegotiate two supplier contracts", impact: "$14.2k / quarter" },
  { title: "Automate invoice reconciliation", impact: "9 hrs / week" },
  { title: "Re-engage 148 dormant accounts", impact: "$31k pipeline" },
];

function Dashboard() {
  const [company, setCompany] = useState("your business");

  useEffect(() => {
    const d = loadOnboarding();
    if (d.company.trim()) setCompany(d.company.trim());
  }, []);

  return (
    <main className="relative min-h-screen">
      <Backdrop intensity={0.35} />

      <div className="mx-auto flex max-w-7xl gap-6 px-5 py-6">
        <aside className="glass sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col rounded-3xl p-5 lg:flex">
          <Brand subtle />
          <nav className="mt-8 space-y-1">
            {nav.map((n, i) => (
              <button
                key={n.label}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  i === 0
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-glass hover:text-foreground"
                }`}
                style={i === 0 ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
              >
                <n.icon className={`size-4 ${i === 0 ? "text-gold" : ""}`} />
                {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-border p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Your assistant is monitoring 6 systems in real time.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-5">
          <div className="rise flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Monday briefing
              </p>
              <h1
                className="mt-2 text-3xl tracking-tight sm:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Good evening, <span className="gold-text italic">{company}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <GhostButton className="px-4 py-2.5">
                <Bell className="size-4" /> 4
              </GhostButton>
              <Link to="/score">
                <GhostButton className="px-4 py-2.5">View score</GhostButton>
              </Link>
            </div>
          </div>

          <GlassCard className="rise p-6" style={{ animationDelay: "80ms" }}>
            <div className="flex items-start gap-4">
              <span
                className="orb grid size-10 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--gradient-gold)" }}
              >
                <Sparkles className="size-5" stroke="oklch(0.2 0.02 70)" />
              </span>
              <div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  Cash position is healthy and fulfilment latency dropped for the third week running.
                  I found <span className="text-gold">three moves</span> worth roughly
                  <span className="text-gold"> $45k</span> this quarter — I can execute the first two
                  on your approval.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <button
                      key={a.title}
                      className="group flex items-center gap-2 rounded-full border border-border bg-glass px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                    >
                      {a.title}
                      <span className="text-gold">{a.impact}</span>
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m, i) => (
              <GlassCard key={m.label} className="rise p-5" style={{ animationDelay: `${140 + i * 70}ms` }}>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{m.label}</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight">{m.value}</p>
                <p className="mt-1 text-xs text-gold">{m.delta} vs last month</p>
              </GlassCard>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <GlassCard className="rise p-6" style={{ animationDelay: "420ms" }}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Operating momentum
                </h2>
                <span className="text-xs text-muted-foreground">Last 12 weeks</span>
              </div>
              <div className="mt-6 flex h-40 items-end gap-2">
                {spark.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md transition-all duration-700"
                    style={{
                      height: `${v}%`,
                      background:
                        i === spark.length - 1 ? "var(--gradient-gold)" : "oklch(0.84 0.14 84 / 22%)",
                    }}
                  />
                ))}
              </div>
            </GlassCard>

            <GlassCard className="rise p-6" style={{ animationDelay: "480ms" }}>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Live workflows
              </h2>
              <ul className="mt-5 space-y-4">
                {[
                  ["Order → fulfilment sync", "running"],
                  ["Weekly cash forecast", "running"],
                  ["Churn risk watch", "learning"],
                  ["Supplier price alerts", "queued"],
                ].map(([name, state]) => (
                  <li key={name} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/85">{name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`size-1.5 rounded-full ${state === "running" ? "bg-gold orb" : "bg-border"}`}
                      />
                      {state}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </section>
      </div>
    </main>
  );
}