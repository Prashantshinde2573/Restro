import { describe, expect, it } from "vitest";
import { couponWorksIn, guestOutletIds, menuFor, stampProgramOf } from "@/lib/live";
import type { Customer, MenuItem, Order, Outlet } from "@/lib/types";

const dish = (id: string, extra: Partial<MenuItem> = {}): MenuItem =>
  ({ id, name: id, categoryId: "c", price: 100, cost: 0, diet: "veg", available: true, soldThisWeek: 0, prepMins: 5, station: "kitchen", hue: 0, ...extra }) as MenuItem;

describe("menu per outlet", () => {
  const all = [dish("shared"), dish("soldB", { offIn: ["b"] }), dish("ownB", { outletIds: ["b"] })];
  it("an outlet on the shared menu sees only shared dishes, sold out per outlet", () => {
    const a = menuFor(all, { id: "a" });
    expect(a.map((m) => m.id)).toEqual(["shared", "soldB"]);
    expect(a.find((m) => m.id === "soldB")?.available).toBe(true);
    const b = menuFor(all, { id: "b" });
    expect(b.find((m) => m.id === "soldB")?.available).toBe(false);
  });
  it("an outlet with its own menu sees only its own dishes", () => {
    expect(menuFor(all, { id: "b", ownMenu: true }).map((m) => m.id)).toEqual(["ownB"]);
  });
});

describe("guests per outlet", () => {
  const g = { id: "9876543210", phone: "98765 43210", name: "N", bills: [{ orderNo: 7, at: "", amount: 1, method: "upi" }] } as unknown as Customer;
  it("finds the outlets from bills (through the order number) and from orders", () => {
    const orders = [{ number: 7, outletId: "a" }, { number: 9, outletId: "b", guestPhone: "+91 98765 43210" }] as unknown as Order[];
    expect([...guestOutletIds(g, orders)].sort()).toEqual(["a", "b"]);
    expect(guestOutletIds(g, []).size).toBe(0);
  });
});

describe("coupons and stamp cards across outlets", () => {
  it("a coupon for one outlet works only there; others everywhere", () => {
    expect(couponWorksIn({ outletIds: ["a"] }, "a")).toBe(true);
    expect(couponWorksIn({ outletIds: ["a"] }, "b")).toBe(false);
    expect(couponWorksIn({}, "b")).toBe(true);
  });
  it("an outlet without its own stamp card uses the brand's card; one turned off stays off", () => {
    const on = { on: true, needed: 5 } as Outlet["stamps"];
    const off = { on: false, needed: 5 } as Outlet["stamps"];
    const outlets = [{ id: "a", stamps: on }, { id: "b" }, { id: "c", stamps: off }] as Outlet[];
    expect(stampProgramOf(outlets[1], outlets)).toBe(on);
    expect(stampProgramOf(outlets[2], outlets)).toBe(off);
  });
});

describe("attendance and salary: who is on it", () => {
  const base = { id: "x", name: "X", phone: "", title: "", outletIds: ["a"], perms: [], active: true, hue: 0 };
  it("staff always, owner never, sub admin only when turned on", async () => {
    const { onPayroll } = await import("../lib/access");
    expect(onPayroll({ ...base, role: "staff" })).toBe(true);
    expect(onPayroll({ ...base, role: "owner" })).toBe(false);
    expect(onPayroll({ ...base, role: "subadmin" })).toBe(false);
    expect(onPayroll({ ...base, role: "subadmin", payrollOn: true })).toBe(true);
    expect(onPayroll(null)).toBe(false);
  });
});
