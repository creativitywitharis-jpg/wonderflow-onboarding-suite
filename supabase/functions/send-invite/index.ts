// WonderFlow OS — send a team invitation email via Resend.
// Requires a signed-in owner/admin of the org. The invitation row is created
// by the app first; this function emails the join link. Best-effort: returns
// { sent:false, error } (HTTP 200) when email isn't configured, so the recorded
// invitation isn't treated as a hard failure.
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function inviteHtml(opts: { orgName: string; inviter: string; role: string; joinUrl: string; email: string }) {
  return `<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8e6e1">
  <div style="max-width:520px;margin:0 auto;padding:40px 28px">
    <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em">WonderFlow <span style="color:#e3b341">OS</span></div>
    <div style="margin-top:28px;padding:28px;border:1px solid #26262b;border-radius:18px;background:#141416">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600">You've been invited</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#b8b5ad">
        <strong style="color:#e8e6e1">${opts.inviter}</strong> invited you to join
        <strong style="color:#e3b341">${opts.orgName}</strong> on WonderFlow OS as a <strong>${opts.role}</strong>.
      </p>
      <a href="${opts.joinUrl}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:linear-gradient(135deg,#f0cf6e,#c99a35);color:#1a1509;font-weight:600;font-size:14px;text-decoration:none">Accept invitation</a>
      <p style="margin:18px 0 0;font-size:12px;color:#8a877f">Create your account with <strong style="color:#b8b5ad">${opts.email}</strong> to join — or sign in with that email if you already have a WonderFlow account. If you didn't expect this, you can ignore it.</p>
    </div>
  </div></body></html>`;
}

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

  let body: { inviteId?: string; origin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const inviteId = body.inviteId ?? "";
  if (!inviteId) return json({ error: "Missing invitation." }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: invite } = await admin
    .from("invitations")
    .select("id,org_id,email,role,token,accepted_at")
    .eq("id", inviteId)
    .maybeSingle();
  const inv = invite as
    | { id: string; org_id: string; email: string; role: string; token: string; accepted_at: string | null }
    | null;
  if (!inv || inv.accepted_at) return json({ error: "Invitation not found." }, 404);

  // Only an owner/admin of the invitation's org may send it.
  const { data: membership } = await userClient
    .from("memberships")
    .select("role")
    .eq("org_id", inv.org_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const role = (membership as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") return json({ error: "Not allowed." }, 403);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return json({ sent: false, error: "Email isn't configured yet — add the RESEND_API_KEY secret." });
  }

  const { data: org } = await admin.from("organizations").select("name").eq("id", inv.org_id).maybeSingle();
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const orgName = (org as { name?: string } | null)?.name ?? "a WonderFlow workspace";
  const inviter = (profile as { full_name?: string } | null)?.full_name ?? "A teammate";

  const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
  const origin = body.origin || req.headers.get("origin") || "";
  const joinUrl = `${origin}/auth?invite=${inv.token}`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [inv.email],
        subject: `${inviter} invited you to ${orgName} on WonderFlow OS`,
        html: inviteHtml({ orgName, inviter, role: inv.role, joinUrl, email: inv.email }),
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return json({ sent: false, error: data?.message ?? "Email failed to send." });
    }
    return json({ sent: true });
  } catch (e) {
    return json({ sent: false, error: e instanceof Error ? e.message : "Email failed to send." });
  }
});
