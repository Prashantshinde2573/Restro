// A clean one-page bill PDF (A6-wide, Helvetica) with no library: header band,
// GST details, item table with right-aligned money, totals and payment.
// Helvetica is a standard PDF font, so text must be Latin-1: "₹" becomes "Rs.".

// Helvetica / Helvetica-Bold widths (1/1000 em) for ASCII 32..126 (Adobe AFM).
const HV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const latin = (s: string) =>
  s
    .replace(/₹\s?/g, "Rs. ")
    .replace(/×/g, "x")
    .replace(/[—–]/g, "-")
    .replace(/·/g, "|")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "");
const pdfStr = (s: string) => latin(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
export const textWidth = (s: string, size: number, bold = false) =>
  [...latin(s)].reduce((w, ch) => w + ((bold ? HB : HV)[ch.charCodeAt(0) - 32] ?? 556), 0) * (size / 1000);

/** Cut text to fit a width, with "..." */
function fit(s: string, size: number, max: number, bold = false) {
  let t = latin(s);
  if (textWidth(t, size, bold) <= max) return t;
  while (t.length > 1 && textWidth(t + "...", size, bold) > max) t = t.slice(0, -1);
  return t + "...";
}

type Op =
  | { k: "text"; x: number; y: number; s: string; size: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center" }
  | { k: "rect"; x: number; y: number; w: number; h: number; color: [number, number, number] }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; color?: [number, number, number]; dash?: boolean; width?: number };

export interface InvoiceData {
  business: string;
  outletName?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  fssai?: string;
  title: string; // "TAX INVOICE" or "BILL"
  billNo?: number;
  where: string; // Table T4
  when: Date;
  by?: string;
  customer?: string;
  lines: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  gstHalfLabel: string; // "2.5%"
  cgst: number;
  sgst: number;
  roundOff: number;
  total: number;
  payments: { label: string; amount: number }[];
  words: string; // amount in words
  footer: string;
}

const m2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function invoicePdf(d: InvoiceData): Blob {
  const W = 297.6; // 105 mm (A6 width)
  const M = 18;
  const ink: [number, number, number] = [0.09, 0.13, 0.12];
  const muted: [number, number, number] = [0.42, 0.46, 0.44];
  const jade: [number, number, number] = [0.06, 0.48, 0.33];
  const ops: Op[] = [];
  let y = 0; // distance from the top; flipped at the end
  const T = (x: number, s: string, size: number, o: Partial<Extract<Op, { k: "text" }>> = {}) => ops.push({ k: "text", x, y: y + size, s, size, ...o });

  // header band
  const bandH = 64 + (d.address ? 10 : 0) + (d.phone || d.gstin ? 10 : 0);
  ops.push({ k: "rect", x: 0, y: 0, w: W, h: bandH, color: [0.06, 0.48, 0.33] });
  y = 16;
  T(W / 2, d.business || "Bill", 15, { bold: true, color: [1, 1, 1], align: "center" });
  y += 20;
  if (d.outletName) { T(W / 2, d.outletName, 8.5, { color: [0.85, 0.95, 0.9], align: "center" }); y += 11; }
  if (d.address) { T(W / 2, fit(d.address, 8, W - 2 * M), 8, { color: [0.85, 0.95, 0.9], align: "center" }); y += 10; }
  const ids = [d.phone && `Ph ${d.phone}`, d.gstin && `GSTIN ${d.gstin}`].filter(Boolean).join("   ");
  if (ids) { T(W / 2, ids, 7.5, { color: [0.85, 0.95, 0.9], align: "center" }); y += 10; }
  y = bandH + 12;

  // invoice line
  T(M, d.title, 10, { bold: true, color: jade });
  T(W - M, d.billNo ? `No. ${d.billNo}` : "", 10, { bold: true, align: "right" });
  y += 15;
  const dt = `${d.when.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${d.when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  T(M, d.where, 8.5, { color: muted });
  T(W - M, dt, 8.5, { color: muted, align: "right" });
  y += 11;
  if (d.by || d.customer) {
    T(M, d.customer ? `Guest: ${d.customer}` : "", 8.5, { color: muted });
    T(W - M, d.by ? `Billed by ${d.by}` : "", 8.5, { color: muted, align: "right" });
    y += 11;
  }
  if (d.fssai) { T(M, `FSSAI ${d.fssai}`, 7.5, { color: muted }); y += 10; }
  y += 6;

  // table head
  const cQty = W - M - 118, cRate = W - M - 62, cAmt = W - M;
  ops.push({ k: "rect", x: M - 4, y: y - 3, w: W - 2 * M + 8, h: 16, color: [0.95, 0.96, 0.95] });
  T(M, "ITEM", 7.5, { bold: true, color: muted });
  T(cQty, "QTY", 7.5, { bold: true, color: muted, align: "right" });
  T(cRate, "RATE", 7.5, { bold: true, color: muted, align: "right" });
  T(cAmt, "AMOUNT", 7.5, { bold: true, color: muted, align: "right" });
  y += 18;
  for (const l of d.lines) {
    T(M, fit(l.name, 9, cQty - M - 26), 9);
    T(cQty, String(l.qty), 9, { align: "right" });
    T(cRate, m2(l.price), 9, { align: "right", color: muted });
    T(cAmt, m2(l.qty * l.price), 9, { align: "right" });
    y += 14;
    ops.push({ k: "line", x1: M, y1: y - 3, x2: W - M, y2: y - 3, color: [0.92, 0.93, 0.92] });
  }
  y += 6;

  // totals
  const row = (label: string, value: string, o: { bold?: boolean; size?: number; color?: [number, number, number] } = {}) => {
    const size = o.size ?? 8.5;
    T(W / 2 - 10, label, size, { bold: o.bold, color: o.color ?? muted });
    T(W - M, value, size, { bold: o.bold, align: "right", color: o.color ?? ink });
    y += size + 5;
  };
  row("Subtotal", m2(d.subtotal));
  if (d.discount) row("Discount", `- ${m2(d.discount)}`, { color: jade });
  if (d.discount) row("Taxable value", m2(d.subtotal - d.discount));
  row(`CGST @ ${d.gstHalfLabel}`, m2(d.cgst));
  row(`SGST @ ${d.gstHalfLabel}`, m2(d.sgst));
  if (Math.abs(d.roundOff) >= 0.01) row("Round off", m2(d.roundOff));
  y += 2;
  ops.push({ k: "line", x1: W / 2 - 10, y1: y, x2: W - M, y2: y, color: ink, width: 1 });
  y += 6;
  row("TOTAL", `Rs. ${m2(d.total)}`, { bold: true, size: 13, color: ink });
  T(M, fit(d.words, 7.5, W - 2 * M), 7.5, { color: muted });
  y += 14;

  if (d.payments.length) {
    ops.push({ k: "rect", x: M - 4, y: y - 3, w: W - 2 * M + 8, h: 18 + (d.payments.length - 1) * 11, color: [0.91, 0.96, 0.93] });
    d.payments.forEach((p, i) => {
      T(M, i === 0 ? "PAID" : "", 8, { bold: true, color: jade });
      T(M + 34, p.label, 8.5);
      T(W - M, `Rs. ${m2(p.amount)}`, 8.5, { align: "right", bold: true });
      y += 11;
    });
    y += 10;
  }
  y += 6;
  T(W / 2, d.footer, 9, { align: "center", bold: true });
  y += 14;
  T(W / 2, "Computer generated bill. Made with Restropi.", 6.5, { align: "center", color: muted });
  y += 16;

  // write
  const H = Math.max(260, y + 6);
  const col = (c: [number, number, number]) => c.map((v) => v.toFixed(3)).join(" ");
  let out = "";
  for (const o of ops) {
    if (o.k === "rect") out += `${col(o.color)} rg ${o.x.toFixed(1)} ${(H - o.y - o.h).toFixed(1)} ${o.w.toFixed(1)} ${o.h.toFixed(1)} re f\n`;
    else if (o.k === "line") out += `${col(o.color ?? [0.8, 0.82, 0.8])} RG ${(o.width ?? 0.5).toFixed(2)} w ${o.dash ? "[2 2] 0 d" : "[] 0 d"} ${o.x1.toFixed(1)} ${(H - o.y1).toFixed(1)} m ${o.x2.toFixed(1)} ${(H - o.y2).toFixed(1)} l S\n`;
    else {
      const w = textWidth(o.s, o.size, o.bold);
      const x = o.align === "right" ? o.x - w : o.align === "center" ? o.x - w / 2 : o.x;
      out += `${col(o.color ?? ink)} rg BT /${o.bold ? "F2" : "F1"} ${o.size} Tf ${x.toFixed(1)} ${(H - o.y).toFixed(1)} Td (${pdfStr(o.s)}) Tj ET\n`;
    }
  }
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H.toFixed(0)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${out.length} >>\nstream\n${out}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

/** 483 → "Rupees Four Hundred Eighty Three only" (Indian numbering). */
export function rupeesInWords(n: number) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`);
  const three = (x: number) => (x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + two(x % 100) : ""}` : two(x));
  let r = Math.round(n);
  if (r === 0) return "Rupees Zero only";
  const parts: string[] = [];
  const cr = Math.floor(r / 1e7); r %= 1e7;
  const lk = Math.floor(r / 1e5); r %= 1e5;
  const th = Math.floor(r / 1e3); r %= 1e3;
  if (cr) parts.push(`${three(cr)} Crore`);
  if (lk) parts.push(`${two(lk)} Lakh`);
  if (th) parts.push(`${two(th)} Thousand`);
  if (r) parts.push(three(r));
  return `Rupees ${parts.join(" ")} only`;
}
