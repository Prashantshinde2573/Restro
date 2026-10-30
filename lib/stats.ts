// Numbers for the dashboard and reports, worked out from real orders.
import { billOf } from "./live";
import type { MenuItem, Order, PayMethod } from "./types";

const DAY = 86_400_000;

export const startOfDay = (d: Date | number = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};
export const inOutlet = (orders: Order[], outletId: string) => orders.filter((o) => !o.outletId || !outletId || o.outletId === outletId);
export const between = (orders: Order[], from: number, to: number) =>
  orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= from && t < to;
  });
export const live = (orders: Order[]) => orders.filter((o) => o.status !== "cancelled");
export const paid = (orders: Order[]) => orders.filter((o) => o.status === "paid");

export interface Totals {
  orders: number; // not cancelled
  paidOrders: number;
  sales: number; // paid bills, with GST
  avgBill: number;
  gst: number;
  open: number; // value of bills not paid yet
}
export function totals(orders: Order[]): Totals {
  const l = live(orders);
  const p = paid(l);
  const sales = p.reduce((s, o) => s + paidAmount(o), 0);
  const net = p.reduce((s, o) => s + o.lines.reduce((a, x) => a + x.qty * x.price, 0), 0);
  return {
    orders: l.length,
    paidOrders: p.length,
    sales,
    avgBill: p.length ? Math.round(sales / p.length) : 0,
    gst: Math.max(0, Math.round(sales - net)),
    open: l.filter((o) => o.status !== "paid").reduce((s, o) => s + billOf(o), 0),
  };
}
/** What was actually collected (payments if recorded, else the bill). */
export const paidAmount = (o: Order) => (o.payments?.length ? o.payments.reduce((s, p) => s + p.amount, 0) : billOf(o));

/** % change, or null when there is nothing to compare with. */
export const change = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export function byDay(orders: Order[], days: number, end = Date.now()) {
  const last = startOfDay(end);
  return Array.from({ length: days }, (_, i) => {
    const from = last - (days - 1 - i) * DAY;
    const list = paid(between(orders, from, from + DAY));
    const d = new Date(from);
    return {
      label: days <= 7 ? d.toLocaleDateString("en-IN", { weekday: "short" }) : String(d.getDate()),
      value: list.reduce((s, o) => s + paidAmount(o), 0),
    };
  });
}

export function byHour(orders: Order[], dayStart: number, compareStart?: number) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const count = (from: number, h: number) => live(between(orders, from + h * 3_600_000, from + (h + 1) * 3_600_000)).length;
  const rows = hours.map((h) => ({ h, today: count(dayStart, h), usual: compareStart !== undefined ? count(compareStart, h) : 0 }));
  // show only the part of the day with any activity (at least 10 am – 10 pm)
  const active = rows.filter((r) => r.today || r.usual).map((r) => r.h);
  const from = Math.min(10, ...active);
  const to = Math.max(22, ...active);
  return rows
    .filter((r) => r.h >= from && r.h <= to)
    .map((r) => ({ label: r.h === 0 ? "12a" : r.h < 12 ? `${r.h}a` : r.h === 12 ? "12p" : `${r.h - 12}p`, value: r.today, ghost: r.usual }));
}

export function topDishes(orders: Order[], n = 5) {
  const map = new Map<string, { name: string; qty: number; sales: number }>();
  for (const o of live(orders))
    for (const l of o.lines) {
      const cur = map.get(l.itemId) ?? { name: l.name, qty: 0, sales: 0 };
      cur.qty += l.qty;
      cur.sales += l.qty * l.price;
      map.set(l.itemId, cur);
    }
  return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.qty - a.qty).slice(0, n);
}

export function byCategory(orders: Order[], menu: MenuItem[], catName: (id: string) => string) {
  const cat = new Map(menu.map((m) => [m.id, m.categoryId]));
  const map = new Map<string, number>();
  for (const o of live(orders)) for (const l of o.lines) {
    const k = catName(cat.get(l.itemId) ?? "") || "Other";
    map.set(k, (map.get(k) ?? 0) + l.qty * l.price);
  }
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function byMethod(orders: Order[]) {
  const m: Record<PayMethod, number> = { upi: 0, cash: 0, card: 0 };
  for (const o of paid(orders)) {
    if (o.payments?.length) o.payments.forEach((p) => (m[p.method] += p.amount));
    else if (o.payment && o.payment !== "split") m[o.payment] += billOf(o);
    else m.cash += billOf(o);
  }
  return m;
}

export const CHANNEL_LABEL: Record<Order["channel"], string> = {
  pos: "Counter & captains",
  qr: "Table / counter QR",
  whatsapp: "WhatsApp",
  swiggy: "Swiggy",
  zomato: "Zomato",
  voice: "Voice",
};
export function byChannel(orders: Order[]) {
  const l = live(orders);
  const map = new Map<Order["channel"], number>();
  l.forEach((o) => map.set(o.channel, (map.get(o.channel) ?? 0) + 1));
  return [...map.entries()]
    .map(([k, v]) => ({ key: k, label: CHANNEL_LABEL[k] ?? k, count: v, pct: l.length ? Math.round((v / l.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export const DAY_MS = DAY;
