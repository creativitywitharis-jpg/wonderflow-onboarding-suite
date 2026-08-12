// Shared outbound-webhook delivery — used by both `run-automations` and
// `inbound` so every WonderFlow event reaches subscribed endpoints (Zapier,
// Make, custom servers). Payloads are signed with HMAC-SHA256 using each
// endpoint's secret, sent in the `x-wonderflow-signature` header.

// deno-lint-ignore no-explicit-any
type Admin = any;

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return "sha256=" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function post(ep: { id: string; url: string; secret: string; failures?: number }, event: string, payload: unknown, admin: Admin) {
  const body = JSON.stringify({ event, created_at: new Date().toISOString(), data: payload });
  let status = 0;
  try {
    const signature = await sign(ep.secret, body);
    const r = await fetch(ep.url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-wonderflow-event": event, "x-wonderflow-signature": signature },
      body,
    });
    status = r.status;
  } catch {
    status = 0;
  }
  const ok = status >= 200 && status < 300;
  await admin
    .from("webhook_endpoints")
    .update({ last_delivery: new Date().toISOString(), last_status: status, failures: ok ? 0 : (ep.failures ?? 0) + 1 })
    .eq("id", ep.id);
  return { id: ep.id, status };
}

/** Deliver an event to every enabled endpoint subscribed to it (or to '*'). */
export async function deliverWebhooks(admin: Admin, orgId: string, event: string, payload: unknown) {
  const { data } = await admin.from("webhook_endpoints").select("*").eq("org_id", orgId).eq("enabled", true);
  const endpoints = ((data as Array<Record<string, unknown>>) ?? []).filter(
    (e) => (e.events as string[]).includes(event) || (e.events as string[]).includes("*"),
  );
  const results = [];
  for (const ep of endpoints) {
    results.push(await post(ep as { id: string; url: string; secret: string; failures?: number }, event, payload, admin));
  }
  return results;
}

/** Send a sample event to one endpoint (the "Send test" button), ignoring its
 *  event subscriptions so the user can verify wiring. */
export async function deliverWebhookTest(admin: Admin, orgId: string, endpointId: string) {
  const { data } = await admin
    .from("webhook_endpoints").select("*").eq("org_id", orgId).eq("id", endpointId).maybeSingle();
  if (!data) return { ok: false, detail: "endpoint not found" };
  const res = await post(data as { id: string; url: string; secret: string; failures?: number }, "test.ping", { message: "This is a test event from WonderFlow OS." }, admin);
  return { ok: res.status >= 200 && res.status < 300, status: res.status };
}
