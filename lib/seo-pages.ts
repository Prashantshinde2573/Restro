// The About page's content shape (hero, bento cards, steps, FAQ). Short words on screen,
// pictures do the talking. The FAQ text is also what Google reads (FAQ structured data).

/** Little pictures drawn in code (components/site/seo-viz.tsx). */
export type Viz =
  | "gst" | "upi" | "discount" | "split" | "reports" | "print"
  | "qrtent" | "multi" | "menu" | "accept" | "lang" | "payfirst"
  | "columns" | "stations" | "voice" | "timer" | "anyscreen"
  | "token" | "ready" | "stamps"
  | "recipe" | "count" | "forecast" | "buylist"
  | "map" | "setup" | "allinone" | "support";

export type HeroArt = "billing" | "qr" | "kot" | "cafe" | "stock" | "pune";

export interface SeoPage {
  slug: string;
  /** <title> (the site adds " · Restropi") */
  title: string;
  description: string;
  /** footer / related link text */
  label: string;
  eyebrow: string;
  /** big hero line; *word* is coloured */
  h1: string;
  sub: string;
  chips: [string, string, string];
  art: HeroArt;
  bentoTitle: string;
  /** 5 cards: big, small, small, small, wide */
  bento: { t: string; d: string; viz: Viz }[];
  steps: [string, string, string];
  faqs: { q: string; a: string }[];
}

export const ABOUT = {
  title: "About us · restaurant software from Pune",
  description: "Restropi is restaurant and café management software from Pune, Maharashtra: billing, KOT, QR ordering, stock, staff and guests in one app, in English, Marathi and Hindi.",
};

