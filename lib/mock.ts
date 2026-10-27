// Sample data for the UI prototype. Replace with Firestore reads in
// lib/repo.ts — nothing in the screens imports this file directly.
import type {
  Campaign,
  Category,
  Customer,
  Feedback,
  Ingredient,
  LeakAlert,
  MenuItem,
  Order,
  Plan,
  StaffMember,
  Table,
  Tenant,
} from "./types";

const now = Date.now();
export const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();
export const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

export const restaurant = {
  name: "Saffron Lane",
  outlet: "Baner, Pune",
  outlets: ["Baner, Pune", "Koregaon Park", "Kothrud"],
  owner: "Prashant",
  gstin: "27ABCDE1234F1Z5",
  upi: "saffronlane@okhdfc",
  plan: "Growth" as const,
};

export const categories: Category[] = [
  { id: "starters", name: "Starters" },
  { id: "mains", name: "Mains" },
  { id: "breads", name: "Breads" },
  { id: "rice", name: "Rice & Biryani" },
  { id: "desserts", name: "Desserts" },
  { id: "drinks", name: "Drinks" },
];

export const menu: MenuItem[] = [
  { id: "m1", name: "Paneer Tikka", categoryId: "starters", price: 320, cost: 96, diet: "veg", available: true, soldThisWeek: 142, prepMins: 14, station: "tandoor", tags: ["Bestseller"], hue: 28 },
  { id: "m2", name: "Chicken Malai Kebab", categoryId: "starters", price: 380, cost: 140, diet: "nonveg", available: true, soldThisWeek: 118, prepMins: 16, station: "tandoor", hue: 40 },
  { id: "m3", name: "Kothimbir Vadi", categoryId: "starters", price: 210, cost: 42, diet: "veg", available: true, soldThisWeek: 36, prepMins: 10, station: "kitchen", tags: ["Chef special"], hue: 95 },
  { id: "m4", name: "Crispy Corn", categoryId: "starters", price: 240, cost: 58, diet: "veg", available: true, soldThisWeek: 96, prepMins: 8, station: "kitchen", hue: 50 },
  { id: "m5", name: "Butter Chicken", categoryId: "mains", price: 420, cost: 150, diet: "nonveg", available: true, soldThisWeek: 204, prepMins: 18, station: "kitchen", tags: ["Bestseller"], hue: 18 },
  { id: "m6", name: "Dal Makhani", categoryId: "mains", price: 290, cost: 62, diet: "veg", available: true, soldThisWeek: 176, prepMins: 10, station: "kitchen", hue: 12 },
  { id: "m7", name: "Kolhapuri Mutton", categoryId: "mains", price: 520, cost: 245, diet: "nonveg", available: true, soldThisWeek: 41, prepMins: 22, station: "kitchen", tags: ["Spicy"], hue: 4 },
  { id: "m8", name: "Paneer Lababdar", categoryId: "mains", price: 340, cost: 118, diet: "veg", available: true, soldThisWeek: 88, prepMins: 15, station: "kitchen", hue: 32 },
  { id: "m9", name: "Malvani Fish Curry", categoryId: "mains", price: 460, cost: 210, diet: "nonveg", available: false, soldThisWeek: 22, prepMins: 20, station: "kitchen", hue: 22 },
  { id: "m10", name: "Butter Naan", categoryId: "breads", price: 70, cost: 12, diet: "veg", available: true, soldThisWeek: 410, prepMins: 4, station: "tandoor", hue: 44 },
  { id: "m11", name: "Garlic Naan", categoryId: "breads", price: 90, cost: 15, diet: "veg", available: true, soldThisWeek: 260, prepMins: 4, station: "tandoor", hue: 48 },
  { id: "m12", name: "Tandoori Roti", categoryId: "breads", price: 40, cost: 6, diet: "veg", available: true, soldThisWeek: 190, prepMins: 3, station: "tandoor", hue: 36 },
  { id: "m13", name: "Hyderabadi Dum Biryani", categoryId: "rice", price: 440, cost: 170, diet: "nonveg", available: true, soldThisWeek: 150, prepMins: 12, station: "kitchen", tags: ["Bestseller"], hue: 34 },
  { id: "m14", name: "Veg Pulao", categoryId: "rice", price: 260, cost: 70, diet: "veg", available: true, soldThisWeek: 54, prepMins: 10, station: "kitchen", hue: 60 },
  { id: "m15", name: "Jeera Rice", categoryId: "rice", price: 180, cost: 30, diet: "veg", available: true, soldThisWeek: 120, prepMins: 6, station: "kitchen", hue: 52 },
  { id: "m16", name: "Gulab Jamun", categoryId: "desserts", price: 140, cost: 30, diet: "veg", available: true, soldThisWeek: 98, prepMins: 2, station: "dessert", hue: 14 },
  { id: "m17", name: "Rasmalai", categoryId: "desserts", price: 180, cost: 64, diet: "veg", available: true, soldThisWeek: 31, prepMins: 2, station: "dessert", hue: 40 },
  { id: "m18", name: "Sitaphal Basundi", categoryId: "desserts", price: 190, cost: 52, diet: "veg", available: true, soldThisWeek: 27, prepMins: 2, station: "dessert", tags: ["Seasonal"], hue: 80 },
  { id: "m19", name: "Masala Chaas", categoryId: "drinks", price: 90, cost: 14, diet: "veg", available: true, soldThisWeek: 220, prepMins: 2, station: "bar", hue: 110 },
  { id: "m20", name: "Kokum Sharbat", categoryId: "drinks", price: 110, cost: 18, diet: "veg", available: true, soldThisWeek: 64, prepMins: 2, station: "bar", hue: 340 },
  { id: "m21", name: "Cold Coffee", categoryId: "drinks", price: 160, cost: 38, diet: "veg", available: true, soldThisWeek: 130, prepMins: 4, station: "bar", hue: 25 },
  { id: "m22", name: "Fresh Lime Soda", categoryId: "drinks", price: 100, cost: 12, diet: "veg", available: true, soldThisWeek: 175, prepMins: 2, station: "bar", hue: 90 },
];

