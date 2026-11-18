// Domain types for Restropi. These mirror the Firestore documents planned in
// WORKFLOW.md, so swapping the mock repository for Firebase keeps every
// screen unchanged.

export type Diet = "veg" | "nonveg" | "egg";

// Categories are created by the owner (Menu → Categories). Every category
// automatically becomes a filter and a side-bar entry on the guest menu.
export interface Category {
  id: string;
  name: string;
  icon?: string; // emoji shown in the guest side bar
  /** the outlet this category is in (missing = the first outlet, from before outlets had their own menus) */
  outletIds?: string[];
}

export type BusinessType = "restaurant" | "cafe";

// One outlet (branch). Each outlet is a restaurant or a café, has its own
// UPI ID for payment QRs, and its own staff.
export interface Outlet {
  id: string;
  name: string; // "Baner, Pune"
  address: string;
  businessType: BusinessType;
  /** Runs both ways: a café that also serves at tables, or a restaurant that also takes counter orders with a token. */
  mixed?: boolean;
  upi: string;
  payFirst: boolean;
  phone?: string;
  gstin?: string;
  fssai?: string;
  hours?: string; // "11:00 am – 11:30 pm" (text printed on bills)
  /** QR ordering window, "HH:MM" 24h. Both empty = guests can order any time. Close before open = past midnight. */
  orderFrom?: string;
  orderTo?: string;
  /** Owner paused QR orders by hand (busy, closed for the day). */
  ordersPaused?: boolean;
  /** self-service counter: token on the guest's phone, "ready" alert, Now serving screen, Picked up */
  selfService?: boolean;
  /** GST on bills: 0.05 (default), 0 when not registered, 0.12 or 0.18. */
  gstRate?: number;
  billFooter?: string; // message at the bottom of the bill
  acceptCard?: boolean; // card machine at the counter
  stamps?: StampProgram; // stamp card (loyalty), set by the owner
  sort?: number;
  /** Old (before every outlet had its own menu); no longer used. */
  ownMenu?: boolean;
}

// The client's account: brand name, plan and when the plan has to be renewed.
export interface Account {
  name: string;
  owner: string;
  plan: "starter" | "growth" | "pro" | "chain";
  renewsAt: string; // ISO
  status?: "active" | "suspended"; // set by the super admin
  /** after the plan ended, the super admin may let the store run until this date (grace period) */
  graceUntil?: string;
  /** Logo on the guest menu, next to the name (public image link). */
  logo?: string;
  /** turned on by the super admin: this client may connect their own payment gateway / WhatsApp API */
  allowGateway?: boolean;
  allowWaApi?: boolean;
}

// What the guest page needs: the brand name + the current outlet's settings.
export interface OutletSettings {
  name: string;
  logo?: string; // the brand's logo (shown on the guest menu)
  stamps?: StampProgram; // stamp card (loyalty)
  businessType: BusinessType;
  mixed?: boolean; // tables and counter both
  upi: string; // UPI ID every payment QR is generated for
  payFirst: boolean; // guests pay before the order goes to the kitchen (typical for cafés)
  address?: string;
  phone?: string;
  gstin?: string;
  fssai?: string;
  hours?: string;
  orderFrom?: string;
  orderTo?: string;
  ordersPaused?: boolean;
  /** self-service counter: token on the guest's phone, "ready" alert, Now serving screen, Picked up */
  selfService?: boolean;
  gstRate?: number;
  billFooter?: string; // printed at the bottom of the bill
  acceptCard?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  price: number; // ₹, tax-exclusive
  cost: number; // recipe cost ₹
  diet: Diet;
  available: boolean;
  soldThisWeek: number;
  prepMins: number;
  station: "kitchen" | "tandoor" | "bar" | "dessert";
  tags?: string[]; // "Bestseller", "Chef special", "Seasonal"…
  isNew?: boolean;
  spice?: 0 | 1 | 2 | 3; // 0 = not spicy
  sweet?: boolean; // shows under the guest "Sweet" filter
  desc?: string;
  options?: OptionGroup[]; // customisations: spice level, add-ons…
  /** sizes with their own price (Pizza M ₹250 / L ₹350). With sizes, `price` is the smallest. */
  sizes?: Size[];
  photos?: string[]; // uploaded photo URLs (Cloud Storage later)
  photoCount?: number; // sample-data stand-in for photos
  hue: number; // placeholder art colour until photos come from Storage
  /** The outlet this dish is in: each outlet has its own menu (missing = the first outlet, from before). */
  outletIds?: string[];
  /** Old: a shared dish sold out only in these outlets (no longer written). */
  offIn?: string[];
}

export interface Size {
  id: string;
  name: string; // "M", "Large", "Half"
  price: number; // the full price for this size, before GST
}

export interface OptionChoice {
  id: string;
  name: string;
  price: number; // extra ₹, 0 for free choices
}

