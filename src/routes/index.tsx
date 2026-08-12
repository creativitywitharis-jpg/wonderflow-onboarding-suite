import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Brain,
  Check,
  Factory,
  LayoutGrid,
  Megaphone,
  Send,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { Eyebrow, GhostButton, GlassCard, GoldButton } from "@/components/wf/ui";
import { supabase } from "@/lib/supabase";

// ── Waitlist wiring ───────────────────────────────────────────────────────
// Primary: WonderFlow's own `waitlist` edge function (stores signups + sends a
// branded welcome email via Resend). If it isn't deployed yet, the form falls
// back to this Formspree endpoint, then to a plain email — so no signup is ever
// lost while the backend waits to deploy.
const WAITLIST_ENDPOINT = "https://formspree.io/f/mzeprnqv";
const CONTACT_EMAIL = "hello@wonderglowstudios.org";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WonderFlow OS — Run your whole business from one AI command center" },
      {
        name: "description",
        content:
          "WonderFlow OS is the AI-powered operating system for small businesses — CRM, orders, inventory, finance, marketing and automation in one place, with an AI that runs it alongside you. Join the waitlist.",
      },
      { property: "og:title", content: "WonderFlow OS — one AI command center for your whole business" },
      { property: "og:description", content: "Replace six tools and a spreadsheet with one intelligent workspace. Join the early-access waitlist." },
    ],
  }),
  component: Welcome,
});

function WaitlistForm({ big = false }: { big?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || state === "sending") return;
    setState("sending");

    // 1) Preferred: WonderFlow's own endpoint (stores + sends a branded welcome).
    try {
      const { error } = await supabase.functions.invoke("waitlist", { body: { email: value, source: "landing" } });
      if (!error) {
        setState("done");
        return;
      }
    } catch {
      /* function not deployed yet — fall through to Formspree */
    }

    // 2) Fallback: Formspree.
    if (WAITLIST_ENDPOINT) {
      try {
        const r = await fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email: value, source: "landing" }),
        });
        setState(r.ok ? "done" : "error");
        return;
      } catch {
        setState("error");
        return;
      }
    }

    // 3) Last resort: open an email so nothing is ever lost.
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("WonderFlow waitlist")}&body=${encodeURIComponent(`Please add me to the waitlist: ${value}`)}`;
    setState("done");
  }

  if (state === "done") {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-glass px-5 py-3 text-sm text-foreground/90 ${big ? "sm:text-base" : ""}`}>
        <Check className="size-4 text-gold" /> You're on the list — we'll be in touch soon.
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={submit} className={`mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row ${big ? "max-w-lg" : ""}`}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="min-w-0 flex-1 rounded-full border border-border bg-background/50 px-5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold/50"
        />
        <GoldButton type="submit" className="justify-center">
          {state === "sending" ? "Joining…" : "Join the waitlist"} <Send className="size-4" />
        </GoldButton>
      </form>
      {state === "error" && (
        <p className="mt-2 text-center text-xs text-rose-300">Something went wrong — email us at {CONTACT_EMAIL}.</p>
      )}
    </div>
  );
}

const modules = [
  { icon: Users, label: "CRM" },
  { icon: ShoppingCart, label: "Orders" },
  { icon: Boxes, label: "Inventory" },
  { icon: Factory, label: "Suppliers" },
  { icon: Wallet, label: "Finance" },
  { icon: Megaphone, label: "Marketing" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Workflow, label: "Automation" },
  { icon: Brain, label: "AI Advisor" },
];

const pillars = [
  {
    icon: Sparkles,
    title: "AI that knows your business",
    body: "Not a bolted-on chatbot — an AI partner that reads your real data and advises you like a seasoned COO, in every module.",
  },
  {
    icon: LayoutGrid,
    title: "Your whole business, one place",
    body: "CRM, orders, inventory, suppliers, finance, marketing and automation — replace six subscriptions and the spreadsheet holding them together.",
  },
  {
    icon: Workflow,
    title: "Connected & automated",
    body: "Capture leads from your website, sync your tools, and let automations handle the busywork — so you run the business, not the admin.",
  },
];

