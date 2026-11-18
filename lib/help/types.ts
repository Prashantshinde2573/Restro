// Help center content: the user manual and common problems, in English, Marathi and Hindi.
// The in-app help chat (the "?" button and the Help center) reads this.
export type HelpLang = "en" | "mr" | "hi";

export type Block =
  | { p: string } // paragraph (**bold** allowed)
  | { steps: string[] } // numbered steps
  | { list: string[] } // bullet points
  | { tip: string } // green "good to know" box
  | { warn: string } // amber "careful" box
  | { table: { head: string[]; rows: string[][] } }
  | { h: string }; // small sub-heading

export interface Section {
  id: string;
  title: string;
  summary: string; // one line under the title in the contents
  blocks: Block[];
}

export interface Faq {
  id: string;
  q: string;
  a: string; // **bold** allowed, new lines become separate lines
  area: "start" | "orders" | "billing" | "tables" | "qr" | "kitchen" | "menu" | "stock" | "team" | "reports" | "plans" | "account";
  /** screens where this question is shown first in the help button */
  pages?: string[];
}

export interface Manual {
  lang: HelpLang;
  subtitle: string;
  ui: Record<
    | "help" | "helpCenter" | "contact" | "contactBody" | "whatsapp" | "noResults" | "goodToKnow" | "careful" | "forThisScreen"
    | "hello" | "askPlaceholder" | "send" | "topics" | "stepByStep" | "related" | "talkToUs" | "helper" | "online",
    string
  >;
  areas: Record<Faq["area"], string>;
  sections: Section[];
  faq: Faq[];
}
