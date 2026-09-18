import { supabase } from "./supabase";

export type DbMovement = {
  id: string;
  product_name: string;
  sku: string | null;
  type: "Received" | "Sold" | "Adjusted" | "Returned" | "Transfer";
  qty: number;
  created_at: string;
};

export type NewMovement = {
  product_id?: string | null;
  product_name: string;
  sku?: string | null;
  type: DbMovement["type"];
  qty: number;
};

const COLS = "id,product_name,sku,type,qty,created_at";
// Ships in migration 0046 — reach the table untyped until Lovable regenerates DB types.
const movementsTable = () => (supabase as unknown as { from: (t: string) => any }).from("stock_movements");

/** Most recent stock movements for an org (RLS-scoped to members). */
export async function listMovements(orgId: string, limit = 50): Promise<DbMovement[]> {
  const { data, error } = await movementsTable().select(COLS).eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return (data as DbMovement[]) ?? [];
}

/** Record a movement. Best-effort — never blocks the stock change itself on a logging failure. */
export async function logMovement(orgId: string, m: NewMovement) {
  try {
    await movementsTable().insert({ org_id: orgId, ...m });
  } catch {
    // best-effort
  }
}