const steps = [
  { n: "1", title: "Tell it about your business", body: "A 6-minute AI intake maps your operations and sets up a workspace around how you actually work." },
  { n: "2", title: "Bring your data in", body: "Import customers, products and orders from a spreadsheet (AI maps the columns), or connect your website and tools." },
  { n: "3", title: "Run it with AI beside you", body: "Daily briefings, one-click actions, and an advisor that tells you exactly what to focus on next." },
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
          <a href="#waitlist">
            <GoldButton className="px-5 py-2.5">Join the waitlist</GoldButton>
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-14 pb-12 text-center sm:pt-20">
        <div className="rise"><Eyebrow>Now in early access · for small businesses</Eyebrow></div>
        <h1 className="rise mt-7 text-balance text-5xl leading-[1.04] tracking-tight sm:text-7xl" style={{ fontFamily: "var(--font-display)", animationDelay: "80ms" }}>
          Run your whole business from one <span className="gold-text italic">AI command center.</span>
        </h1>
        <p className="rise mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg" style={{ animationDelay: "160ms" }}>
          Stop juggling six tools and a spreadsheet. WonderFlow OS runs your CRM, orders, inventory, finances, marketing and more — with an AI that thinks alongside you.
        </p>
        <div className="rise mt-9" style={{ animationDelay: "240ms" }}>
          <WaitlistForm />
          <p className="mt-3 text-xs text-muted-foreground">Free to join · No card required · Early founders get lifetime perks.</p>
        </div>
      </section>

      {/* Problem strip */}
      <section className="mx-auto max-w-5xl px-6 pb-4">
        <GlassCard className="rise flex flex-wrap items-center justify-center gap-x-8 gap-y-2 p-5 text-center">
          <span className="text-sm text-muted-foreground">The average small business runs on</span>
          <span className="text-lg font-semibold text-foreground/90" style={{ fontFamily: "var(--font-display)" }}>6+ subscriptions</span>
          <span className="text-gold">·</span>
          <span className="text-lg font-semibold text-foreground/90" style={{ fontFamily: "var(--font-display)" }}>3 spreadsheets</span>
          <span className="text-gold">·</span>
          <span className="text-lg font-semibold text-gold" style={{ fontFamily: "var(--font-display)" }}>0 clarity</span>
        </GlassCard>
      </section>

      {/* Modules */}
      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>One platform. <span className="gold-text italic">Your entire business.</span></h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">Every part of your operation, finally in one intelligent workspace.</p>
        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {modules.map((m) => (
            <GlassCard key={m.label} className="flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-glass"><m.icon className="size-5 text-gold" /></span>
              <span className="text-sm font-medium text-foreground/90">{m.label}</span>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Why different */}
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-16 sm:grid-cols-3">
        {pillars.map((p) => (
          <GlassCard key={p.title} className="p-6">
            <span className="grid size-11 place-items-center rounded-2xl border border-gold/25 bg-glass"><p.icon className="size-5 text-gold" /></span>
            <h3 className="mt-4 text-base font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </GlassCard>
        ))}
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="text-center text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>Live in <span className="gold-text italic">minutes,</span> not months.</h2>
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <GlassCard className="h-full p-6">
                <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-primary-foreground" style={{ background: "var(--gradient-gold)" }}>{s.n}</span>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </section>

      {/* Founder note */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <GlassCard className="glass-strong relative overflow-hidden p-7 text-center sm:p-9">
          <div className="veil pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <span className="orb mx-auto grid size-11 place-items-center rounded-full" style={{ background: "var(--gradient-gold)" }}><Sparkles className="size-5" stroke="oklch(0.2 0.02 70)" /></span>
            <p className="mt-5 text-lg leading-relaxed text-foreground/90" style={{ fontFamily: "var(--font-display)" }}>
              "I'm building WonderFlow because running a small business shouldn't mean drowning in tools and admin. One place. One AI partner. Built in the open — come along."
            </p>
            <p className="mt-4 text-sm text-muted-foreground">— The founder, building WonderFlow OS in public</p>
          </div>
        </GlassCard>
      </section>

      {/* Final CTA */}
      <section id="waitlist" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24 text-center">
        <h2 className="text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>Be <span className="gold-text italic">first</span> in line.</h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground sm:text-base">Join the waitlist for early access — and lifetime perks for the founders who get in first.</p>
        <div className="mt-8"><WaitlistForm big /></div>
        <p className="mt-6 text-xs text-muted-foreground">
          Already have an account? <Link to="/auth" className="text-gold hover:underline">Sign in <ArrowRight className="inline size-3" /></Link>
        </p>
      </section>

      <footer className="border-t border-border/60 px-6 py-8 text-center text-xs text-muted-foreground">
        WonderFlow OS · the AI operating system for small business · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
