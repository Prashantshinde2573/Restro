import { describe, expect, it } from "vitest";
import { categoriesFor, couponWorksIn, pickOutlet, guestKey, guestsOf, mainOutletId, menuFor, stampProgramOf } from "@/lib/live";
import type { Customer, MenuItem, Outlet } from "@/lib/types";

const dish = (id: string, extra: Partial<MenuItem> = {}): MenuItem =>
  ({ id, name: id, categoryId: "c", price: 100, cost: 0, diet: "veg", available: true, soldThisWeek: 0, prepMins: 5, station: "kitchen", hue: 0, ...extra }) as MenuItem;

describe("menu per outlet", () => {
  const all = [dish("old"), dish("soldB", { offIn: ["b"] }), dish("ownA", { outletIds: ["a"] }), dish("ownB", { outletIds: ["b"] })];
  it("each outlet sees only its own dishes; older dishes with no outlet belong to the first outlet", () => {
    expect(menuFor(all, { id: "a" }, "a").map((m) => m.id)).toEqual(["old", "soldB", "ownA"]);
    expect(menuFor(all, { id: "b" }, "a").map((m) => m.id)).toEqual(["ownB"]);
  });
  it("old per-outlet sold out still shows as sold out", () => {
    expect(menuFor(all, { id: "b" }, "b").find((m) => m.id === "soldB")?.available).toBe(false);
  });
  it("first outlet = lowest sort", () => {
    expect(mainOutletId([{ id: "z", sort: 1 }, { id: "y", sort: 0 }])).toBe("y");
  });
  it("categories per outlet", () => {
    const cats = [{ id: "c1", name: "A" }, { id: "c2", name: "B", outletIds: ["b"] }];
    expect(categoriesFor(cats, { id: "a" }, "a").map((c) => c.id)).toEqual(["c1"]);
    expect(categoriesFor(cats, { id: "b" }, "a").map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("guests per outlet", () => {
  const g = (id: string, outletId?: string) => ({ id, outletId, phone: "98765 43210", name: "N" }) as unknown as Customer;
  it("each outlet sees only its own records; older records belong to the first outlet", () => {
    const all = [g("9876543210"), g("9876543210@b", "b")];
    expect(guestsOf(all, "a", "a").map((c) => c.id)).toEqual(["9876543210"]);
    expect(guestsOf(all, "b", "a").map((c) => c.id)).toEqual(["9876543210@b"]);
  });
  it("record id is phone@outlet", () => {
    expect(guestKey("+91 98765 43210", "b")).toBe("9876543210@b");
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

describe("which outlet a person works in", () => {
  const outlets = [{ id: "main" }, { id: "kolhapur" }];
  const sub = { id: "m1", name: "Uddhav", role: "subadmin", outletIds: ["kolhapur"], perms: [], active: true } as unknown as Parameters<typeof pickOutlet>[1];
  const owner = { id: "owner", name: "O", role: "owner", outletIds: [], perms: [], active: true } as unknown as Parameters<typeof pickOutlet>[1];
  it("a sub admin never lands on another outlet, even if this device last showed it", () => {
    expect(pickOutlet(outlets, sub, "main")?.id).toBe("kolhapur");
    expect(pickOutlet(outlets, sub, "")?.id).toBe("kolhapur");
    expect(pickOutlet(outlets, sub, "kolhapur")?.id).toBe("kolhapur");
  });
  it("the owner can switch to any outlet", () => {
    expect(pickOutlet(outlets, owner, "kolhapur")?.id).toBe("kolhapur");
    expect(pickOutlet(outlets, owner, "")?.id).toBe("main");
  });
  it("someone with no outlet left gets none (nothing is saved to a wrong one)", () => {
    const none = { ...(sub as object), outletIds: [] } as unknown as Parameters<typeof pickOutlet>[1];
    expect(pickOutlet(outlets, none, "main")).toBeUndefined();
  });
});
