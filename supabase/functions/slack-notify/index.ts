// WonderFlow OS — Send a test message to an org's connected Slack channel.
// Slack's Incoming Webhook endpoint doesn't set CORS headers, so the browser
// can't POST to it directly — this relays the request server-side. The
// automation runner posts to Slack directly on its own (already server-side),
// so this function exists only for the client-triggered "Send test message"
// button in Settings → Integrations.
//
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { orgId?: string; text?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const orgId = body.orgId ?? "";
  const text = body.text?.trim() || "Test message from WonderFlow OS.";
  if (!orgId) return json({ error: "Missing organization." }, 400);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data: membership } = await userClient
    .from("memberships").select("role").eq("org_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!membership) return json({ error: "Not a member of this organization." }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: conn } = await admin.from("connections").select("status,config").eq("org_id", orgId).eq("provider", "slack").maybeSingle();
  const webhookUrl = (conn as { config?: { webhook_url?: string } } | null)?.config?.webhook_url;
  if ((conn as { status?: string } | null)?.status !== "connected" || !webhookUrl) {
    return json({ ok: false, detail: "Slack isn't connected yet." });
  }

  try {
    const r = await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    return json({ ok: r.ok, detail: r.ok ? undefined : `HTTP ${r.status}` });
  } catch (e) {
    return json({ ok: false, detail: e instanceof Error ? e.message : "Request to Slack failed." });
  }
});
