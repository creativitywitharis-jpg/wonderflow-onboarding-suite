// WonderFlow OS — email an invoice to the customer via Resend, and mark it sent.
// Requires a signed-in member of the invoice's org. The invoice is branded with
// the business's name (so it reads as coming from THEM, not WonderFlow). Best-
// effort: returns { sent:false, error } (HTTP 200) when email isn't configured,
// so the caller can still treat the invoice as created.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (optional, defaults to Resend sandbox)
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { invoiceHtml, money, type InvoiceItem } from "../_shared/invoice-html.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type Item = InvoiceItem;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "Please sign in." }, 401);

  let body: { invoiceId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  const invoiceId = body.invoiceId ?? "";
  if (!invoiceId) return json({ error: "Missing invoice." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: invoice } = await admin
    .from("invoices")
    .select("id,org_id,customer_id,customer_name,number,issue_date,due_date,amount,tax,total,items,notes")
    .eq("id", invoiceId)
    .maybeSingle();
  const inv = invoice as Record<string, unknown> | null;
  if (!inv) return json({ error: "Invoice not found." }, 404);
  const orgId = inv.org_id as string;

  // Only an active member of the invoice's org may send it.
  const { data: membership } = await userClient
    .from("memberships").select("id").eq("org_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!membership) return json({ error: "Not allowed." }, 403);

  // Resolve the client's email (from the linked customer).
  let toEmail = "";
  let customerName = (inv.customer_name as string) || "Customer";
  if (inv.customer_id) {
    const { data: cust } = await admin.from("customers").select("name,email").eq("id", inv.customer_id).maybeSingle();
    const c = cust as { name?: string; email?: string } | null;
    if (c?.email) toEmail = c.email;
    if (c?.name) customerName = c.name;
  }
  if (!toEmail) return json({ sent: false, error: "This customer has no email address on file." });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ sent: false, error: "Email isn't configured yet — add the RESEND_API_KEY secret." });

  const { data: org } = await admin.from("organizations").select("name,address,phone,website").eq("id", orgId).maybeSingle();
  const o = org as { name?: string; address?: string; phone?: string; website?: string } | null;
  const orgName = o?.name ?? "Your business";
  const from = Deno.env.get("EMAIL_FROM") || "WonderFlow OS <onboarding@resend.dev>";

  const items = (Array.isArray(inv.items) ? inv.items : []) as Item[];
  const subtotal = Number(inv.amount) || 0;
  const tax = Number(inv.tax) || 0;
  const total = Number(inv.total) || subtotal + tax;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: `Invoice ${inv.number ?? ""} from ${orgName} — ${money(total)}`,
        html: invoiceHtml({
          orgName,
          orgAddress: o?.address || null,
          orgPhone: o?.phone || null,
          orgWebsite: o?.website || null,
          number: (inv.number as string) || "Invoice",
          customerName,
          issueDate: (inv.issue_date as string) || new Date().toISOString().slice(0, 10),
          dueDate: (inv.due_date as string) || null,
          items,
          subtotal,
          tax,
          total,
          notes: (inv.notes as string) || null,
        }),
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ sent: false, error: data?.message ?? "Email failed to send." });

    // Flip to 'sent' now that it's on its way.
    await admin.from("invoices").update({ status: "sent" }).eq("id", invoiceId);
    return json({ sent: true, to: toEmail });
  } catch (e) {
    return json({ sent: false, error: e instanceof Error ? e.message : "Email failed to send." });
  }
});
