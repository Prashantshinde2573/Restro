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
}

export type BusinessType = "restaurant" | "cafe";

// One outlet (branch). Each outlet is a restaurant or a café, has its own
// UPI ID for payment QRs, and its own staff.
export interface Outlet {
  id: string;
  name: string; // "Baner, Pune"
  address: string;
  businessType: BusinessType;
  upi: string;
  payFirst: boolean;
  phone?: string;
  gstin?: string;
  fssai?: string;
  hours?: string; // "11:00 am – 11:30 pm"
  billFooter?: string; // message at the bottom of the bill
  acceptCard?: boolean; // card machine at the counter
  sort?: number;
}

// The client's account: brand name, plan and when the plan has to be renewed.
export interface Account {
  name: string;
  owner: string;
  plan: "starter" | "growth" | "pro" | "chain";
  renewsAt: string; // ISO
  status?: "active" | "suspended"; // set by the super admin
}

// What the guest page needs: the brand name + the current outlet's settings.
export interface OutletSettings {
  name: string;
  businessType: BusinessType;
  upi: string; // UPI ID every payment QR is generated for
  payFirst: boolean; // guests pay before the order goes to the kitchen (typical for cafés)
  address?: string;
  phone?: string;
  gstin?: string;
  fssai?: string;
  hours?: string;
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
  photos?: string[]; // uploaded photo URLs (Cloud Storage later)
  photoCount?: number; // sample-data stand-in for photos
  hue: number; // placeholder art colour until photos come from Storage
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
  payment?: "upi" | "cash" | "card" | "split";
  payments?: Payment[]; // how the bill was actually settled (can be mixed)
  paymentLog?: PaymentLogEntry[]; // every later change, for the owner
  payPreference?: PayMethod; // what the guest chose when asking for the bill
  guestPhone?: string; // OTP-verified number of the guest who ordered (QR)
  guestUid?: string; // Supabase user id of the guest's phone (cloud mode)
  prepaid?: Payment[]; // part the guest already paid from their phone (e.g. UPI half of "Cash + UPI")
  priority?: boolean;
  outletId?: string; // which outlet took the order
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  par: number;
  costPerUnit: number;
  supplier: string;
  forecastTomorrow: number;
  expiresInDays?: number;
}

/** A raw material the kitchen keeps (paneer, oil, milk…). */
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

export interface Customer {
  id: string;
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
  bills?: { orderNo: number; at: string; amount: number; method: string }[];
}

export interface StaffMember {
  id: string;
  name: string;
  role: "Owner" | "Manager" | "Captain" | "Cashier" | "Chef" | "Helper";
  onShift: boolean;
  clockedIn?: string;
  hoursThisWeek: number;
  salesToday: number;
  rating: number;
  hue: number;
}

export interface Feedback {
  id: string;
  customer: string;
  stars: number;
  text: string;
  at: string;
  routed: "google" | "private";
  replied?: boolean;
}

export type AlertSeverity = "high" | "medium" | "low";

export interface LeakAlert {
  id: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
  at: string;
  who?: string;
  amount?: number;
  kind: "void" | "discount" | "cash" | "stock" | "refund";
}

export interface Campaign {
  id: string;
  name: string;
  channel: "WhatsApp" | "SMS" | "Email";
  audience: string;
  status: "draft" | "scheduled" | "sent";
  sent?: number;
  visits?: number;
  revenue?: number;
  when: string;
}

export interface Tenant {
  id: string;
  name: string;
  city: string;
  plan: "Starter" | "Growth" | "Pro" | "Chain";
  outlets: number;
  status: "active" | "trial" | "past-due" | "cancelled";
  mrr: number;
  since: string;
  ordersToday: number;
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
