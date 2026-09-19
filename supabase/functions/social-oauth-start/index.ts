// WonderFlow OS — start a real OAuth connect flow for a social provider.
// Requires a signed-in owner/admin. Generates a one-time, DB-backed CSRF
// state token, then returns the provider's real authorize URL for the
// client to redirect to. The provider later redirects the browser to
// social-oauth-callback with ?code=&state=.
//
// Secrets (add once your developer apps are approved):
//   META_APP_ID, META_APP_SECRET
//   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
// Until those are set, this returns a clear "not configured yet" error
// instead of a broken redirect.
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

// The redirect_uri registered in each app's dashboard must exactly match
// this — same URL for both providers, since which provider a callback
// belongs to is resolved by looking up its state row, not the URL itself.
function callbackUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-oauth-callback`;
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

  let body: { orgId?: string; provider?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const orgId = body.orgId ?? "";
  const provider = body.provider ?? "";
  if (!orgId || (provider !== "meta" && provider !== "tiktok")) return json({ error: "Missing or invalid org/provider." }, 400);

  const { data: membership } = await userClient
    .from("memberships").select("role").eq("org_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  const role = (membership as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") return json({ error: "Only owners and admins can connect social accounts." }, 403);

  const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const referer = req.headers.get("referer");
  const origin = req.headers.get("origin") || (referer ? new URL(referer).origin : "");
  if (!origin) return json({ error: "Could not determine where to redirect back to." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error: insErr } = await admin.from("oauth_states").insert({ state, org_id: orgId, user_id: user.id, provider, origin });
  if (insErr) return json({ error: insErr.message }, 500);

  const redirectUri = callbackUrl();

  if (provider === "meta") {
    const appId = Deno.env.get("META_APP_ID");
    if (!appId) return json({ error: "Meta isn't connected yet — add the META_APP_ID and META_APP_SECRET secrets once your Meta developer app is approved." });
    // Scopes needed to post to a connected Instagram Business account and
    // its linked Facebook Page. Verify these against the current Meta App
    // Dashboard when setting up App Review -- exact required permissions
    // for content publishing have shifted across API versions before.
    const scope = ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement", "business_management"].join(",");
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code`;
    return json({ url });
  }

  // provider === "tiktok"
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
  if (!clientKey) return json({ error: "TikTok isn't connected yet — add the TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET secrets once your TikTok developer app is approved." });
  // video.publish requires the Content Posting API scope specifically --
  // confirm the exact scope name in your TikTok app's product configuration.
  const scope = ["user.info.basic", "video.publish"].join(",");
  const url = `https://www.tiktok.com/v2/auth/authorize?client_key=${encodeURIComponent(clientKey)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&response_type=code`;
  return json({ url });
});