export const tables: Table[] = [
  { id: "t1", name: "T1", zone: "Main hall", seats: 2, status: "seated", guests: 2, since: minsAgo(6), server: "Rohit" },
  { id: "t2", name: "T2", zone: "Main hall", seats: 4, status: "ordered", guests: 4, since: minsAgo(28), total: 1860, server: "Rohit" },
  { id: "t3", name: "T3", zone: "Main hall", seats: 4, status: "free" },
  { id: "t4", name: "T4", zone: "Main hall", seats: 6, status: "billing", guests: 5, since: minsAgo(64), total: 3420, server: "Sneha" },
  { id: "t5", name: "T5", zone: "Main hall", seats: 2, status: "free" },
  { id: "t6", name: "T6", zone: "Main hall", seats: 4, status: "ordered", guests: 3, since: minsAgo(17), total: 1240, server: "Sneha" },
  { id: "t7", name: "T7", zone: "Main hall", seats: 8, status: "reserved", since: minsAgo(-25) },
  { id: "t8", name: "T8", zone: "Main hall", seats: 4, status: "free" },
  { id: "t9", name: "R1", zone: "Rooftop", seats: 4, status: "ordered", guests: 4, since: minsAgo(41), total: 2280, server: "Aman" },
  { id: "t10", name: "R2", zone: "Rooftop", seats: 2, status: "free" },
  { id: "t11", name: "R3", zone: "Rooftop", seats: 6, status: "seated", guests: 6, since: minsAgo(3), server: "Aman" },
  { id: "t12", name: "R4", zone: "Rooftop", seats: 4, status: "reserved", since: minsAgo(-50) },
  { id: "t13", name: "P1", zone: "Private room", seats: 12, status: "free" },
];

