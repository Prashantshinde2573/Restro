// A real Excel file (.xlsx), made in the browser with no library.
// Dates are true Excel dates (shown DD-MM-YYYY, so they sort and never turn into #####),
// numbers are numbers, the title and header rows are bold, and columns get a width that fits.
// The file is a plain ZIP (stored, not compressed) of the few XML parts Excel needs.

/** A date cell: the day of this time (local calendar date). */
export type XDate = { date: number };
export type XCell = string | number | boolean | null | undefined | XDate;
export const asDate = (t: number | Date): XDate => ({ date: typeof t === "number" ? t : t.getTime() });
const isDate = (v: unknown): v is XDate => typeof v === "object" && v !== null && "date" in v;

/** Same day as text, for CSV and screens: 18-11-2026. */
export const dayText = (t: number) => {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};
/** A cell as plain text (CSV). */
export const cellText = (v: XCell) => (isDate(v) ? dayText(v.date) : v == null ? "" : String(v));

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
/** Excel's day number of a local calendar date (1900 date system). */
const serial = (t: number) => {
  const d = new Date(t);
  return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000;
};

/**
 * Build the sheet XML. `bold` = row numbers (0-based) shown bold: rows with a single text cell
 * (titles) and the first row after a blank or title row (headers) are bold by default.
 */
export function sheetXml(rows: XCell[][], bold?: Set<number>): string {
  const boldRows = bold ?? guessBold(rows);
  const widths: number[] = [];
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          if (v === null || v === undefined || v === "") return "";
          const ref = `${colName(c)}${r + 1}`;
          const b = boldRows.has(r);
          const w = isDate(v) ? 11 : String(v).length;
          // a long title in column A doesn't make the whole column wide
          if (!(row.length === 1 && typeof v === "string")) widths[c] = Math.max(widths[c] ?? 6, Math.min(50, w + 2));
          if (isDate(v)) return `<c r="${ref}" s="${b ? 3 : 2}"><v>${serial(v.date)}</v></c>`;
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${b ? ' s="1"' : ""}><v>${v}</v></c>`;
          if (typeof v === "boolean") return `<c r="${ref}" t="b"${b ? ' s="1"' : ""}><v>${v ? 1 : 0}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${b ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w ?? 8}" customWidth="1"/>`).join("")}</cols>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}

function guessBold(rows: XCell[][]): Set<number> {
  const out = new Set<number>();
  const blank = (r?: XCell[]) => !r || r.every((v) => v === null || v === undefined || v === "");
  const title = (r?: XCell[]) => !!r && r.filter((v) => !(v === null || v === undefined || v === "")).length === 1 && typeof r[0] === "string";
  rows.forEach((r, i) => {
    if (blank(r)) return;
    if (title(r) && (i === 0 || blank(rows[i - 1]))) out.add(i);
    else if (i > 0 && (blank(rows[i - 1]) || (title(rows[i - 1]) && i - 1 !== 0)) && r.length > 1) out.add(i);
  });
  return out;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** The .xlsx file: one sheet per entry (name ≤ 31 characters). */
export function xlsxBlob(sheets: { name: string; rows: XCell[][] }[]): Blob {
  const names = sheets.map((s, i) => (s.name.replace(/[\\/?*[\]:]/g, " ").trim() || `Sheet${i + 1}`).slice(0, 31));
  const files: [string, string][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    ],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ["xl/styles.xml", STYLES],
    ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)]),
  ];
  return new Blob([zip(files) as Uint8Array<ArrayBuffer>], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ---------------- a tiny ZIP writer (stored entries) ---------------- */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function zip(files: [string, string][]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameB = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameB.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameB.length, true);
    local.set(nameB, 30);
    const cen = new Uint8Array(46 + nameB.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameB, 46);
    parts.push(local, data);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cenSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cenSize + 22);
  let p = 0;
  for (const b of [...parts, ...central, end]) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
