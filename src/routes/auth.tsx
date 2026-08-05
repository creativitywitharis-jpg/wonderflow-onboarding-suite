import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Lock, Mail, User } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Field, GhostButton, GlassCard, GoldButton, inputClass } from "@/components/wf/ui";
import { supabase } from "@/lib/supabase";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/onboarding" });
        } else {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) setError(error.message);
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
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${inputClass} pl-10`}
                    placeholder="Aisha Imran"
                  />
                </div>
              </Field>
            )}
            <Field label="Work email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="you@company.com"
                />
              </div>
            </Field>
            <Field label="Password" hint="Minimum 6 characters.">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="••••••••••"
                />
              </div>
            </Field>

            {error && (
              <p className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
              </p>
            )}
            {notice && (
              <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-glass px-3 py-2.5 text-xs text-foreground/85">
                <Check className="mt-0.5 size-3.5 shrink-0 text-gold" /> {notice}
              </p>
            )}

            <GoldButton type="submit" disabled={pending} className="w-full">
              {pending ? (
                "Please wait…"
              ) : (
                <>
                  {mode === "signup" ? "Create workspace" : "Sign in"}
                  <ArrowRight className="size-4" />
                </>
              )}
            </GoldButton>
          </form>

          <div className="my-4 flex items-center gap-3 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <GhostButton type="button" onClick={google} className="w-full">
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.25 1.36-1 2.5-2.13 3.28v2.72h3.44c2.02-1.86 3.19-4.6 3.19-7.86 0-.66-.06-1.3-.17-1.9z" />
              <path fill="currentColor" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.44-2.72c-.95.64-2.17 1.02-3.18 1.02-2.45 0-4.53-1.65-5.27-3.88H3.15v2.44C4.8 19.98 8.14 22 12 22z" opacity=".8" />
              <path fill="currentColor" d="M6.73 13.98A5.86 5.86 0 0 1 6.4 12c0-.69.12-1.36.33-1.98V7.58H3.15A9.98 9.98 0 0 0 2 12c0 1.6.38 3.12 1.15 4.42l3.58-2.44z" opacity=".6" />
              <path fill="currentColor" d="M12 6.14c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 3.13 14.7 2 12 2 8.14 2 4.8 4.02 3.15 7.58l3.58 2.44C7.47 7.8 9.55 6.14 12 6.14z" opacity=".9" />
            </svg>
            Continue with Google
          </GhostButton>

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Protected by enterprise controls, encrypted storage and per-business data isolation.
          </p>
        </GlassCard>
      </div>
    </main>
  );
}