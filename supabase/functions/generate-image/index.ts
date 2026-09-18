// WonderFlow OS — real AI image generation for Content Studio, via OpenAI's
// image API. Requires a signed-in org member. Stateless: generates and
// returns the image inline (base64) — nothing is persisted server-side,
// same as the existing text generator (Content Studio has never saved
// drafts anywhere, images follow the same pattern).
//
// Secrets: OPENAI_API_KEY
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY

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
  if (req.method !== "POST") return json({ error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "Please sign in." });

  let body: { prompt?: string; size?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return json({ error: "Missing prompt." });

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "Image generation isn't configured yet — add the OPENAI_API_KEY secret." });

  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        size: body.size ?? "1024x1024",
        n: 1,
        response_format: "b64_json",
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: data?.error?.message ?? "Image generation failed." });
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return json({ error: "No image came back — try again." });
    return json({ dataUrl: `data:image/png;base64,${b64}` });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Image generation failed." });
  }
});