const line = (id: string, qty: number, done = false, note?: string) => {
  const m = menu.find((x) => x.id === id)!;
  return { itemId: id, name: m.name, qty, price: m.price, station: m.station, done, note };
};

export const orders: Order[] = [
  { id: "o1", number: 1042, type: "dine-in", channel: "pos", tableId: "t2", tableName: "T2", lines: [line("m5", 2, true), line("m10", 4, true), line("m6", 1), line("m19", 4, true)], status: "preparing", createdAt: minsAgo(22), staff: "Rohit" },
  { id: "o2", number: 1043, type: "dine-in", channel: "qr", tableId: "t9", tableName: "R1", lines: [line("m13", 2), line("m1", 1, false, "Less spicy"), line("m22", 2)], status: "preparing", createdAt: minsAgo(14), staff: "QR", priority: true },
  { id: "o3", number: 1044, type: "takeaway", channel: "whatsapp", customer: "Neha Kulkarni", lines: [line("m8", 1), line("m11", 3), line("m15", 1)], status: "new", createdAt: minsAgo(3), staff: "WhatsApp" },
  { id: "o4", number: 1045, type: "delivery", channel: "swiggy", customer: "Swiggy #88213", lines: [line("m5", 1), line("m10", 2), line("m16", 2)], status: "new", createdAt: minsAgo(1), staff: "Swiggy" },
  { id: "o5", number: 1041, type: "dine-in", channel: "voice", tableId: "t6", tableName: "T6", lines: [line("m2", 1, true), line("m4", 1, true), line("m21", 2, true)], status: "ready", createdAt: minsAgo(17), staff: "Sneha" },
  { id: "o6", number: 1040, type: "dine-in", channel: "pos", tableId: "t4", tableName: "T4", lines: [line("m7", 2, true), line("m13", 2, true), line("m11", 4, true), line("m17", 3, true), line("m20", 5, true)], status: "served", createdAt: minsAgo(58), staff: "Sneha" },
  { id: "o7", number: 1039, type: "takeaway", channel: "pos", customer: "Walk-in", lines: [line("m3", 2, true), line("m19", 2, true)], status: "paid", createdAt: minsAgo(72), staff: "Kavya", payment: "upi" },
  { id: "o8", number: 1038, type: "delivery", channel: "zomato", customer: "Zomato #5521", lines: [line("m13", 1, true), line("m16", 1, true)], status: "paid", createdAt: minsAgo(95), staff: "Zomato", payment: "upi" },
  { id: "o9", number: 1037, type: "dine-in", channel: "qr", tableName: "T3", lines: [line("m6", 1, true), line("m12", 4, true), line("m14", 1, true)], status: "paid", createdAt: minsAgo(120), staff: "QR", payment: "split" },
  { id: "o10", number: 1036, type: "dine-in", channel: "pos", tableName: "T8", lines: [line("m1", 1, true), line("m5", 1, true), line("m10", 3, true)], status: "paid", createdAt: minsAgo(150), staff: "Rohit", payment: "card" },
];

