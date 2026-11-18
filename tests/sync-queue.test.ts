import { describe, expect, it } from "vitest";
import { diffFields } from "@/lib/sync-queue";

describe("diffFields: what an order edit sends", () => {
  const order = { id: "o1", status: "preparing", lines: [{ itemId: "a", qty: 1, price: 100 }], customer: "Ravi", number: 1042 };

  it("sends only the field that changed", () => {
    expect(diffFields(order, { ...order, status: "ready" })).toEqual({ set: { status: "ready" }, drop: [] });
  });

  it("compares lists by their content, not by object identity", () => {
    expect(diffFields(order, { ...order, lines: [{ itemId: "a", qty: 1, price: 100 }] })).toEqual({ set: {}, drop: [] });
    const more = [...order.lines, { itemId: "b", qty: 2, price: 50 }];
    expect(diffFields(order, { ...order, lines: more })).toEqual({ set: { lines: more }, drop: [] });
  });

  it("drops fields that were removed or set to undefined", () => {
    const { customer: _c, ...rest } = order;
    expect(diffFields(order, rest).drop).toEqual(["customer"]);
    expect(diffFields(order, { ...order, customer: undefined }).drop).toEqual(["customer"]);
  });

  it("kitchen and captain edits on the same order don't overlap", () => {
    const kitchen = diffFields(order, { ...order, status: "ready" });
    const captain = diffFields(order, { ...order, lines: [...order.lines, { itemId: "c", qty: 1, price: 80 }] });
    expect(Object.keys(kitchen.set)).toEqual(["status"]);
    expect(Object.keys(captain.set)).toEqual(["lines"]);
  });

  it("a new order (no earlier copy) sends everything", () => {
    expect(diffFields(undefined, order).set).toEqual(order);
  });
});
