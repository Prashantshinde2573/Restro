import { describe, expect, it } from "vitest";
import { withOrders } from "@/lib/tables";
import type { Order, Table } from "@/lib/types";

const since = new Date(Date.now() - 10 * 60_000).toISOString();
const table = (p: Partial<Table["parties"][number]>): Table =>
  ({ id: "t1", name: "T1", zone: "Indoor", seats: 4, parties: [{ id: "A", guests: 2, since, status: "ordered", total: 240, pendingApproval: true, ...p }] }) as unknown as Table;
const order = (status: Order["status"]): Order =>
  ({ id: "o" + status, tableId: "t1", partyId: "A", status, createdAt: new Date().toISOString(), lines: [{ itemId: "a", name: "A", qty: 1, price: 240 }] }) as unknown as Order;

describe("tables after cancelled orders", () => {
  it("every order cancelled → seated, nothing to charge, nothing to accept", () => {
    const [t] = withOrders([table({})], [order("cancelled")]);
    expect(t.parties[0].status).toBe("seated");
    expect(t.parties[0].total).toBeUndefined();
    expect(t.parties[0].pendingApproval).toBe(false);
  });
  it("an open order is still counted", () => {
    const [t] = withOrders([table({})], [order("cancelled"), order("accepted")]);
    expect(t.parties[0].status).toBe("ordered");
    expect(t.parties[0].total).toBe(240);
  });
  it("a group that only sat down is left as it is", () => {
    const t0 = table({ status: "seated", total: undefined, pendingApproval: false });
    expect(withOrders([t0], [])[0]).toBe(t0);
  });
});

describe("group seated from the QR (picked the number of guests)", () => {
  it("no order yet → Seated, not 'accept?'", () => {
    const [t] = withOrders([table({ status: "seated", total: undefined, pendingApproval: true })], []);
    expect(t.parties[0].status).toBe("seated");
    expect(t.parties[0].pendingApproval).toBe(false);
  });
  it("first QR order waiting → 'accept?'", () => {
    const [t] = withOrders([table({ status: "seated", total: undefined, pendingApproval: true })], [order("new")]);
    expect(t.parties[0].pendingApproval).toBe(true);
    expect(t.parties[0].status).toBe("ordered");
  });
  it("accepted order → no longer waiting", () => {
    const [t] = withOrders([table({ pendingApproval: true })], [order("accepted")]);
    expect(t.parties[0].pendingApproval).toBe(false);
  });
});
