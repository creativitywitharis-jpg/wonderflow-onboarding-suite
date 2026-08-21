import { supabase } from "./supabase";

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceItem = { description: string; qty: number; price: number };

export type DbInvoice = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  number: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  amount: number;
  tax: number;
  total: number;
  items: InvoiceItem[];
  notes: string | null;
  paid_at: string | null;
  created_at: string;
};

export type NewInvoice = {
  customer_id?: string | null;
  customer_name?: string | null;
  number?: string;
  status?: InvoiceStatus;
  issue_date?: string;
  due_date?: string | null;
  amount: number;
  tax?: number;
  total?: number;
  items?: InvoiceItem[];
  notes?: string | null;
};

/** Subtotal, tax and total for a set of line items at a tax rate (%). */
export function invoiceTotals(items: InvoiceItem[], taxRate = 0) {
  const subtotal = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const tax = Math.round(subtotal * (Number(taxRate) || 0)) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

export type DbExpense = {
  id: string;
  supplier_id: string | null;
  vendor: string | null;
  category: string | null;
  amount: number;
  date: string;
  status: "paid" | "pending";
  notes: string | null;
  created_at: string;
};

export type NewExpense = {
  supplier_id?: string | null;
  vendor?: string | null;
  category?: string | null;
  amount: number;
  date?: string;
  status?: "paid" | "pending";
  notes?: string | null;
};

const INV_COLS = "id,customer_id,customer_name,number,status,issue_date,due_date,amount,tax,total,items,notes,paid_at,created_at";
const EXP_COLS = "id,supplier_id,vendor,category,amount,date,status,notes,created_at";

function invNumber() {
  return `INV-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Whether a sent invoice is past its due date (derived, not stored). */
export function isOverdue(inv: DbInvoice): boolean {
  return inv.status === "sent" && !!inv.due_date && new Date(inv.due_date) < new Date();
}

export async function listInvoices(orgId: string): Promise<DbInvoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select(INV_COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbInvoice[]) ?? [];
}

export async function createInvoice(orgId: string, inv: NewInvoice) {
  const total = inv.total ?? (Number(inv.amount) || 0) + (Number(inv.tax) || 0);
  const { data, error } = await supabase
    .from("invoices")
    .insert({ org_id: orgId, number: inv.number ?? invNumber(), ...inv, total })
    .select(INV_COLS)
    .single();
  return { data: data as DbInvoice | null, error: error ? new Error(error.message) : null };
}

export async function insertInvoices(orgId: string, rows: NewInvoice[]) {
  const { error } = await supabase.from("invoices").insert(
    rows.map((r) => ({ org_id: orgId, number: r.number ?? invNumber(), total: r.total ?? (Number(r.amount) || 0) + (Number(r.tax) || 0), ...r })),
  );
  return { error: error ? new Error(error.message) : null };
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus) {
  const { error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);
  return { error: error ? new Error(error.message) : null };
}

/** Email the invoice to the customer (branded) via the send-invoice edge fn,
 *  which also flips the invoice to 'sent'. Fails soft. */
export async function sendInvoice(invoiceId: string, origin?: string): Promise<{ sent: boolean; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("send-invoice", {
    body: { invoiceId, origin: origin ?? window.location.origin },
  });
  if (error) return { sent: false, error: error.message };
  const res = data as { sent?: boolean; error?: string } | null;
  return { sent: !!res?.sent, error: res?.error ?? null };
}

export async function listExpenses(orgId: string): Promise<DbExpense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(EXP_COLS)
    .eq("org_id", orgId)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DbExpense[]) ?? [];
}

export async function createExpense(orgId: string, e: NewExpense) {
  const { data, error } = await supabase.from("expenses").insert({ org_id: orgId, ...e }).select(EXP_COLS).single();
  return { data: data as DbExpense | null, error: error ? new Error(error.message) : null };
}

export async function insertExpenses(orgId: string, rows: NewExpense[]) {
  const { error } = await supabase.from("expenses").insert(rows.map((r) => ({ org_id: orgId, ...r })));
  return { error: error ? new Error(error.message) : null };
}
