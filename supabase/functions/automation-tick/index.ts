// WonderFlow OS — automation tick (public).
// Flushes any due `wait` steps across ALL orgs' multi-step workflows. Workflow
// steps also get opportunistically resumed as a side effect of normal activity
// (see resumeDueRuns in automation-runner.ts), but a dormant org with no other
// events would never flush otherwise — this endpoint exists for that case.
//
// Point ANY external scheduler at it on a fixed interval (e.g. every 15–60 min):
// a Zapier/Make "Schedule" trigger, an n8n Cron node, or a GitHub Actions cron
// workflow, each doing a plain GET/POST to this URL with the secret.
//
// Auth: a single shared secret for the whole deployment (not per-org, since one
// call processes every org's due steps) — set AUTOMATION_TICK_SECRET and pass it
// as ?key= or the x-wf-key header.
//
// verify_jwt = false (called by anonymous external schedulers).
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { resumeDueRuns } from "../_shared/automation-runner.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-wf-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const secret = Deno.env.get("AUTOMATION_TICK_SECRET");
  if (!secret) return json({ error: "AUTOMATION_TICK_SECRET isn't configured." }, 500);

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-wf-key") || "";
  if (key !== secret) return json({ error: "Invalid key." }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const processed = await resumeDueRuns(admin);
    return json({ ok: true, processed });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "tick failed" }, 500);
  }
});
