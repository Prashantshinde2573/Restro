"use client";

// WhatsApp API (Pro): when a bill is paid, or a counter token turns ready, ask the server to send the
// owner's chosen template. The server reads the order, sends only to the number on it, and only once
// (every staff phone may ask; the first one wins). Nothing happens when WhatsApp API is off.
import { useEffect, useRef, useState } from "react";
import { useCloud, waAuto, waStatus, type WaStatus } from "@/lib/cloud";
import { useOrders } from "@/lib/live";
import { recentBills } from "@/lib/wa";

const RECENT = 15 * 60_000;

export function WaAuto() {
  const cloud = useCloud();
  const orders = useOrders();
  const [st, setSt] = useState<WaStatus | null>(null);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    if (cloud.status !== "ready" || !cloud.rid || !cloud.role || cloud.role === "guest") return;
    let live = true;
    const load = () => waStatus().then((s) => live && setSt(s)).catch(() => {});
    void load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [cloud.status, cloud.rid, cloud.role]);

  useEffect(() => {
    if (!st || (!st.bill && !st.ready)) return;
    const now = Date.now();
    if (st.bill) {
      // one bill = the orders paid together for the same number
      const bills = recentBills(orders, now, RECENT);
      for (const [k, ids] of bills) {
        if (asked.current.has(`b${k}`)) continue;
        asked.current.add(`b${k}`);
        waAuto("bill", ids).catch(() => {});
      }
    }
    if (st.ready) {
      for (const o of orders) {
        if (o.status !== "ready" || o.tableId || !o.guestPhone || now - new Date(o.createdAt).getTime() > 6 * 3600_000) continue;
        if (asked.current.has(`r${o.id}`)) continue;
        asked.current.add(`r${o.id}`);
        waAuto("ready", [o.id]).catch(() => {});
      }
    }
  }, [orders, st]);
  return null;
}
