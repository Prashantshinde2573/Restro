"use client";

// The bell: everything that pinged on this device (new orders, bill requests,
// payments to confirm), and "Needs you now" on the home screen.
import clsx from "clsx";
import Link from "next/link";
import { Bell, BellOff, BellRing, ChefHat, Check, ChevronDown, Clock3, Play, ReceiptText, Smartphone, Star, UtensilsCrossed, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createStore } from "@/lib/store";
import { paymentsText, pendingClaims, useCan, useCanConfirm, useCurrentOutlet, useOrders } from "@/lib/live";
import { confirmPayment, rejectPayment } from "@/lib/billing";
import { orderWhere, useAllTables } from "@/lib/tables";
import { inr, timeAgo } from "@/lib/format";
import { Button, Sheet } from "./ui";
import { useToast } from "./toast";
import { WaiterCallCards, useOutletCalls } from "./waiter-calls";
import { playSound, setSound, setSoundFor, SOUND_EVENTS, SOUNDS, useSound, useSoundPicks, type SoundId } from "./sound";

export interface Notice {
  id: string;
  at: string;
  kind: "order" | "call" | "bill" | "claim" | "ready" | "kitchen" | "review";
  title: string;
  body: string;
  href: string;
  read?: boolean;
}

// kept on this device only (each phone has its own bell)
const noticeStore = createStore<Notice[]>([], "notices");
export function pushNotice(n: Omit<Notice, "id" | "at">) {
  const item: Notice = { ...n, id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString() };
  noticeStore.set([item, ...noticeStore.get()].slice(0, 60));
}

const icon = { order: ReceiptText, call: BellRing, bill: Smartphone, claim: Clock3, ready: UtensilsCrossed, kitchen: ChefHat, review: Star };

/** Bell with the unread count; opens the list. */
export function NoticeBell({ dark = false }: { dark?: boolean }) {
  const list = noticeStore.use();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]); // a link in the list was tapped
  const unread = list.filter((n) => !n.read).length;
  const sound = useSound();
  const markAll = () => noticeStore.set(noticeStore.get().map((n) => (n.read ? n : { ...n, read: true })));
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
        className={clsx("relative flex h-[34px] w-[34px] items-center justify-center rounded-full", dark ? "text-white hover:bg-white/10" : "bg-surface text-ink shadow-float hover:bg-sunken")}
      >
        {sound ? <Bell size={18} /> : <BellOff size={18} />}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose px-1 text-[11px] font-bold text-white tnum">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          markAll();
        }}
        title="Notifications"
      >
        <SoundRow />
        <NeedsYou compact />
        {list.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-muted">Nothing yet. New orders, bill requests and payments to confirm show up here.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-group bg-surface">
            {list.map((n) => {
              const I = icon[n.kind];
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={markAll}
                  className="flex items-start gap-3 border-b border-line/80 px-4 py-3 last:border-0 hover:bg-sunken/40"
                >
                  <span className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.kind === "claim" || n.kind === "review" || n.kind === "call" ? "bg-saffron-soft text-saffron" : n.kind === "bill" ? "bg-sky-soft text-sky" : "bg-jade-soft text-jade")}>
                    <I size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={clsx("text-[14.5px]", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-rose" />}
                    </span>
                    <span className="block text-[13px] text-muted">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-faint">{timeAgo(n.at)}</span>
                </Link>
              );
            })}
          </div>
        )}
        {list.length > 0 && (
          <button onClick={() => noticeStore.set([])} className="mt-3 w-full text-center text-[13px] font-semibold text-muted">
            Clear list
          </button>
        )}
      </Sheet>
    </>
  );
}

