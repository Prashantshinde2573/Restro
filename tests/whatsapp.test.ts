import { describe, expect, it } from "vitest";
import { recentBills } from "@/lib/wa";
import type { Order } from "@/lib/types";

const now = Date.parse("2026-11-18T10:00:00Z");
const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const o = (id: string, x: Partial<Order>): Order =>
  ({ id, number: 1, type: "dine-in", channel: "qr", lines: [], status: "paid", createdAt: at(60), staff: "QR", guestPhone: "98765 43210", ...x }) as Order;

describe("WhatsApp e-bill: one message per bill", () => {
  it("orders paid together for one number make one bill", () => {
    const pay = [{ at: at(2), by: "Ravi", text: "Paid · UPI ₹500 (bill for 2 orders)" }];
    const b = recentBills([o("o1", { paymentLog: pay }), o("o2", { paymentLog: pay })], now);
    expect([...b.values()]).toEqual([["o1", "o2"]]);
  });
  it("online payments count too", () => {
    const b = recentBills([o("o3", { paymentLog: [{ at: at(1), by: "Online · Razorpay", text: "Paid online ₹105 · razorpay pay_1" }] })], now);
    expect(b.size).toBe(1);
  });
  it("skips old bills, unpaid orders and orders with no number", () => {
    const pay = [{ at: at(1), by: "x", text: "Paid · Cash ₹100" }];
    const b = recentBills([
      o("old", { paymentLog: [{ at: at(60), by: "x", text: "Paid · Cash ₹100" }] }),
      o("open", { status: "served", paymentLog: pay }),
      o("nophone", { guestPhone: undefined, paymentLog: pay }),
    ], now);
    expect(b.size).toBe(0);
  });
  it("a bill marked unpaid and paid again is a new bill", () => {
    const b = recentBills([o("o4", { paymentLog: [{ at: at(10), by: "x", text: "Paid · Cash ₹100" }, { at: at(8), by: "Owner", text: "Marked unpaid (was Cash ₹100)" }, { at: at(5), by: "x", text: "Paid · UPI ₹100" }] })], now);
    expect([...b.keys()][0]).toContain(at(5));
  });
});
