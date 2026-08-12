import { supabase } from "./supabase";

/** Events a business can subscribe outbound webhooks to. */
export const EVENT_CATALOG: { key: string; label: string; desc: string }[] = [
  { key: "customer.created", label: "New customer / lead", desc: "A customer is added — including website form leads." },
  { key: "order.created", label: "New order", desc: "An order is created." },
  { key: "invoice.paid", label: "Invoice paid", desc: "An invoice is marked paid." },
];

export type DbWebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  last_delivery: string | null;
  last_status: number | null;
  failures: number;
  created_at: string;
};

const COLS = "id,url,events,secret,enabled,last_delivery,last_status,failures,created_at";

function newSecret() {
  return `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function listWebhooks(orgId: string): Promise<DbWebhookEndpoint[]> {
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbWebhookEndpoint[]) ?? [];
}

export async function createWebhook(orgId: string, url: string, events: string[]) {
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .insert({ org_id: orgId, url: url.trim(), events, secret: newSecret(), enabled: true })
    .select(COLS)
    .single();
  return { data: data as DbWebhookEndpoint | null, error: error ? new Error(error.message) : null };
}

export async function toggleWebhook(id: string, enabled: boolean) {
  const { error } = await supabase.from("webhook_endpoints").update({ enabled }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

export async function deleteWebhook(id: string) {
  const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Send a sample "test.ping" event to one endpoint to verify wiring. */
export async function testWebhook(orgId: string, id: string): Promise<{ ok: boolean; status?: number; detail?: string }> {
  const { data, error } = await supabase.functions.invoke("run-automations", { body: { orgId, testWebhookId: id } });
  if (error) return { ok: false, detail: error.message };
  return { ok: !!data?.ok, status: data?.status };
}
