import type { Lang } from "@/lib/i18n";

/** Read kitchen tickets aloud in the app's language (English, हिंदी or मराठी). */

const BCP: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

let voices: SpeechSynthesisVoice[] = [];
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const load = () => (voices = window.speechSynthesis.getVoices());
  load();
  window.speechSynthesis.addEventListener?.("voiceschanged", load);
}

// the clearer voices first: the natural / neural / Google ones sound far better than the old robotic ones
const quality = (v: SpeechSynthesisVoice) => (/natural|neural|online|premium|enhanced|google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
const find = (tag: string) => {
  const t = tag.toLowerCase();
  const base = t.split("-")[0];
  const exact = voices.filter((v) => v.lang.toLowerCase().replace("_", "-") === t).sort((a, b) => quality(b) - quality(a));
  if (exact.length) return exact[0];
  return voices.filter((v) => v.lang.toLowerCase().startsWith(base)).sort((a, b) => quality(b) - quality(a))[0];
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

/**
 * Say it, clearly and in full: a little slower, one sentence at a time (some browsers cut a long
 * text off half way), after a short pause so it doesn't talk over the order chime.
 */
export function speak(text: string, lang: Lang, rate = 0.9, delayMs = 0) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!voices.length) voices = window.speechSynthesis.getVoices();
  const { voice, tag } = voiceFor(lang);
  const parts = (text.match(/[^.:।!?]+[.:।!?]*/g) ?? [text]).map((x) => x.trim()).filter(Boolean);
  const go = () => {
    const ss = window.speechSynthesis;
    if (ss.paused) ss.resume(); // Chrome sometimes leaves it paused after the tab was in the background
    for (const part of parts) {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = tag;
      if (voice) u.voice = voice;
      u.rate = rate;
      u.pitch = 1;
      u.volume = 1;
      ss.speak(u);
    }
  };
  if (delayMs > 0) window.setTimeout(go, delayMs);
  else go();
}

/** "PLAIN PIZZA" is read letter by letter by some voices: say it as "Plain pizza". */
const sayable = (name: string) => (/[a-z]/.test(name) || !/[A-Z]{2}/.test(name) ? name : name.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()));

const W = {
  en: { from: (w: string) => `New order received from ${w}`, more: (w: string) => `More items ordered from ${w}`, table: "table", parcel: "parcel token", order: "order number", on: "Orders will be read aloud" },
  hi: { from: (w: string) => `${w} से नया ऑर्डर आया है`, more: (w: string) => `${w} से और आइटम ऑर्डर हुए हैं`, table: "टेबल", parcel: "पार्सल टोकन", order: "ऑर्डर नंबर", on: "ऑर्डर बोलकर सुनाए जाएंगे" },
  mr: { from: (w: string) => `${w} वरून नवीन ऑर्डर आली आहे`, more: (w: string) => `${w} वरून आणखी पदार्थ ऑर्डर झाले आहेत`, table: "टेबल", parcel: "पार्सल टोकन", order: "ऑर्डर नंबर", on: "ऑर्डर मोठ्याने वाचून दाखवल्या जातील" },
} as const;

export const voiceOnText = (lang: Lang) => W[lang].on;

/** "New order received from table T2: 1 Plain pizza, 2 Butter naan (less spicy)." — in the app's language. */
export function ticketText(
  o: { tableName?: string; type?: string; number?: number; lines: { qty: number; name: string; note?: string; addOn?: boolean }[] },
  lang: Lang,
  addOn = false,
) {
  const w = W[lang];
  const where = o.tableName ? `${w.table} ${o.tableName}` : o.type === "takeaway" ? `${w.parcel} ${o.number || ""}`.trim() : `${w.order} ${o.number || ""}`.trim();
  const items = o.lines.map((l) => `${l.qty} ${sayable(l.name)}${l.note ? ` (${l.note})` : ""}`).join(", ");
  return `${addOn ? w.more(where) : w.from(where)}: ${items}.`;
}
