// Search pages: one page per thing restaurant owners search for ("restaurant billing software",
// "QR code ordering", "KOT app"…). Short words on screen, pictures do the talking.
// The FAQ text is also what Google reads (FAQ structured data), so it stays true to the product.

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

const pricingLine = "Plans start at ₹699 a month (Starter), with Growth at ₹1,999 and Pro at ₹2,999 for up to 3 outlets — one price per restaurant, unlimited bills.";

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "restaurant-billing-software",
    label: "Restaurant billing software",
    title: "Restaurant billing software with GST & UPI QR",
    description: "Restropi is restaurant billing software for India: GST bills, a UPI QR with the exact amount, split and mixed payments, discounts and coupons, on the phone, tablet or laptop you already have.",
    eyebrow: "Billing",
    h1: "Restaurant billing with *GST* and *UPI QR*",
    sub: "A GST bill in seconds. Guests scan, pay the exact amount, money goes to your bank.",
    chips: ["GST ready", "UPI to your bank", "No new hardware"],
    art: "billing",
    bentoTitle: "Every bill, *sorted.*",
    bento: [
      { t: "GST bill in one tap", d: "Your GSTIN and rate on every bill.", viz: "gst" },
      { t: "Exact-amount QR", d: "No typing, no wrong amount.", viz: "upi" },
      { t: "Split & mix", d: "UPI, cash, card — on one bill.", viz: "split" },
      { t: "Offers built in", d: "Discounts, coupons, stamp cards.", viz: "discount" },
      { t: "Bills that tally", d: "Today’s sales and GST when you close.", viz: "reports" },
    ],
    steps: ["Add the dishes", "Show the UPI QR", "Bill closes itself"],
    faqs: [
      { q: "Is Restropi GST billing software?", a: "Yes. Restropi adds GST to bills at your rate, prints your GSTIN and shows the tax on every bill and in reports." },
      { q: "Do guests pay by UPI?", a: "Yes. Each bill shows a UPI QR with the exact amount. You can also take cash or card, or a mix of them, on the same bill." },
      { q: "Can I print bills?", a: "Yes. Print from the browser to the printer you already have, or send the bill to the guest on WhatsApp." },
      { q: "What does it cost?", a: pricingLine },
    ],
  },
  {
    slug: "qr-code-ordering",
    label: "QR code ordering",
    title: "QR code menu & table ordering for restaurants",
    description: "Guests scan the table QR, see your menu with photos, order to the kitchen and pay by UPI from their phone. Restropi QR ordering for restaurants and cafés in India, in English, Marathi and Hindi.",
    eyebrow: "QR ordering",
    h1: "Scan, order, pay. *From the table.*",
    sub: "Every table gets a QR. Guests order from their phone, straight to your kitchen.",
    chips: ["No app to install", "मराठी · हिंदी · English", "Pay by UPI"],
    art: "qr",
    bentoTitle: "A menu guests *enjoy.*",
    bento: [
      { t: "Photo menu", d: "Search, veg / non-veg, add-ons.", viz: "menu" },
      { t: "QR on every table", d: "Print and stick. Done.", viz: "qrtent" },
      { t: "Whole table orders", d: "Many phones, one bill.", viz: "multi" },
      { t: "You stay in control", d: "Accept QR orders first, if you like.", viz: "accept" },
      { t: "Their language", d: "English, मराठी or हिंदी — guest picks.", viz: "lang" },
    ],
    steps: ["Guest scans the QR", "Order reaches the kitchen", "Pays from the phone"],
    faqs: [
      { q: "Do guests need to install an app?", a: "No. They scan the table QR with the phone camera and the menu opens in the browser." },
      { q: "Can several people at one table order?", a: "Yes. Everyone at the table can order from their own phone, and it all goes on one bill." },
      { q: "Can I print the table QR codes?", a: "Yes. Restropi makes a printable QR for every table and for the counter." },
    ],
  },
  {
    slug: "kot-software",
    label: "KOT software",
    title: "KOT software · kitchen order tickets on a phone or tablet",
    description: "Restropi KOT software sends every order to a kitchen screen on any phone or tablet: new, cooking and ready columns, stations (tandoor, bar, desserts), timers and orders read out aloud.",
    eyebrow: "Kitchen",
    h1: "KOT on a screen. *No more paper.*",
    sub: "Captain, counter and QR orders land on one kitchen screen. Tap ready, everyone knows.",
    chips: ["Any phone or tablet", "Read out aloud", "Stations"],
    art: "kot",
    bentoTitle: "A calmer *kitchen.*",
    bento: [
      { t: "New → Cooking → Ready", d: "One tap moves the order.", viz: "columns" },
      { t: "Stations", d: "Tandoor, bar, desserts — each their own.", viz: "stations" },
      { t: "Read out aloud", d: "English, हिंदी or मराठी.", viz: "voice" },
      { t: "Nothing waits", d: "A timer on every ticket.", viz: "timer" },
      { t: "Any screen works", d: "Old phone, tablet or laptop.", viz: "anyscreen" },
    ],
    steps: ["Order is placed", "Kitchen cooks", "Ready — captain is told"],
    faqs: [
      { q: "What is a KOT?", a: "A kitchen order ticket: the list of dishes the kitchen has to make for an order. Restropi shows it on a screen instead of paper." },
      { q: "Do I need a special kitchen display?", a: "No. Any phone, tablet or laptop with a browser works." },
      { q: "Can the kitchen see orders from the QR menu?", a: "Yes. Table QR, counter QR, captain and counter orders all reach the same kitchen screen." },
    ],
  },
  {
    slug: "cafe-billing-software",
    label: "Café billing app",
    title: "Café billing & POS app with tokens and counter QR",
    description: "A simple café billing and POS app: counter orders with tokens, self-service counter QR, “order ready” alerts, UPI QR payments, stamp cards for regulars and daily reports. Restropi for cafés in India.",
    eyebrow: "Cafés",
    h1: "A quick counter for your *café.*",
    sub: "Order, token, ready alert. Regulars collect stamps for a free coffee.",
    chips: ["Tokens", "Self-service QR", "Stamp cards"],
    art: "cafe",
    bentoTitle: "Fast at the *counter.*",
    bento: [
      { t: "Order ready alert", d: "On the guest’s phone, in their language.", viz: "ready" },
      { t: "Tokens", d: "Every order gets a number.", viz: "token" },
      { t: "Pay first — or later", d: "Your choice, per outlet.", viz: "payfirst" },
      { t: "Stamp card", d: "Buy 6, get 1 free. No paper.", viz: "stamps" },
      { t: "Guests order themselves", d: "Counter QR — no queue.", viz: "qrtent" },
    ],
    steps: ["Order at the counter", "Token on the phone", "Collect when ready"],
    faqs: [
      { q: "Is it good for small cafés?", a: "Yes. It runs on one phone or tablet. " + pricingLine },
      { q: "Can guests order without staff?", a: "Yes, with the self-service counter QR. They order, pay (if you choose) and collect when it's ready." },
      { q: "Does it work for bakeries and cloud kitchens?", a: "Yes. Counter, takeaway and delivery orders are all supported." },
    ],
  },
  {
    slug: "restaurant-inventory-software",
    label: "Restaurant inventory software",
    title: "Restaurant inventory software with recipe costing & forecast",
    description: "Restropi tracks restaurant stock automatically: each dish's recipe comes off stock when a bill is paid, counts learn real use, and a forecast tells you tomorrow's need and what to buy.",
    eyebrow: "Stock",
    h1: "Stock that *counts itself.*",
    sub: "Every paid plate takes its recipe off stock. Restropi tells you what to buy tomorrow.",
    chips: ["Recipe based", "Learns real use", "Buy list on WhatsApp"],
    art: "stock",
    bentoTitle: "Never run out of *paneer.*",
    bento: [
      { t: "Recipe per plate", d: "Sell a dish, stock goes down.", viz: "recipe" },
      { t: "Learns the real use", d: "Count once, numbers get truer.", viz: "count" },
      { t: "Tomorrow’s need", d: "And how many days it lasts.", viz: "forecast" },
      { t: "Buy list", d: "By supplier, on WhatsApp.", viz: "buylist" },
      { t: "Cost of every plate", d: "From your own stock prices.", viz: "reports" },
    ],
    steps: ["Add a recipe once", "Bills update stock", "Buy what’s needed"],
    faqs: [
      { q: "Do I have to enter every use by hand?", a: "No. Once a dish has its recipe, every paid plate updates stock by itself. You only add deliveries and do a count now and then." },
      { q: "What if the kitchen uses more than the recipe?", a: "Do a stock count. Restropi learns the difference and the forecast follows the real use." },
      { q: "Does it cost a dish?", a: "Yes. The recipe gives the cost of one plate from your stock prices, used for margins in reports." },
    ],
  },
  {
    slug: "restaurant-pos-pune",
    label: "Restaurant POS in Pune",
    title: "Restaurant POS software in Pune, Satara & Kolhapur",
    description: "Restropi is a Pune-made restaurant POS and billing app with Marathi, Hindi and English, on-site setup help in Pune, Satara and Kolhapur, and WhatsApp support.",
    eyebrow: "Pune · Satara · Kolhapur",
    h1: "Restaurant POS, *made in Pune.*",
    sub: "Set up with you the same day. Support on WhatsApp, in your language.",
    chips: ["Same-day setup", "मराठी · हिंदी · English", "WhatsApp support"],
    art: "pune",
    bentoTitle: "Local, and *close by.*",
    bento: [
      { t: "We come to you", d: "Pune, Satara and Kolhapur.", viz: "map" },
      { t: "Your language", d: "Staff and guests choose.", viz: "lang" },
      { t: "Live the same day", d: "Menu, tables, staff — done with you.", viz: "setup" },
      { t: "Help on WhatsApp", d: "Real people, quick replies.", viz: "support" },
      { t: "Everything in one app", d: "Billing, kitchen, tables, stock, staff.", viz: "allinone" },
    ],
    steps: ["Book a demo", "We set it up", "Start billing today"],
    faqs: [
      { q: "Where is Restropi based?", a: "In Pune, Maharashtra. We work with restaurants across India and visit in Pune, Satara and Kolhapur." },
      { q: "Can my staff use it in Marathi?", a: "Yes. The app works in Marathi, Hindi and English." },
      { q: "What does it cost?", a: pricingLine },
    ],
  },
];

export const ABOUT = {
  title: "About us · restaurant software from Pune",
  description: "Restropi is restaurant and café management software from Pune, Maharashtra: billing, KOT, QR ordering, stock, staff and guests in one app, in English, Marathi and Hindi.",
};

export const seoPage = (slug: string) => SEO_PAGES.find((p) => p.slug === slug);
