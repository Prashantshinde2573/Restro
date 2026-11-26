"use client";

import { L } from "@/lib/i18n";
// A dish's recipe for stock: what one plate takes (paneer 0.15 kg, butter 0.02 kg…).
// Every paid plate then takes it off stock by itself.
import { Plus, X } from "lucide-react";
import type { RecipeLine, StockItem } from "@/lib/types";
import { inr } from "@/lib/format";
import { recipeCost } from "@/lib/stock-forecast";
import { Hint } from "@/components/ui";

export function RecipeEditor({ value, onChange, stock, onUseCost }: { value: RecipeLine[]; onChange: (v: RecipeLine[]) => void; stock: StockItem[]; onUseCost?: (rs: number) => void }) {
  const unused = stock.filter((s) => !value.some((r) => r.stockId === s.id));
  const cost = recipeCost(value, stock);
  const set = (i: number, patch: Partial<RecipeLine>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  if (!stock.length)
    return <p className="rounded-group bg-surface px-3 py-2.5 text-[13px] text-muted">{L("Add stock items (Stock page) to link this dish to them.")}</p>;
  return (
    <div className="rounded-group bg-surface p-3">
      {value.length === 0 && <p className="px-1 pb-2 text-[13px] text-muted">{L("Nothing linked yet.")}</p>}
      <div className="space-y-1.5">
        {value.map((r, i) => {
          const it = stock.find((s) => s.id === r.stockId);
          return (
            <div key={r.stockId + i} className="flex items-center gap-2">
              <select
                aria-label={L("Stock item")}
                value={r.stockId}
                onChange={(e) => set(i, { stockId: e.target.value })}
                className="h-10 min-w-0 flex-1 rounded-[10px] bg-sunken/50 px-2.5 text-[14.5px] font-medium outline-none focus:ring-1 focus:ring-jade/40"
              >
                {[...(it ? [it] : []), ...unused].map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="relative w-[110px] shrink-0">
                <input
                  aria-label={L("Per plate, {0}", it?.unit ?? "")}
                  inputMode="decimal"
                  value={Number.isFinite(r.qty) && r.qty ? String(r.qty) : ""}
                  placeholder="0"
                  onChange={(e) => set(i, { qty: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) })}
                  className="h-10 w-full rounded-[10px] bg-sunken/50 pl-3 pr-10 text-right text-[14.5px] tnum outline-none focus:ring-1 focus:ring-jade/40"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">{it?.unit}</span>
              </div>
              <button aria-label={L("Remove")} onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunken">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {unused.length > 0 && (
          <button type="button" onClick={() => onChange([...value, { stockId: unused[0].id, qty: 0 }])} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13.5px] font-semibold text-jade ring-1 ring-jade/30">
            <Plus size={15} /> {L("Add item")}</button>
        )}
        {cost > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-[13px] text-muted">
            {L("Costs")} {inr(cost)} {L("a plate")}{onUseCost && <button type="button" onClick={() => onUseCost(cost)} className="font-semibold text-jade">{L("Use as cost")}</button>}
          </span>
        )}
      </div>
    </div>
  );
}

export const RecipeHint = () => <Hint align="left">{L("Per plate, in the stock item's unit (0.15 kg = 150 g). Each paid plate takes this off stock by itself.")}</Hint>;
