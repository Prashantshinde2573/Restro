"use client";

import { L } from "@/lib/i18n";
// One order as a card: where it is, what's in it, its stage, and the one next step.
import clsx from "clsx";
import { Bike, Check, ChefHat, Clock3, CookingPot, Gift, HandPlatter, QrCode, ShoppingBag, Ticket, UtensilsCrossed, Wallet } from "lucide-react";
import type { Order } from "@/lib/types";
import { inr, minutesSince, clock } from "@/lib/format";
import { methodLabel, payingOnline } from "@/lib/live";

const STAGE_LABEL: Record<string, string> = { new: "New", accepted: "Accepted", preparing: "Cooking", ready: "Ready", served: "Served", paid: "Paid", cancelled: "Cancelled" };
const TONE: Record<string, { bar: string; chip: string }> = {
  new: { bar: "bg-saffron", chip: "bg-saffron text-white" },
  accepted: { bar: "bg-sky", chip: "bg-sky-soft text-sky" },
  preparing: { bar: "bg-sky", chip: "bg-sky text-white" },
  ready: { bar: "bg-jade", chip: "bg-jade text-white" },
  served: { bar: "bg-ink/70", chip: "bg-ink text-canvas" },
  paid: { bar: "bg-line", chip: "bg-sunken text-muted" },
  cancelled: { bar: "bg-rose", chip: "bg-rose-soft text-rose" },
};

export function orderKind(o: Order) {
  if (o.channel === "qr") return { icon: QrCode, label: o.type === "takeaway" ? "QR · take away" : "QR order", cls: "bg-sky-soft text-sky" };
  if (o.type === "delivery") return { icon: Bike, label: "Delivery", cls: "bg-[#FFEBDD] text-[#C2560B]" };
  if (o.type === "takeaway") return { icon: ShoppingBag, label: "Counter", cls: "bg-saffron-soft text-saffron" };
  return { icon: UtensilsCrossed, label: "Dine-in", cls: "bg-jade-soft text-jade-deep" };
}

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold";

/** "2× Butter Naan, 1× Paneer Tikka" — dishes still to come first; done ones only when nothing is left. */
function dishLine(o: Order) {
  const todo = o.lines.filter((l) => !l.done);
  const ls = (todo.length ? todo : o.lines).slice().sort((a, b) => Number(!!b.addOn) - Number(!!a.addOn));
  return ls.map((l) => `${l.qty}× ${l.name}`).join(", ");
}

/** Inside a grouped card the button is small: "Accept & send to kitchen" → "Accept". */
const shortLabel = (l: string) => (l.startsWith("Accept") ? "Accept" : l.startsWith("Mark cooking") ? "Cooking" : l.startsWith("Mark ready") ? "Ready" : l.startsWith("Mark served") ? "Served" : l);

function StepButton({ a, small }: { a: NonNullable<Step>; small?: boolean }) {
  const I = a.label.startsWith("Accept") ? Check : a.label.startsWith("Mark cooking") ? CookingPot : a.label.startsWith("Mark ready") ? ChefHat : a.label.startsWith("Mark served") ? HandPlatter : Wallet;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); a.onClick(); }}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] font-semibold transition active:scale-[.97]",
        small ? "h-8 px-2.5 text-[12.5px]" : "h-9 px-3 text-[13.5px]",
        a.tone === "dark" ? "bg-ink text-canvas hover:bg-ink/90" : "bg-jade text-white hover:bg-jade-deep",
      )}
    >
      <I size={small ? 14 : 15} /> {L(small ? shortLabel(a.label) : a.label)}
    </button>
  );
}

