import { supabase } from "./supabase";

export type DbProduct = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  cost: number;
  stock: number;
  reorder_point: number;
  incoming: number;
};

export type NewProduct = {
  name: string;
  sku?: string | null;
  category?: string | null;
  price?: number;
  cost?: number;
  stock?: number;
  reorder_point?: number;
  incoming?: number;
};

const COLS = "id,name,sku,category,price,cost,stock,reorder_point,incoming";

/** All products for an org (RLS-scoped to members). */
export async function listProducts(orgId: string): Promise<DbProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(COLS)
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DbProduct[]) ?? [];
}

export async function createProduct(orgId: string, p: NewProduct) {
  const { data, error } = await supabase
    .from("products")
    .insert({ org_id: orgId, ...p })
    .select(COLS)
    .single();
  return { data: data as DbProduct | null, error: error ? new Error(error.message) : null };
}

export async function insertProducts(orgId: string, rows: NewProduct[]) {
  const { error } = await supabase.from("products").insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}

export async function updateProduct(id: string, patch: Partial<NewProduct>) {
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Atomically adjust stock by a delta (clamped at 0); returns the new stock. */
export async function adjustStock(id: string, delta: number): Promise<number | null> {
  const { data, error } = await supabase.rpc("adjust_stock", { p_id: id, p_delta: delta });
  if (error) throw new Error(error.message);
  return (data as number | null) ?? null;
}

export type StockStatus = "Healthy" | "Low" | "Critical" | "Overstock";

/** Derive a stock status from live stock vs. its reorder point. */
export function stockStatus(stock: number, reorder: number): StockStatus {
  if (reorder > 0 && stock <= reorder * 0.5) return "Critical";
  if (stock <= reorder) return "Low";
  if (reorder > 0 && stock >= reorder * 3.5) return "Overstock";
  return "Healthy";
}
