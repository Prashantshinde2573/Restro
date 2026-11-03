"use client";

// "How many guests?" — for table orders only: the guest's phone asks right after the scan,
// and staff choose it when they seat a new party from New order.
import clsx from "clsx";
import { Minus, Plus, Users } from "lucide-react";
import { useState } from "react";

const MAX = 40;

/** Compact chips (1–6, then a stepper) for the staff cart. */
export function GuestCount({ value, onChange, className }: { value: number | null; onChange: (n: number) => void; className?: string }) {
  const [more, setMore] = useState(false);
  const big = more || (value ?? 0) > 6;
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <span className={clsx("shrink-0 text-[13px] font-medium", value ? "text-muted" : "text-saffron")}>
        <Users size={14} className="mr-1 inline -translate-y-px" />Guests
      </span>
      {big ? (
        <Stepper value={value ?? 7} onChange={onChange} />
      ) : (
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={value === n}
              className={clsx("h-8 min-w-8 shrink-0 rounded-full px-2 text-[14px] font-semibold tnum transition-colors", value === n ? "bg-ink text-canvas" : "bg-sunken text-ink hover:bg-line/60")}
            >
              {n}
            </button>
          ))}
          <button type="button" onClick={() => { setMore(true); onChange(Math.max(7, value ?? 7)); }} className="h-8 shrink-0 rounded-full bg-sunken px-3 text-[13px] font-semibold text-ink hover:bg-line/60">
            7+
          </button>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, large }: { value: number; onChange: (n: number) => void; large?: boolean }) {
  const s = large ? "h-14 w-14" : "h-8 w-8";
  return (
    <div className={clsx("flex items-center rounded-full bg-sunken p-1", large ? "gap-4" : "gap-2")}>
      <button type="button" aria-label="Fewer guests" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))} className={clsx("flex items-center justify-center rounded-full bg-surface shadow-float disabled:opacity-40", s)}>
        <Minus size={large ? 20 : 14} />
      </button>
      <span className={clsx("text-center font-semibold tnum", large ? "w-14 text-[30px]" : "w-7 text-[15px]")}>{value}</span>
      <button type="button" aria-label="More guests" disabled={value >= MAX} onClick={() => onChange(Math.min(MAX, value + 1))} className={clsx("flex items-center justify-center rounded-full bg-surface shadow-float disabled:opacity-40", s)}>
        <Plus size={large ? 20 : 14} />
      </button>
    </div>
  );
}

type Lang = "en" | "mr";
const tx = (lang: Lang, en: string, mr: string) => (lang === "mr" ? mr : en);

/** Full screen on the guest's phone, before the menu. */
export function GuestCountScreen({ place, restaurant, lang, initial, onPick, onClose }: { place: string; restaurant: string; lang: Lang; initial?: number | null; onPick: (n: number) => void; onClose?: () => void }) {
  const [more, setMore] = useState((initial ?? 0) > 8);
  const [n, setN] = useState(Math.max(9, initial ?? 9));
  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md animate-fade-in flex-col bg-canvas px-5 pb-8 pt-8 sm:max-w-2xl" role="dialog" aria-label={tx(lang, "How many guests?", "किती जण आहात?")}>
      <div className="flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/restropi-logo-dark.png" alt="Restropi" width={597} height={180} className="h-[22px] w-auto" />
        {onClose && (
          <button onClick={onClose} className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold ring-1 ring-line">{tx(lang, "Cancel", "रद्द")}</button>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <span className="inline-flex w-fit rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-canvas">{place}</span>
        <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-tight">{tx(lang, "How many guests?", "किती जण आहात?")}</h1>
        <p className="mt-1 text-[15px] text-muted">{tx(lang, `Welcome to ${restaurant}. Tell us how many are at the table, then see the menu.`, `${restaurant} मध्ये स्वागत. टेबलवर किती जण आहात ते सांगा, मग मेनू पहा.`)}</p>

        {!more ? (
          <div className="mt-7 grid grid-cols-4 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
              <button
                key={k}
                onClick={() => onPick(k)}
                className={clsx("flex aspect-square flex-col items-center justify-center rounded-[20px] text-[26px] font-semibold tnum ring-1 transition active:scale-95", initial === k ? "bg-jade text-white ring-jade" : "bg-surface ring-line/70 hover:ring-jade/50")}
              >
                {k}
              </button>
            ))}
            <button onClick={() => setMore(true)} className="col-span-4 h-14 rounded-[18px] bg-surface text-[15.5px] font-semibold ring-1 ring-line/70 hover:ring-jade/50">
              {tx(lang, "More than 8", "8 पेक्षा जास्त")}
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-6">
            <Stepper value={n} onChange={setN} large />
            <button onClick={() => onPick(n)} className="h-14 w-full rounded-[18px] bg-jade text-[16px] font-semibold text-white shadow-float">
              {tx(lang, `We are ${n} · see the menu`, `आम्ही ${n} जण · मेनू पहा`)}
            </button>
            <button onClick={() => setMore(false)} className="text-[14px] font-semibold text-muted">{tx(lang, "Back", "मागे")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
