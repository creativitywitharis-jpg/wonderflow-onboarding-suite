import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Eyebrow, GhostButton, GlassCard, GoldButton } from "@/components/wf/ui";
import { loadOnboarding, scoreFor, type OnboardingData } from "@/lib/onboarding-store";

export const Route = createFileRoute("/score")({
  head: () => ({
    meta: [
      { title: "Your Business Transformation Score — WonderFlow OS" },
      {
        name: "description",
        content:
          "See your WonderFlow transformation score: automation readiness, data maturity, and the levers with the highest projected impact.",
      },
      { property: "og:title", content: "Your Business Transformation Score — WonderFlow OS" },
      {
        property: "og:description",
        content: "Automation readiness, data maturity and your highest-impact levers.",
      },
    ],
  }),
  component: ScoreScreen,
});

const breakdown = [
  { label: "Automation readiness", weight: 0.94 },
  { label: "Data maturity", weight: 0.71 },
  { label: "Team leverage", weight: 0.83 },
  { label: "Revenue intelligence", weight: 0.62 },
];

function ScoreScreen() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setData(loadOnboarding());
  }, []);

  const target = data ? scoreFor(data) : 0;

  useEffect(() => {
    if (!target) return;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const t = Math.min(1, frame / 60);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [target]);

  const circumference = 2 * Math.PI * 88;
  const company = data?.company?.trim() || "your business";

  return (
    <main className="relative min-h-screen">
      <Backdrop intensity={0.9} />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-7">
        <Brand subtle />
        <Link to="/onboarding">
          <GhostButton className="px-5 py-2.5">Revise answers</GhostButton>
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-24 text-center">
        <div className="rise">
          <Eyebrow>Analysis complete</Eyebrow>
        </div>
        <h1
          className="rise mt-6 text-4xl tracking-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display)", animationDelay: "60ms" }}
        >
          Transformation score for <span className="gold-text italic">{company}</span>
        </h1>

        <div className="rise mt-10 grid gap-6 lg:grid-cols-[22rem_1fr]" style={{ animationDelay: "140ms" }}>
          <GlassCard className="grid place-items-center p-8">
            <div className="relative grid size-56 place-items-center">
              <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
                <circle cx="100" cy="100" r="88" fill="none" stroke="var(--color-border)" strokeWidth="10" />
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="var(--gold)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - shown / 100)}
                  style={{ transition: "stroke-dashoffset 120ms linear" }}
                />
              </svg>
              <div>
                <div className="text-6xl font-semibold tracking-tight gold-text">{shown}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  out of 100
                </div>
              </div>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4 text-gold" />
              Top {Math.max(6, 100 - shown)}% of comparable operators
            </p>
          </GlassCard>

          <div className="grid gap-4">
            <GlassCard className="p-6 text-left">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Signal breakdown
              </h2>
              <div className="mt-5 space-y-4">
                {breakdown.map((b) => {
                  const value = Math.round(shown * b.weight);
                  return (
                    <div key={b.label}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-foreground/85">{b.label}</span>
                        <span className="tabular-nums text-gold">{value}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full transition-[width] duration-200"
                          style={{ width: `${value}%`, background: "var(--gradient-gold)" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="p-6 text-left">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Projected 90-day impact
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  ["+18h", "reclaimed weekly"],
                  ["-24%", "operating drag"],
                  ["3.4x", "decision velocity"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <div className="text-2xl font-semibold tracking-tight text-foreground">{v}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        <div className="rise mt-10" style={{ animationDelay: "220ms" }}>
          <Link to="/dashboard">
            <GoldButton>
              Reveal my workspace <ArrowRight className="size-4" />
            </GoldButton>
          </Link>
        </div>
      </section>
    </main>
  );
}