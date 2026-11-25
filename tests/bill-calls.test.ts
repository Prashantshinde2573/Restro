import { describe, expect, it } from "vitest";
import type { Member } from "@/lib/access";
import { answersCall } from "@/lib/live";

const m = (id: string, role: Member["role"], perms: Member["perms"]): Member => ({ id, name: id, phone: "", role, title: "", outletIds: ["main"], perms, active: true, hue: 1 });
const owner = m("owner", "owner", []);
const cashier = m("cashier", "staff", ["pos", "charge"]);
const checker = m("checker", "staff", ["confirmPay"]);
const waiter = m("waiter", "staff", ["tables"]);
const cook = m("cook", "staff", ["kitchen"]);

describe("who hears a guest's call", () => {
  const bill = { reason: "Bill", outletId: "main" };
  const water = { reason: "Water", outletId: "main" };
  it("Call for bill: owner, waiters, and everyone who takes or confirms payments", () => {
    expect([owner, cashier, checker, waiter, cook].map((x) => answersCall(x, bill))).toEqual([true, true, true, true, false]);
  });
  it("other calls stay with the waiters (and the owner)", () => {
    expect([owner, cashier, checker, waiter, cook].map((x) => answersCall(x, water))).toEqual([true, false, false, true, false]);
  });
  it("not in that outlet: no call", () => {
    expect(answersCall({ ...cashier, outletIds: ["other"] }, bill)).toBe(false);
  });
});
