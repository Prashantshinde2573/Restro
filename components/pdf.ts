// A tiny PDF writer for bills: one narrow page (80 mm receipt width), Courier,
// plain text. No library needed. Only Latin-1 text is printable, so ₹ → "Rs"
// and other symbols are simplified.
const W = 227; // 80 mm in points
const LH = 12;
const MARGIN = 14;

const clean = (s: string) =>
  s
    .replace(/₹\s?/g, "Rs ")
    .replace(/×/g, "x")
    .replace(/[—–]/g, "-")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E]/g, "") // drop emoji and other scripts
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

/** Wrap to the receipt width (Courier 9 pt ≈ 5.4 pt per character). */
function wrap(line: string, max: number) {
  if (line.length <= max) return [line];
  const out: string[] = [];
  let cur = "";
  for (const w of line.split(" ")) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) out.push(cur);
      cur = w.length > max ? w.slice(0, max) : w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

export type PdfLine = { text: string; bold?: boolean; center?: boolean; right?: string };

export function receiptPdf(lines: PdfLine[]): Blob {
  const size = 9;
  const cw = size * 0.6;
  const max = Math.floor((W - MARGIN * 2) / cw);
  const rows: { t: string; bold?: boolean; x: number }[] = [];
  for (const l of lines) {
    if (l.right !== undefined) {
      // long item names wrap; the amount sits on the first line, right-aligned
      const right = clean(l.right);
      const parts = wrap(clean(l.text), Math.max(4, max - right.length - 1));
      parts.forEach((left, k) =>
        rows.push({ t: k === 0 ? left + " ".repeat(Math.max(1, max - left.length - right.length)) + right : "  " + left, bold: l.bold, x: MARGIN }),
      );
      continue;
    }
    for (const part of wrap(clean(l.text), max)) {
      const x = l.center ? Math.max(MARGIN, (W - part.length * cw) / 2) : MARGIN;
      rows.push({ t: part, bold: l.bold, x });
    }
  }
  const H = Math.max(200, MARGIN * 2 + rows.length * LH + 8);
  let content = "";
  rows.forEach((r, i) => {
    const y = H - MARGIN - 10 - i * LH;
    content += `BT /${r.bold ? "F2" : "F1"} ${size} Tf ${r.x.toFixed(1)} ${y.toFixed(1)} Td (${r.t}) Tj ET\n`;
  });
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H.toFixed(0)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
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