/** The small flags an order can carry (claim, add-on, wants the bill, coupon…). */
function Flags({ o, action }: { o: Order; action?: Step }) {
  const live = !["paid", "cancelled"].includes(o.status);
  return (
    <>
      {payingOnline(o) && live && <span className={clsx(pill, "bg-jade-soft text-jade-deep")}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jade" /> {L("Paying online…")}</span>}
      {live && o.lines.some((l) => l.addOn && !l.done) && <span className={clsx(pill, "bg-saffron text-white")}>{L("+ Add-on")}</span>}
      {o.status === "new" && o.channel === "qr" && !action && !payingOnline(o) && <span className={clsx(pill, "bg-saffron-soft text-saffron")}>{L("Waiting to be accepted")}</span>}
      {o.status === "cancelled" && o.cancelledBy === "guest" && <span className={clsx(pill, "bg-rose-soft text-rose")}>{L("Cancelled by guest")}</span>}
      {o.payPreference && o.payPreference !== "online" && live && !o.payClaim && <span className={clsx(pill, "bg-sky-soft text-sky")}><Wallet size={11} /> {L("Bill ·")} {methodLabel[o.payPreference]}</span>}
      {o.payPreference === "online" && o.status === "new" && !payingOnline(o) && live && <span className={clsx(pill, "bg-rose-soft text-rose")}>{L("Online pay not finished")}</span>}
      {o.gateway && <span className={clsx(pill, "bg-jade-soft text-jade-deep")} title={L("Paid on your {0} gateway · {1}", o.gateway.provider, o.gateway.paymentId)}><Check size={11} /> {L("Online")}{o.gateway.method ? ` · ${o.gateway.method === "card" ? L("Card") : "UPI"}` : ""}</span>}
      {o.wantsCoupon && live && <span className={clsx(pill, "bg-jade-soft text-jade-deep")}><Ticket size={11} /> {o.wantsCoupon}</span>}
      {o.wantsReward && live && <span className={clsx(pill, "bg-jade-soft text-jade-deep")}><Gift size={11} /> {L("Reward")}</span>}
      {o.status === "paid" && (o.discounts?.length ?? 0) > 0 && (
        <span className={clsx(pill, "bg-jade-soft text-jade-deep")} title={o.discounts!.map((d) => `${d.label} −₹${d.amount}`).join(", ")}>
          <Ticket size={11} /> −₹{o.discounts!.reduce((s, d) => s + d.amount, 0)}
        </span>
      )}
    </>
  );
}

/**
 * One order, compact: where + amount, the dishes on one line, its stage and the one next step.
 * Tap it for everything else (the full order sheet).
 */
export function OrderCard({
  o,
  where,
  total,
  onOpen,
  action,
}: {
  o: Order;
  where: string;
  total: number;
  onOpen: () => void;
  /** the one next step, e.g. Accept / Mark ready / Charge */
  action?: { label: string; onClick: () => void; tone?: "primary" | "dark" } | null;
}) {
  const k = orderKind(o);
  const mins = minutesSince(o.createdAt);
  const live = !["paid", "cancelled"].includes(o.status);
  const late = live && mins > 20 && ["new", "accepted", "preparing"].includes(o.status);
  const tone = TONE[o.payClaim && live ? "new" : o.status] ?? TONE.served;
  const items = o.lines.reduce((s, l) => s + l.qty, 0);
  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="relative cursor-pointer overflow-hidden rounded-[16px] bg-surface p-3 pl-4 shadow-[0_1px_2px_rgb(16_24_20/.05)] ring-1 ring-line/70 transition hover:shadow-[0_10px_24px_-18px_rgb(16_24_20/.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade/50"
    >
      <span className={clsx("absolute inset-y-0 left-0 w-1", tone.bar)} aria-hidden />
      {/* where · amount */}
      <div className="flex items-center gap-2.5">
        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", k.cls)} title={k.label}>
          <k.icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-[15px] font-semibold leading-tight">{L(where)}</span>
            <span className="shrink-0 text-[12px] text-faint tnum">#{o.number || "—"}</span>
          </div>
        </div>
        <span className="shrink-0 text-[15.5px] font-semibold tracking-tight tnum">{inr(total)}</span>
      </div>
      {/* the dishes, one line */}
      <p className="mt-1.5 truncate text-[13px] text-muted" title={dishLine(o)}>
        <span className="font-medium text-ink">{items} {L("item")}{items === 1 ? "" : "s"}</span> · {dishLine(o)}
      </p>
      {/* stage · flags · time · next step */}
      <div className="mt-2 flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className={clsx(pill, tone.chip)}>{o.payClaim && live ? L("Paid? Confirm") : L(STAGE_LABEL[o.status])}</span>
          <Flags o={o} action={action} />
          <span className={clsx("inline-flex items-center gap-0.5 text-[11.5px] tnum", late ? "font-semibold text-rose" : "text-faint")}>
            <Clock3 size={11} /> {live ? `${mins}m` : clock(o.createdAt)}
          </span>
        </div>
        {action && <StepButton a={action} />}
      </div>
    </article>
  );
}

