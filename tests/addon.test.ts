import { describe, expect, it } from "vitest";
import { getOrders, orderActions } from "@/lib/live";

const line = (name: string, qty = 1) => ({ itemId: name, name, qty, price: 100, station: "kitchen" as const });

describe("a guest's next round goes into the open order", () => {
  it("adds the new dishes as an add-on; food already served is marked done", async () => {
    const o = orderActions.add({ type: "dine-in", channel: "qr", tableId: "T9", tableName: "T9", partyId: "A", lines: [line("Dosa", 2)], status: "accepted", createdAt: new Date().toISOString(), staff: "QR" });
    expect(await orderActions.addOn(o.id, [line("Tea")])).toBe(true);
    let x = getOrders().find((y) => y.id === o.id)!;
    expect(x.lines.map((l) => [l.name, !!l.done, l.addOn ?? false, l.round ?? 1])).toEqual([["Dosa", false, false, 1], ["Tea", false, true, 2]]);
    expect(x.status).toBe("accepted");

    orderActions.setStatus(o.id, "served");
    expect(await orderActions.addOn(o.id, [line("Lassi", 3)])).toBe(true);
    x = getOrders().find((y) => y.id === o.id)!;
    expect(x.status).toBe("accepted"); // back to the kitchen
    expect(x.lines.filter((l) => !l.done).map((l) => l.name)).toEqual(["Lassi"]);
    expect(x.lines.at(-1)!.round).toBe(3);
  });
  it("not once the bill is asked for", async () => {
    const o = orderActions.add({ type: "dine-in", channel: "qr", tableId: "T8", tableName: "T8", lines: [line("Dosa")], status: "served", createdAt: new Date().toISOString(), staff: "QR", payPreference: "upi" });
    expect(await orderActions.addOn(o.id, [line("Tea")])).toBe(false);
  });
});
