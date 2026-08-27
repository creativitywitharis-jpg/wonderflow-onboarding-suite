// WonderFlow OS — permanently delete the caller's own WonderFlow account
// (their actual login + profile), not just membership in one business.
//
// Safety: refuses to run if the caller owns any business that still has
// other active members — those must be transferred first (via
// transfer_ownership) so a business is never silently orphaned or handed
// to an arbitrary successor. Businesses they solely own are deleted
// outright (organizations cascades to every table). Any other memberships
// are simply removed. Finally the actual Supabase Auth user is deleted via
// the Admin API — there's no self-delete method on the public client SDK,
// which is why this needs the service-role key and its own function.
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

type MembershipRow = { id: string; org_id: string; role: string; organizations: { name: string } | null };

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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rows, error: rowsErr } = await admin
    .from("memberships")
    .select("id,org_id,role,organizations(name)")
    .eq("user_id", user.id);
  if (rowsErr) return json({ error: rowsErr.message }, 500);
  const memberships = (rows ?? []) as unknown as MembershipRow[];

  // Refuse if they own a business that still has other members.
  const ownedOrgIds = memberships.filter((m) => m.role === "owner").map((m) => m.org_id);
  if (ownedOrgIds.length > 0) {
    const { data: others } = await admin
      .from("memberships")
      .select("org_id")
      .in("org_id", ownedOrgIds)
      .neq("user_id", user.id);
    const blockedOrgIds = new Set(((others ?? []) as { org_id: string }[]).map((r) => r.org_id));
    const blockedNames = memberships
      .filter((m) => blockedOrgIds.has(m.org_id))
      .map((m) => m.organizations?.name ?? "a business");
    if (blockedNames.length > 0) {
      return json(
        { error: `Transfer ownership of ${blockedNames.join(", ")} before deleting your account — those businesses still have other team members.` },
        400,
      );
    }
  }

  // Everything left is either a business they solely own (delete it
  // outright) or a membership elsewhere (just remove it).
  for (const m of memberships) {
    if (m.role === "owner") await admin.from("organizations").delete().eq("id", m.org_id);
    else await admin.from("memberships").delete().eq("id", m.id);
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true });
});
