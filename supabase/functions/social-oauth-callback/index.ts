// WonderFlow OS — OAuth callback for social connections (Meta, TikTok).
// Hit directly by the provider's redirect after the user approves (or
// denies) access -- there's no user session here, only the one-time
// `state` token minted by social-oauth-start. Exchanges the code for real
// tokens, stores the connection, then redirects the browser back into the
// app with a plain status flag (never the tokens themselves).
//
// verify_jwt = false (called by the provider, not the signed-in user).
// Secrets: META_APP_ID, META_APP_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

function redirect(origin: string, params: Record<string, string>) {
  const url = new URL(`${origin}/admin`);
  url.searchParams.set("tab", "integrations");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

function callbackUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-oauth-callback`;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Redeem the state token — one-time use, regardless of outcome below.
  const { data: stateRow } = state
    ? await admin.from("oauth_states").select("*").eq("state", state).maybeSingle()
    : { data: null };
  if (state) await admin.from("oauth_states").delete().eq("state", state);

  const row = stateRow as { org_id: string; user_id: string; provider: string; origin: string; created_at: string } | null;
  // Fall back to WonderFlow's own domain if the state is already gone --
  // there's nowhere else known to send the browser.
  const origin = row?.origin || "https://wonderflow.app";

  if (providerError) return redirect(origin, { social_error: providerError });
  if (!row) return redirect(origin, { social_error: "This connection link expired or was already used — try connecting again." });
  if (!code) return redirect(origin, { social_error: "No authorization code received." });
  // 10-minute window between starting the connect flow and completing it.
  if (Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) {
    return redirect(origin, { social_error: "That connection attempt timed out — try again." });
  }

  const redirectUri = callbackUrl();

  try {
    if (row.provider === "meta") {
      const appId = Deno.env.get("META_APP_ID")!;
      const appSecret = Deno.env.get("META_APP_SECRET")!;

      // Step 1: exchange the code for a short-lived user access token.
      const tokenResp = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`,
      );
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok || !tokenData.access_token) return redirect(origin, { social_error: tokenData?.error?.message ?? "Meta didn't return an access token." });

      // Step 2: exchange for a long-lived token (~60 days instead of ~2 hours).
      const longResp = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(tokenData.access_token)}`,
      );
      const longData = await longResp.json();
      const userToken = longResp.ok && longData.access_token ? longData.access_token : tokenData.access_token;
      const expiresIn = longResp.ok && longData.expires_in ? longData.expires_in : tokenData.expires_in;
      const expiresAt = expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString() : null;

      // Step 3: find the Facebook Page(s) this user manages, and each
      // Page's own access token (used for both Page and linked IG posts).
      const pagesResp = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(userToken)}`);
      const pagesData = await pagesResp.json();
      const pages = (pagesData?.data as Array<{ id: string; name: string; access_token: string }> | undefined) ?? [];
      if (pages.length === 0) return redirect(origin, { social_error: "No Facebook Page found for this account — connect one you manage a Page for." });

      // First Page for now -- most small businesses only run one. Multi-Page
      // selection would be a real UI addition, not something to guess at here.
      const page = pages[0];
      await admin.from("social_connections").upsert(
        { org_id: row.org_id, provider: "meta_facebook", account_id: page.id, account_name: page.name, access_token: page.access_token, expires_at: expiresAt, connected_by: row.user_id, updated_at: new Date().toISOString() },
        { onConflict: "org_id,provider" },
      );

      // Step 4: if that Page has a linked Instagram Business account, store it too.
      const igResp = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(page.access_token)}`);
      const igData = await igResp.json();
      const ig = igData?.instagram_business_account as { id: string; username?: string } | undefined;
      if (ig?.id) {
        await admin.from("social_connections").upsert(
          { org_id: row.org_id, provider: "meta_instagram", account_id: ig.id, account_name: ig.username ? `@${ig.username}` : page.name, access_token: page.access_token, expires_at: expiresAt, connected_by: row.user_id, updated_at: new Date().toISOString() },
          { onConflict: "org_id,provider" },
        );
      }

      return redirect(origin, { social_connected: ig?.id ? "instagram" : "facebook" });
    }

    // provider === "tiktok"
    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY")!;
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET")!;
    const tokenResp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) return redirect(origin, { social_error: tokenData?.error_description ?? "TikTok didn't return an access token." });

    const expiresAt = tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString() : null;
    let accountName: string | null = null;
    try {
      const infoResp = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const infoData = await infoResp.json();
      accountName = infoData?.data?.user?.display_name ?? null;
    } catch {
      // best-effort -- the connection still succeeds without a display name.
    }

    await admin.from("social_connections").upsert(
      {
        org_id: row.org_id,
        provider: "tiktok",
        account_id: tokenData.open_id,
        account_name: accountName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        connected_by: row.user_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" },
    );
    return redirect(origin, { social_connected: "tiktok" });
  } catch (e) {
    return redirect(origin, { social_error: e instanceof Error ? e.message : "Connection failed." });
  }
});
