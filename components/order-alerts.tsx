"use client";

// Ping the team when something needs them: a new order from a guest's phone
// (QR) and a guest asking for the bill. Sound + a toast, and a phone/desktop
// notification when the browser allows it. Orders already there when the app
// opens never ping.
import { BellRing, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReady } from "@/lib/store";
import { useCan, useOrders } from "@/lib/live";
import { useToast } from "./toast";

let ctx: AudioContext | null = null;
export function chime() {
  try {
    ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.35);
      o.connect(g).connect(ctx!.destination);
      o.start(t + i * 0.16);
      o.stop(t + i * 0.16 + 0.4);
    });
  } catch {
    /* no sound on this device */
  }
}

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification(title, { body, icon: "/brand/icon-192.png", tag: title + body });
  } catch {
    /* some phones only allow notifications from an installed app */
  }
}

export function OrderAlerts() {
  const orders = useOrders();
  const ready = useReady("orders");
  const canSee = useCan("orders");
  const toast = useToast();
  const seenNew = useRef<Set<string> | null>(null);
  const seenBill = useRef<Set<string> | null>(null);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!ready || !canSee) return;
    const fresh = orders.filter((o) => o.status === "new");
    const bills = orders.filter((o) => o.payPreference && o.status !== "paid" && o.status !== "cancelled");
    if (!seenNew.current || !seenBill.current) {
      // first load: remember what's already there, ping only for what comes after
      seenNew.current = new Set(fresh.map((o) => o.id));
      seenBill.current = new Set(bills.map((o) => o.id));
      return;
    }
    const newOnes = fresh.filter((o) => !seenNew.current!.has(o.id));
    const billOnes = bills.filter((o) => !seenBill.current!.has(o.id));
    newOnes.forEach((o) => seenNew.current!.add(o.id));
    billOnes.forEach((o) => seenBill.current!.add(o.id));
    if (newOnes.length) {
      const o = newOnes[0];
      const where = o.tableName ? `Table ${o.tableName}` : o.type === "takeaway" ? "Counter" : "QR";
      const msg = newOnes.length > 1 ? `${newOnes.length} new orders` : `New order · ${where} · ${o.lines.reduce((s, l) => s + l.qty, 0)} items`;
      chime();
      toast(msg);
      notify("New order", msg);
    }
    if (billOnes.length) {
      const o = billOnes[0];
      const msg = `${o.tableName ? `Table ${o.tableName}` : "A guest"} asked for the bill`;
      chime();
      toast(msg);
      notify("Bill requested", msg);
    }
  }, [orders, ready, canSee, toast]);

  // offer phone/desktop notifications once
  useEffect(() => {
    if (!canSee || !("Notification" in window) || Notification.permission !== "default") return;
    try {
      if (localStorage.getItem("restropi.notifyAsked")) return;
    } catch {}
    setAsk(true);
  }, [canSee]);

  if (!ask) return null;
  const close = () => {
    setAsk(false);
    try {
      localStorage.setItem("restropi.notifyAsked", "1");
    } catch {}
  };
  return (
    <div className="fixed inset-x-3 bottom-[88px] z-40 mx-auto flex max-w-md items-center gap-3 rounded-[18px] bg-ink px-4 py-3 text-canvas shadow-float lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
      <BellRing size={18} className="shrink-0 text-saffron" />
      <span className="flex-1 text-[13.5px]">Get a ping for new orders and bill requests?</span>
      <button
        onClick={() => {
          chime();
          Notification.requestPermission().finally(close);
        }}
        className="rounded-full bg-canvas px-3 py-1.5 text-[13px] font-semibold text-ink"
      >
        Turn on
      </button>
      <button onClick={close} aria-label="Not now" className="p-1 text-canvas/60"><X size={16} /></button>
    </div>
  );
}
