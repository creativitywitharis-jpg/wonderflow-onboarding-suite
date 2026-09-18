import { supabase } from "./supabase";

export type DbCustomer = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  tier: string;
  sentiment: string;
  ltv: number;
  health: number;
  orders: number;
  since: string | null;
  tags: string[];
};

export type NewCustomer = {
  name: string;
  company?: string;
  email?: string;
  tier?: string;
  sentiment?: string;
  ltv?: number;
  health?: number;
  orders?: number;
  since?: string;
  tags?: string[];
};

const COLS = "id,name,company,email,tier,sentiment,ltv,health,orders,since,tags";

/** All customers for an org (RLS ensures only the caller's org is visible). */
export async function listCustomers(orgId: string): Promise<DbCustomer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(COLS)
    .eq("org_id", orgId)
    .order("ltv", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbCustomer[]) ?? [];
}

export async function createCustomer(orgId: string, c: NewCustomer) {
  const { data, error } = await supabase
    .from("customers")
    .insert({ org_id: orgId, ...c })
    .select(COLS)
    .single();
  return { data: data as DbCustomer | null, error: error ? new Error(error.message) : null };
}

export async function insertCustomers(orgId: string, rows: NewCustomer[]) {
  const { error } = await supabase.from("customers").insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}

/** Update an existing customer (RLS restricts this to the owning org's members). */
export async function updateCustomer(id: string, patch: Partial<NewCustomer>) {
  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", id)
    .select(COLS)
    .single();
  return { data: data as DbCustomer | null, error: error ? new Error(error.message) : null };
}

/**
 * Send a one-off direct email to a customer right now, with a subject/body
 * the sender writes themselves -- the CRM profile's "Message" button.
 * Distinct from the AI-only "email_customer" automation action. Logs a real
 * interaction on success so it shows up in that customer's activity feed.
 */
export async function sendCustomerMessage(customerId: string, subject: string, message: string): Promise<{ sent: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke("email-customer", {
      body: { customerId, subject, message },
    });
    if (error) return { sent: false, error: error.message };
    if (data?.error) return { sent: false, error: data.error as string };
    return { sent: !!data?.sent, error: null };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Could not send the email." };
  }
}
