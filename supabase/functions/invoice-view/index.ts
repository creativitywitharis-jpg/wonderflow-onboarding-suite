// WonderFlow OS — fetchable invoice document (public, no session).
// Lets external tools (n8n, Zapier, Make) download an invoice as a real
// file after receiving its id from the invoice.paid webhook, e.g. to
// attach it in an outgoing email. Returns the same branded HTML document
// WonderFlow itself emails -- an HTTP Request node with "Response Format:
// File" turns this into binary data automatically.
//
// Auth: the org's ingest_key (same one used by the Website & forms
// endpoint) as ?key=, scoping which invoices a given key can read --
// never a user session, since this is called by unattended automation.
//
// verify_jwt = false (called anonymously by external systems).
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { invoiceHtml, type InvoiceItem } from "../_shared/invoice-html.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function text(body: string, status = 200, contentType = "text/plain") {
  return new Response(body, { status, headers: { ...CORS, "Content-Type": contentType } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return text("Method not allowed", 405);

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const invoiceId = url.searchParams.get("id") || "";
  if (!key) return text("Missing form key.", 401);
  if (!invoiceId) return text("Missing invoice id.", 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: org } = await admin.from("organizations").select("id,name,address,phone,website").eq("ingest_key", key).maybeSingle();
  const o = org as { id?: string; name?: string; address?: string; phone?: string; website?: string } | null;
  if (!o?.id) return text("Invalid key.", 401);

  const { data: invoice } = await admin
    .from("invoices")
    .select("id,org_id,customer_id,customer_name,number,issue_date,due_date,amount,tax,total,items,notes")
    .eq("id", invoiceId)
    .eq("org_id", o.id) // this key may only read invoices belonging to its own org
    .maybeSingle();
  const inv = invoice as Record<string, unknown> | null;
  if (!inv) return text("Invoice not found.", 404);

  let customerName = (inv.customer_name as string) || "Customer";
  if (inv.customer_id) {
    const { data: cust } = await admin.from("customers").select("name").eq("id", inv.customer_id).maybeSingle();
    const c = cust as { name?: string } | null;
    if (c?.name) customerName = c.name;
  }

  const items = (Array.isArray(inv.items) ? inv.items : []) as InvoiceItem[];
  const subtotal = Number(inv.amount) || 0;
  const tax = Number(inv.tax) || 0;
  const total = Number(inv.total) || subtotal + tax;

  const html = invoiceHtml({
    orgName: o.name ?? "Your business",
    orgAddress: o.address || null,
    orgPhone: o.phone || null,
    orgWebsite: o.website || null,
    number: (inv.number as string) || "Invoice",
    customerName,
    issueDate: (inv.issue_date as string) || new Date().toISOString().slice(0, 10),
    dueDate: (inv.due_date as string) || null,
    items,
    subtotal,
    tax,
    total,
    notes: (inv.notes as string) || null,
  });

  return new Response(html, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="invoice-${(inv.number as string) || invoiceId}.html"`,
    },
  });
});
