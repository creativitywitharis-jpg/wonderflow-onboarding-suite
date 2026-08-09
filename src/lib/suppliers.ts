import { supabase } from "./supabase";

export type DbSupplier = {
  id: string;
  name: string;
  category: string | null;
  country: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  rating: number;
  spend: number;
  price_index: number;
  status: string;
  notes: string | null;
  created_at: string;
};

export type NewSupplier = {
  name: string;
  category?: string | null;
  country?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  lead_time_days?: number;
  rating?: number;
  spend?: number;
  price_index?: number;
  status?: string;
  notes?: string | null;
};

const COLS =
  "id,name,category,country,contact_name,email,phone,lead_time_days,rating,spend,price_index,status,notes,created_at";

/** All suppliers for an org (RLS-scoped to members). */
export async function listSuppliers(orgId: string): Promise<DbSupplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select(COLS)
    .eq("org_id", orgId)
    .order("spend", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbSupplier[]) ?? [];
}

export async function createSupplier(orgId: string, s: NewSupplier) {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ org_id: orgId, ...s })
    .select(COLS)
    .single();
  return { data: data as DbSupplier | null, error: error ? new Error(error.message) : null };
}

export async function insertSuppliers(orgId: string, rows: NewSupplier[]) {
  const { error } = await supabase.from("suppliers").insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}

export async function updateSupplier(id: string, patch: Partial<NewSupplier>) {
  const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
