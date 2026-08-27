import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, Lock } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Field, GhostButton, GlassCard, GoldButton, inputClass } from "@/components/wf/ui";
import { supabase } from "@/lib/supabase";
import { acceptInvitation } from "@/lib/team";
import { clearPendingInvite, getPendingInvite } from "@/lib/pending-invite";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset your password — WonderFlow OS" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    setPending(true);
    setError(null);
    // The recovery link puts a temporary session in place; updateUser sets the
    // new password against it.
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(
        /session|expired|invalid/i.test(error.message)
          ? "This reset link is invalid or has expired. Request a new one from the sign-in page."
          : error.message,
      );
      return;
    }
    // If this reset was reached via a pending team invite, redeem it now — the
    // new password just put a real session in place, same as a normal sign-in
    // would. A failure here is surfaced, not swallowed: silently continuing
    // to /dashboard with no org would just bounce the user into onboarding
    // with zero explanation, which reads exactly like "my account got wiped."
    const inviteToken = getPendingInvite();
    if (inviteToken) {
      try {
        await acceptInvitation(inviteToken);
        clearPendingInvite();
      } catch (err) {
        setJoinFailed(err instanceof Error ? err.message : "Couldn't join the team automatically.");
        return;
      }
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 1400);
  }

  // The password update already succeeded and the user has a real session —
  // retry just the invite redemption, no need to make them log in again.
  async function retryJoin() {
    const inviteToken = getPendingInvite();
    if (!inviteToken) return;
    setPending(true);
    try {
      await acceptInvitation(inviteToken);
      clearPendingInvite();
      setJoinFailed(null);
      setDone(true);
      setTimeout(() => navigate({ to: "/dashboard" }), 1400);
    } catch (err) {
      setJoinFailed(err instanceof Error ? err.message : "Couldn't join the team automatically.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col">
      <Backdrop intensity={0.7} />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7">
        <Brand />
        <Link to="/auth">
          <GhostButton className="px-5 py-2.5">Back to sign in</GhostButton>
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 items-center px-6 pb-16">
        <GlassCard className="rise w-full p-7">
          {joinFailed ? (
            <div className="text-center">
              <span className="orb mx-auto grid size-12 place-items-center rounded-full border border-rose-400/40 bg-rose-500/10">
                <AlertTriangle className="size-6 text-rose-300" />
              </span>
              <h1 className="mt-5 text-2xl" style={{ fontFamily: "var(--font-display)" }}>Password updated</h1>
              <p className="mt-2 text-sm text-muted-foreground">But we couldn't automatically join you to the team: {joinFailed}</p>
              <GoldButton onClick={retryJoin} disabled={pending} className="mt-5 w-full justify-center">
                {pending ? "Retrying…" : <>Retry joining the team <ArrowRight className="size-4" /></>}
              </GoldButton>
              <Link to="/dashboard" className="mt-3 block text-xs text-muted-foreground hover:text-gold">Skip for now — go to my workspace</Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <span className="orb mx-auto grid size-12 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                <Check className="size-6" stroke="oklch(0.2 0.02 70)" />
              </span>
              <h1 className="mt-5 text-2xl" style={{ fontFamily: "var(--font-display)" }}>Password updated</h1>
              <p className="mt-2 text-sm text-muted-foreground">Signing you in…</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Set a <span className="gold-text italic">new password</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">Choose a new password for your account.</p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field label="New password" hint="Minimum 6 characters.">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      required
                      type={show ? "text" : "password"}
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pl-10 pr-10`}
                      placeholder="••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>

                {error && (
                  <p className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
                  </p>
                )}

                <GoldButton type="submit" disabled={pending} className="w-full">
                  {pending ? "Updating…" : <>Update password <ArrowRight className="size-4" /></>}
                </GoldButton>
              </form>
            </>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
