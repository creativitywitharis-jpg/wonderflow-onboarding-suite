// Shared invoice document template -- used both when emailing an invoice
// (send-invoice) and when serving it as a fetchable file (invoice-view, for
// external tools like n8n/Zapier to download and attach elsewhere).

export type InvoiceItem = { description?: string; qty?: number; price?: number };

export const money = (n: number) => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

export function invoiceHtml(o: {
  orgName: string;
  orgAddress: string | null;
  orgPhone: string | null;
  orgWebsite: string | null;
  number: string;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  items: InvoiceItem[];
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
