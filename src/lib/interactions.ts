import { supabase } from "./supabase";

export type InteractionChannel = "note" | "email" | "call" | "meeting" | "chat";

export type DbInteraction = {
  id: string;
  customer_id: string | null;
  channel: InteractionChannel;
  body: string;
  created_at: string;
  customer: { name: string; company: string | null } | null;
};

export type NewInteraction = {
  customer_id?: string | null;
  channel?: InteractionChannel;
  body: string;
};

// PostgREST embeds the related customer via the FK.
const COLS = "id,customer_id,channel,body,created_at,customer:customers(name,company)";

/** Recent interactions for an org (RLS-scoped), newest first. */
export async function listInteractions(orgId: string, limit = 50): Promise<DbInteraction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as DbInteraction[]) ?? [];
}

/** Recent interactions logged against one customer, newest first. */
export async function listCustomerInteractions(customerId: string, limit = 20): Promise<DbInteraction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(COLS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as DbInteraction[]) ?? [];
}

export async function addInteraction(orgId: string, i: NewInteraction) {
  const { error } = await supabase.from("interactions").insert({
    org_id: orgId,
    customer_id: i.customer_id ?? null,
    channel: i.channel ?? "note",
    body: i.body,
  });
  return { error: error ? new Error(error.message) : null };
}
