// WonderFlow OS — email WonderFlow about a new Suggestions & Reviews
// submission. The feedback row is created by the app first (client-side
// insert, RLS-scoped); this function just emails it. Best-effort: returns
// { sent:false, error } (HTTP 200) when email isn't configured, so the
// recorded submission isn't treated as a hard failure.
//
// Secrets: RESEND_API_KEY, FEEDBACK_NOTIFY_EMAIL (where these land), EMAIL_FROM (optional)
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

const TYPE_LABEL: Record<string, string> = {
  concern: "Concern",
  integration_request: "Integration request",
  review: "Review",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);

  let body: { feedbackId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const feedbackId = body.feedbackId ?? "";
  if (!feedbackId) return json({ error: "Missing feedback." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: fb } = await admin
    .from("feedback")
    .select("id,org_id,user_id,type,message,rating")
    .eq("id", feedbackId)
    .maybeSingle();
  const f = fb as { id: string; org_id: string; user_id: string; type: string; message: string; rating: number | null } | null;
  // Only the person who submitted it can trigger its own notification email.
  if (!f || f.user_id !== user.id) return json({ error: "Feedback not found." }, 404);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyTo = Deno.env.get("FEEDBACK_NOTIFY_EMAIL");
  if (!resendKey || !notifyTo) {
    return json({ sent: false, error: "Notification email isn't configured yet." });
  }

  const { data: org } = await admin.from("organizations").select("name").eq("id", f.org_id).maybeSingle();
  const { data: profile } = await admin.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();
  const orgName = (org as { name?: string } | null)?.name ?? "Unknown business";
  const p = profile as { full_name?: string; email?: string } | null;
  const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
  const stars = f.rating ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating) : "";

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [notifyTo],
        reply_to: p?.email || undefined,
        subject: `[WonderFlow ${TYPE_LABEL[f.type] ?? f.type}] ${orgName}`,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6">
          <p><b>${TYPE_LABEL[f.type] ?? f.type}</b> from <b>${orgName}</b> (${p?.full_name ?? "unknown"}${p?.email ? `, ${p.email}` : ""})</p>
          ${stars ? `<p style="font-size:18px;letter-spacing:2px">${stars}</p>` : ""}
          <p style="white-space:pre-wrap">${(f.message ?? "").replace(/</g, "&lt;")}</p>
        </div>`,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ sent: false, error: data?.message ?? "Email failed to send." });
    return json({ sent: true });
  } catch (e) {
    return json({ sent: false, error: e instanceof Error ? e.message : "Email failed to send." });
  }
});
