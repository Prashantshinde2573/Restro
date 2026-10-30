"use client";

// Plans, as shown on the website (home page and /pricing).
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { plans as allPlans } from "@/lib/plans";
import { inr } from "@/lib/format";
import { IconArrow } from "./site/icons";

function Tick({ light }: { light?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="mt-0.5 shrink-0">
      <circle cx="9" cy="9" r="8.2" className={light ? "fill-saffron/20" : "fill-jade-soft"} />
      <path d="M5.5 9.2l2.2 2.2 4.6-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={light ? "text-saffron" : "text-jade"} />
    </svg>
  );
}

function PlanCard({ p, cycle }: { p: (typeof allPlans)[number]; cycle: "monthly" | "yearly" }) {
  const price = cycle === "monthly" ? p.monthly : p.yearly;
  const dark = !!p.highlight;
  return (
    <div
      className={clsx(
        "relative flex h-full flex-col overflow-hidden rounded-[28px] p-6 transition-all duration-500 lg:p-7",
        dark ? "bg-ink text-canvas shadow-[0_30px_60px_-30px_rgb(16_24_20/.55),inset_0_1px_0_rgb(255_255_255/.12)]" : "glass glass-shine hover:-translate-y-1",
      )}
    >
      {dark && <div aria-hidden className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-saffron/20 blur-3xl" />}

      {/* name + badge: same height on every card */}
      <div className="relative flex h-7 items-center justify-between">
        <h3 className="text-[20px] font-semibold tracking-tight">{p.name}</h3>
        {dark && <span className="rounded-full bg-saffron px-2.5 py-1 text-[12px] font-bold text-white">Most picked</span>}
      </div>
      <p className={clsx("relative mt-2 min-h-[44px] text-[14px] leading-snug", dark ? "text-canvas/70" : "text-muted")}>{p.blurb}</p>

      {/* price */}
      <div className="relative mt-6 flex h-12 items-end gap-1.5">
        {price ? (
          <>
            <span className="text-[38px] font-semibold leading-none tracking-[-0.03em] tnum">{inr(price)}</span>
            <span className={clsx("pb-1 text-[14px]", dark ? "text-canvas/60" : "text-muted")}>/{cycle === "monthly" ? "month" : "year"}</span>
          </>
        ) : (
          <span className="text-[34px] font-semibold leading-none tracking-tight">Let&apos;s talk</span>
        )}
      </div>
      <div className={clsx("relative mt-2 text-[13px]", dark ? "text-canvas/60" : "text-muted")}>{p.outlets} · + GST</div>

      <Link
        href="/#contact"
        className={clsx(
          "group/btn relative mt-6 flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition",
          dark ? "bg-canvas text-ink hover:bg-white" : "bg-jade text-white hover:bg-jade-deep",
        )}
      >
        {p.monthly ? "Get started" : "Talk to us"}
        <IconArrow size={16} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
      </Link>

      <div className={clsx("relative my-6 h-px", dark ? "bg-white/10" : "bg-line")} />
      <ul className="relative flex-1 space-y-3">
        {p.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px] leading-snug">
            <Tick light={dark} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingTable() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  return (
    <div>
      <div className="flex justify-center">
        <div role="tablist" aria-label="Billing cycle" className="glass relative inline-flex rounded-full p-1">
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
      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-4" data-reveal-group>
        {allPlans.map((p) => (
          <PlanCard key={p.id} p={p} cycle={cycle} />
        ))}
      </div>
      <p className="mt-8 text-center text-[13.5px] text-ink/50">No card needed for the trial. Cancel any time. Your data stays downloadable.</p>
    </div>
  );
}
