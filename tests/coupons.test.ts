import { describe, expect, it } from "vitest";
import { couponProblem, discountsFrom, billOrdersOf } from "@/lib/live";
import type { Coupon, Order } from "@/lib/types";

const base: Coupon = { id: "c", code: "WELCOME26", kind: "flat", value: 10, uses: 0, active: true, createdAt: "2026-11-18" };

describe("who may use a coupon", () => {
  it("public: anyone with the code, once each (needs the number to check)", () => {
    expect(couponProblem(base, 200, "98765 43210")).toBeNull();
    expect(couponProblem({ ...base, usedBy: ["9876543210"] }, 200, "+91 98765 43210")).toMatch(/already used/);
    expect(couponProblem(base, 200)).toMatch(/mobile number/);
  });
  it("public without 'once each': no number needed", () => {
    expect(couponProblem({ ...base, oncePerGuest: false }, 200)).toBeNull();
    expect(couponProblem({ ...base, oncePerGuest: false, usedBy: ["9876543210"] }, 200, "9876543210")).toBeNull();
  });
  it("invited: only the guests it was sent to", () => {
    const vip: Coupon = { ...base, audience: "invited", forPhones: ["9000000001"] };
    expect(couponProblem(vip, 200, "9000000001")).toBeNull();
    expect(couponProblem(vip, 200, "9000000002")).toMatch(/only for the guests/);
    expect(couponProblem({ ...vip, forPhones: [] }, 200, "9000000001")).toMatch(/only for the guests/);
  });
  it("the old rules still apply", () => {
    expect(couponProblem({ ...base, maxUses: 3, uses: 3 }, 200, "9000000001")).toMatch(/used up/);
    expect(couponProblem({ ...base, minBill: 500 }, 200, "9000000001")).toMatch(/500/);
    expect(couponProblem({ ...base, active: false }, 200, "9000000001")).toMatch(/off/);
  });
});

describe("discounts keep their reason", () => {
  it("coupon + stamp reward from an older claim", () => {
    expect(discountsFrom({ discount: 70, coupon: "WELCOME26", reward: { name: "Free coffee", amount: 60 } })).toEqual([
      { kind: "reward", label: "Stamp card · Free coffee", amount: 60 },
      { kind: "coupon", label: "Coupon WELCOME26", amount: 10, code: "WELCOME26" },
    ]);
  });
  it("a plain discount", () => {
    expect(discountsFrom({ discount: 22 })).toEqual([{ kind: "staff", label: "Discount", amount: 22 }]);
    expect(discountsFrom({})).toEqual([]);
  });
});

describe("one bill = the orders paid together", () => {
  const paid = (id: string, at: string, extra: Partial<Order> = {}) =>
    ({ id, number: 1, status: "paid", tableName: "T1", partyId: "A", lines: [], createdAt: at, staff: "x", type: "dine-in", channel: "pos", paymentLog: [{ at, by: "x", text: "Paid · UPI ₹100" }], ...extra }) as Order;
  it("finds the rounds of the same bill, not other bills", () => {
    const all = [paid("a", "2026-11-19T10:00:00Z"), paid("b", "2026-11-19T10:00:00Z"), paid("c", "2026-11-19T11:00:00Z"), paid("d", "2026-11-19T10:00:00Z", { tableName: "T2" })];
    expect(billOrdersOf(all[0], all).map((o) => o.id)).toEqual(["a", "b"]);
    expect(billOrdersOf(all[2], all).map((o) => o.id)).toEqual(["c"]);
  });
});

import { discountReport } from "@/lib/stats";
describe("discounts report", () => {
  it("adds up paid bills only, per coupon", () => {
    const mk = (id: string, status: Order["status"], discounts: Order["discounts"]) =>
      ({ id, number: 1, status, lines: [], createdAt: "2026-11-19T10:00:00Z", staff: "x", type: "dine-in", channel: "pos", discounts }) as Order;
    const r = discountReport([
      mk("a", "paid", [{ kind: "coupon", label: "Coupon WELCOME26", amount: 10, code: "WELCOME26" }, { kind: "reward", label: "Stamp card · Coffee", amount: 60 }]),
      mk("b", "paid", [{ kind: "coupon", label: "Coupon WELCOME26", amount: 15, code: "WELCOME26" }]),
      mk("c", "paid", [{ kind: "staff", label: "Discount", amount: 20 }]),
      mk("d", "cancelled", [{ kind: "staff", label: "Discount", amount: 99 }]),
      mk("e", "paid", undefined),
    ]);
    expect([r.total, r.bills, r.coupon, r.reward, r.staff]).toEqual([105, 3, 25, 60, 20]);
    expect(r.coupons).toEqual([{ code: "WELCOME26", uses: 2, amount: 25 }]);
  });
});

import { niceName } from "@/components/guest-menu";
describe("dish and category names typed in capitals read easier", () => {
  it("title case, initials kept, mixed case left alone", () => {
    expect(niceName("MILK SHAKES")).toBe("Milk Shakes");
    expect(niceName("TEA")).toBe("Tea");
    expect(niceName("DRY FRUITS")).toBe("Dry Fruits");
    expect(niceName("TRC SPECIAL TEA")).toBe("TRC Special Tea");
    expect(niceName("COOLERS / MOJITOS")).toBe("Coolers / Mojitos");
    expect(niceName("veg pizza")).toBe("veg pizza");
    expect(niceName("Paneer Tikka")).toBe("Paneer Tikka");
  });
});
