"use client";

import { AlertTriangle } from "lucide-react";
import { claimSummary } from "@/lib/billing";
import { inr } from "@/lib/format";

/** One line under a "marked paid" claim: the bill against what was paid, in red when it is less. */
export function ClaimCheck({ claimId }: { claimId: string }) {
  const s = claimSummary(claimId);
  if (!s) return null;
  return (
    <div className="mt-1.5 text-[13px]">
      Bill <b className="tnum">{inr(s.bill)}</b> · paid <b className="tnum">{inr(s.paid)}</b>
      {s.discount > 0 && (
        <>
          {" "}· discount <b className="tnum">{inr(s.discount)}</b>
          {s.reward ? ` (${s.reward})` : s.coupon ? ` (coupon ${s.coupon})` : s.guest ? " (from the guest's phone)" : ""}
        </>
      )}
      {s.short > 0 && (
        <div className="mt-1 flex items-center gap-1.5 font-semibold text-[#B42318]">
          <AlertTriangle size={14} /> {inr(s.short)} less than the bill. Check before you confirm.
        </div>
      )}
    </div>
  );
}