/** "Needs you now": waiter calls, QR orders to accept, bills asked for, payments to confirm. Nothing → nothing shown. */
export function NeedsYou({ compact = false, onGo }: { compact?: boolean; onGo?: () => void }) {
  const all = useOrders();
  const outlet = useCurrentOutlet();
  const tables = useAllTables();
  const canConfirm = useCanConfirm();
  const canOrders = useCan("orders");
  const toast = useToast();
  const orders = all.filter((o) => !o.outletId || !outlet.id || o.outletId === outlet.id);
  const toAccept = canOrders ? orders.filter((o) => o.status === "new") : [];
  const bills = canOrders ? orders.filter((o) => o.payPreference && !o.payClaim && o.status !== "paid" && o.status !== "cancelled") : [];
  const claims = canConfirm ? pendingClaims(orders) : [];
  const calls = useOutletCalls();
  if (!toAccept.length && !bills.length && !claims.length && !calls.length) return null;
  return (
    <section className={clsx("rounded-[24px] bg-saffron-soft/70", compact ? "p-3" : "p-4 lg:p-5")}>
      <h2 className={clsx("font-semibold tracking-tight", compact ? "px-1 text-[15px]" : "text-[18px]")}>Needs you now</h2>
      <div className="mt-2 space-y-2">
        <WaiterCallCards calls={calls} />
        {claims.map((c) => {
          const total = c.claim.payments.reduce((s, p) => s + p.amount, 0);
          return (
            <div key={c.claim.id} className="rounded-[16px] bg-surface p-3">
              <div className="flex items-start gap-2">
                <Clock3 size={17} className="mt-0.5 shrink-0 text-saffron" />
                <div className="min-w-0 flex-1 text-[14px]">
                  <b>{orderWhere(c.orders[0], tables)}</b> marked paid · {inr(total)}
                  <div className="text-[12.5px] text-muted">{paymentsText(c.claim.payments)} · by {c.claim.by} · {timeAgo(c.claim.at)}</div>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => { confirmPayment(c.claim.id); toast("Payment confirmed · bill closed"); }}><Check size={15} /> Money received</Button>
                <Button size="sm" variant="plain" onClick={() => { rejectPayment(c.claim.id); toast("Marked not received · the bill is open again"); }}><X size={15} /> Not received</Button>
              </div>
            </div>
          );
        })}
        {toAccept.length > 0 && (
          <Link href="/app/orders" onClick={onGo} className="flex items-center gap-2 rounded-[16px] bg-surface p-3 text-[14px] hover:shadow-float">
            <ReceiptText size={17} className="text-jade" />
            <span className="flex-1"><b>{toAccept.length} QR order{toAccept.length > 1 ? "s" : ""}</b> waiting to be accepted</span>
            <span className="text-[13px] font-semibold text-jade">Open</span>
          </Link>
        )}
        {bills.length > 0 && (
          <Link href={bills.some((o) => o.tableName) ? "/app/tables" : "/app/orders"} onClick={onGo} className="flex items-center gap-2 rounded-[16px] bg-surface p-3 text-[14px] hover:shadow-float">
            <Smartphone size={17} className="text-sky" />
            <span className="flex-1">
              <b>{[...new Set(bills.map((o) => o.tableName ?? "Counter"))].join(", ")}</b> asked for the bill
            </span>
            <span className="text-[13px] font-semibold text-jade">Open</span>
          </Link>
        )}
      </div>
    </section>
  );
}

/** Sound on / off for this device (in the bell and in your profile menu). */
export function SoundRow() {
  const on = useSound();
  const picks = useSoundPicks();
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 overflow-hidden rounded-group bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", on ? "bg-jade-soft text-jade" : "bg-sunken text-muted")}>
          {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">Sound</span>
          <span className="block text-[12.5px] text-muted">{on ? "A different sound for each kind of alert" : "Muted on this device · alerts still show here"}</span>
        </span>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Sound for alerts"
          onClick={() => setSound(!on)}
          className={clsx("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors", on ? "bg-jade" : "bg-line")}
        >
          <span className={clsx("absolute h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-t border-line/80 px-4 py-2.5 text-[13.5px] font-semibold text-jade"
      >
        Choose sounds
        <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className={clsx("border-t border-line/80", !on && "opacity-60")}>
          {SOUND_EVENTS.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 border-b border-line/60 px-4 py-2.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{ev.label}</span>
                <span className="block text-[12px] leading-snug text-muted">{ev.hint}</span>
              </span>
              <select
                aria-label={`Sound for ${ev.label}`}
                value={picks[ev.id]}
                onChange={(e) => setSoundFor(ev.id, e.target.value as SoundId)}
                className="h-9 max-w-[140px] rounded-[10px] bg-sunken px-2 text-[13px] font-medium outline-none"
              >
                {SOUNDS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={() => playSound(picks[ev.id])}
                disabled={picks[ev.id] === "none"}
                aria-label={`Play ${ev.label} sound`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink disabled:opacity-40"
              >
                <Play size={14} />
              </button>
            </div>
          ))}
          {!on && <p className="px-4 pb-3 pt-1 text-[12px] text-muted">Sound is off, so these won't play until you turn it on.</p>}
        </div>
      )}
    </div>
  );
}
