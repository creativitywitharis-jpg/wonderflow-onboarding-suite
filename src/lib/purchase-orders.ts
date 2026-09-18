import { supabase } from "./supabase";
import { adjustStock } from "./products";
import { logMovement } from "./stock-movements";

export type PoStatus = "Draft" | "Sent" | "Confirmed" | "In transit" | "Received" | "Cancelled";

export type DbPurchaseOrder = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  number: string | null;
  status: PoStatus;
  items: number;
  total: number;
  eta: string | null;
  created_at: string;
};

export type NewPoItem = { product_id?: string | null; product_name: string; qty: number; cost?: number };

export type NewPurchaseOrder = {
  supplier_id?: string | null;
  supplier_name?: string | null;
  number?: string;
  status?: PoStatus;
  items?: number;
  total?: number;
  eta?: string | null;
  notes?: string | null;
};

export type DbPoItem = { id: string; product_id: string | null; product_name: string; qty: number; cost: number };

const COLS = "id,supplier_id,supplier_name,number,status,items,total,eta,created_at";
const ITEM_COLS = "id,product_id,product_name,qty,cost";
// Ships in migration 0047 — reach the table untyped until Lovable regenerates DB types.
const poItemsTable = () => (supabase as unknown as { from: (t: string) => any }).from("purchase_order_items");

function poNumber() {
  return `PO-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** All purchase orders for an org, newest first (RLS-scoped to members). */
export async function listPurchaseOrders(orgId: string): Promise<DbPurchaseOrder[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbPurchaseOrder[]) ?? [];
}

/** Real per-product lines for one purchase order. */
export async function listPurchaseOrderItems(poId: string): Promise<DbPoItem[]> {
  const { data, error } = await poItemsTable().select(ITEM_COLS).eq("purchase_order_id", poId);
  if (error) return [];
  return (data as DbPoItem[]) ?? [];
}

/** Create a PO, optionally with real per-product line items. */
export async function createPurchaseOrder(orgId: string, po: NewPurchaseOrder, items?: NewPoItem[]) {
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({ org_id: orgId, number: po.number ?? poNumber(), ...po })
    .select(COLS)
    .single();
  if (error || !data) return { data: null, error: error ? new Error(error.message) : null };
  const created = data as DbPurchaseOrder;
  if (items && items.length) {
    await poItemsTable().insert(
      items.map((i) => ({ org_id: orgId, purchase_order_id: created.id, product_id: i.product_id ?? null, product_name: i.product_name, qty: i.qty, cost: i.cost ?? 0 })),
    );
  }
  return { data: created, error: null };
}

/** Status-only update — use receivePurchaseOrder instead when moving to "Received". */
export async function updatePurchaseOrderStatus(id: string, status: PoStatus) {
  const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/**
 * Mark a PO Received: increases real product stock for every line item that
 * has a matched product, logs a real "Received" stock movement per line,
 * then sets the PO's status. Lines with no product_id (no supplier-catalog
 * match at creation time) are skipped — nothing to increment.
 */
export async function receivePurchaseOrder(orgId: string, poId: string) {
  const items = await listPurchaseOrderItems(poId);
  for (const it of items) {
    if (!it.product_id || it.qty <= 0) continue;
    const newStock = await adjustStock(it.product_id, it.qty);
    if (newStock !== null) {
      await logMovement(orgId, { product_id: it.product_id, product_name: it.product_name, type: "Received", qty: it.qty });
    }
  }
  return updatePurchaseOrderStatus(poId, "Received");
}
