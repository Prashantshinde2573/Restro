"use client";

// Ping the team when something needs them:
//   • any new order taken on another phone, tablet or from a guest's QR (every outlet you work in)
//   • a guest asking for the bill
//   • a bill marked paid that needs the owner's OK (for people who can confirm)
//   • a payment you marked that the owner did NOT confirm
//   • an order the kitchen marked ready (for waiters / order takers)
//   • a new order for the kitchen (kitchen staff, on any screen)
//   • a guest review of 3 stars or less (owner / guests access)
// Sound + a toast, a phone/desktop notification when the browser allows it, and
// a line in the bell list. Things already there when the app opens never ping.
// The sound can be muted on each device (components/sound.ts).
import { BellRing, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useReady } from "@/lib/store";
import { inOutlet } from "@/lib/access";
import { createdHere, paymentsText, pendingClaims, useCan, useCanConfirm, useFeedback, useMe, useOrders, useOutlets } from "@/lib/live";
import { orderWhere, useAllTables } from "@/lib/tables";
import { pushNotice, type Notice } from "./notifications";
import { useToast } from "./toast";

export { chime } from "./sound";
import { chime, type SoundEvent } from "./sound";

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification(title, { body, icon: "/brand/icon-192.png", tag: title + body });
  } catch {
    /* some phones only allow notifications from an installed app */
  }
}

