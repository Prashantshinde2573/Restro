"use client";

// Frees a table on its own when a group sat down (scanned the QR and picked
// "how many guests", or a captain seated them) but has no open order 30 minutes
// later (never ordered, or every order was cancelled). Runs on the owner's and captains' devices; doing it twice is harmless.
import { useEffect } from "react";
import { useFresh } from "@/lib/store";
import { hasPerm, inOutlet } from "@/lib/access";
import { getOrders, useMe } from "@/lib/live";
import { tableActions, useAllTables } from "@/lib/tables";

export const EMPTY_TABLE_MINUTES = 30;

export function TableJanitor() {
  const me = useMe();
  const tables = useAllTables();
  // only on the server's answer: never free a table from a day-old copy on this device
  const tablesReady = useFresh("tables");
  const ordersReady = useFresh("orders");
  const ready = tablesReady && ordersReady;

  useEffect(() => {
    if (!ready || !me || !hasPerm(me, "tables")) return;
    const sweep = () => {
      const open = getOrders().filter((o) => o.tableId && o.status !== "paid" && o.status !== "cancelled");
      for (const t of tables) {
        if (t.outletId && !inOutlet(me, t.outletId)) continue;
        for (const p of t.parties) {
          const idle = (Date.now() - Date.parse(p.since)) / 60_000 >= EMPTY_TABLE_MINUTES;
          // the orders decide: a group whose orders were all cancelled has nothing open either
          const ordered = open.some((o) => o.tableId === t.id && (o.partyId ?? "A") === p.id);
          if (idle && !ordered && p.status !== "billing" && !p.paymentPending) tableActions.close(t.id, p.id, `no order in ${EMPTY_TABLE_MINUTES} min`);
        }
      }
    };
    sweep();
    const timer = window.setInterval(sweep, 60_000);
    return () => window.clearInterval(timer);
  }, [ready, me, tables]);

  return null;
}
