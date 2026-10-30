"use client";

// Plans, as shown on the website (home page and /pricing).
import clsx from "clsx";
import Link from "next/link";
import { useRef, useState } from "react";
import { plans as allPlans } from "@/lib/plans";
import { inr } from "@/lib/format";
import { IconArrow } from "./site/icons";
import { useTilt } from "./site/motion";

function Tick({ light }: { light?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <circle cx="9" cy="9" r="8.2" className={light ? "fill-saffron/20" : "fill-jade-soft"} />
      <path d="M5.5 9.2l2.2 2.2 4.6-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={light ? "text-saffron" : "text-jade"} />
    </svg>
  );
}

function PlanCard({ p, cycle, index }: { p: (typeof allPlans)[number]; cycle: "monthly" | "yearly"; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref, 4);
  const price = cycle === "monthly" ? p.monthly : p.yearly;
  const dark = !!p.highlight;
  return (
    <div style={{ perspective: "1000px" }} className={clsx(dark && "lg:-mt-6")}>
      <div
        ref={ref}
        className={clsx(
          "group relative flex h-full flex-col overflow-hidden rounded-[32px] p-7 transition-shadow duration-500",
          dark ? "bg-ink text-canvas shadow-[0_40px_80px_-40px_rgb(16_24_20/.6)] lg:pb-10 lg:pt-12" : "bg-surface ring-1 ring-line hover:shadow-float",
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {dark && <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-saffron/25 blur-3xl" />}
        <div className="relative flex items-center justify-between">
          <span className={clsx("text-[13px] font-semibold tnum", dark ? "text-canvas/50" : "text-faint")}>0{index + 1}</span>
          {dark && <span className="rounded-full bg-saffron px-2.5 py-1 text-[12px] font-bold text-white">Most picked</span>}
        </div>
        <h3 className="relative mt-4 font-display text-[40px] leading-none">{p.name}</h3>
        <p className={clsx("relative mt-2 min-h-[44px] text-[14.5px]", dark ? "text-canvas/70" : "text-muted")}>{p.blurb}</p>
        <div className="relative mt-6 flex items-baseline gap-1.5">
          {price ? (
            <>
              <span className="text-[42px] font-semibold tracking-[-0.03em] tnum">{inr(price)}</span>
              <span className={clsx("text-[14px]", dark ? "text-canvas/60" : "text-muted")}>/{cycle === "monthly" ? "month" : "year"}</span>
            </>
          ) : (
            <span className="text-[34px] font-semibold tracking-tight">Let&apos;s talk</span>
          )}
        </div>
        <div className={clsx("relative text-[13px]", dark ? "text-canvas/60" : "text-muted")}>{p.outlets} · + GST</div>
        <div className={clsx("relative my-6 h-px", dark ? "bg-white/10" : "bg-line")} />
        <ul className="relative flex-1 space-y-3">
          {p.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14.5px]">
              <Tick light={dark} />
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/#contact"
          className={clsx(
            "group/btn relative mt-8 flex h-[52px] items-center justify-between rounded-full py-2 pl-5 pr-2 text-[15px] font-semibold transition",
            dark ? "bg-canvas text-ink hover:bg-white" : "bg-jade text-white hover:bg-jade-deep",
          )}
        >
          {p.monthly ? "Get started" : "Talk to us"}
          <span className={clsx("flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-500 group-hover/btn:-rotate-45", dark ? "bg-ink text-canvas" : "bg-white/15")}>
            <IconArrow size={16} />
          </span>
        </Link>
      </div>
    </div>
  );
}

export function PricingTable() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  return (
    <div>
      <div className="flex justify-center">
        <div role="tablist" aria-label="Billing cycle" className="relative inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ transform: cycle === "yearly" ? "translateX(100%)" : "none" }}
          />
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={cycle === c}
              onClick={() => setCycle(c)}
              className={clsx("relative z-10 w-40 rounded-full py-2.5 text-[14px] font-semibold transition-colors duration-300 sm:w-48", cycle === c ? "text-canvas" : "text-muted")}
            >
              {c === "monthly" ? "Monthly" : "Yearly · 2 months free"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:items-start" data-reveal-group>
        {allPlans.map((p, i) => (
          <PlanCard key={p.id} p={p} cycle={cycle} index={i} />
        ))}
      </div>
      <p className="mt-8 text-center text-[13.5px] text-muted">No card needed for the trial. Cancel any time. Your data stays downloadable.</p>
    </div>
  );
}
