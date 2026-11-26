import { describe, expect, it } from "vitest";
import { paidUp } from "@/lib/billing";
import { getOrders, orderActions } from "@/lib/live";
import { getTable, tableActions, withOrders } from "@/lib/tables";
import type { Order } from "@/lib/types";

const line = { itemId: "i1", name: "Paneer Tikka", qty: 1, price: 200, station: "kitchen" as const };
const dineIn = (tableId: string, name: string): Omit<Order, "id" | "number"> => ({
  type: "dine-in", channel: "pos", tableId, tableName: name, partyId: "A", staff: "Owner",
  createdAt: new Date().toISOString(), status: "accepted", lines: [line],
});
const live = (id: string) => withOrders([getTable(id)!], getOrders())[0].parties[0];

describe("dine-in: the guest pays before the food comes", () => {
  it("keeps the table (Paid, nothing to charge) until staff say the guests left", () => {
    const t = tableActions.add({ name: "P1", zone: "Main", seats: 4 });
    tableActions.seat(t.id, 2);
    const o = orderActions.add(dineIn(t.id, "P1"));
    orderActions.pay([o.id], [{ method: "cash", amount: 210 }], "Owner");
    paidUp(t.id, "A", "bill paid");

    expect(getTable(t.id)?.parties).toHaveLength(1); // still at the table
    expect(getTable(t.id)?.cleaning).toBeUndefined(); // not "to clean"
    expect(live(t.id)).toMatchObject({ paid: true, total: 0, status: "ordered" }); // no Charge, not "Wants bill"

    // the kitchen serves it: still paid, still nothing to charge
    orderActions.setStatus(o.id, "served");
    expect(getOrders().find((x) => x.id === o.id)?.status).toBe("paid");
    expect(live(t.id)).toMatchObject({ paid: true, total: 0 });

    // they order a dessert: only that is charged
    const more = orderActions.add({ ...dineIn(t.id, "P1"), lines: [{ ...line, name: "Kulfi", price: 80 }] });
    expect(live(t.id)).toMatchObject({ paid: false, total: 80 });

    // they pay for it after eating: now they leave and the table is to clean
    orderActions.setStatus(more.id, "served");
    orderActions.pay([more.id], [{ method: "upi", amount: 84 }], "Owner");
    paidUp(t.id, "A", "bill paid");
    expect(getTable(t.id)?.parties).toHaveLength(0);
    expect(getTable(t.id)?.cleaning).toBeTruthy();
  });

  it("paid after the food was served: the table frees and needs cleaning, as before", () => {
    const t = tableActions.add({ name: "P2", zone: "Main", seats: 4 });
    tableActions.seat(t.id, 2);
    const o = orderActions.add(dineIn(t.id, "P2"));
    orderActions.setStatus(o.id, "served");
    orderActions.pay([o.id], [{ method: "cash", amount: 210 }], "Owner");
    paidUp(t.id, "A", "bill paid");
    expect(getTable(t.id)?.parties).toHaveLength(0);
    expect(getTable(t.id)?.cleaning).toBeTruthy();
  });
});
