// WonderFlow OS — resolve a paused `approval` automation step.
// Requires a signed-in member of the run's org. Approving continues the
// workflow from where it paused (may pause again); rejecting stops it.
//
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveApprovalRun } from "../_shared/automation-runner.ts";

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

  let body: { runId?: string; approve?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const runId = body.runId ?? "";
  if (!runId || typeof body.approve !== "boolean") return json({ error: "Missing runId or approve." }, 400);

  // Confirm the run belongs to an org this user is a member of, via the
  // user's own client (RLS-scoped select on automation_runs).
  const { data: run } = await userClient.from("automation_runs").select("id,org_id").eq("id", runId).maybeSingle();
  if (!run) return json({ error: "Not found." }, 404);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const result = await resolveApprovalRun(admin, runId, body.approve, user.id);
  return json(result);
});
