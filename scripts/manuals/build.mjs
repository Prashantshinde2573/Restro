// Makes the three designed PDF manuals in public/manuals from lib/help (English, Marathi, Hindi).
//
//   node scripts/manuals/build.mjs <folder with Noto Sans Devanagari .woff2 files>
//
// Needs: esbuild and playwright (with Chromium). The fonts are the @fontsource/noto-sans-devanagari
// files "noto-sans-devanagari-{devanagari,latin}-{400,500,600,700}-normal.woff2".
// Run it again whenever lib/help/*.ts changes.
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fontDir = resolve(process.argv[2] || "fonts");

// 1. bundle the manual content + HTML template into one file we can import
const out = join(tmpdir(), "restropi-manuals.mjs");
await build({
  stdin: {
    contents: `export { MANUALS } from "./lib/help/index"; export { manualHtml } from "./lib/help/html";`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: out,
  logLevel: "warning",
});
const { MANUALS, manualHtml } = await import(pathToFileURL(out).href + "?t=" + Date.now());

// 2. fonts and logos inline, so the PDF needs nothing else
const b64 = (p) => readFileSync(p).toString("base64");
let fontCss = "";
for (const w of [400, 500, 600, 700])
  for (const [sub, range] of [
    ["latin", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+20B9, U+2122, U+2191, U+2193, U+2212, U+2215, U+2713, U+FEFF, U+FFFD"],
    ["devanagari", "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF"],
  ])
    fontCss += `@font-face{font-family:"Noto Sans Devanagari";font-weight:${w};font-style:normal;unicode-range:${range};src:url(data:font/woff2;base64,${b64(join(fontDir, `noto-sans-devanagari-${sub}-${w}-normal.woff2`))}) format("woff2");}\n`;
const logo = "data:image/png;base64," + b64(join(root, "public/brand/restropi-mark.png"));
const wordmark = "data:image/png;base64," + b64(join(root, "public/brand/restropi-logo-light.png"));
const whatsapp = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "").replace(/\D/g, "");

// 3. print each language
mkdirSync(join(root, "public/manuals"), { recursive: true });
const browser = await chromium.launch();
for (const lang of ["en", "mr", "hi"]) {
  const m = MANUALS[lang];
  const html = manualHtml(m, { fontCss, logo, wordmark, whatsapp });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const file = join(root, `public/manuals/restropi-manual-${lang}.pdf`);
  await page.pdf({
    path: file,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;padding:0 16mm;font:8px Helvetica,Arial,sans-serif;color:#8a918d;display:flex;justify-content:space-between"><span>Restropi · ${m.lang.toUpperCase()} · User manual</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  if (process.env.HTML_OUT) writeFileSync(join(process.env.HTML_OUT, `manual-${lang}.html`), html);
  await page.close();
  console.log("wrote", file);
}
await browser.close();
