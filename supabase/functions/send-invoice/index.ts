// WonderFlow OS — email an invoice to the customer via Resend, and mark it sent.
// Requires a signed-in member of the invoice's org. The invoice is branded with
// the business's name (so it reads as coming from THEM, not WonderFlow). Best-
// effort: returns { sent:false, error } (HTTP 200) when email isn't configured,
// so the caller can still treat the invoice as created.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (optional, defaults to Resend sandbox)
// Auto-injected: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

type Item = { description?: string; qty?: number; price?: number };
const money = (n: number) => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

function invoiceHtml(o: {
  orgName: string;
  orgAddress: string | null;
  orgPhone: string | null;
  orgWebsite: string | null;
  number: string;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  items: Item[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
}): string {
  const rows = (o.items.length ? o.items : [{ description: "Services", qty: 1, price: o.subtotal }])
    .map(
      (it) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #ece7dc;color:#33394a">${esc(it.description || "Item")}</td>
        <td style="padding:12px 0;border-bottom:1px solid #ece7dc;text-align:center;color:#8a8f98">${Number(it.qty) || 0}</td>
        <td style="padding:12px 0;border-bottom:1px solid #ece7dc;text-align:right;color:#8a8f98">${money(Number(it.price) || 0)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #ece7dc;text-align:right;color:#33394a">${money((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
      </tr>`,
    )
    .join("");
  const contactLine = [o.orgAddress, o.orgPhone, o.orgWebsite]
    .filter((v): v is string => !!v)
    .map(esc)
    .join(" &nbsp;·&nbsp; ");
  return `<!doctype html><html><body style="margin:0;background:#f2efe8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#33394a">
  <div style="max-width:620px;margin:0 auto;padding:40px 20px">
    <div style="border-radius:20px;border:1px solid #ece7dc;background:#fdfbf7;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:19px;font-weight:700;letter-spacing:-0.01em;color:#262b38">${esc(o.orgName)}</div>
          ${o.orgAddress ? `<div style="margin-top:4px;font-size:12px;line-height:1.6;color:#8a8f98">${esc(o.orgAddress)}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a8f98">Invoice</div>
          <div style="margin-top:4px;font-size:20px;font-weight:700;color:#c99a35">${esc(o.number)}</div>
        </div>
      </div>

      <div style="margin-top:28px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8a8f98">Billed to</div>
          <div style="margin-top:4px;font-size:15px;font-weight:600;color:#262b38">${esc(o.customerName)}</div>
        </div>
        <div style="font-size:12px;color:#8a8f98">Issued ${esc(o.issueDate)}${o.dueDate ? ` &nbsp;·&nbsp; Due ${esc(o.dueDate)}` : ""}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:14px">
        <thead><tr style="background:#f4f1ea">
          <th style="text-align:left;padding:9px 0 9px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#8a8f98;border-radius:8px 0 0 8px">Description</th>
          <th style="text-align:center;padding:9px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#8a8f98">Qty</th>
          <th style="text-align:right;padding:9px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#8a8f98">Unit price</th>
          <th style="text-align:right;padding:9px 12px 9px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#8a8f98;border-radius:0 8px 8px 0">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:18px;margin-left:auto;width:260px;font-size:14px">
        <div style="display:flex;justify-content:space-between;padding:4px 0;color:#6b7078"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;color:#6b7078"><span>Tax</span><span>${money(o.tax)}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:10px 14px;border-radius:10px;background:#f4f1ea;font-size:17px;font-weight:700;color:#c99a35"><span>Total</span><span>${money(o.total)}</span></div>
      </div>

      ${o.notes ? `<div style="margin-top:26px;padding-top:16px;border-top:1px solid #ece7dc"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#8a8f98">Notes</div><p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:#6b7078;white-space:pre-wrap">${esc(o.notes)}</p></div>` : ""}
    </div>
    <p style="margin:18px 0 0;font-size:11px;color:#9a9a92;text-align:center">${esc(o.orgName)}${contactLine ? ` &nbsp;·&nbsp; ${contactLine}` : ""}</p>
  </div></body></html>`;
}

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