export interface OptionGroup {
  id: string;
  name: string;
  type: "single" | "multi"; // pick one vs pick any
  required?: boolean;
  choices: OptionChoice[];
}

export type TableStatus = "free" | "seated" | "ordered" | "billing" | "reserved";
export type PartyStatus = "seated" | "ordered" | "billing";

// One group of guests at a table. A table can hold several parties
// (strangers sharing a table); each party has its own order and bill.
export interface Party {
  id: string; // "A", "B", "C"…
  guests: number;
  since: string; // ISO
  status: PartyStatus;
  total?: number;
  server?: string;
  code: string; // 4-digit group code friends use to join this party's bill
  codeExpiresAt?: string; // ISO; codes shared from a phone expire after a few minutes
  source: "captain" | "qr"; // who opened the party
  phoneClaimed?: boolean; // a guest phone has joined this party via QR
  pendingApproval?: boolean; // opened from QR, captain has not confirmed yet
  paymentPending?: boolean; // staff or guest says it's paid; waiting for the owner's OK
}

export interface Table {
  id: string;
  name: string;
  zone: string;
  seats: number;
  outletId?: string; // which outlet the table belongs to
  parties: Party[];
  reservedAt?: string; // ISO
  // Internal id of the current sitting at this table. The printed QR never
  // changes (it only says "table T6"); this id just tells today's guests apart
  // from the people who sat here before, so an old phone isn't put back into
  // a finished group's bill.
  visitId: string;
  // Staff pushed this table up against another one for a big group: its seats count for that
  // table (the "main" one, which holds the guests and the bill) until the group leaves.
  joinedTo?: string;
}

export type OrderType = "dine-in" | "takeaway" | "delivery";
export type OrderChannel = "pos" | "qr" | "whatsapp" | "swiggy" | "zomato" | "voice";
// new = received (waiting for staff to accept) → accepted → preparing → ready → served → paid
export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "served" | "paid" | "cancelled";
export type PayMethod = "upi" | "cash" | "card";

export interface Payment {
  method: PayMethod;
  amount: number;
}

/** One discount on a bill, with its reason, so the guest, the owner, the bill and reports all say why. */
export interface BillDiscount {
  kind: "coupon" | "reward" | "staff";
  label: string; // "Coupon WELCOME26", "Stamp card · Free coffee", "Discount 10%"
  amount: number; // rupees off the items, before GST
  code?: string; // the coupon code
}

/** "It's paid" from someone who can't close bills alone: waits for the owner (or a trusted manager). */
export interface PayClaim {
  id: string; // same id on every order of the bill
  payments: Payment[];
  by: string;
  at: string; // ISO
  source: "staff" | "guest";
  discount?: number;
  coupon?: string;
  /** the guest used their full stamp card on this bill (its amount is in `discount`) */
  reward?: { name: string; amount: number };
  /** each discount with its reason (newer claims) */
  discounts?: BillDiscount[];
}

/** One line in the activity log: who did what, when. */
export interface ActivityEntry {
  id: string;
  at: string; // ISO
  by: string;
  kind: "order" | "payment" | "table" | "menu" | "stock" | "settings" | "team" | "coupon" | "guest";
  text: string;
  outletId?: string;
  source?: "team" | "guest";
}

export interface PaymentLogEntry {
  at: string; // ISO
  by: string;
  text: string;
}

export interface OrderLine {
  itemId: string;
  name: string;
  qty: number;
  price: number;
  note?: string;
  station: MenuItem["station"];
  done?: boolean;
  /** added to an order already sent (a guest's next round): which round, and when */
  round?: number;
  addOn?: boolean;
  addedAt?: string;
}

export interface Order {
  id: string;
  number: number;
  type: OrderType;
  channel: OrderChannel;
  tableId?: string;
  tableName?: string;
  partyId?: string; // which party at the table (table sharing)
  customer?: string;
  lines: OrderLine[];
  status: OrderStatus;
  createdAt: string; // ISO
  staff: string;
  /** the member who took the order (their name can change; this doesn't) */
  staffId?: string;
  payment?: "upi" | "cash" | "card" | "split";
  payments?: Payment[]; // how the bill was actually settled (can be mixed)
  paymentLog?: PaymentLogEntry[]; // every later change, for the owner
  payPreference?: PayMethod | "online"; // what the guest chose when asking for the bill ("online": paying on the restaurant's gateway)
  wantsReward?: boolean; // the guest asked to use their full stamp card on this bill
  wantsCoupon?: string; // coupon code the guest applied from their phone (cash/card: staff apply it at checkout)
  guestPhone?: string; // OTP-verified number of the guest who ordered (QR)
  guestUid?: string; // Supabase user id of the guest's phone (cloud mode)
  prepaid?: Payment[]; // part the guest already paid from their phone (e.g. UPI half of "Cash + UPI")
  payClaim?: PayClaim; // marked paid by staff or the guest, not confirmed yet
  confirmedBy?: string; // who confirmed the payment
  priority?: boolean;
  outletId?: string; // which outlet took the order
  /** the bill's discounts, with their reasons (on the first order of the bill) */
  discounts?: BillDiscount[];
  /** paid on the restaurant's own gateway (written by the server only) */
  gateway?: { intent: string; provider: "razorpay" | "cashfree"; paymentId: string };
}

