// Domain types for Restro. These mirror the Firestore documents planned in
// WORKFLOW.md, so swapping the mock repository for Firebase keeps every
// screen unchanged.

export type Diet = "veg" | "nonveg" | "egg";

export interface Category {
  id: string;
  name: string;
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
  tags?: string[];
  hue: number; // placeholder art colour until photos come from Storage
}

export type TableStatus = "free" | "seated" | "ordered" | "billing" | "reserved";

export interface Table {
  id: string;
  name: string;
  zone: string;
  seats: number;
  status: TableStatus;
  guests?: number;
  since?: string; // ISO
  total?: number;
  server?: string;
}

export type OrderType = "dine-in" | "takeaway" | "delivery";
export type OrderChannel = "pos" | "qr" | "whatsapp" | "swiggy" | "zomato" | "voice";
export type OrderStatus = "new" | "preparing" | "ready" | "served" | "paid" | "cancelled";

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
  customer?: string;
  lines: OrderLine[];
  status: OrderStatus;
  createdAt: string; // ISO
  staff: string;
  payment?: "upi" | "cash" | "card" | "split";
  priority?: boolean;
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
