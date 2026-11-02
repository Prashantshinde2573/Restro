// The bill: printed receipt (browser print, 80 mm friendly) and WhatsApp e-bill text.
import { halfGstLabel, inr } from "@/lib/format";
import { receiptPdf, type PdfLine } from "./pdf";
import type { OutletSettings, Payment } from "@/lib/types";

export interface ReceiptData {
  settings: OutletSettings;
  outletName: string;
  label: string; // "Table T4", "Takeaway"
  billNo?: number;
  lines: { name: string; qty: number; price: number }[];
  totals: { subtotal: number; discount: number; cgst: number; sgst: number; roundOff: number; total: number };
  payments: Payment[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const methodName = (m: string) => (m === "upi" ? "UPI" : m === "cash" ? "Cash" : m === "card" ? "Card" : m);

export function printReceipt(r: ReceiptData) {
  const s = r.settings;
  const now = new Date();
  const rows = r.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class=c>${l.qty}</td><td class=r>${money(l.qty * l.price)}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bill</title><style>
    @page{size:80mm auto;margin:4mm}body{font:12px/1.35 ui-monospace,Menlo,monospace;color:#000;width:72mm;margin:0 auto}
    h1{font-size:15px;text-align:center;margin:0 0 2px}.m{text-align:center;margin:0}.sm{font-size:11px}
    table{width:100%;border-collapse:collapse;margin:6px 0}td{padding:2px 0;vertical-align:top}.c{text-align:center;width:28px}.r{text-align:right;white-space:nowrap}
    hr{border:0;border-top:1px dashed #000;margin:6px 0}.t td{font-weight:700;font-size:14px}
  </style></head><body>
    <h1>${esc(s.name || r.outletName)}</h1>
    ${s.address ? `<p class="m sm">${esc(s.address)}</p>` : ""}
    ${s.phone ? `<p class="m sm">Ph: ${esc(s.phone)}</p>` : ""}
    ${s.gstin ? `<p class="m sm">GSTIN: ${esc(s.gstin)}</p>` : ""}
    ${s.fssai ? `<p class="m sm">FSSAI: ${esc(s.fssai)}</p>` : ""}
    <hr><div>${r.billNo ? `Bill #${r.billNo} · ` : ""}${esc(r.label)}</div><div class=sm>${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div><hr>
    <table><tr><td><b>Item</b></td><td class=c><b>Qty</b></td><td class=r><b>Amount</b></td></tr>${rows}</table><hr>
    <table>
      <tr><td>Subtotal</td><td class=r>${money(r.totals.subtotal)}</td></tr>
      ${r.totals.discount ? `<tr><td>Discount</td><td class=r>-${money(r.totals.discount)}</td></tr>` : ""}
      <tr><td>CGST ${halfGstLabel()}</td><td class=r>${money(r.totals.cgst)}</td></tr>
      <tr><td>SGST ${halfGstLabel()}</td><td class=r>${money(r.totals.sgst)}</td></tr>
      ${Math.abs(r.totals.roundOff) >= 0.01 ? `<tr><td>Round off</td><td class=r>${money(r.totals.roundOff)}</td></tr>` : ""}
      <tr class=t><td>Total</td><td class=r>₹${money(r.totals.total)}</td></tr>
    </table>
    ${r.payments.length ? `<div class=sm>Paid: ${r.payments.map((p) => `${methodName(p.method)} ₹${money(p.amount)}`).join(" + ")}</div>` : ""}
    <hr><p class="m">${esc(s.billFooter || "Thank you! Visit again")}</p>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

export function receiptText(r: ReceiptData) {
  const s = r.settings;
  return [
    `*${s.name || r.outletName}*`,
    `${r.billNo ? `Bill #${r.billNo} · ` : ""}${r.label} · ${new Date().toLocaleDateString("en-IN")}`,
    "",
    ...r.lines.map((l) => `${l.qty} × ${l.name} — ${inr(l.qty * l.price)}`),
    "",
    r.totals.discount ? `Discount: -${inr(r.totals.discount)}` : "",
    `GST: ${inr(Math.round(r.totals.cgst + r.totals.sgst))}`,
    `*Total: ${inr(r.totals.total)}*`,
    r.payments.length ? `Paid by ${r.payments.map((p) => methodName(p.method)).join(" + ")}` : "",
    "",
    s.billFooter || "Thank you! Visit again 🙏",
  ]
    .filter((x, i, a) => x !== "" || (a[i - 1] ?? "") !== "")
    .join("\n");
}

/** The same bill as a small PDF file (to share on WhatsApp or save). */
export function receiptPdfBlob(r: ReceiptData) {
  const s = r.settings;
  const now = new Date();
  const m = (n: number) => money(n);
  const L: PdfLine[] = [
    { text: s.name || r.outletName, bold: true, center: true },
    ...(s.address ? [{ text: s.address, center: true }] : []),
    ...(s.phone ? [{ text: `Ph: ${s.phone}`, center: true }] : []),
    ...(s.gstin ? [{ text: `GSTIN: ${s.gstin}`, center: true }] : []),
    ...(s.fssai ? [{ text: `FSSAI: ${s.fssai}`, center: true }] : []),
    { text: "-".repeat(36) },
    { text: `${r.billNo ? `Bill #${r.billNo}  ` : ""}${r.label}` },
    { text: `${now.toLocaleDateString("en-IN")} ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` },
    { text: "-".repeat(36) },
    ...r.lines.map((l) => ({ text: `${l.qty} x ${l.name}`, right: m(l.qty * l.price) })),
    { text: "-".repeat(36) },
    { text: "Subtotal", right: m(r.totals.subtotal) },
    ...(r.totals.discount ? [{ text: "Discount", right: `-${m(r.totals.discount)}` }] : []),
    { text: `CGST ${halfGstLabel()}`, right: m(r.totals.cgst) },
    { text: `SGST ${halfGstLabel()}`, right: m(r.totals.sgst) },
    ...(Math.abs(r.totals.roundOff) >= 0.01 ? [{ text: "Round off", right: m(r.totals.roundOff) }] : []),
    { text: "TOTAL", right: `Rs ${m(r.totals.total)}`, bold: true },
    ...(r.payments.length ? [{ text: `Paid: ${r.payments.map((p) => `${methodName(p.method)} Rs ${m(p.amount)}`).join(" + ")}` }] : []),
    { text: "-".repeat(36) },
    { text: s.billFooter || "Thank you! Visit again", center: true },
  ];
  return receiptPdf(L);
}
