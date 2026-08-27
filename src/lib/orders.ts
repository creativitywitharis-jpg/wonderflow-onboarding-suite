import { supabase } from "./supabase";

export type OrderItem = { name: string; qty: number; price: number };
export type OrderStatus = "New" | "Paid" | "Processing" | "Packed" | "Shipped" | "Delivered" | "Cancelled";

export type DbOrder = {
  id: string;
  number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: OrderStatus;
  channel: string | null;
  city: string | null;
  priority: "High" | "Normal";
  total: number;
  item_count: number;
  items: OrderItem[];
  eta: string | null;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
};

export type NewOrder = {
  customer_name?: string | null;
  customer_id?: string | null;
  channel?: string | null;
  city?: string | null;
  priority?: "High" | "Normal";
  total: number;
  item_count: number;
  items: OrderItem[];
  status?: OrderStatus;
  eta?: string | null;
  number?: string;
};

const COLS =
  "id,number,customer_id,customer_name,status,channel,city,priority,total,item_count,items,eta,tracking_number,carrier,created_at";

// tracking_number/carrier ship in migration 0045 — reach the table untyped
// until Lovable regenerates DB types. Runtime behaviour is unchanged once
// types regenerate.
const ordersTable = () => (supabase as unknown as { from: (t: string) => any }).from("orders");

function orderNumber() {
  return `#${Math.floor(10000 + Math.random() * 90000)}`;
}

/** All orders for an org, newest first (RLS-scoped to members). */
export async function listOrders(orgId: string): Promise<DbOrder[]> {
  const { data, error } = await ordersTable()
    .select(COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbOrder[]) ?? [];
}

export async function createOrder(orgId: string, o: NewOrder) {
  const { data, error } = await ordersTable()
    .insert({ org_id: orgId, number: o.number ?? orderNumber(), ...o })
    .select(COLS)
    .single();
  return { data: data as DbOrder | null, error: error ? new Error(error.message) : null };
}

export async function insertOrders(orgId: string, rows: NewOrder[]) {
  const { error } = await ordersTable()
    .insert(rows.map((r) => ({ org_id: orgId, number: r.number ?? orderNumber(), ...r })));
  return { error: error ? new Error(error.message) : null };
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const { error } = await ordersTable().update({ status }).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Record the carrier + tracking number once an order's actually shipped. */
export async function updateOrderTracking(id: string, patch: { tracking_number?: string | null; carrier?: string | null }) {
  const { error } = await ordersTable().update(patch).eq("id", id);
  return { error: error ? new Error(error.message) : null };
}
