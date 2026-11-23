import { describe, expect, it } from "vitest";
import { guestCanCancel } from "@/lib/live";
import type { Order } from "@/lib/types";

const base = { id: "o", number: 1, type: "dine-in", channel: "qr", createdAt: new Date().toISOString(), staff: "Guest", lines: [{ itemId: "a", name: "A", qty: 1, price: 10 }] } as unknown as Order;
const o = (x: Partial<Order>) => ({ ...base, ...x }) as Order;

describe("guest can cancel until the kitchen starts", () => {
  it("allows new and accepted orders", () => {
    expect(guestCanCancel(o({ status: "new" }))).toBe(true);
    expect(guestCanCancel(o({ status: "accepted" }))).toBe(true);
  });
  it("blocks once cooking, ready, served, paid or cancelled", () => {
    for (const status of ["preparing", "ready", "served", "paid", "cancelled"] as const) expect(guestCanCancel(o({ status }))).toBe(false);
  });
  it("blocks when a dish is ticked done", () => {
    expect(guestCanCancel(o({ status: "accepted", lines: [{ ...base.lines[0], done: true }] }))).toBe(false);
  });
  it("blocks when any payment has started", () => {
    expect(guestCanCancel(o({ status: "new", payPreference: "upi" }))).toBe(false);
    expect(guestCanCancel(o({ status: "new", prepaid: [{ method: "upi", amount: 10 }] as Order["prepaid"] }))).toBe(false);
    expect(guestCanCancel(o({ status: "accepted", kitchenStatus: "accepted" }))).toBe(false);
    expect(guestCanCancel(o({ status: "new", payClaim: { id: "c" } as Order["payClaim"] }))).toBe(false);
  });
});
