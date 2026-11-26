// L(): show an app text in the chosen language. Plain module (no React), so any code can use it.
import type { Lang } from "./i18n";

// The language on screen, for L() below. Set while rendering by LangProvider.
let current: Lang = "en";
export const setCurrentLang = (l: Lang) => void (current = l);
// Marathi + Hindi texts (lib/i18n-dict.ts, ~230 KB): loaded only once someone picks one of them,
// so English screens and the website never download it.
let DICT: Record<string, readonly [string, string]> | null = null;
let dictLoading: Promise<void> | null = null;
export const dictLoaded = () => !!DICT;
export const loadDict = () => (dictLoading ??= import("./i18n-dict").then((m) => void (DICT = m.DICT)));
/**
 * Show an English text in the chosen language (Marathi / Hindi), or as it is when there is no
 * translation. "{0}", "{1}" are filled with the values given: L("{0} busy", 3).
 * Data people type (dish names, staff names…) has no translation, so it stays as typed.
 */
export function L(s: string, ...args: unknown[]): string;
export function L<T>(s: T, ...args: unknown[]): T; // anything that isn't a string (a node, nothing) passes through
export function L(s: unknown, ...args: unknown[]): unknown {
  if (typeof s !== "string") return s;
  let out = s;
  if (current !== "en" && DICT) {
    const t = DICT[s];
    if (t) out = (current === "mr" ? t[0] : t[1]) || s;
    else if (!args.length) {
      // a text with a value inside: "Table T4", "Charge ₹431", "12 min ago"
      for (const [re, tpl] of PATTERNS) {
        const m = s.match(re);
        if (m) return L(tpl, ...m.slice(1));
      }
    }
    // values stay as they are (names, dishes, amounts); only the app's own place words change:
    // "Counter", "Delivery", "Takeaway", "Table T2"
    if (args.length) args = args.map((v) => (typeof v === "string" && (PLACE_WORDS.has(v) || /^Table .+/.test(v)) ? L(v) : v));
  }
  if (args.length) args.forEach((v, i) => (out = out.split(`{${i}}`).join(String(v ?? ""))));
  return out;
}
const PLACE_WORDS = new Set(["Counter", "Delivery", "Takeaway", "Guest", "Guests"]);
const PATTERNS: [RegExp, string][] = [
  [/^Table (.+) · ([A-Z]|P\d+)$/, "Table {0} · {1}"],
  [/^Table (.+)$/, "Table {0}"],
  [/^Charge (₹[\d,.]+)$/, "Charge {0}"],
  [/^Party (.+)$/, "Party {0}"],
  [/^(\d+) min ago$/, "{0} min ago"],
  [/^(\d+) h ago$/, "{0} h ago"],
  [/^(\d+) days ago$/, "{0} days ago"],
  [/^in (\d+) min$/, "in {0} min"],
];
export const currentLang = () => current;
/** Locale for day and month names on screen ("गुरुवार, 26 नोव्हेंबर"); digits stay 0-9. */
export const dateLocale = () => (current === "mr" ? "mr-IN-u-nu-latn" : current === "hi" ? "hi-IN-u-nu-latn" : "en-IN");
