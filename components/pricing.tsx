"use client";

import clsx from "clsx";
import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";
import { Segmented } from "./ui";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";

export function PricingTable() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const plans = repo.plans();
  return (
    <div>
      <div className="flex justify-center">
        <Segmented value={cycle} onChange={setCycle} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly · 2 months free" }]} />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const price = cycle === "monthly" ? p.monthly : p.yearly;
          return (
            <div key={p.id} className={clsx("flex flex-col rounded-[24px] p-6", p.highlight ? "bg-ink text-canvas" : "bg-surface")}>
              <div className="flex items-center justify-between">
                <h3 className="text-[19px] font-semibold">{p.name}</h3>
                {p.highlight && <span className="rounded-full bg-saffron px-2.5 py-0.5 text-[12px] font-bold text-white">Most picked</span>}
              </div>
              <p className={clsx("mt-1 text-[14px]", p.highlight ? "text-canvas/70" : "text-muted")}>{p.blurb}</p>
              <div className="mt-5 flex items-baseline gap-1">
                {price ? (
                  <>
                    <span className="text-[38px] font-semibold tracking-tight tnum">{inr(price)}</span>
                    <span className={clsx("text-[14px]", p.highlight ? "text-canvas/60" : "text-muted")}>/{cycle === "monthly" ? "month" : "year"}</span>
                  </>
                ) : (
                  <span className="text-[30px] font-semibold tracking-tight">Let&apos;s talk</span>
                )}
              </div>
              <div className={clsx("text-[13px]", p.highlight ? "text-canvas/60" : "text-muted")}>{p.outlets} · + GST</div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[14px]">
                    <Check size={16} className={clsx("mt-0.5 shrink-0", p.highlight ? "text-saffron" : "text-jade")} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.monthly ? "/onboarding" : "mailto:sales@restro.app"}
                className={clsx(
                  "mt-6 flex h-12 items-center justify-center rounded-ctl text-[15px] font-semibold transition active:scale-[.98]",
                  p.highlight ? "bg-canvas text-ink hover:bg-canvas/90" : "bg-jade-soft text-jade-deep hover:brightness-95",
                )}
              >
                {p.monthly ? "Start 14-day free trial" : "Talk to us"}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-[13px] text-muted">No card needed for the trial. Cancel any time. Your data stays downloadable.</p>
    </div>
  );
}
