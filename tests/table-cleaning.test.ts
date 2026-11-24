import { describe, expect, it } from "vitest";
import { getTable, tableActions } from "@/lib/tables";

describe("tables to clean", () => {
  it("a paid group leaving marks the table; freeing a table with no order does not", () => {
    const t = tableActions.add({ name: "C1", zone: "Main", seats: 4 });
    tableActions.seat(t.id, 2);
    tableActions.close(t.id, "A", "freed, no order");
    expect(getTable(t.id)?.cleaning).toBeUndefined();

    const u = tableActions.add({ name: "C2", zone: "Main", seats: 4 });
    tableActions.seat(u.id, 2);
    tableActions.close(u.id, "A", "bill paid", { paid: true });
    expect(getTable(u.id)?.cleaning?.since).toBeTruthy();

    tableActions.assignCleaning(u.id, { id: "m1", name: "Ravi" }, "Owner");
    expect(getTable(u.id)?.cleaning).toMatchObject({ to: "m1", toName: "Ravi", by: "Owner" });

    tableActions.cleaned(u.id, "Ravi");
    expect(getTable(u.id)?.cleaning).toBeUndefined();
  });

  it("staff can ask for any table to be cleaned, even with guests on it", () => {
    const t = tableActions.add({ name: "C3", zone: "Main", seats: 4 });
    tableActions.seat(t.id, 3);
    tableActions.needsCleaning(t.id);
    expect(getTable(t.id)?.cleaning?.to).toBeUndefined();
    expect(getTable(t.id)?.parties.length).toBe(1);
  });
});
