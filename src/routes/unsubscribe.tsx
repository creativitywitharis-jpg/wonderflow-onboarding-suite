import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { GhostButton, GlassCard } from "@/components/wf/ui";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Unsubscribe — WonderFlow OS" }] }),
  component: Unsubscribe,
});

function Unsubscribe() {
  const [status, setStatus] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get("c");
    const orgId = params.get("o");
    if (!customerId || !orgId) {
      setStatus("error");
      return;
    }
    // Public RPC — no sign-in required. Scoped to exactly this
    // (customer, org) pair and can only ever set the opt-out flag true.
    // Ships in migration 0049 — not in the generated RPC union type until
    // Lovable regenerates it.
    (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> })
      .rpc("unsubscribe_customer", { p_customer_id: customerId, p_org_id: orgId })
      .then(({ error }) => setStatus(error ? "error" : "done"));
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col">
      <Backdrop intensity={0.7} />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7">
        <Brand />
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 items-center px-6 pb-16">
        <GlassCard className="rise w-full p-7 text-center">
          {status === "working" && <p className="text-sm text-muted-foreground">Unsubscribing…</p>}
          {status === "done" && (
            <>
              <span className="orb mx-auto grid size-12 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}>
                <Check className="size-6" stroke="oklch(0.2 0.02 70)" />
              </span>
              <h1 className="mt-5 text-2xl" style={{ fontFamily: "var(--font-display)" }}>You're unsubscribed</h1>
              <p className="mt-2 text-sm text-muted-foreground">You won't receive marketing emails from this business again.</p>
            </>
          )}
          {status === "error" && (
            <>
              <span className="mx-auto grid size-12 place-items-center rounded-full border border-rose-400/30 bg-rose-500/10">
                <AlertTriangle className="size-6 text-rose-300" />
              </span>
              <h1 className="mt-5 text-2xl" style={{ fontFamily: "var(--font-display)" }}>Couldn't process that</h1>
              <p className="mt-2 text-sm text-muted-foreground">This unsubscribe link looks incomplete or invalid.</p>
            </>
          )}
          <Link to="/" className="mt-6 inline-block"><GhostButton className="px-5 py-2.5">Back home</GhostButton></Link>
        </GlassCard>
      </div>
    </main>
  );
}
