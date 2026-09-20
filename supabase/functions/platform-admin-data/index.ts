// WonderFlow OS — read-only cross-tenant data for the platform operator.
// Every other table's RLS deliberately keeps one business from ever
// seeing another's data; this is the one narrow, explicit exception, and
// only for accounts listed in platform_admins. Re-checks that table with
// the service-role key on every call -- a row in platform_admins is the
// only thing that grants access here, and it's never client-writable.
//
// verify_jwt = true (still requires a real signed-in user; anonymous
// callers are rejected before the platform_admins check even runs).
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

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const action = body.action ?? "";
  if (!["orgs", "subscriptions", "feedback"].includes(action)) return json({ error: "Unknown action." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: adminRow } = await admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return json({ error: "Not allowed." }, 403);

  if (action === "orgs") {
    const { data: orgs } = await admin
      .from("organizations")
      .select("id,name,industry,plan,created_at")
      .order("created_at", { ascending: false });
    const list = (orgs as { id: string; name: string; industry: string | null; plan: string; created_at: string }[]) ?? [];

    const { data: owners } = await admin.from("memberships").select("org_id,user_id").eq("role", "owner");
    const ownerRows = (owners as { org_id: string; user_id: string }[]) ?? [];
    const ownerIds = [...new Set(ownerRows.map((o) => o.user_id))];
    const { data: profiles } = ownerIds.length
      ? await admin.from("profiles").select("id,full_name,email").in("id", ownerIds)
      : { data: [] };
    const profileById = new Map(((profiles as { id: string; full_name: string | null; email: string | null }[]) ?? []).map((p) => [p.id, p]));
    const ownerByOrg = new Map(ownerRows.map((o) => [o.org_id, profileById.get(o.user_id)]));

    return json({
      orgs: list.map((o) => ({
        id: o.id,
        name: o.name,
        industry: o.industry,
        plan: o.plan,
        created_at: o.created_at,
        owner_name: ownerByOrg.get(o.id)?.full_name ?? null,
        owner_email: ownerByOrg.get(o.id)?.email ?? null,
      })),
    });
  }

  if (action === "subscriptions") {
    const { data: subs } = await admin
      .from("subscriptions")
      .select("id,org_id,plan,status,current_period_end,created_at")
      .order("created_at", { ascending: false });
    const list = (subs as { id: string; org_id: string; plan: string; status: string; current_period_end: string | null; created_at: string }[]) ?? [];
    const orgIds = [...new Set(list.map((s) => s.org_id))];
    const { data: orgs } = orgIds.length ? await admin.from("organizations").select("id,name").in("id", orgIds) : { data: [] };
    const nameById = new Map(((orgs as { id: string; name: string }[]) ?? []).map((o) => [o.id, o.name]));
    return json({ subscriptions: list.map((s) => ({ ...s, org_name: nameById.get(s.org_id) ?? "Unknown business" })) });
  }

  // action === "feedback"
  const { data: rows } = await admin
    .from("feedback")
    .select("id,org_id,user_id,type,message,rating,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const list = (rows as { id: string; org_id: string; user_id: string; type: string; message: string; rating: number | null; created_at: string }[]) ?? [];
  const orgIds = [...new Set(list.map((r) => r.org_id))];
  const userIds = [...new Set(list.map((r) => r.user_id))];
  const { data: orgs } = orgIds.length ? await admin.from("organizations").select("id,name").in("id", orgIds) : { data: [] };
  const { data: profiles } = userIds.length ? await admin.from("profiles").select("id,full_name,email").in("id", userIds) : { data: [] };
  const orgNameById = new Map(((orgs as { id: string; name: string }[]) ?? []).map((o) => [o.id, o.name]));
  const profileById = new Map(((profiles as { id: string; full_name: string | null; email: string | null }[]) ?? []).map((p) => [p.id, p]));
  return json({
    feedback: list.map((f) => ({
      ...f,
      org_name: orgNameById.get(f.org_id) ?? "Unknown business",
      submitter_name: profileById.get(f.user_id)?.full_name ?? null,
      submitter_email: profileById.get(f.user_id)?.email ?? null,
    })),
  });
});
