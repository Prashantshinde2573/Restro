"use client";

import clsx from "clsx";
import { Banknote, CreditCard, Plus, QrCode, X } from "lucide-react";
import { inr } from "@/lib/format";
import type { Payment, PayMethod } from "@/lib/types";

const methods: { v: PayMethod; label: string; icon: typeof QrCode }[] = [
  { v: "upi", label: "UPI", icon: QrCode },
  { v: "cash", label: "Cash", icon: Banknote },
  { v: "card", label: "Card", icon: CreditCard },
];

export const paidSum = (rows: Payment[]) => rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0);

/**
 * Part UPI, part cash (or card). Each row is one payment. The last row can be
 * filled with "the rest" in one tap, so staff never do the subtraction.
 */
export function PaymentSplit({ total, rows, onChange }: { total: number; rows: Payment[]; onChange: (rows: Payment[]) => void }) {
  const sum = paidSum(rows);
  const left = total - sum;
  const set = (i: number, patch: Partial<Payment>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unused = methods.find((m) => !rows.some((r) => r.method === m.v))?.v ?? "cash";

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 rounded-group bg-surface p-2">
          <div className="flex shrink-0 rounded-ctl bg-sunken p-[3px]">
            {methods.map((m) => (
              <button
                key={m.v}
                onClick={() => set(i, { method: m.v })}
                aria-pressed={r.method === m.v}
                className={clsx("flex items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[13px] font-semibold", r.method === m.v ? "bg-surface shadow-float" : "text-muted")}
              >
                <m.icon size={14} /> <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted">₹</span>
            <input
              aria-label={`Amount ${i + 1}`}
              inputMode="numeric"
              value={Number.isFinite(r.amount) && r.amount !== 0 ? r.amount : ""}
              onChange={(e) => set(i, { amount: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              placeholder="0"
              className="h-10 w-full rounded-[10px] bg-sunken/60 pl-7 pr-2 text-right text-[16px] font-semibold outline-none tnum focus:ring-2 focus:ring-jade"
            />
          </div>
          {rows.length > 1 && (
            <button aria-label="Remove this payment" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint hover:bg-sunken">
              <X size={16} />
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {left > 0 && (
          <button
            onClick={() => set(rows.length - 1, { amount: (rows[rows.length - 1].amount || 0) + left })}
            className="rounded-full bg-jade-soft px-3 py-1.5 text-[13px] font-semibold text-jade-deep"
          >
            Put the rest {inr(left)} on {methods.find((m) => m.v === rows[rows.length - 1].method)?.label}
          </button>
        )}
        {rows.length < 3 && (
          <button
            onClick={() => onChange([...rows, { method: unused, amount: Math.max(0, left) }])}
            className="flex items-center gap-1 rounded-full bg-sunken px-3 py-1.5 text-[13px] font-semibold"
          >
            <Plus size={13} /> Add another payment
          </button>
        )}
      </div>

      <div
        className={clsx(
          "flex items-baseline justify-between rounded-ctl px-4 py-2.5 text-[14px] font-medium",
          left === 0 ? "bg-jade-soft text-jade-deep" : left > 0 ? "bg-saffron-soft text-ink" : "bg-rose-soft text-rose",
        )}
      >
        <span>{left === 0 ? "Fully paid" : left > 0 ? "Still to collect" : "More than the bill by"}</span>
        <span className="text-[17px] font-semibold tnum">{inr(Math.abs(left))}</span>
      </div>
    </div>
  );
}