type Step = { label: string; onClick: () => void; tone?: "primary" | "dark" } | null;

/**
 * Several orders of one table (the same group, the same bill) as one card: the guests ordered,
 * then ordered again. Each order keeps its own kitchen step; the bill step (Charge / Money received)
 * shows once, at the bottom.
 */
export function BillGroupCard({
  orders,
  where,
  total,
  onOpen,
  actionOf,
}: {
  orders: Order[];
  where: string;
  total: number;
  onOpen: (o: Order) => void;
  actionOf: (o: Order) => Step;
}) {
  const first = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const k = orderKind(first[0]);
  const live = first.some((o) => !["paid", "cancelled"].includes(o.status));
  const mins = minutesSince(first[0].createdAt);
  const isBillStep = (a: Step) => !!a && (a.label.startsWith("Charge") || a.label === "Money received");
  const billStep = first.map(actionOf).find(isBillStep) ?? null;
  const rank = ["new", "accepted", "preparing", "ready", "served", "paid", "cancelled"];
  const lead = first.reduce((a, o) => (o.payClaim && live ? a : rank.indexOf(o.status) < rank.indexOf(a.status) ? o : a), first[0]);
  const claimed = live && first.some((o) => o.payClaim);
  const tone = TONE[claimed ? "new" : lead.status] ?? TONE.served;
  return (
    <article className="relative overflow-hidden rounded-[16px] bg-surface p-3 pl-4 shadow-[0_1px_2px_rgb(16_24_20/.05)] ring-1 ring-line/70">
      <span className={clsx("absolute inset-y-0 left-0 w-1", tone.bar)} aria-hidden />
      <button onClick={() => onOpen(lead)} className="flex w-full items-center gap-2.5 text-left">
        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", k.cls)} title={k.label}>
          <k.icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight">{L(where)}</div>
          <div className="text-[11.5px] text-muted"><b className="font-semibold text-ink">{first.length} {L("orders · one bill")}</b> · <span className="tnum">{live ? `${mins}m` : clock(first[0].createdAt)}</span></div>
        </div>
        <span className="shrink-0 text-[15.5px] font-semibold tracking-tight tnum">{inr(total)}</span>
      </button>
      <div className="mt-2 divide-y divide-line/70 rounded-[12px] bg-sunken/50">
        {first.map((o) => {
          const t = TONE[o.payClaim && live ? "new" : o.status] ?? TONE.served;
          const step = actionOf(o);
          const own = step && !isBillStep(step) ? step : null;
          return (
            <div key={o.id} role="button" tabIndex={0} onClick={() => onOpen(o)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(o); }} className="flex cursor-pointer items-center gap-2 px-2.5 py-2">
              <span className="shrink-0 text-[12px] font-semibold text-faint tnum">#{o.number || "—"}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{dishLine(o)}</span>
              <span className={clsx(pill, "shrink-0", t.chip)}>{o.payClaim && live ? L("Paid?") : L(STAGE_LABEL[o.status])}</span>
              {own && <StepButton a={own} small />}
            </div>
          );
        })}
      </div>
      {billStep && (
        <div className="mt-2 flex justify-end">
          <StepButton a={billStep} />
        </div>
      )}
    </article>
  );
}