export const ingredients: Ingredient[] = [
  { id: "i1", name: "Paneer", unit: "kg", stock: 4.2, par: 8, costPerUnit: 360, supplier: "Chitale Dairy", forecastTomorrow: 6.5, expiresInDays: 2 },
  { id: "i2", name: "Chicken (boneless)", unit: "kg", stock: 11, par: 15, costPerUnit: 280, supplier: "Venky's", forecastTomorrow: 13 },
  { id: "i3", name: "Mutton", unit: "kg", stock: 3, par: 5, costPerUnit: 720, supplier: "Pune Meat Co", forecastTomorrow: 2.4 },
  { id: "i4", name: "Basmati rice", unit: "kg", stock: 38, par: 25, costPerUnit: 110, supplier: "Metro Cash & Carry", forecastTomorrow: 9 },
  { id: "i5", name: "Maida", unit: "kg", stock: 6, par: 20, costPerUnit: 42, supplier: "Metro Cash & Carry", forecastTomorrow: 11 },
  { id: "i6", name: "Butter (Amul)", unit: "kg", stock: 5.5, par: 6, costPerUnit: 520, supplier: "Chitale Dairy", forecastTomorrow: 3.8 },
  { id: "i7", name: "Fresh cream", unit: "L", stock: 2, par: 6, costPerUnit: 240, supplier: "Chitale Dairy", forecastTomorrow: 3.2, expiresInDays: 1 },
  { id: "i8", name: "Tomatoes", unit: "kg", stock: 14, par: 12, costPerUnit: 38, supplier: "Market yard", forecastTomorrow: 10 },
  { id: "i9", name: "Onions", unit: "kg", stock: 22, par: 20, costPerUnit: 34, supplier: "Market yard", forecastTomorrow: 14 },
  { id: "i10", name: "Surmai", unit: "kg", stock: 0, par: 4, costPerUnit: 880, supplier: "Sassoon Dock", forecastTomorrow: 2 },
  { id: "i11", name: "Milk", unit: "L", stock: 18, par: 20, costPerUnit: 62, supplier: "Chitale Dairy", forecastTomorrow: 16, expiresInDays: 1 },
  { id: "i12", name: "Kokum", unit: "kg", stock: 1.6, par: 2, costPerUnit: 400, supplier: "Konkan Mart", forecastTomorrow: 0.6 },
];

export const customers: Customer[] = [
  { id: "c1", name: "Neha Kulkarni", phone: "98220 41187", visits: 34, spend: 48200, lastVisit: daysAgo(2), points: 1840, tier: "Inner circle", favourite: "Paneer Tikka", birthday: "29 Oct", mood: "happy" },
  { id: "c2", name: "Aditya Deshmukh", phone: "99700 12230", visits: 18, spend: 21650, lastVisit: daysAgo(5), points: 860, tier: "Gold", favourite: "Hyderabadi Dum Biryani", mood: "happy" },
  { id: "c3", name: "Sana Shaikh", phone: "90110 77812", visits: 9, spend: 9420, lastVisit: daysAgo(12), points: 310, tier: "Regular", favourite: "Butter Chicken", mood: "neutral" },
  { id: "c4", name: "Rahul Joshi", phone: "98605 33091", visits: 26, spend: 30180, lastVisit: daysAgo(41), points: 1205, tier: "Gold", favourite: "Kolhapuri Mutton", birthday: "2 Nov", mood: "unhappy" },
  { id: "c5", name: "Meera Iyer", phone: "97300 66120", visits: 3, spend: 2780, lastVisit: daysAgo(1), points: 90, tier: "New", favourite: "Cold Coffee", mood: "happy" },
  { id: "c6", name: "Vikram Patil", phone: "98903 55102", visits: 14, spend: 17900, lastVisit: daysAgo(33), points: 640, tier: "Regular", favourite: "Dal Makhani", mood: "neutral" },
  { id: "c7", name: "Ishita Gupta", phone: "88050 21944", visits: 7, spend: 6100, lastVisit: daysAgo(8), points: 240, tier: "Regular", favourite: "Rasmalai", mood: "happy" },
  { id: "c8", name: "Omkar Pawar", phone: "77200 98431", visits: 41, spend: 61300, lastVisit: daysAgo(0), points: 2410, tier: "Inner circle", favourite: "Chicken Malai Kebab", mood: "happy" },
];

