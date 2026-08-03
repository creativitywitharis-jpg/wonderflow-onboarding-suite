import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Lock, Mail, User } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Field, GhostButton, GlassCard, GoldButton, inputClass } from "@/components/wf/ui";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — WonderFlow OS" },
      {
        name: "description",
        content:
          "Create your WonderFlow OS workspace or sign back in to continue your business onboarding.",
      },
      { property: "og:title", content: "Sign in — WonderFlow OS" },
      {
        property: "og:description",
        content: "Create your workspace or sign back in to continue onboarding.",
      },
    ],
  }),
  component: AuthScreen,
});

const perks = [
  "AI intake that maps your operating model",
  "Transformation score in under 6 minutes",
  "A workspace pre-built around your goals",
];

function AuthScreen() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    window.setTimeout(() => navigate({ to: "/onboarding" }), 900);
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      <Backdrop intensity={0.7} />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7">
        <Brand />
        <Link to="/">
          <GhostButton className="px-5 py-2.5">Back</GhostButton>
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-6 pb-16 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <div className="rise hidden lg:block">
          <h1
            className="text-balance text-4xl leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your <span className="gold-text italic">digital chief of staff</span> is ready to be
            introduced.
          </h1>
          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="grid size-5 place-items-center rounded-full border border-gold/40 text-gold">
                  <Check className="size-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <GlassCard className="rise p-7" style={{ animationDelay: "100ms" }}>
          <div className="flex rounded-full border border-border p-1 text-sm">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full px-4 py-2 font-medium transition-all ${
                  mode === m
                    ? "bg-glass text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input required className={`${inputClass} pl-10`} placeholder="Ava Lindqvist" />
                </div>
              </Field>
            )}
            <Field label="Work email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  required
                  type="email"
                  className={`${inputClass} pl-10`}
                  placeholder="ava@company.com"
                />
              </div>
            </Field>
            <Field label="Password" hint="Minimum 10 characters, one symbol.">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  required
                  type="password"
                  minLength={6}
                  className={`${inputClass} pl-10`}
                  placeholder="••••••••••"
                />
              </div>
            </Field>

            <GoldButton type="submit" disabled={pending} className="w-full">
              {pending ? (
                "Preparing your workspace…"
              ) : (
                <>
                  {mode === "signup" ? "Create workspace" : "Continue"}
                  <ArrowRight className="size-4" />
                </>
              )}
            </GoldButton>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Protected by enterprise SSO, SOC 2 Type II controls and regional data residency.
          </p>
        </GlassCard>
      </div>
    </main>
  );
}