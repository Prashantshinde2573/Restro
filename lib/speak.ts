import type { Lang } from "@/lib/i18n";

/** Read kitchen tickets aloud in the app's language (English, हिंदी or मराठी). */

const BCP: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

let voices: SpeechSynthesisVoice[] = [];
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const load = () => (voices = window.speechSynthesis.getVoices());
  load();
  window.speechSynthesis.addEventListener?.("voiceschanged", load);
}

const find = (tag: string) => {
  const t = tag.toLowerCase();
  const base = t.split("-")[0];
  return voices.find((v) => v.lang.toLowerCase().replace("_", "-") === t) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
};

/** The best voice for a language. Many phones and laptops have no Marathi voice: Hindi reads Devanagari Marathi well, so fall back to it. */
function voiceFor(lang: Lang): { voice?: SpeechSynthesisVoice; tag: string } {
  if (lang === "mr") {
    const mr = find("mr-IN");
    if (mr) return { voice: mr, tag: "mr-IN" };
    const hi = find("hi-IN");
    if (hi) return { voice: hi, tag: "hi-IN" };
    return { tag: "mr-IN" };
  }
  return { voice: find(BCP[lang]), tag: BCP[lang] };
}

export function speak(text: string, lang: Lang, rate = 0.95) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const { voice, tag } = voiceFor(lang);
  u.lang = tag;
  if (voice) u.voice = voice;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

const W = {
  en: { newOrder: "New order", table: "Table", parcel: "Parcel, token", order: "Order", on: "Orders will be read aloud" },
  hi: { newOrder: "नया ऑर्डर", table: "टेबल", parcel: "पार्सल, टोकन", order: "ऑर्डर", on: "ऑर्डर बोलकर सुनाए जाएंगे" },
  mr: { newOrder: "नवीन ऑर्डर", table: "टेबल", parcel: "पार्सल, टोकन", order: "ऑर्डर", on: "ऑर्डर मोठ्याने वाचून दाखवल्या जातील" },
} as const;

export const voiceOnText = (lang: Lang) => W[lang].on;

/** "New order. Table T5. 2 Paneer Tikka. 1 Butter Naan, less spicy" — in the app's language. */
export function ticketText(
  o: { tableName?: string; type?: string; number?: number; lines: { qty: number; name: string; note?: string }[] },
  lang: Lang,
) {
  const w = W[lang];
  const where = o.tableName ? `${w.table} ${o.tableName}` : o.type === "takeaway" ? `${w.parcel} ${o.number || ""}` : `${w.order} ${o.number || ""}`;
  const items = o.lines.map((l) => `${l.qty} ${l.name}${l.note ? `, ${l.note}` : ""}`).join(". ");
  return `${w.newOrder}. ${where}. ${items}`;
}
