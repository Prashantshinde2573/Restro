// "What's new": short notes on new features and changes, newest first, in English, Marathi and Hindi.
// Add an entry at the top only when the owner asks for it (a new id makes the dot show on the tab).
import type { Lang } from "./i18n";

type T = Record<Lang, string>;
export type WhatsNew = {
  id: string; // unique, newest first
  date: string; // YYYY-MM-DD
  tag: "new" | "better" | "fixed";
  title: T;
  points: Record<Lang, string[]>;
  href?: string; // the screen it is on
};

export const WHATS_NEW: WhatsNew[] = [
];

export const LATEST_WHATS_NEW = WHATS_NEW[0]?.id ?? "";
const SEEN_KEY = "restropi.whatsnew.seen";
export function whatsNewSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}
export function markWhatsNewSeen() {
  try {
    localStorage.setItem(SEEN_KEY, LATEST_WHATS_NEW);
  } catch {}
}