export function OrderAlerts() {
  const all = useOrders();
  const me = useMe();
  const outlets = useOutlets();
  const tables = useAllTables();
  const feedback = useFeedback();
  const path = usePathname() ?? "";
  const ready = useReady("orders");
  const canSee = useCan("orders");
  const canKitchen = useCan("kitchen");
  const canGuests = useCan("guests");
  const canConfirm = useCanConfirm();
  const toast = useToast();
  const seenNew = useRef<Set<string> | null>(null);
  const seenBill = useRef<Set<string> | null>(null);
  const seenClaim = useRef<Map<string, { by: string; ids: string[] }> | null>(null);
  const seenReady = useRef<Set<string> | null>(null);
  const seenReview = useRef<Set<string> | null>(null);
  const [ask, setAsk] = useState(false);
  const watching = canSee || canKitchen;

  useEffect(() => {
    if (!ready || !watching) return;
    // every outlet this person works in (the owner: all of them)
    const orders = all.filter((o) => !o.outletId || inOutlet(me, o.outletId));
    const outletTag = (id?: string) => (outlets.length > 1 && id ? ` · ${outlets.find((x) => x.id === id)?.name ?? ""}` : "");
    const open = orders.filter((o) => o.status !== "paid" && o.status !== "cancelled");
    const bills = open.filter((o) => o.payPreference && !o.payClaim);
    const claims = pendingClaims(orders);
    const readyNow = open.filter((o) => o.status === "ready");
    if (!seenNew.current || !seenBill.current || !seenClaim.current || !seenReady.current || !seenReview.current) {
      // first load: remember what's already there, ping only for what comes after
      seenNew.current = new Set(orders.map((o) => o.id));
      seenBill.current = new Set(bills.map((o) => o.id));
      seenClaim.current = new Map(claims.map((c) => [c.claim.id, { by: c.claim.by, ids: c.orders.map((o) => o.id) }]));
      seenReady.current = new Set(readyNow.map((o) => o.id));
      seenReview.current = new Set(feedback.map((f) => f.id));
      return;
    }
    // one sound per check: the most important kind of alert wins
    const RANK: SoundEvent[] = ["payment", "bill", "order", "kitchen", "ready", "review"];
    let ping: SoundEvent | null = null;
    const ring = (ev: SoundEvent) => {
      if (!ping || RANK.indexOf(ev) < RANK.indexOf(ping)) ping = ev;
    };
    const SOUND_OF: Record<Notice["kind"], SoundEvent> = { order: "order", call: "waiter", kitchen: "kitchen", bill: "bill", claim: "payment", ready: "ready", review: "review" };
    const say = (kind: Notice["kind"], title: string, body: string, href: string, short = body) => {
      pushNotice({ kind, title, body, href });
      notify(title, body);
      toast(short);
      ring(SOUND_OF[kind]);
    };

    // new orders from other devices / guests
    const newOnes = open.filter((o) => !seenNew.current!.has(o.id));
    orders.forEach((o) => seenNew.current!.add(o.id));
    const fromElsewhere = newOnes.filter((o) => !createdHere.has(o.id));
    if (canSee) {
      for (const o of fromElsewhere) {
        const items = o.lines.reduce((s, l) => s + l.qty, 0);
        const needsOk = o.status === "new";
        const title = needsOk ? (o.payPreference ? "New order · take the payment" : "New QR order · accept it") : o.channel === "qr" ? "New QR order" : `New order by ${o.staff}`;
        const body = `${orderWhere(o, tables)} · ${items} item${items === 1 ? "" : "s"}${outletTag(o.outletId)}`;
        pushNotice({ kind: "order", title, body, href: "/app/orders" });
        notify(title, body);
        ring("order");
      }
      if (fromElsewhere.length) toast(fromElsewhere.length > 1 ? `${fromElsewhere.length} new orders` : `New order · ${orderWhere(fromElsewhere[0], tables)}`);
    } else if (canKitchen && !path.startsWith("/app/kitchen")) {
      // kitchen staff away from the kitchen screen
      const toCook = fromElsewhere.filter((o) => o.status === "accepted" || o.status === "preparing");
      for (const o of toCook) say("kitchen", "New order for the kitchen", `${orderWhere(o, tables)} · ${o.lines.map((l) => `${l.qty} ${l.name}`).join(", ")}`, "/app/kitchen", `New order · ${orderWhere(o, tables)}`);
    }

    if (canSee) {
      // a guest (or staff) asked for the bill
      for (const o of bills.filter((o) => !seenBill.current!.has(o.id))) {
        seenBill.current!.add(o.id);
        if (o.status === "new" && fromElsewhere.includes(o)) continue; // already pinged as a new order
        const body = `${o.tableName ? `Table ${o.tableName}` : "A guest"} asked for the bill · ${o.payPreference!.toUpperCase()}${outletTag(o.outletId)}`;
        say("bill", "Bill requested", body, o.tableName ? "/app/tables" : "/app/orders");
      }
      // food is ready to serve (not when you're the one on the kitchen screen)
      for (const o of readyNow.filter((o) => !seenReady.current!.has(o.id))) {
        seenReady.current!.add(o.id);
        if (path.startsWith("/app/kitchen")) continue;
        say("ready", "Ready to serve", `${orderWhere(o, tables)} · order #${o.number || "—"}${outletTag(o.outletId)}`, "/app/orders");
      }
    }

    // payments: new ones to confirm, and ones the owner turned down
    const claimNow = new Map(claims.map((c) => [c.claim.id, c]));
    for (const c of claims) {
      if (seenClaim.current!.has(c.claim.id)) continue;
      seenClaim.current!.set(c.claim.id, { by: c.claim.by, ids: c.orders.map((o) => o.id) });
      if (!canConfirm) continue;
      const guest = c.claim.source === "guest";
      const title = guest ? "Guest paid · please confirm" : "Payment to confirm";
      const body = `${orderWhere(c.orders[0], tables)} · ${paymentsText(c.claim.payments)} · ${guest ? `paid from the phone by ${c.claim.by}` : `marked by ${c.claim.by}`}${outletTag(c.orders[0].outletId)}`;
      say("claim", title, body, "/app/orders", `Payment to confirm · ${orderWhere(c.orders[0], tables)}`);
    }
    for (const [id, was] of [...seenClaim.current!]) {
      if (claimNow.has(id)) continue;
      seenClaim.current!.delete(id);
      const os = orders.filter((o) => was.ids.includes(o.id));
      const turnedDown = os.length > 0 && os.every((o) => o.status !== "paid" && !o.payClaim);
      if (turnedDown && me && was.by === me.name && !canConfirm) {
        say("claim", "Payment not confirmed", `${orderWhere(os[0], tables)} · the owner marked it "not received". Please check with the guest.`, "/app/orders", `Payment not confirmed · ${orderWhere(os[0], tables)}`);
      }
    }

    // a low rating from a guest
    for (const f of feedback.filter((f) => !seenReview.current!.has(f.id))) {
      seenReview.current!.add(f.id);
      if (f.stars <= 3 && (canGuests || me?.role === "owner")) say("review", `${f.stars}★ review · needs a look`, `${f.customer || "A guest"}${f.text ? `: “${f.text.slice(0, 80)}”` : ""}`, "/app/guests", `${f.stars}★ review from ${f.customer || "a guest"}`);
    }

    if (ping) chime(ping);
  }, [all, me, outlets, tables, feedback, path, ready, watching, canSee, canKitchen, canGuests, canConfirm, toast]);

  // offer phone/desktop notifications once
  useEffect(() => {
    if (!watching || !("Notification" in window) || Notification.permission !== "default") return;
    try {
      if (localStorage.getItem("restropi.notifyAsked")) return;
    } catch {}
    setAsk(true);
  }, [watching]);

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
