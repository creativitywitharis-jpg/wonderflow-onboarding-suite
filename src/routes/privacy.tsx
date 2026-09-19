import { createFileRoute, Link } from "@tanstack/react-router";
import { Backdrop } from "@/components/wf/Backdrop";
import { Brand } from "@/components/wf/Brand";
import { GhostButton } from "@/components/wf/ui";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — WonderFlow OS" },
      { name: "description", content: "How WonderFlow OS collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPolicy,
});

const LAST_UPDATED = "September 19, 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">{children}</ul>;
}

function PrivacyPolicy() {
  return (
    <main className="relative min-h-screen">
      <Backdrop intensity={0.5} />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-7">
        <Link to="/"><Brand /></Link>
        <Link to="/"><GhostButton className="px-5 py-2.5">Back</GhostButton></Link>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 pb-24">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
        <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          <span className="gold-text italic">Privacy Policy</span>
        </h1>
        <p className="mt-3 text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

        <P>
          WonderFlow OS ("WonderFlow," "we," "us") provides an AI-native business operating system — CRM, orders, inventory, finance,
          automation, and related tools — to businesses ("you," your "workspace"). This policy explains what we collect, why, and how
          it's handled. It applies to WonderFlow's own platform; if you connect a third-party service (Stripe, Slack, Meta, TikTok,
          Zapier, Make, n8n, etc.), that service's own privacy policy also applies to what happens on their end.
        </P>

        <H2>Information we collect</H2>
        <P>We collect information in three ways: what you give us directly, what your use of the product generates, and what you choose to connect.</P>
        <Ul>
          <li><b className="text-foreground/80">Account &amp; workspace info</b> — your name, email, password (handled by our authentication provider, never stored by us in plain text), and business details like company name, industry, address, phone, and website.</li>
          <li><b className="text-foreground/80">Business data you enter</b> — customer records, orders, invoices, inventory, supplier details, automation rules, and anything else you or your team add to run your business through WonderFlow. This data belongs to you; we process it to provide the service.</li>
          <li><b className="text-foreground/80">AI conversation content</b> — messages you send to WonderFlow's AI features (Advisor, Help, automation drafting, content generation) and the responses returned.</li>
          <li><b className="text-foreground/80">Payment information</b> — handled directly by Stripe; WonderFlow does not store your card details. If you connect your own Stripe account to sync your business's customers, that connection's access token is stored securely and never displayed back to you after saving.</li>
          <li><b className="text-foreground/80">Integration credentials &amp; tokens</b> — if you connect Slack, Stripe, or a social account (Instagram, Facebook, TikTok), we store the access tokens needed to act on your behalf, restricted to your workspace's owners/admins.</li>
          <li><b className="text-foreground/80">Usage data</b> — basic technical data (IP address, browser/device type, pages visited) collected automatically to keep the service secure and reliable.</li>
        </Ul>

        <H2>How we use information</H2>
        <Ul>
          <li>To provide, maintain, and improve WonderFlow's features.</li>
          <li>To power AI features — see "AI features" below for specifics on what that involves.</li>
          <li>To send transactional email (invoices, receipts, team invitations, password resets) and, where you've configured it, marketing email on your behalf to your own customers.</li>
          <li>To process payments and manage subscriptions.</li>
          <li>To provide customer support and respond to your requests (including anything sent through the Suggestions &amp; Reviews panel).</li>
          <li>To detect, prevent, and address fraud, abuse, or security issues.</li>
        </Ul>

        <H2>AI features</H2>
        <P>
          WonderFlow's AI features (business advisor chat, automation drafting, content generation, image generation) are powered by
          Anthropic's Claude API. When you use these features, the relevant business data (e.g. customer details, order history,
          the text of your request) is sent to Anthropic to generate a response. Anthropic processes this data to provide the
          completion and does not use it to train their models under their standard API terms. We don't send your data to any AI
          provider except to directly fulfill a feature you've actively used.
        </P>

        <H2>Who we share data with</H2>
        <P>We don't sell your data. We share it only with:</P>
        <Ul>
          <li><b className="text-foreground/80">Infrastructure &amp; service providers</b> who process data on our behalf under contract: our database/auth/hosting provider, Anthropic (AI features), Resend (email delivery), and Stripe (payments).</li>
          <li><b className="text-foreground/80">Integrations you set up yourself</b> — outbound webhooks, Slack, or connected social accounts only send data where you've explicitly configured them to, and only the events you've subscribed to.</li>
          <li><b className="text-foreground/80">Legal requirements</b> — if required by law, court order, or to protect the rights and safety of WonderFlow or others.</li>
        </Ul>

        <H2>Data security</H2>
        <P>
          Each business's data is isolated at the database level — row-level security policies ensure one workspace can never read
          another's data, even in the event of an application bug. We support optional two-factor authentication for your account,
          and security-sensitive actions (team changes, integration changes) are recorded in an audit log visible to your workspace's
          owners and admins. Sensitive credentials (API keys, OAuth tokens) are write-only from the interface — once saved, they're
          never displayed back to you or any team member.
        </P>

        <H2>Data retention &amp; deletion</H2>
        <P>
          We retain your data for as long as your workspace is active. You can delete individual records (customers, automations,
          etc.) at any time from within the product. You can also delete your entire WonderFlow account, or close a business you
          own outright, from Settings — both are real, permanent actions available directly in the app, not something you need to
          contact us for. Some records (e.g. financial history tied to a deleted customer) are retained in de-identified form for
          accounting continuity rather than deleted outright, consistent with standard bookkeeping practice.
        </P>

        <H2>Your rights</H2>
        <P>
          Depending on where you're located, you may have rights to access, correct, export, or delete your personal information.
          Most of these are available directly in the product (Settings, customer profiles, account deletion). For anything else,
          contact us using the details below.
        </P>

        <H2>Children's privacy</H2>
        <P>WonderFlow is a business tool and is not directed at, or knowingly used by, children under 16.</P>

        <H2>Changes to this policy</H2>
        <P>We'll update the "Last updated" date above when this policy changes, and post material changes here.</P>

        <H2>Contact</H2>
        <P>
          Questions about this policy or your data can be sent through the Suggestions &amp; Reviews panel in the app, or to{" "}
          <span className="text-foreground/80">[add your support/privacy contact email here]</span>.
        </P>

        <p className="mt-10 rounded-2xl border border-gold/25 bg-glass px-4 py-3 text-xs text-muted-foreground">
          This is a working draft written to accurately reflect WonderFlow's actual data practices — useful as a real starting point
          (including for third-party app reviews like Meta's), but it hasn't been reviewed by a lawyer. Have it checked before relying
          on it for legal compliance, especially for GDPR/CCPA specifics and your own business's exact jurisdiction and contact details.
        </p>
      </div>
    </main>
  );
}
