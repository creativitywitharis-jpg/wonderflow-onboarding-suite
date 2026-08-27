import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Field, GhostButton, GlassCard, GoldButton, inputClass } from "@/components/wf/ui";
import { emptyOnboarding, saveOnboarding, type OnboardingData } from "@/lib/onboarding-store";
import { createOrganization, enabledModulesFor, INDUSTRIES as industries } from "@/lib/org";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Business Onboarding — WonderFlow OS" },
      {
        name: "description",
        content:
          "A guided, AI-led intake that maps your company, goals and systems into a WonderFlow operating model.",
      },
      { property: "og:title", content: "Business Onboarding — WonderFlow OS" },
      {
        property: "og:description",
        content: "A guided, AI-led intake that maps your company into an operating model.",
      },
    ],
  }),
  component: Onboarding,
});

const steps = ["Company", "Ambition", "Systems", "AI setup"] as const;

const sizes = ["1–9", "10–49", "50–199", "200+"];
const revenues = ["< $500k", "$500k–$5M", "$5M–$50M", "$50M+"];
const goalOptions = [
  "Automate operations",
  "Grow revenue",
  "Cut costs",
  "Improve retention",
  "Hire and scale the team",
  "Get real-time visibility",
];
const stackOptions = ["Shopify", "Stripe", "HubSpot", "Notion", "Slack", "QuickBooks", "Salesforce", "Google Workspace"];

