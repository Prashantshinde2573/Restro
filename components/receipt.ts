// The bill, three ways: printed receipt (80 mm thermal printer or A4 via the
// browser), a PDF to share, and a WhatsApp e-bill. Same content in all three.
import { gstRate, halfGstLabel, inr } from "@/lib/format";
import { invoicePdf, rupeesInWords } from "./invoice-pdf";
import type { OutletSettings, Payment } from "@/lib/types";

export interface ReceiptData {
  settings: OutletSettings;
  outletName: string;
  label: string; // "Table T4", "Takeaway"
  billNo?: number;
  lines: { name: string; qty: number; price: number }[];
  totals: { subtotal: number; discount: number; cgst: number; sgst: number; roundOff: number; total: number };
  payments: Payment[];
  by?: string; // who billed it
  customer?: string;
  when?: Date;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const methodName = (m: string) => (m === "upi" ? "UPI" : m === "cash" ? "Cash" : m === "card" ? "Card" : m);
const title = () => (gstRate() > 0 ? "TAX INVOICE" : "BILL");
const whenText = (d: Date) => `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;

export function printReceipt(r: ReceiptData) {
  const s = r.settings;
  const now = r.when ?? new Date();
  const items = r.lines.reduce((a, l) => a + l.qty, 0);
  const rows = r.lines
    .map((l) => `<tr><td class=n>${esc(l.name)}</td><td class=c>${l.qty}</td><td class=r>${money(l.price)}</td><td class=r>${money(l.qty * l.price)}</td></tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title()} ${r.billNo ?? ""}</title><style>
    @page{size:80mm auto;margin:3mm}
    *{box-sizing:border-box}
    body{font:12px/1.4 "Segoe UI",Roboto,Arial,sans-serif;color:#000;width:74mm;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .center{text-align:center}.sm{font-size:10.5px}.xs{font-size:9.5px;color:#333}
    h1{font-size:17px;margin:0;letter-spacing:.01em}
    .tag{display:inline-block;margin:6px 0 2px;padding:2px 10px;border:1.5px solid #000;border-radius:999px;font-weight:700;font-size:10.5px;letter-spacing:.12em}
    .meta{display:flex;justify-content:space-between;font-size:11px;margin:1px 0}
    table{width:100%;border-collapse:collapse}
    th{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;text-align:left;border-bottom:1px solid #000;padding:3px 0}
    td{padding:3px 0;vertical-align:top}.n{padding-right:4px}.c{text-align:center;width:22px}.r{text-align:right;white-space:nowrap;padding-left:4px}
    th.c{text-align:center}th.r{text-align:right}
    hr{border:0;border-top:1px dashed #000;margin:7px 0}
    .tot td{padding:1.5px 0}.grand td{font-size:16px;font-weight:800;padding-top:5px;border-top:1.5px solid #000}
    .paid{margin-top:6px;padding:5px 7px;border:1px solid #000;border-radius:6px;font-size:11px}
    .foot{margin-top:8px;font-weight:600}
  </style></head><body>
    <div class=center>
      <h1>${esc(s.name || r.outletName)}</h1>
      ${r.outletName && s.name && r.outletName !== s.name ? `<div class=sm>${esc(r.outletName)}</div>` : ""}
      ${s.address ? `<div class=xs>${esc(s.address)}</div>` : ""}
      ${s.phone ? `<div class=xs>Ph: ${esc(s.phone)}</div>` : ""}
      ${s.gstin ? `<div class=xs>GSTIN: ${esc(s.gstin)}</div>` : ""}
      ${s.fssai ? `<div class=xs>FSSAI Lic. No: ${esc(s.fssai)}</div>` : ""}
      <div class=tag>${title()}</div>
    </div>
    <hr>
    <div class=meta><span><b>Bill No:</b> ${r.billNo ?? "—"}</span><span>${esc(r.label)}</span></div>
    <div class=meta><span>${esc(whenText(now))}</span><span>${r.by ? `By: ${esc(r.by)}` : ""}</span></div>
    ${r.customer ? `<div class=meta><span>Guest: ${esc(r.customer)}</span><span></span></div>` : ""}
    <hr>
    <table><thead><tr><th>Item</th><th class=c>Qty</th><th class=r>Rate</th><th class=r>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <hr>
    <table class=tot>
      <tr><td>Items: ${items}</td><td class=r>Subtotal</td><td class=r>${money(r.totals.subtotal)}</td></tr>
      ${r.totals.discount ? `<tr><td></td><td class=r>Discount</td><td class=r>-${money(r.totals.discount)}</td></tr><tr><td></td><td class=r>Taxable value</td><td class=r>${money(r.totals.subtotal - r.totals.discount)}</td></tr>` : ""}
      ${gstRate() > 0 ? `<tr><td></td><td class=r>CGST @ ${halfGstLabel()}</td><td class=r>${money(r.totals.cgst)}</td></tr><tr><td></td><td class=r>SGST @ ${halfGstLabel()}</td><td class=r>${money(r.totals.sgst)}</td></tr>` : ""}
      ${Math.abs(r.totals.roundOff) >= 0.01 ? `<tr><td></td><td class=r>Round off</td><td class=r>${money(r.totals.roundOff)}</td></tr>` : ""}
      <tr class=grand><td colspan=2>TOTAL</td><td class=r>₹${money(r.totals.total)}</td></tr>
    </table>
    <div class=xs>${esc(rupeesInWords(r.totals.total))}</div>
    ${r.payments.length ? `<div class=paid><b>PAID</b> &nbsp;${r.payments.map((p) => `${methodName(p.method)} ₹${money(p.amount)}`).join(" + ")}</div>` : ""}
    <div class="center foot">${esc(s.billFooter || "Thank you! Please visit again.")}</div>
    <div class="center xs" style="margin-top:4px">Computer generated bill · Restropi</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/** WhatsApp e-bill: short, clear, looks like a bill. */
export function receiptText(r: ReceiptData) {
  const s = r.settings;
  const now = r.when ?? new Date();
  const line = "━━━━━━━━━━━━━━━";
  const out = [
    `*${s.name || r.outletName}*`,
    [r.outletName && r.outletName !== s.name ? r.outletName : "", s.phone ? `📞 ${s.phone}` : ""].filter(Boolean).join(" · "),
    s.gstin ? `GSTIN ${s.gstin}` : "",
    "",
    `🧾 *${title() === "BILL" ? "Bill" : "Tax invoice"}${r.billNo ? ` #${r.billNo}` : ""}*`,
    `${r.label} · ${whenText(now)}`,
    line,
    ...r.lines.map((l) => `${l.qty} × ${l.name}  —  ${inr(l.qty * l.price)}`),
    line,
    `Subtotal: ${inr(r.totals.subtotal, { decimals: true })}`,
    r.totals.discount ? `Discount: −${inr(r.totals.discount, { decimals: true })}` : "",
    gstRate() > 0 ? `CGST ${halfGstLabel()}: ${inr(r.totals.cgst, { decimals: true })}` : "",
    gstRate() > 0 ? `SGST ${halfGstLabel()}: ${inr(r.totals.sgst, { decimals: true })}` : "",
    `*Total: ${inr(r.totals.total)}*`,
    r.payments.length ? `✅ Paid · ${r.payments.map((p) => `${methodName(p.method)} ${inr(p.amount)}`).join(" + ")}` : "",
    "",
    `${s.billFooter || "Thank you for visiting us!"} 🙏`,
    "_Bill sent via Restropi_",
  ];
  return out.filter((x, i, a) => x !== "" || (a[i - 1] ?? "") !== "").join("\n").trim();
}

/** The same bill as a PDF (to share on WhatsApp or save). */
export function receiptPdfBlob(r: ReceiptData) {
  const s = r.settings;
  return invoicePdf({
    business: s.name || r.outletName,
    outletName: r.outletName && r.outletName !== s.name ? r.outletName : undefined,
    address: s.address,
    phone: s.phone,
    gstin: s.gstin,
    fssai: s.fssai,
    title: title(),
    billNo: r.billNo,
    where: r.label,
    when: r.when ?? new Date(),
    by: r.by,
    customer: r.customer,
    lines: r.lines,
    subtotal: r.totals.subtotal,
    discount: r.totals.discount,
    gstHalfLabel: halfGstLabel(),
    cgst: r.totals.cgst,
    sgst: r.totals.sgst,
    roundOff: r.totals.roundOff,
    total: r.totals.total,
    payments: r.payments.map((p) => ({ label: methodName(p.method), amount: p.amount })),
    words: rupeesInWords(r.totals.total),
    footer: s.billFooter || "Thank you! Please visit again.",
  });
}
