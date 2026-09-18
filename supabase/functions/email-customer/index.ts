// WonderFlow OS — send a one-off direct email to a customer from their CRM
// profile, right now, with a subject/body the sender writes themselves.
// Distinct from the "email_customer" automation action, which is always
// AI-drafted and only ever fires from a workflow — this is the "Message"
// button on a customer's profile, for a real person composing a real email
// in the moment. Requires a signed-in active member of the customer's org.
// Logs a real interaction so it shows up in that customer's activity feed.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (optional, defaults to Resend sandbox)
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

const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

function messageHtml(orgName: string, bodyText: string): string {
  const paras = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#e8e6e1">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8e6e1">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em">${esc(orgName)}</div>
    <div style="margin-top:20px;padding:28px;border:1px solid #26262b;border-radius:18px;background:#141416">${paras}</div>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);

  let body: { customerId?: string; subject?: string; message?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const customerId = body.customerId ?? "";
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!customerId || !subject || !message) return json({ error: "Missing customer, subject, or message." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cust } = await admin.from("customers").select("id,org_id,name,email").eq("id", customerId).maybeSingle();
  const c = cust as { id: string; org_id: string; name: string; email: string | null } | null;
  if (!c) return json({ error: "Customer not found." }, 404);

  // Only an active member of this customer's org may message them.
  const { data: membership } = await userClient
    .from("memberships").select("id").eq("org_id", c.org_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!membership) return json({ error: "Not allowed." }, 403);

  if (!c.email) return json({ sent: false, error: "This customer has no email address on file." });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ sent: false, error: "Email isn't configured yet — add the RESEND_API_KEY secret." });

  const { data: org } = await admin.from("organizations").select("name").eq("id", c.org_id).maybeSingle();
  const orgName = (org as { name?: string } | null)?.name ?? "Your business";
  const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [c.email], subject, html: messageHtml(orgName, message) }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ sent: false, error: data?.message ?? "Email failed to send." });

    await admin.from("interactions").insert({
      org_id: c.org_id,
      customer_id: c.id,
      channel: "email",
      body: `${subject}: ${message}`,
      created_by: user.id,
    });
    return json({ sent: true });
  } catch (e) {
    return json({ sent: false, error: e instanceof Error ? e.message : "Email failed to send." });
  }
});