export const staff: StaffMember[] = [
  { id: "s1", name: "Prashant", role: "Owner", onShift: true, clockedIn: minsAgo(240), hoursThisWeek: 38, salesToday: 0, rating: 5, hue: 160 },
  { id: "s2", name: "Kavya More", role: "Manager", onShift: true, clockedIn: minsAgo(300), hoursThisWeek: 44, salesToday: 6200, rating: 4.8, hue: 280 },
  { id: "s3", name: "Rohit Sawant", role: "Captain", onShift: true, clockedIn: minsAgo(280), hoursThisWeek: 41, salesToday: 14850, rating: 4.7, hue: 210 },
  { id: "s4", name: "Sneha Kale", role: "Captain", onShift: true, clockedIn: minsAgo(270), hoursThisWeek: 39, salesToday: 17320, rating: 4.9, hue: 330 },
  { id: "s5", name: "Aman Verma", role: "Captain", onShift: true, clockedIn: minsAgo(120), hoursThisWeek: 22, salesToday: 8410, rating: 4.4, hue: 30 },
  { id: "s6", name: "Chef Ganesh", role: "Chef", onShift: true, clockedIn: minsAgo(320), hoursThisWeek: 48, salesToday: 0, rating: 4.9, hue: 10 },
  { id: "s7", name: "Imran Khan", role: "Chef", onShift: false, hoursThisWeek: 36, salesToday: 0, rating: 4.6, hue: 100 },
  { id: "s8", name: "Pooja Nair", role: "Cashier", onShift: false, hoursThisWeek: 30, salesToday: 0, rating: 4.5, hue: 250 },
];

export const feedback: Feedback[] = [
  { id: "f1", customer: "Meera Iyer", stars: 5, text: "Cold coffee was perfect and the staff remembered my order!", at: minsAgo(55), routed: "google" },
  { id: "f2", customer: "Rahul Joshi", stars: 2, text: "Mutton was too salty today and we waited 35 min.", at: minsAgo(180), routed: "private" },
  { id: "f3", customer: "Omkar Pawar", stars: 5, text: "Best malai kebab in Baner. Sneha was great.", at: minsAgo(300), routed: "google", replied: true },
  { id: "f4", customer: "Sana Shaikh", stars: 4, text: "Food great, AC on rooftop could be better.", at: daysAgo(1), routed: "google" },
];

export const leakAlerts: LeakAlert[] = [
  { id: "a1", title: "3 voids after KOT on one shift", detail: "Items voided after the kitchen had already started cooking. Worth a quick word.", severity: "high", at: minsAgo(40), who: "Aman Verma", amount: 1140, kind: "void" },
  { id: "a2", title: "Cash drawer short by ₹620", detail: "Yesterday's close: counted ₹18,380 against ₹19,000 expected.", severity: "high", at: daysAgo(1), who: "Pooja Nair", amount: 620, kind: "cash" },
  { id: "a3", title: "Paneer usage 18% above recipe", detail: "Sold 142 Paneer Tikka this week — recipe needs 21.3 kg, stock used 25.1 kg.", severity: "medium", at: daysAgo(1), amount: 1368, kind: "stock" },
  { id: "a4", title: "Manual discounts up 2.4×", detail: "₹2,860 in manual discounts this week vs ₹1,190 weekly average.", severity: "medium", at: daysAgo(2), who: "Rohit Sawant", amount: 2860, kind: "discount" },
  { id: "a5", title: "Refund without manager PIN", detail: "Order #1012 refunded ₹380 using cashier login.", severity: "low", at: daysAgo(3), who: "Pooja Nair", amount: 380, kind: "refund" },
];

export const campaigns: Campaign[] = [
  { id: "cp1", name: "Diwali family thali", channel: "WhatsApp", audience: "Gold + Inner circle · 412 guests", status: "scheduled", when: "29 Oct, 11:00" },
  { id: "cp2", name: "We miss you — 15% off", channel: "WhatsApp", audience: "Not seen in 30 days · 186 guests", status: "sent", sent: 186, visits: 31, revenue: 38400, when: "18 Oct" },
  { id: "cp3", name: "Rooftop Friday", channel: "SMS", audience: "All guests · 1,920", status: "sent", sent: 1920, visits: 74, revenue: 81200, when: "11 Oct" },
  { id: "cp4", name: "Birthday dessert", channel: "WhatsApp", audience: "Automatic · birthday this week", status: "scheduled", when: "Runs daily" },
];

