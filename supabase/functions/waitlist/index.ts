// WonderFlow OS — public waitlist capture + branded welcome email.
// The landing page POSTs { email } here. Stores the signup (deduped) and, if
// Resend is configured, sends a welcome email from your own domain. Public
// (verify_jwt = false) — no user session.
//
// Secrets used if present: RESEND_API_KEY, EMAIL_FROM
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function welcomeHtml() {
  return `<!doctype html><html><body style="margin:0;background:#0b0b0d;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8e6e1">
  <div style="max-width:520px;margin:0 auto;padding:40px 28px">
    <div style="font-size:20px;font-weight:700">WonderFlow <span style="color:#e3b341">OS</span></div>
    <div style="margin-top:24px;padding:28px;border:1px solid #26262b;border-radius:18px;background:#141416">
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:600">You're on the list 🎉</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#c9c6bd">Thanks for joining the WonderFlow OS waitlist — welcome aboard.</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#c9c6bd">You're in line for early access to one calm, AI-powered command center for your whole business — CRM, orders, inventory, finances, marketing and automation, in one place instead of six tabs and a spreadsheet.</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#c9c6bd">I'll email you the moment your access is ready — and founding members get lifetime perks the crowd won't.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#c9c6bd">Quick favour while you wait — just reply and tell me: <b style="color:#e8e6e1">what's the one part of running your business that drives you crazy?</b> I read every response.</p>
      <p style="margin:18px 0 0;font-size:14px;color:#8a877f">— The WonderFlow OS team</p>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { email?: string; name?: string; source?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please enter a valid email." }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Store (ignore duplicates so re-submits don't error).
  const { error } = await admin.from("waitlist").insert({ email, name: body.name ?? null, source: body.source ?? "landing" });
  const isDuplicate = !!error && (error.code === "23505" || /duplicate/i.test(error.message));
  if (error && !isDuplicate) {
    return json({ error: "Could not join the waitlist." }, 500);
  }

  // Send the welcome email once (skip on duplicate). Best-effort.
  let emailed = false;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey && !isDuplicate) {
    try {
      const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject: "You're on the list 🎉", html: welcomeHtml() }),
      });
      emailed = r.ok;
    } catch {
      // ignore — the signup is already saved
    }
  }

  return json({ ok: true, already: isDuplicate, emailed });
});
