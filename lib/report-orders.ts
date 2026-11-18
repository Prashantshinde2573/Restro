"use client";

// Orders for a report's date range. The app keeps only the latest 1,000 orders
// in memory; when a restaurant has more than that, the range is read from the
// server, so 30-day, custom and GST reports count every bill.
import { useEffect, useMemo, useState } from "react";
import { fetchOrdersBetween } from "./cloud";
import { useOrders } from "./live";
import { cloudConfigured } from "./store";
import type { Order } from "./types";

/** How many orders the app loads at start (see lib/cloud.ts). */
const LOADED = 1000;
const DAY = 86_400_000;
const dayStart = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function useOrdersForRange(from: number, to: number): { orders: Order[]; loading: boolean; failed: boolean } {
  const live = useOrders();
  const complete = !cloudConfigured || live.length < LOADED;
  // whole days, so the request doesn't change on every render
  const a = dayStart(from);
  const b = dayStart(to - 1) + DAY;
  const [server, setServer] = useState<{ key: string; list: Order[] | null } | null>(null);
  const key = `${a}-${b}`;

  useEffect(() => {
    if (complete) return;
    let stop = false;
    void fetchOrdersBetween(new Date(a).toISOString(), new Date(b).toISOString()).then((list) => {
      if (!stop) setServer({ key, list: list as Order[] | null });
    });
    return () => {
      stop = true;
    };
  }, [complete, a, b, key]);

  return useMemo(() => {
    if (complete) return { orders: live, loading: false, failed: false };
    if (!server || server.key !== key) return { orders: live, loading: true, failed: false };
    if (!server.list) return { orders: live, loading: false, failed: true };
    // the app's own copy is the freshest for orders it has; the server fills in the rest
    const byId = new Map<string, Order>();
    for (const o of server.list) byId.set(o.id, o);
    for (const o of live) byId.set(o.id, o);
    return { orders: [...byId.values()], loading: false, failed: false };
  }, [complete, live, server, key]);
}
