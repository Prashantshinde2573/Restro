import { describe, expect, it } from "vitest";
import { ONLINE_PAY_WAIT_MS, counterPref, payingOnline, toAccept } from "@/lib/live";

const now = Date.parse("2026-11-18T10:00:00Z");
const order = (extra: Record<string, unknown> = {}) =>
  ({ status: "new", createdAt: new Date(now - 60_000).toISOString(), ...extra }) as Parameters<typeof payingOnline>[0];

describe("online payments on the restaurant's gateway", () => {
  it("a pay-first order being paid online waits; staff don't accept it", () => {
    const o = order({ payPreference: "online" });
    expect(payingOnline(o, now)).toBe(true);
    expect(toAccept({ ...o, createdAt: new Date().toISOString() })).toBe(false);
  });
  it("after the wait, an unfinished online payment is an ordinary order to accept (or cancel)", () => {
    const o = order({ payPreference: "online", createdAt: new Date(now - ONLINE_PAY_WAIT_MS - 1000).toISOString() });
    expect(payingOnline(o, now)).toBe(false);
  });
  it("once the gateway paid it, it is no longer 'paying'", () => {
    expect(payingOnline(order({ payPreference: "online", gateway: { intent: "i", provider: "razorpay", paymentId: "pay_1" } }), now)).toBe(false);
    expect(payingOnline(order({ status: "accepted", payPreference: "online" }), now)).toBe(false);
  });
  it("ordinary new orders still need accepting", () => {
    expect(toAccept(order())).toBe(true);
    expect(toAccept(order({ payPreference: "cash" }))).toBe(true);
  });
  it("the counter's checkout never pre-selects 'online'", () => {
    expect(counterPref([{ payPreference: "online" }, { payPreference: "card" }])).toBe("card");
    expect(counterPref([{ payPreference: "online" }])).toBeUndefined();
    expect(counterPref([{}, { payPreference: "upi" }])).toBe("upi");
  });
});
