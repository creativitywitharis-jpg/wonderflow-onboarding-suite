// WonderFlow OS — send a Campaign Studio email campaign for real, via Resend.
// Requires a signed-in member of the campaign's org. Resolves the campaign's
// audience (a tier — Champions/Loyal/New/At risk/Dormant — or "All
// customers") to real customers with a real email on file who haven't
// unsubscribed, sends each one the campaign's subject/body with a real
// unsubscribe link, then records the real sent count.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (optional, defaults to Resend's sandbox)
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Campaign Studio's plural "Champions" audience label maps to the singular
// "Champion" tier value stored on each customer row.
const AUDIENCE_TO_TIER: Record<string, string> = {
  Champions: "Champion",
  Loyal: "Loyal",
  New: "New",
  "At risk": "At risk",
  Dormant: "Dormant",
};

function emailHtml(body: string, unsubscribeUrl: string) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e8e6e1">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <div style="padding:28px;border:1px solid #26262b;border-radius:18px;background:#141416">
      ${paragraphs}
    </div>
    <p style="margin:20px 0 0;font-size:11px;color:#6b6862;text-align:center">
      <a href="${unsubscribeUrl}" style="color:#8a877f">Unsubscribe from marketing emails</a>
    </p>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "Please sign in." });

  let body: { campaignId?: string; origin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." });
  }
  const campaignId = body.campaignId ?? "";
  if (!campaignId) return json({ error: "Missing campaign." });

  // Read via the user's own client so RLS confirms they're actually a member
  // of this campaign's org before anything gets sent.
  const { data: campaign } = await userClient
    .from("campaigns")
    .select("id,org_id,channel,audience,subject,body,sent")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return json({ error: "Campaign not found." });
  if (campaign.channel !== "Email") return json({ error: "Only Email campaigns can be sent from here right now." });
  if (!campaign.subject?.trim() || !campaign.body?.trim()) return json({ error: "Add a subject and message before sending." });
  if (campaign.sent > 0) return json({ error: "This campaign has already been sent." });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "Email isn't configured yet — add the RESEND_API_KEY secret." });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let custQuery = admin
    .from("customers")
    .select("id,email")
    .eq("org_id", campaign.org_id)
    .eq("email_opt_out", false)
    .not("email", "is", null);
  const tier = AUDIENCE_TO_TIER[campaign.audience ?? ""];
  if (tier) custQuery = custQuery.eq("tier", tier);
  const { data: customers, error: custErr } = await custQuery;
  if (custErr) return json({ error: custErr.message });

  const recipients = ((customers ?? []) as { id: string; email: string | null }[]).filter((c) => c.email && c.email.includes("@"));
  if (recipients.length === 0) {
    return json({ error: `No customers with an email on file match "${campaign.audience ?? "All customers"}".` });
  }

  const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
  const origin = body.origin || req.headers.get("origin") || "";

  let sent = 0;
  let failed = 0;
  for (const c of recipients) {
    const unsubscribeUrl = `${origin}/unsubscribe?c=${c.id}&o=${campaign.org_id}`;
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [c.email],
          subject: campaign.subject,
          html: emailHtml(campaign.body, unsubscribeUrl),
        }),
      });
      if (resp.ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  await admin.from("campaigns").update({ sent, status: "Done" }).eq("id", campaignId);

  return json({ sent, failed, skipped: (customers?.length ?? 0) - recipients.length });
});
