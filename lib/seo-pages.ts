// Search pages: one page per thing restaurant owners search for ("restaurant billing software",
// "QR code ordering", "KOT app"…). Each has its own title, text and questions, all true to the product.
export interface SeoPage {
  slug: string;
  /** <title> (the site adds " · Restropi") */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  points: { t: string; d: string }[];
  faqs: { q: string; a: string }[];
  /** footer / related link text */
  label: string;
}

const pricingLine = "Plans start at ₹699 a month (Starter), with Growth at ₹1,999 and Pro at ₹2,999 for up to 3 outlets — one price per restaurant, unlimited bills.";

export const SEO_PAGES: SeoPage[] = [
  {
    slug: "restaurant-billing-software",
    label: "Restaurant billing software",
    title: "Restaurant billing software with GST & UPI QR",
    description: "Restropi is restaurant billing software for India: GST bills, a UPI QR with the exact amount, split and mixed payments, discounts and coupons, on the phone, tablet or laptop you already have.",
    eyebrow: "Billing",
    h1: "Restaurant billing software with GST and UPI QR",
    intro: "Restropi makes a GST bill in seconds and shows a UPI QR for the exact amount, so guests pay without typing anything and the money goes straight to your bank. It runs in the browser — no new hardware, no installation.",
    points: [
      { t: "GST bills in one tap", d: "Your GST rate, GSTIN and bill footer are printed on every bill. Print from the browser to the printer you have, or send the bill on WhatsApp." },
      { t: "UPI QR for the exact amount", d: "The QR already has the bill amount, so there is no wrong amount and no waiting. Cash, card and mixed payments work too." },
      { t: "Discounts, coupons and stamp cards", d: "Staff discounts with limits, coupon codes for guests, and a stamp card that rewards regulars — all shown on the bill and in reports." },
      { t: "Bills that tally", d: "Every payment, change and refund is logged with who did it. Daily sales, payment methods and staff sales are ready in reports." },
    ],
    faqs: [
      { q: "Is Restropi GST billing software?", a: "Yes. Restropi adds GST to bills at your rate, prints your GSTIN and shows the tax on every bill and in reports." },
      { q: "Do guests pay by UPI?", a: "Yes. Each bill shows a UPI QR with the exact amount. You can also take cash or card, or a mix of them, on the same bill." },
      { q: "What does it cost?", a: pricingLine },
    ],
  },
  {
    slug: "qr-code-ordering",
    label: "QR code ordering",
    title: "QR code menu & table ordering for restaurants",
    description: "Guests scan the table QR, see your menu with photos, order to the kitchen and pay by UPI from their phone. Restropi QR ordering for restaurants and cafés in India, in English, Marathi and Hindi.",
    eyebrow: "QR ordering",
    h1: "QR code menu and table ordering",
    intro: "Every table gets its own QR code. Guests open your menu on their phone — with photos, veg / non-veg filters and search — send the order to the kitchen, order more on the same bill, and pay by UPI when they are done.",
    points: [
      { t: "A menu guests enjoy", d: "Photos, categories, veg and non-veg, sizes and add-ons, in English, Marathi or Hindi. Sold-out dishes hide by themselves." },
      { t: "Straight to the kitchen", d: "QR orders reach the kitchen screen and can read out aloud. Captains can accept them first if you prefer." },
      { t: "Pay from the table", d: "The bill shows on the guest's phone with a UPI QR for the exact amount, or connect your own payment gateway." },
      { t: "Self-service counters too", d: "For cafés: order at the counter QR, get a token, and a “your order is ready” message on the phone." },
    ],
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
    h1: "KOT software for your kitchen",
    intro: "Orders from captains, the counter and the table QR land on one kitchen screen as clear tickets. The kitchen ticks dishes off, marks the order ready, and the captain or the guest is told at once.",
    points: [
      { t: "New → Cooking → Ready", d: "Colour-coded tickets with a timer, so the oldest order never waits. Add-ons show on the same ticket." },
      { t: "Stations", d: "Split tickets by kitchen, tandoor, bar or desserts, each on its own screen." },
      { t: "Read aloud", d: "New orders can be read out in English, Hindi or Marathi — useful in a busy kitchen." },
      { t: "No printer needed", d: "Any old phone or tablet becomes the kitchen screen. Printing a KOT still works if you want paper." },
    ],
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
    h1: "Café billing and POS app",
    intro: "Restropi keeps a busy café counter quick: take the order, give a token, send it to the barista or kitchen, and let guests collect when it's ready. Regulars collect stamps for a free coffee.",
    points: [
      { t: "Counter orders with tokens", d: "Bill at the counter or let guests order from the counter QR. Each order gets a token number." },
      { t: "“Your order is ready”", d: "The guest's phone shows a ready message (and it can go on WhatsApp). Staff tap Picked up." },
      { t: "Pay first or at the end", d: "Choose per outlet: guests pay before the kitchen starts, or after." },
      { t: "Stamp card", d: "Buy 6, get 1 free — tracked by phone number, no paper cards." },
    ],
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
    h1: "Restaurant inventory with recipes and a smart forecast",
    intro: "Link each dish to what one plate uses — paneer, butter, rice. Every paid plate takes it off stock by itself. When you count stock, Restropi learns how much the kitchen really uses and forecasts tomorrow's need.",
    points: [
      { t: "Recipe-based use", d: "Paid bills take each dish's recipe off stock, with a daily record of what was used." },
      { t: "Learns real use", d: "A stock count compares what's there with what the recipes said, and adjusts future numbers." },
      { t: "Tomorrow and how long it lasts", d: "A forecast from the same weekday, the last 7 days and tomorrow's expected plates — with “lasts N days”." },
      { t: "Buy list on WhatsApp", d: "Items running low go on a buy list by supplier, ready to send on WhatsApp." },
    ],
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
    h1: "Restaurant POS software made in Pune",
    intro: "Restropi is built in Pune, Maharashtra for restaurants, cafés and cloud kitchens across India. We set it up with you the same day — on a call, or in person in Pune, Satara and Kolhapur — and support you on WhatsApp in Marathi, Hindi and English.",
    points: [
      { t: "In Marathi, Hindi and English", d: "Staff and guests can use the app in their own language." },
      { t: "Same-day setup", d: "We add your menu (even from a photo of it), tables and staff with you." },
      { t: "Everything in one app", d: "Billing, KOT, tables and QR ordering, stock, staff attendance and salary, guests and reports." },
      { t: "Local support", d: "WhatsApp support from people who know how restaurants here work." },
    ],
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
