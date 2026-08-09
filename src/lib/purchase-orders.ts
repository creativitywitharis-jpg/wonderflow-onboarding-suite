import { supabase } from "./supabase";

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

const COLS = "id,supplier_id,supplier_name,number,status,items,total,eta,created_at";

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

export async function createPurchaseOrder(orgId: string, po: NewPurchaseOrder) {
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({ org_id: orgId, number: po.number ?? poNumber(), ...po })
    .select(COLS)
    .single();
  return { data: data as DbPurchaseOrder | null, error: error ? new Error(error.message) : null };
}

export async function updatePurchaseOrderStatus(id: string, status: PoStatus) {
  const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
