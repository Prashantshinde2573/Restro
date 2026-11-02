// The printable manual as one HTML page (A4). scripts/manuals turns it into the PDFs in public/manuals.
import type { Block, Manual } from "./types";
import { SUPPORT } from "./en";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rich = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

function blocks(bs: Block[], m: Manual): string {
  return bs
    .map((b) => {
      if ("p" in b) return `<p>${rich(b.p)}</p>`;
      if ("h" in b) return `<h4>${esc(b.h)}</h4>`;
      if ("steps" in b) return `<ol class="steps">${b.steps.map((s, i) => `<li><span class="n">${i + 1}</span><span>${rich(s)}</span></li>`).join("")}</ol>`;
      if ("list" in b) return `<ul class="list">${b.list.map((s) => `<li>${rich(s)}</li>`).join("")}</ul>`;
      if ("tip" in b) return `<div class="note tip"><div class="nt">${esc(m.ui.goodToKnow)}</div>${rich(b.tip)}</div>`;
      if ("warn" in b) return `<div class="note warn"><div class="nt">${esc(m.ui.careful)}</div>${rich(b.warn)}</div>`;
      if ("table" in b) {
        const wide = b.table.head.length > 3;
        return `<table class="${wide ? "wide" : ""}"><thead><tr>${b.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.table.rows
          .map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? "first" : ""}${c === "✓" ? " yes" : c === "—" ? " no" : ""}">${rich(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`;
      }
      return "";
    })
    .join("\n");
}

