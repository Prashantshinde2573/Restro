import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// a pretend database and a pretend Razorpay
const db = {
  coupon: null as Record<string, unknown> | null,
  order: null as Record<string, unknown> | null,
  rpc: vi.fn(),
};
vi.mock("@/lib/server/supabase-admin", () => ({
  admin: () => ({
    from: (t: string) => {
      const q = {
        select: () => q, eq: () => q, gte: () => q, limit: () => q,
        maybeSingle: async () => ({ data: t === "plan_coupons" ? db.coupon : db.order }),
        update: () => ({ eq: async () => ({}) }),
      };
      return q;
    },
    rpc: (...a: unknown[]) => db.rpc(...a),
  }),
}));
vi.mock("@/lib/server/plans", () => ({ sendPlanUpdate: vi.fn(async () => ({ ok: true })) }));

process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
process.env.RAZORPAY_KEY_SECRET = "sec";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec";
const rz = await import("@/lib/server/razorpay");

beforeEach(() => { db.coupon = null; db.order = null; db.rpc.mockReset(); vi.unstubAllGlobals(); });

describe("plan price is worked out on the server", () => {
  it("one price per restaurant, cycles and coupons", async () => {
    expect(await rz.quote("pro", "monthly")).toMatchObject({ list: 2999, months: 1, off: 0, amount: 2999 });
    expect(await rz.quote("pro", "half")).toMatchObject({ list: 14995, months: 6, amount: 14995 });
    db.coupon = { code: "NEW26", kind: "percent", value: 10, active: true, valid_to: null, max_uses: 4, uses: 1, plans: ["pro"] };
    expect(await rz.quote("pro", "monthly", "new26")).toMatchObject({ coupon: "NEW26", off: 300, amount: 2699 });
    await expect(rz.quote("growth", "monthly", "NEW26")).rejects.toThrow(/can't be used/);
    db.coupon = { ...db.coupon, uses: 4 };
    await expect(rz.quote("pro", "monthly", "NEW26")).rejects.toThrow(/can't be used/);
    await expect(rz.quote("chain", "monthly")).rejects.toThrow(/priced by the Restropi team/);
    await expect(rz.quote("pro", "weekly")).rejects.toThrow();
  });
});

describe("a plan is renewed only when Razorpay says it was paid", () => {
  const order = { id: "11111111-2222-4333-8444-555555555555", rid: "r1", amount: 2999, status: "created", rp_order_id: "order_1" };
  const razorpay = (items: unknown[]) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items }), { status: 200 })));
  it("captured, exact amount → applied with the paid amount", async () => {
    db.order = order;
    razorpay([{ id: "pay_1", order_id: "order_1", status: "captured", amount: 299900, currency: "INR" }]);
    db.rpc.mockResolvedValue({ data: { renewsTo: "2026-12-19T00:00:00Z" }, error: null });
    const r = await rz.settlePlanOrder(order.id);
    expect(r.status).toBe("paid");
    expect(db.rpc).toHaveBeenCalledWith("svc_apply_plan_order", { p_order: order.id, p_payment: "pay_1", p_paid_paise: 299900 });
  });
  it("nothing paid yet → pending, nothing applied", async () => {
    db.order = order;
    razorpay([]);
    expect((await rz.settlePlanOrder(order.id)).status).toBe("pending");
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("all tries failed → failed, nothing applied", async () => {
    db.order = order;
    razorpay([{ id: "pay_2", status: "failed", amount: 299900, currency: "INR" }]);
    expect((await rz.settlePlanOrder(order.id)).status).toBe("failed");
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("already paid → no second renewal", async () => {
    db.order = { ...order, status: "paid", renews_to: "2026-12-19" };
    const r = await rz.settlePlanOrder(order.id);
    expect(r).toMatchObject({ status: "paid", already: true });
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("webhook signature", () => {
  it("only Razorpay's signature is accepted", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const good = createHmac("sha256", "whsec").update(body).digest("hex");
    expect(rz.webhookOk(body, good)).toBe(true);
    expect(rz.webhookOk(body, "0".repeat(64))).toBe(false);
    expect(rz.webhookOk(body + " ", good)).toBe(false);
    expect(rz.webhookOk(body, "")).toBe(false);
  });
  it("keys: test mode is detected, secret never needed in the browser", () => {
    expect(rz.planPayReady()).toBe(true);
    expect(rz.planPayTest()).toBe(true);
  });
});