/** A raw material the kitchen keeps (paneer, oil, milk…). */
/** A discount code the restaurant gives its guests (Growth plan and up). */
export interface Coupon {
  id: string;
  code: string; // UPPERCASE, 3–20 letters/digits
  kind: "percent" | "flat";
  value: number; // % or ₹
  maxOff?: number; // cap for % coupons, ₹
  minBill?: number; // bill must be at least this (before discount), ₹
  validTo?: string; // YYYY-MM-DD, last day it works
  maxUses?: number;
  uses: number;
  active: boolean;
  note?: string;
  createdAt: string;
  outletIds?: string[]; // only these outlets (empty or missing: every outlet)
  /** "invited": only the guests it was sent from Campaigns (forPhones). Missing: anyone with the code */
  audience?: "anyone" | "invited";
  /** the invited guests (10-digit numbers) */
  forPhones?: string[];
  /** guests who already used it (10-digit numbers) */
  usedBy?: string[];
  /** each guest once (default: yes) */
  oncePerGuest?: boolean;
}

export interface StockItem {
  id: string;
  name: string;
  unit: string; // kg, L, pcs…
  stock: number;
  par: number; // order more below this
  costPerUnit: number;
  supplier: string;
  outletId?: string;
  log?: StockLog[]; // newest first, last 50
}
export interface StockLog {
  at: string; // ISO
  kind: "in" | "used" | "waste" | "count";
  qty: number; // for "count": the new stock level
  by: string;
  note?: string;
}

/** Stamp card: a stamp per bill, a reward when the card is full. Set per outlet by the owner. */
export interface StampProgram {
  on: boolean;
  /** stamps to fill a card; the reward is given on the next bill */
  needed: number;
  /** what the guest gets, in words: "Free coffee" */
  reward: string;
  /** how the reward comes off the bill */
  rewardKind: "item" | "flat" | "pct";
  rewardItemId?: string; // rewardKind "item": this dish is free (up to its price)
  rewardValue?: number; // rewardKind "flat": ₹ off · "pct": % off
  rewardCap?: number; // rewardKind "pct": at most this many ₹
  /** a bill earns a stamp only if its items come to at least this (before GST) */
  minBill: number;
  /** at most this many stamps per guest per day */
  perDay: number;
  /** stamps older than this many days stop counting (0 = never) */
  expiryDays: number;
  /** who can collect: everyone with a number, or only guests who said yes to offers */
  who: "everyone" | "optin";
  /** add the stamp by itself when a bill is charged with the guest's number (or the cashier ticks it) */
  auto: boolean;
  /** who can give stamps and who can give the reward */
  givers: "charge" | "discount" | "owner";
  redeemers: "charge" | "discount" | "owner";
  /** extra rules guests see */
  terms?: string;
}
export interface Stamp {
  at: string; // ISO
  orderNo?: number;
  by?: string; // who gave it
  outletId?: string;
}

export interface Customer {
  /** "phone@outlet" (older records: the phone) */
  id: string;
  /** the outlet this guest-book record is for (missing = the first outlet) */
  outletId?: string;
  name: string;
  phone: string;
  visits: number;
  spend: number;
  lastVisit: string; // ISO
  points: number;
  tier: "New" | "Regular" | "Gold" | "Inner circle";
  favourite: string;
  birthday?: string;
  mood?: "happy" | "neutral" | "unhappy";
  verified?: boolean; // phone confirmed by OTP
  source?: "qr" | "pos" | "whatsapp";
  optIn?: boolean; // agreed to offers on WhatsApp
  bills?: { orderNo: number; at: string; amount: number; method: string; outletId?: string }[];
  /** stamp card: stamps on the current card (oldest first) and rewards given */
  stamps?: Stamp[];
  rewards?: { at: string; reward: string; amount: number; orderNo?: number; by?: string; outletId?: string }[];
}

export interface Feedback {
  id: string;
  customer: string;
  stars: number;
  text: string;
  at: string;
  routed: "google" | "private";
  replied?: boolean;
  outletId?: string; // the outlet the guest ate at
}

export interface Plan {
  id: "starter" | "growth" | "pro" | "chain";
  name: string;
  monthly: number | null;
  yearly: number | null;
  blurb: string;
  outlets: string;
  features: string[];
  highlight?: boolean;
}
