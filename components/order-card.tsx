"use client";

// One order as a card: where it is, what's in it, its stage, and the one next step.
import clsx from "clsx";
import { Bike, Check, ChefHat, Clock3, CookingPot, HandPlatter, QrCode, ShoppingBag, UtensilsCrossed, Wallet } from "lucide-react";
import type { Order } from "@/lib/types";
import { inr, minutesSince, clock } from "@/lib/format";
import { methodLabel } from "@/lib/live";

const STAGES = ["new", "accepted", "preparing", "ready", "served"] as const;
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
  const stage = STAGES.indexOf(o.status as (typeof STAGES)[number]);
  const items = o.lines.reduce((s, l) => s + l.qty, 0);
  const shown = o.lines.slice(0, 3);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[22px] bg-surface shadow-[0_1px_2px_rgb(16_24_20/.05),0_8px_24px_-18px_rgb(16_24_20/.35)] ring-1 ring-line/70 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(16_24_20/.45)]">
      <span className={clsx("absolute inset-y-0 left-0 w-1.5", tone.bar)} aria-hidden />
      <button onClick={onOpen} className="flex flex-1 flex-col gap-3 p-4 pl-5 text-left">
        {/* where + amount */}
        <div className="flex items-start gap-3">
          <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", k.cls)}>
            <k.icon size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16.5px] font-semibold leading-tight">{where}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">
              <span className="tnum">#{o.number || "—"}</span>
              <span>·</span>
              <span>{k.label}</span>
              <span>·</span>
              <span className={clsx("inline-flex items-center gap-1 tnum", late && "font-semibold text-rose")}>
                <Clock3 size={12} /> {live ? `${mins} min` : clock(o.createdAt)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-semibold tracking-tight tnum">{inr(total)}</div>
            <div className="text-[11.5px] text-faint">{items} item{items === 1 ? "" : "s"}</div>
          </div>
        </div>

        {/* what's in it */}
        <ul className="space-y-1 rounded-[14px] bg-sunken/50 px-3 py-2.5 text-[13.5px]">
          {shown.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-6 shrink-0 font-semibold tnum">{l.qty}×</span>
              <span className={clsx("min-w-0 flex-1 truncate", l.done && "text-muted line-through")}>{l.name}</span>
            </li>
          ))}
          {o.lines.length > 3 && <li className="pl-8 text-[12.5px] text-muted">+{o.lines.length - 3} more</li>}
        </ul>

        {/* stage */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={clsx("rounded-full px-2.5 py-1 text-[12px] font-semibold", tone.chip)}>{o.payClaim && live ? "Paid? Confirm" : STAGE_LABEL[o.status]}</span>
          {o.status === "new" && o.channel === "qr" && !action && <span className="rounded-full bg-saffron-soft px-2.5 py-1 text-[12px] font-semibold text-saffron">Waiting to be accepted</span>}
          {o.payPreference && live && !o.payClaim && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-2.5 py-1 text-[12px] font-semibold text-sky"><Wallet size={12} /> Wants bill · {methodLabel[o.payPreference]}</span>
          )}
          {o.customer && o.channel === "qr" && <span className="truncate text-[12px] text-muted">{o.customer}</span>}
          {live && stage >= 0 && (
            <span className="ml-auto flex items-center gap-1" aria-label={`Stage ${stage + 1} of ${STAGES.length}`}>
              {STAGES.map((s, i) => (
                <span key={s} className={clsx("h-1.5 w-4 rounded-full", i <= stage ? tone.bar : "bg-line")} />
              ))}
            </span>
          )}
        </div>
      </button>
      {action && (
        <div className="border-t border-line/70 p-3 pl-5">
          <button
            onClick={action.onClick}
            className={clsx(
              "flex h-11 w-full items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold transition active:scale-[.98]",
              action.tone === "dark" ? "bg-ink text-canvas hover:bg-ink/90" : "bg-jade text-white hover:bg-jade-deep",
            )}
          >
            {action.label.startsWith("Accept") ? <Check size={17} /> : action.label.startsWith("Mark cooking") ? <CookingPot size={17} /> : action.label.startsWith("Mark ready") ? <ChefHat size={17} /> : action.label.startsWith("Mark served") ? <HandPlatter size={17} /> : <Wallet size={17} />}
            {action.label}
          </button>
        </div>
      )}
    </article>
  );
}
