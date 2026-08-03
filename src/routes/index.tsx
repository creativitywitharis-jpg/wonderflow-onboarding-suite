import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, LineChart, ShieldCheck, Sparkles } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Eyebrow, GhostButton, GlassCard, GoldButton } from "@/components/wf/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WonderFlow OS — Your AI Business Operating System" },
      {
        name: "description",
        content:
          "Meet WonderFlow OS: an AI business operating system that onboards your company, scores its readiness, and runs operations like a digital chief of staff.",
      },
      { property: "og:title", content: "WonderFlow OS — Your AI Business Operating System" },
      {
        property: "og:description",
        content: "An AI operating system that runs your business like a digital chief of staff.",
      },
    ],
  }),
  component: Welcome,
});

const pillars = [
  {
    icon: Brain,
    title: "Understands your business",
    body: "A guided intake builds a live model of your operations, teams, and revenue motion.",
  },
  {
    icon: LineChart,
    title: "Scores your readiness",
    body: "A transformation score benchmarks you against 12,000 operators in your category.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise from day one",
    body: "SOC 2 controls, regional data residency, and audit trails on every AI decision.",
  },
];

function Welcome() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Backdrop />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <Brand />
        <div className="flex items-center gap-3">
          <Link to="/auth" className="hidden sm:block">
            <GhostButton className="px-5 py-2.5">Sign in</GhostButton>
          </Link>
          <Link to="/auth">
            <GoldButton className="px-5 py-2.5">Get started</GoldButton>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-16 pb-10 text-center sm:pt-24">
        <div className="rise">
          <Eyebrow>Now welcoming founders · Cohort 04</Eyebrow>
        </div>
        <h1
          className="rise mt-8 text-balance text-5xl leading-[1.05] tracking-tight sm:text-7xl"
          style={{ fontFamily: "var(--font-display)", animationDelay: "80ms" }}
        >
          The operating system that <span className="gold-text italic">runs</span> your business
          with you.
        </h1>
        <p
          className="rise mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          WonderFlow OS interviews you like a chief of staff, maps your operations, and turns them
          into an intelligent workspace — in under six minutes.
        </p>
        <div
          className="rise mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "240ms" }}
        >
          <Link to="/auth">
            <GoldButton className="w-full sm:w-auto">
              Begin onboarding <ArrowRight className="size-4" />
            </GoldButton>
          </Link>
          <Link to="/dashboard">
            <GhostButton className="w-full sm:w-auto">
              <Sparkles className="size-4 text-gold" /> Preview the workspace
            </GhostButton>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {pillars.map((p, i) => (
          <GlassCard
            key={p.title}
            className="rise p-6"
            style={{ animationDelay: `${320 + i * 90}ms` }}
          >
            <p.icon className="size-5 text-gold" />
            <h2 className="mt-4 text-base font-semibold tracking-tight">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </GlassCard>
        ))}
      </section>
    </main>
  );
}
