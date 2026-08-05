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
