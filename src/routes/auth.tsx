import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, Lock, Mail, User, Users } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Field, GhostButton, GlassCard, GoldButton, inputClass } from "@/components/wf/ui";
import { supabase } from "@/lib/supabase";
import { acceptInvitation } from "@/lib/team";
import { clearPendingInvite, getPendingInvite, savePendingInvite } from "@/lib/pending-invite";
import { lovable } from "@/integrations/lovable/index";

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
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [hasInvite, setHasInvite] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) savePendingInvite(token);
    setHasInvite(!!getPendingInvite());
  }, []);

  // If the user arrived via a team invite link, redeem it after auth and send
  // them straight to the workspace (they're joining an existing org). Reads
  // from localStorage as well as the URL — email-confirmation redirects
  // don't reliably preserve our own query string.
  async function finishAuth(fallback: "/onboarding" | "/dashboard") {
    const token = getPendingInvite();
    if (token) {
      try {
        await acceptInvitation(token);
        clearPendingInvite();
        navigate({ to: "/dashboard" });
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't accept the invitation.");
      }
    }
    navigate({ to: fallback });
  }

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
          await finishAuth("/onboarding");
        } else {
          setConfirmEmail(email);
          setNotice(`We sent a confirmation link to ${email}. Open it, then sign in.`);
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // A brand-new invitee has no account yet, so "sign in" always fails
          // here — point them at Sign up instead of leaving a bare auth error.
          if (hasInvite) throw new Error(`${error.message} — if this is your first time joining, switch to "Sign up" above to create your account with this email instead.`);
          throw error;
        }
        // The password alone only gets an aal1 session if this account has a
        // verified 2FA factor — it still needs a code before it's really signed in.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const factor = factors?.totp?.[0];
          if (factor) {
            setMfaFactorId(factor.id);
            return;
          }
        }
        await finishAuth("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaFactorId || mfaCode.trim().length !== 6 || pending) return;
    setError(null);
    setPending(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode.trim() });
      if (vErr) throw vErr;
      setMfaFactorId(null);
      setMfaCode("");
      await finishAuth("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmEmail) return;
    setError(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: confirmEmail });
    if (error) setError(error.message);
    else setNotice(`Confirmation email re-sent to ${confirmEmail}.`);
  }

  async function sendReset() {
    const target = email.trim();
    if (!target) {
      setError("Enter your email above first, then tap 'Forgot password?'.");
      return;
    }
    setError(null);
    setNotice(null);
    setResetPending(true);
    try {
      // Carry a pending team invite through the reset — otherwise resetting a
      // password mid-invite silently drops it. The query param is a best
      // effort (Supabase's redirect may not preserve it); reset-password.tsx
      // also falls back to the same localStorage key saved on arrival here.
      const inviteToken = getPendingInvite();
      const resetUrl = `${window.location.origin}/reset-password${inviteToken ? `?invite=${inviteToken}` : ""}`;
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: resetUrl,
      });
      if (error) setError(error.message);
      else setNotice(`Email sent — check ${target}'s inbox for the password reset link.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email. Please try again.");
    } finally {
      setResetPending(false);
    }
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    await finishAuth("/onboarding");
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
          {hasInvite && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-gold/30 bg-glass px-3 py-2.5 text-xs text-foreground/85">
              <Users className="size-3.5 shrink-0 text-gold" /> You've been invited to a team — sign in or create your account with the invited email to join.
            </div>
          )}
          {mfaFactorId ? (
            <form onSubmit={verifyMfa} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Two-factor code</h2>
                <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <input
                autoFocus
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${inputClass} text-center tracking-[0.4em]`}
                placeholder="000000"
              />
              {error && (
                <p className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
                </p>
              )}
              <GoldButton type="submit" disabled={pending || mfaCode.length !== 6} className="w-full">
                {pending ? "Verifying…" : <>Verify <ArrowRight className="size-4" /></>}
              </GoldButton>
              <button type="button" onClick={() => { setMfaFactorId(null); setMfaCode(""); setError(null); }} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Back to sign in
              </button>
            </form>
          ) : (
          <>
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
                  type={showPassword ? "text" : "password"}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pl-10 pr-10`}
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            {mode === "signin" && (
              <div className="-mt-2 text-right">
                <button type="button" onClick={sendReset} disabled={resetPending} className="text-xs text-muted-foreground transition-colors hover:text-gold disabled:opacity-60">
                  {resetPending ? "Sending…" : "Forgot password?"}
                </button>
              </div>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
              </p>
            )}
            {notice && (
              <div className="space-y-2">
                <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-glass px-3.5 py-3 text-sm font-medium text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" /> {notice}
                </p>
                {confirmEmail && (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    className="pl-1 text-xs text-gold underline-offset-2 hover:underline"
                  >
                    Didn't get it? Resend confirmation email
                  </button>
                )}
              </div>
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
          </>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Protected by enterprise controls, encrypted storage and per-business data isolation.
          </p>
        </GlassCard>
      </div>
    </main>
  );
}