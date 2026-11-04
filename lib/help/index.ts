// Help center content in three languages, plus search and "questions for this screen".
import type { Faq, HelpLang, Manual, Section } from "./types";
import { en, SUPPORT } from "./en";
import { mr } from "./mr";
import { hi } from "./hi";

export type { Block, Faq, HelpLang, Manual, Section } from "./types";
export { SUPPORT };

export const MANUALS: Record<HelpLang, Manual> = { en, mr, hi };
export const HELP_LANGS: HelpLang[] = ["en", "mr", "hi"];

/** "**bold** text" → parts, for rendering without HTML. */
export function boldParts(s: string): { text: string; bold: boolean }[] {
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) => (p.startsWith("**") && p.endsWith("**") ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false }));
}
export const plain = (s: string) => s.replace(/\*\*/g, "");

const norm = (s: string) => plain(s).toLowerCase().normalize("NFC");

function sectionText(s: Section): string {
  const out: string[] = [s.title, s.summary];
  for (const b of s.blocks) {
    if ("p" in b) out.push(b.p);
    else if ("steps" in b) out.push(...b.steps);
    else if ("list" in b) out.push(...b.list);
    else if ("tip" in b) out.push(b.tip);
    else if ("warn" in b) out.push(b.warn);
    else if ("h" in b) out.push(b.h);
    else if ("table" in b) out.push(...b.table.head, ...b.table.rows.flat());
  }
  return norm(out.join(" \n "));
}

/** Search both the questions and the manual. Every word must match (in any language's text). */
export function searchHelp(m: Manual, query: string): { faq: Faq[]; sections: Section[] } {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1 || /[^\x00-\x7F]/.test(w));
  if (!words.length) return { faq: [], sections: [] };
  // English words also find the same question in Marathi / Hindi (button names, UPI, GST, PIN…)
  const enFaq = new Map(en.faq.map((f) => [f.id, norm(f.q + " " + f.a)]));
  const enSec = new Map(en.sections.map((s) => [s.id, sectionText(s)]));
  const hit = (text: string) => words.every((w) => text.includes(w));
  const faq = m.faq
    .map((f) => {
      const own = norm(f.q + " " + f.a);
      const q = norm(f.q);
      const score = (words.every((w) => q.includes(w)) ? 3 : 0) + (hit(own) ? 2 : 0) + (hit(enFaq.get(f.id) ?? "") ? 1 : 0);
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);
  const sections = m.sections.filter((s) => hit(sectionText(s)) || hit(enSec.get(s.id) ?? ""));
  return { faq, sections };
}

/** Questions to show first on a screen, e.g. "/app/tables". */
export function faqsForPath(m: Manual, path: string): Faq[] {
  const p = path.replace(/\/$/, "") || "/app";
  const hits = m.faq.filter((f) => f.pages?.some((x) => p === x || p.startsWith(x + "/")));
  if (hits.length) return hits;
  // home and screens without their own questions: the ones people ask most
  const top = ["guest-paid-open", "staff-no-pin", "upi-qr", "notify", "paid-mistake", "print"];
  return top.map((id) => m.faq.find((f) => f.id === id)!).filter(Boolean);
}

/** Which manual section explains a screen. */
export const SECTION_FOR_PATH: Record<string, string> = {
  "/app": "reports",
  "/app/pos": "new-order",
  "/app/orders": "orders",
  "/app/tables": "tables",
  "/app/kitchen": "kitchen",
  "/app/menu": "menu",
  "/app/inventory": "stock",
  "/app/team": "team",
  "/app/access": "team",
  "/app/guests": "guests",
  "/app/campaigns": "guests",
  "/app/insights": "reports",
  "/app/reports": "reports",
  "/app/activity": "reports",
  "/app/settings": "settings",
};
export function sectionForPath(path: string): string | undefined {
  const p = path.replace(/\/$/, "") || "/app";
  if (SECTION_FOR_PATH[p]) return SECTION_FOR_PATH[p];
  const k = Object.keys(SECTION_FOR_PATH).filter((x) => x !== "/app" && p.startsWith(x + "/")).sort((a, b) => b.length - a.length)[0];
  return k ? SECTION_FOR_PATH[k] : undefined;
}
