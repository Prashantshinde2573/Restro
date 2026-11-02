"use client";

// Ping the team when something needs them:
//   • any new order taken on another phone, tablet or from a guest's QR
//   • a guest asking for the bill
//   • a bill marked paid that needs the owner's OK (for people who can confirm)
// Sound + a toast, a phone/desktop notification when the browser allows it, and
// a line in the bell list. Things already there when the app opens never ping.
import { BellRing, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReady } from "@/lib/store";
import { createdHere, paymentsText, pendingClaims, useCan, useCanConfirm, useCurrentOutlet, useOrders } from "@/lib/live";
import { orderWhere, useAllTables } from "@/lib/tables";
import { pushNotice } from "./notifications";
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
  const all = useOrders();
  const outlet = useCurrentOutlet();
  const tables = useAllTables();
  const ready = useReady("orders");
  const canSee = useCan("orders");
  const canConfirm = useCanConfirm();
  const toast = useToast();
  const seenNew = useRef<Set<string> | null>(null);
  const seenBill = useRef<Set<string> | null>(null);
  const seenClaim = useRef<Set<string> | null>(null);
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!ready || !canSee) return;
    const orders = all.filter((o) => !o.outletId || !outlet.id || o.outletId === outlet.id);
    const open = orders.filter((o) => o.status !== "paid" && o.status !== "cancelled");
    const bills = open.filter((o) => o.payPreference && !o.payClaim);
    const claims = canConfirm ? pendingClaims(orders) : [];
    if (!seenNew.current || !seenBill.current || !seenClaim.current) {
      // first load: remember what's already there, ping only for what comes after
      seenNew.current = new Set(orders.map((o) => o.id));
      seenBill.current = new Set(bills.map((o) => o.id));
      seenClaim.current = new Set(claims.map((c) => c.claim.id));
      return;
    }
    const newOnes = open.filter((o) => !seenNew.current!.has(o.id));
    orders.forEach((o) => seenNew.current!.add(o.id));
    const fromElsewhere = newOnes.filter((o) => !createdHere.has(o.id));
    const billOnes = bills.filter((o) => !seenBill.current!.has(o.id));
    billOnes.forEach((o) => seenBill.current!.add(o.id));
    const claimOnes = claims.filter((c) => !seenClaim.current!.has(c.claim.id));
    claimOnes.forEach((c) => seenClaim.current!.add(c.claim.id));

    let ping = false;
    for (const o of fromElsewhere) {
      const items = o.lines.reduce((s, l) => s + l.qty, 0);
      const where = orderWhere(o, tables);
      const needsOk = o.status === "new";
      const title = needsOk ? "New QR order · accept it" : o.channel === "qr" ? "New QR order" : `New order by ${o.staff}`;
      const body = `${where} · ${items} item${items === 1 ? "" : "s"}`;
      pushNotice({ kind: "order", title, body, href: "/app/orders" });
      notify(title, body);
      ping = true;
    }
    if (fromElsewhere.length) toast(fromElsewhere.length > 1 ? `${fromElsewhere.length} new orders` : `New order · ${orderWhere(fromElsewhere[0], tables)}`);
    for (const o of billOnes) {
      const body = `${o.tableName ? `Table ${o.tableName}` : "A guest"} asked for the bill${o.payPreference ? ` · ${o.payPreference.toUpperCase()}` : ""}`;
      pushNotice({ kind: "bill", title: "Bill requested", body, href: o.tableName ? "/app/tables" : "/app/orders" });
      notify("Bill requested", body);
      toast(body);
      ping = true;
    }
    for (const c of claimOnes) {
      const body = `${orderWhere(c.orders[0], tables)} · ${paymentsText(c.claim.payments)} · marked by ${c.claim.by}`;
      pushNotice({ kind: "claim", title: "Payment to confirm", body, href: "/app/orders" });
      notify("Payment to confirm", body);
      toast(`Payment to confirm · ${orderWhere(c.orders[0], tables)}`);
      ping = true;
    }
    if (ping) chime();
  }, [all, outlet.id, tables, ready, canSee, canConfirm, toast]);

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
      <span className="flex-1 text-[13.5px]">Get a ping for new orders, bill requests and payments?</span>
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