const agentTasks = [
  "Reading your operating context",
  "Mapping revenue and cost signals",
  "Configuring intelligent workflows",
  "Drafting your executive briefing",
  "Calibrating transformation score",
];

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-all duration-300 ${
        active
          ? "border-gold/60 text-foreground shadow-[0_0_30px_-12px_var(--gold)]"
          : "border-border bg-glass text-muted-foreground hover:border-gold/30 hover:text-foreground"
      }`}
      style={active ? { background: "oklch(0.84 0.14 84 / 12%)" } : undefined}
    >
      {children}
    </button>
  );
}

function Onboarding() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(emptyOnboarding);
  const [otherIndustry, setOtherIndustry] = useState(false);
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Must be signed in to create a workspace.
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggle = (key: "goals" | "stack", value: string) =>
    setData((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  const canAdvance = useMemo(() => {
    if (step === 0) return data.company.trim().length > 1 && !!data.industry && !!data.size;
    if (step === 1) return data.goals.length > 0 && !!data.revenue;
    if (step === 2) return true;
    return true;
  }, [step, data]);

  return (
    <main className="relative min-h-screen">
      <Backdrop intensity={0.6} />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-7">
        <Brand subtle />
        <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Step {Math.min(step + 1, steps.length)} / {steps.length}
        </span>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 pb-24">
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className="h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: i <= step ? "100%" : "0%",
                    background: "var(--gradient-gold)",
                  }}
                />
              </div>
              <span
                className={`mt-2 block text-[0.68rem] uppercase tracking-[0.18em] ${
                  i <= step ? "text-gold" : "text-muted-foreground"
                }`}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

        <GlassCard key={step} className="rise mt-8 p-7 sm:p-9">
          {step === 0 && (
            <div className="space-y-6">
              <Header
                title="Tell me about the business"
                sub="I'll use this to shape every recommendation that follows."
              />
              <Field label="Company name">
                <input
                  autoFocus
                  className={inputClass}
                  value={data.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Northwind Studio"
                />
              </Field>
              <Field label="Industry">
                <div className="flex flex-wrap gap-2">
                  {industries.map((i) => (
                    <Chip
                      key={i}
                      active={!otherIndustry && data.industry === i}
                      onClick={() => {
                        setOtherIndustry(false);
                        set("industry", i);
                      }}
                    >
                      {i}
                    </Chip>
                  ))}
                  <Chip
                    active={otherIndustry}
                    onClick={() => {
                      setOtherIndustry(true);
                      set("industry", "");
                    }}
                  >
                    Other…
                  </Chip>
                </div>
                {otherIndustry && (
                  <input
                    autoFocus
                    className={`${inputClass} mt-3`}
                    value={data.industry}
                    onChange={(e) => set("industry", e.target.value)}
                    placeholder="Your industry — e.g. Banking, Legal, Agriculture, Government"
                  />
                )}
              </Field>
              <Field label="Team size">
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <Chip key={s} active={data.size === s} onClick={() => set("size", s)}>
                      {s} people
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Header
                title="What should we move first?"
                sub="Pick the outcomes that matter this quarter — I'll prioritise around them."
              />
              <Field label="Annual revenue">
                <div className="flex flex-wrap gap-2">
                  {revenues.map((r) => (
                    <Chip key={r} active={data.revenue === r} onClick={() => set("revenue", r)}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Primary goals" hint="Select as many as apply.">
                <div className="flex flex-wrap gap-2">
                  {goalOptions.map((g) => (
                    <Chip key={g} active={data.goals.includes(g)} onClick={() => toggle("goals", g)}>
                      {g}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Biggest operational bottleneck">
                <textarea
                  rows={3}
                  className={inputClass}
                  value={data.challenge}
                  onChange={(e) => set("challenge", e.target.value)}
                  placeholder="Order handoffs between sales and fulfilment take three days…"
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Header
                title="Which systems should I connect?"
                sub="WonderFlow reads from these to build a single operating picture."
              />
              <div className="flex flex-wrap gap-2">
                {stackOptions.map((s) => (
                  <Chip key={s} active={data.stack.includes(s)} onClick={() => toggle("stack", s)}>
                    {data.stack.includes(s) && <Check className="mr-1 inline size-3.5 text-gold" />}
                    {s}
                  </Chip>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Connections are read-only until you approve each automation.
              </p>
            </div>
          )}

          {step === 3 && <AISetup data={data} onDone={() => navigate({ to: "/score" })} />}

          {step < 3 && (
            <div className="mt-9 flex items-center justify-between gap-3">
              <GhostButton
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="px-5 py-2.5"
              >
                <ArrowLeft className="size-4" /> Back
              </GhostButton>
              <GoldButton
                disabled={!canAdvance}
                onClick={() => {
                  saveOnboarding(data);
                  setStep((s) => s + 1);
                }}
              >
                Continue <ArrowRight className="size-4" />
              </GoldButton>
            </div>
          )}
        </GlassCard>
      </div>
    </main>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="text-2xl tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function AISetup({ data, onDone }: { data: OnboardingData; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [orgReady, setOrgReady] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const createdRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    saveOnboarding(data);
    // Create the real organization once (guarded against React strict double-run).
    if (!createdRef.current) {
      createdRef.current = true;
      createOrganization({
        name: data.company || "My business",
        industry: data.industry || undefined,
        enabledModules: enabledModulesFor(data.industry || undefined),
      }).then(({ error }) => (error ? setOrgError(error.message) : setOrgReady(true)));
    }
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= agentTasks.length) {
          window.clearInterval(id);
          return p;
        }
        return p + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [data]);

  const done = progress >= agentTasks.length && orgReady;

  return (
    <div className="space-y-7">
      <div className="flex items-start gap-4">
        <span
          className="orb mt-1 grid size-11 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--gradient-gold)" }}
        >
          <Sparkles className="size-5" stroke="oklch(0.2 0.02 70)" />
        </span>
        <div>
          <h1
            className="text-2xl tracking-tight sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {done ? "Your operating model is ready." : "Give me a moment, I'm building it."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {done
              ? `I've assembled a workspace tuned to ${data.company || "your business"}.`
              : "Synthesising your answers into a live operating model."}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {agentTasks.map((t, i) => {
          const state = i < progress ? "done" : i === progress ? "active" : "idle";
          return (
            <div
              key={t}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-all duration-500 ${
                state === "idle"
                  ? "border-transparent text-muted-foreground/50"
                  : "border-border text-foreground/90"
              }`}
              style={state === "active" ? { background: "var(--glass)" } : undefined}
            >
              <span
                className={`grid size-5 place-items-center rounded-full border ${
                  state === "done" ? "border-gold/60 text-gold" : "border-border"
                }`}
              >
                {state === "done" ? (
                  <Check className="size-3" />
                ) : (
                  <span className={state === "active" ? "size-1.5 rounded-full bg-gold orb" : "size-1.5 rounded-full bg-border"} />
                )}
              </span>
              <span className="flex-1">{t}</span>
              {state === "active" && <span className="shimmer-line h-px w-16 rounded-full" />}
            </div>
          );
        })}
      </div>

      {orgError ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Couldn't create your workspace: {orgError}
          </p>
          <GhostButton onClick={() => navigate({ to: "/auth" })} className="w-full">
            Back to sign in
          </GhostButton>
        </div>
      ) : (
        <GoldButton disabled={!done} onClick={onDone} className="w-full">
          {done ? (
            <>
              See my transformation score <ArrowRight className="size-4" />
            </>
          ) : (
            "Working…"
          )}
        </GoldButton>
      )}
    </div>
  );
}