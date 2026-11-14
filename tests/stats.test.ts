import { beforeEach, describe, expect, it } from "vitest";
import { setGstRate } from "@/lib/format";
import { between, gstIn, taxSplit, totals } from "@/lib/stats";
import type { Order } from "@/lib/types";

const order = (o: Partial<Order>): Order =>
  ({ id: Math.random().toString(36).slice(2), status: "paid", lines: [{ itemId: "a", name: "Tea", qty: 2, price: 100 }], createdAt: "2026-11-10T08:00:00.000Z", ...o }) as Order;

describe("GST and totals", () => {
  beforeEach(() => setGstRate(0.05));

  it("takes GST out of an amount that includes it", () => {
    expect(gstIn(105)).toBe(5);
    expect(gstIn(1218)).toBe(58);
  });

  it("splits a paid bill into taxable, CGST and SGST that add up", () => {
    const s = taxSplit(order({ payments: [{ method: "upi", amount: 210 }] }));
    expect(s.total).toBe(210);
    expect(s.cgst + s.sgst).toBeCloseTo(s.gst, 2);
    expect(s.taxable + s.gst).toBeCloseTo(210, 2);
  });

  it("counts only paid bills as sales, and leaves cancelled ones out", () => {
    const t = totals([
      order({ payments: [{ method: "cash", amount: 210 }] }),
      order({ status: "served" }),
      order({ status: "cancelled", payments: [{ method: "upi", amount: 999 }] }),
    ]);
    expect(t.paidOrders).toBe(1);
    expect(t.sales).toBe(210);
    expect(t.orders).toBe(2);
    expect(t.open).toBe(210); // 2 × ₹100 + 5% GST
  });

  it("uses the GST rate the restaurant set", () => {
    setGstRate(0.18);
    expect(gstIn(118)).toBe(18);
  });

  it("picks orders by the time they were made, end excluded", () => {
    const a = order({ createdAt: "2026-11-01T00:00:00.000Z" });
    const b = order({ createdAt: "2026-11-02T00:00:00.000Z" });
    const from = Date.parse("2026-11-01T00:00:00.000Z");
    const to = Date.parse("2026-11-02T00:00:00.000Z");
    expect(between([a, b], from, to)).toEqual([a]);
  });
});