// Hourly covers today vs typical (for Pulse chart)
export const hourly = [
  { h: "11", today: 4, usual: 6 },
  { h: "12", today: 18, usual: 16 },
  { h: "13", today: 34, usual: 29 },
  { h: "14", today: 26, usual: 24 },
  { h: "15", today: 9, usual: 10 },
  { h: "16", today: 6, usual: 7 },
  { h: "17", today: 11, usual: 9 },
  { h: "18", today: 0, usual: 18 },
  { h: "19", today: 0, usual: 38 },
  { h: "20", today: 0, usual: 52 },
  { h: "21", today: 0, usual: 47 },
  { h: "22", today: 0, usual: 22 },
];

export const weekSales = [
  { d: "Wed", v: 58200 },
  { d: "Thu", v: 61400 },
  { d: "Fri", v: 84900 },
  { d: "Sat", v: 112300 },
  { d: "Sun", v: 104800 },
  { d: "Mon", v: 49700 },
  { d: "Tue", v: 38650 },
];

export const tenants: Tenant[] = [
  { id: "r1", name: "Saffron Lane", city: "Pune", plan: "Growth", outlets: 3, status: "active", mrr: 7497, since: "Mar 2026", ordersToday: 186 },
  { id: "r2", name: "Café Bloom", city: "Mumbai", plan: "Starter", outlets: 1, status: "active", mrr: 999, since: "Jun 2026", ordersToday: 74 },
  { id: "r3", name: "Konkan Kitchen", city: "Ratnagiri", plan: "Growth", outlets: 1, status: "trial", mrr: 0, since: "Oct 2026", ordersToday: 41 },
  { id: "r4", name: "The Brew Room", city: "Bengaluru", plan: "Pro", outlets: 2, status: "active", mrr: 9998, since: "Jan 2026", ordersToday: 233 },
  { id: "r5", name: "Biryani Badshah", city: "Hyderabad", plan: "Chain", outlets: 9, status: "active", mrr: 32000, since: "Feb 2026", ordersToday: 1204 },
  { id: "r6", name: "Misal Junction", city: "Nashik", plan: "Starter", outlets: 1, status: "past-due", mrr: 999, since: "Apr 2026", ordersToday: 58 },
  { id: "r7", name: "Green Bowl", city: "Pune", plan: "Starter", outlets: 1, status: "trial", mrr: 0, since: "Oct 2026", ordersToday: 22 },
  { id: "r8", name: "Masala Story", city: "Nagpur", plan: "Growth", outlets: 2, status: "cancelled", mrr: 0, since: "Dec 2025", ordersToday: 0 },
];

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 999,
    yearly: 9990,
    blurb: "For a café or a single small outlet.",
    outlets: "1 outlet · 3 staff logins",
    features: ["Billing with UPI QR and GST", "Menu and tables", "Kitchen display", "WhatsApp e-bills", "Daily sales report"],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 2499,
    yearly: 24990,
    blurb: "For a busy restaurant that wants fewer leaks.",
    outlets: "1 outlet · unlimited staff",
    features: ["Everything in Starter", "QR ordering with split-by-guest pay", "Inventory and recipe costing", "Restro Pulse daily briefing", "Review booster", "Staff attendance and payroll"],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 4999,
    yearly: 49990,
    blurb: "For owners who want the numbers to run themselves.",
    outlets: "Up to 3 outlets",
    features: ["Everything in Growth", "Voice ordering", "Prep forecast", "Leak guard alerts", "Menu engineering", "Swiggy and Zomato orders in one place"],
  },
  {
    id: "chain",
    name: "Chain",
    monthly: null,
    yearly: null,
    blurb: "For brands with many outlets and a central kitchen.",
    outlets: "4+ outlets",
    features: ["Everything in Pro", "Central kitchen and stock transfers", "Brand-wide menu control", "Dedicated onboarding", "Priority support on WhatsApp"],
  },
];
