import type { Customer, Order } from "./types";

const digits = (p: string) => p.replace(/\D/g, "").slice(-10);
/** Opens WhatsApp to an Indian number, optionally with a message typed in. */
export const waLink = (phone: string, text = "") => `https://wa.me/91${digits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export type GuestSeg = "all" | "regular" | "lapsed" | "optin";
const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
export const guestMatch = (c: Customer, s: GuestSeg) =>
  s === "all" ? true : s === "regular" ? c.visits >= 3 : s === "lapsed" ? daysSince(c.lastVisit) > 30 : c.optIn === true;

/** When a bill was paid (the orders of one bill share it). */
export const paidAt = (o: Pick<Order, "paymentLog">) =>
  [...(o.paymentLog ?? [])].reverse().find((e) => /^Paid/i.test(e.text))?.at ?? o.paymentLog?.[o.paymentLog.length - 1]?.at;
/** Bills paid in the last `withinMs` that carry a guest's number: one entry per bill, with its orders. */
export function recentBills(orders: Order[], now: number, withinMs = 15 * 60_000): Map<string, string[]> {
  const bills = new Map<string, string[]>();
  for (const o of orders) {
    if (o.status !== "paid" || !o.guestPhone) continue;
    const at = paidAt(o);
    if (!at || now - new Date(at).getTime() > withinMs) continue;
    const k = `${digits(o.guestPhone)}|${at}`;
    bills.set(k, [...(bills.get(k) ?? []), o.id]);
  }
  return bills;
}
