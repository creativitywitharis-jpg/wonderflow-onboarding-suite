// WonderFlow OS — automation execution engine (user-triggered).
// Given an event (order.created / customer.created / manual), runs the org's
// matching enabled automations via the shared runner. Requires a signed-in
// member of the org.
//
// Secrets used if present: ANTHROPIC_API_KEY, RESEND_API_KEY, EMAIL_FROM
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { runAutomations } from "../_shared/automation-runner.ts";

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);

  let body: { orgId?: string; event?: string; payload?: Record<string, unknown>; automationId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const orgId = body.orgId ?? "";
  const event = body.event ?? "";
  if (!orgId || !event) return json({ error: "Missing orgId or event." }, 400);

  const { data: membership } = await userClient
    .from("memberships").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return json({ error: "You don't have access to this workspace." }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const results = await runAutomations(admin, orgId, event, body.payload ?? {}, { automationId: body.automationId });

  return json({ ran: results.length, results });
});