export function manualHtml(m: Manual, opts: { fontCss: string; logo: string; wordmark: string; whatsapp?: string }): string {
  const areas = (Object.keys(m.areas) as (keyof Manual["areas"])[]).filter((a) => m.faq.some((f) => f.area === a));
  const half = Math.ceil(m.sections.length / 2);
  return `<!DOCTYPE html>
<html lang="${m.lang}"><head><meta charset="utf-8"><title>${esc(m.title)}</title>
<style>
${opts.fontCss}
@page { size: A4; margin: 18mm 16mm 20mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: "Noto Sans Devanagari", "Noto Sans", sans-serif; color: #1b211e; font-size: 10.4pt; line-height: 1.62; }
b { font-weight: 600; color: #0f1412; }
.cover { height: 297mm; width: 210mm; position: relative; background: #0d1512; color: #fff; padding: 26mm 22mm; overflow: hidden; page-break-after: always; }
.cover .glow { position: absolute; right: -60mm; top: -50mm; width: 170mm; height: 170mm; border-radius: 50%; background: radial-gradient(circle, rgba(31,174,132,.55), rgba(31,174,132,0) 68%); }
.cover .glow2 { position: absolute; left: -50mm; bottom: -70mm; width: 160mm; height: 160mm; border-radius: 50%; background: radial-gradient(circle, rgba(242,153,48,.28), rgba(242,153,48,0) 70%); }
.cover .brand { position: relative; display: flex; align-items: center; gap: 4mm; }
.cover .brand img.mark { width: 15mm; height: 15mm; border-radius: 4mm; background: #fff; padding: 2mm; }
.cover .brand img.word { height: 12mm; }
.cover .kicker { position: relative; margin-top: 58mm; display: inline-block; padding: 1.6mm 4mm; border-radius: 20mm; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); font-size: 10pt; font-weight: 600; letter-spacing: .02em; }
.cover h1 { position: relative; font-size: 36pt; line-height: 1.15; font-weight: 700; margin: 7mm 0 0; letter-spacing: -.01em; }
.cover .sub { position: relative; margin-top: 6mm; font-size: 13pt; line-height: 1.55; color: rgba(255,255,255,.72); max-width: 140mm; }
.cover .who { position: relative; margin-top: 16mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; max-width: 160mm; }
.cover .who div { border-radius: 4mm; padding: 4mm; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); font-size: 9.6pt; color: rgba(255,255,255,.8); }
.cover .who div b { display: block; color: #fff; font-size: 11pt; margin-bottom: 1mm; }
.cover .foot { position: absolute; left: 22mm; right: 22mm; bottom: 20mm; display: flex; justify-content: space-between; font-size: 9.5pt; color: rgba(255,255,255,.55); border-top: 1px solid rgba(255,255,255,.14); padding-top: 5mm; }
h2.toc-h { font-size: 20pt; margin: 0 0 6mm; letter-spacing: -.01em; }
.toc { display: grid; grid-template-columns: 1fr 1fr; gap: 0 9mm; }
.toc a { display: block; text-decoration: none; color: inherit; padding: 3mm 0; border-bottom: 1px solid #e6e9e7; break-inside: avoid; }
.toc a .t { font-weight: 600; font-size: 10.8pt; }
.toc a .s { display: block; color: #6b736f; font-size: 9pt; line-height: 1.4; }
.quick { margin-top: 10mm; border-radius: 4mm; background: #eef7f3; border: 1px solid #cfe9df; padding: 5mm 6mm; }
.quick .qt { font-weight: 700; color: #0f8a66; margin-bottom: 1.5mm; }
section.sec { page-break-before: always; }
section.sec + section.sec.cont { page-break-before: auto; margin-top: 10mm; }
.sec-head { display: flex; align-items: flex-end; gap: 4mm; border-bottom: 2px solid #0f1412; padding-bottom: 3mm; margin-bottom: 5mm; }
.sec-head .num { font-size: 30pt; line-height: 1; font-weight: 700; color: #1fae84; }
.sec-head h2 { margin: 0; font-size: 17pt; line-height: 1.25; letter-spacing: -.01em; }
.sec-head .sum { color: #6b736f; font-size: 9.6pt; }
p { margin: 0 0 3mm; }
h4 { font-size: 11.4pt; margin: 5mm 0 2mm; color: #0f1412; break-after: avoid; }
ol.steps, ul.list { margin: 0 0 3.5mm; padding: 0; list-style: none; }
ol.steps li { display: flex; gap: 3mm; margin-bottom: 2.2mm; break-inside: avoid; }
ol.steps .n { flex: none; width: 6mm; height: 6mm; margin-top: .6mm; border-radius: 50%; background: #1fae84; color: #fff; font-weight: 700; font-size: 8.6pt; line-height: 6mm; text-align: center; font-family: "Noto Sans", "Noto Sans Devanagari", sans-serif; }
ul.list li { position: relative; padding-left: 5mm; margin-bottom: 1.8mm; break-inside: avoid; }
ul.list li::before { content: ""; position: absolute; left: .6mm; top: 2.4mm; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: #1fae84; }
.note { border-radius: 3mm; padding: 3.2mm 4mm; margin: 0 0 3.5mm; break-inside: avoid; }
.note .nt { font-size: 8.4pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: .6mm; }
.note.tip { background: #eef7f3; border-left: 1.2mm solid #1fae84; }
.note.tip .nt { color: #0f8a66; }
.note.warn { background: #fdf3e6; border-left: 1.2mm solid #e48a1c; }
.note.warn .nt { color: #b5650a; }
table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 9.2pt; line-height: 1.4; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #0f1412; color: #fff; text-align: left; font-weight: 600; padding: 2mm 2.4mm; }
td { border-bottom: 1px solid #e6e9e7; padding: 1.8mm 2.4mm; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f7f8f7; }
td.first { font-weight: 500; color: #0f1412; }
table.wide th:not(:first-child), table.wide td:not(.first) { text-align: center; }
table.wide th:first-child { width: 40%; }
td.yes { color: #1fae84; font-weight: 700; }
td.no { color: #b5bbb8; }
.faq-area { margin: 6mm 0 2mm; font-size: 12pt; font-weight: 700; color: #0f8a66; break-after: avoid; }
.faq { break-inside: avoid; border: 1px solid #e6e9e7; border-radius: 3mm; padding: 3mm 4mm; margin-bottom: 2.6mm; }
.faq .q { font-weight: 600; color: #0f1412; margin-bottom: 1mm; }
.faq .a { color: #3a423e; }
.contact { margin-top: 8mm; border-radius: 4mm; background: #0d1512; color: #fff; padding: 7mm; break-inside: avoid; }
.contact .ct { font-size: 15pt; font-weight: 700; }
.contact p { color: rgba(255,255,255,.72); margin: 1.5mm 0 4mm; }
.contact .row { display: flex; gap: 8mm; font-weight: 600; }
.contact .row span { color: rgba(255,255,255,.55); font-weight: 400; display: block; font-size: 8.6pt; }
</style></head><body>
<div class="cover">
  <div class="glow"></div><div class="glow2"></div>
  <div class="brand"><img class="word" src="${opts.wordmark}" alt="Restropi"></div>
  <div class="kicker">${esc(m.ui.manual)} · ${esc(m.langName)}</div>
  <h1>${esc(m.title)}</h1>
  <div class="sub">${esc(m.subtitle)}</div>
  <div class="who">
    ${m.sections[0].blocks
      .flatMap((b) => ("list" in b ? b.list : []))
      .slice(0, 3)
      .map((s) => {
        const mm = s.match(/^\*\*([^*]+)\*\*\s*(?:\([^)]*\)\s*)?—\s*(.*)$/);
        return mm ? `<div><b>${esc(mm[1])}</b>${esc(mm[2].split(/[.।]/)[0])}</div>` : "";
      })
      .join("")}
  </div>
  <div class="foot"><span>restropi.com · ${esc(SUPPORT.email)}</span><span>${esc(m.updated)}</span></div>
</div>

<section>
  <h2 class="toc-h">${esc(m.ui.contents)}</h2>
  <div class="toc">
    ${[...m.sections.slice(0, half), ...m.sections.slice(half)].map((s) => `<a href="#${s.id}"><span class="t">${esc(s.title)}</span><span class="s">${esc(s.summary)}</span></a>`).join("")}
    <a href="#faq"><span class="t">${m.sections.length + 1}. ${esc(m.ui.commonProblems)}</span><span class="s">${m.faq.length} · ${esc(areas.map((a) => m.areas[a]).slice(0, 5).join(", "))}…</span></a>
  </div>
  <div class="quick"><div class="qt">${esc(m.ui.goodToKnow)}</div>${rich(m.sections[0].blocks.find((b) => "tip" in b && b) ? (m.sections[0].blocks.find((b) => "tip" in b) as { tip: string }).tip : "")}</div>
</section>

${m.sections
  .map((s) => {
    const mm = s.title.match(/^(\d+)\.\s*(.*)$/);
    return `<section class="sec" id="${s.id}">
  <div class="sec-head"><div class="num">${mm ? mm[1].padStart(2, "0") : ""}</div><div><h2>${esc(mm ? mm[2] : s.title)}</h2><div class="sum">${esc(s.summary)}</div></div></div>
  ${blocks(s.blocks, m)}
</section>`;
  })
  .join("\n")}

<section class="sec" id="faq">
  <div class="sec-head"><div class="num">${String(m.sections.length + 1).padStart(2, "0")}</div><div><h2>${esc(m.ui.commonProblems)}</h2><div class="sum">${esc(m.ui.searchPlaceholder.replace(/^[^:：]*[:：]\s*/, ""))}</div></div></div>
  ${areas
    .map(
      (a) => `<div class="faq-area">${esc(m.areas[a])}</div>
  ${m.faq
    .filter((f) => f.area === a)
    .map((f) => `<div class="faq"><div class="q">${esc(f.q)}</div><div class="a">${rich(f.a)}</div></div>`)
    .join("")}`,
    )
    .join("\n")}
  <div class="contact">
    <div class="ct">${esc(m.ui.contact)}</div>
    <p>${esc(m.ui.contactBody)}</p>
    <div class="row">
      <div><span>${esc(m.ui.email)}</span>${esc(SUPPORT.email)}</div>
      ${opts.whatsapp ? `<div><span>${esc(m.ui.whatsapp)}</span>+${esc(opts.whatsapp)}</div>` : ""}
    </div>
  </div>
</section>
</body></html>`;
}
