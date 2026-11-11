"use client";

// Frees a table on its own when a group sat down (scanned the QR and picked
// "how many guests", or a captain seated them) but nobody ordered within 30
// minutes. Runs on the owner's and captains' devices; doing it twice is harmless.
import { useEffect } from "react";
import { useReady } from "@/lib/store";
import { hasPerm, inOutlet } from "@/lib/access";
import { getOrders, useMe } from "@/lib/live";
import { tableActions, useAllTables } from "@/lib/tables";

export const EMPTY_TABLE_MINUTES = 30;

export function TableJanitor() {
  const me = useMe();
  const tables = useAllTables();
  const tablesReady = useReady("tables");
  const ordersReady = useReady("orders");
  const ready = tablesReady && ordersReady;

  useEffect(() => {
    if (!ready || !me || !hasPerm(me, "tables")) return;
    const sweep = () => {
      const open = getOrders().filter((o) => o.tableId && o.status !== "paid" && o.status !== "cancelled");
      for (const t of tables) {
        if (t.outletId && !inOutlet(me, t.outletId)) continue;
        for (const p of t.parties) {
          const idle = (Date.now() - Date.parse(p.since)) / 60_000 >= EMPTY_TABLE_MINUTES;
          const ordered = !!p.total || open.some((o) => o.tableId === t.id && (o.partyId ?? "A") === p.id);
          if (idle && !ordered && !p.pendingApproval && p.status === "seated") tableActions.close(t.id, p.id, `no order in ${EMPTY_TABLE_MINUTES} min`);
        }
      }
    };
    sweep();
    const timer = window.setInterval(sweep, 60_000);
    return () => window.clearInterval(timer);
  }, [ready, me, tables]);

  return null;
}
