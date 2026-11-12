"use client";

import clsx from "clsx";
import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, DietMark, Sheet } from "./ui";
import { Gallery, ItemBadges, SpiceMeter } from "./menu-bits";
import { inr } from "@/lib/format";
import type { MenuItem, Size } from "@/lib/types";
import { sizesOf } from "@/lib/sizes";

export interface CartLine {
  key: string; // item + size + chosen options, so different choices stay separate
  item: MenuItem;
  qty: number;
  size?: string; // "L" (dishes sold in sizes)
  options: string[]; // readable labels, e.g. "Hot", "Extra cheese"
  unitPrice: number; // size (or base) price + paid add-ons
}

export const makeLine = (item: MenuItem, qty: number, options: string[] = [], extra = 0, size?: Size): CartLine => ({
  key: `${item.id}|${size?.id ?? ""}|${options.join(",")}`,
  item,
  qty,
  size: size?.name,
  options,
  unitPrice: (size?.price ?? item.price) + extra,
});

/**
 * Dish detail: photos, description, spice, and customisations
 * (single choice like spice level, multi choice like add-ons).
 */
export function ItemSheet({
  item,
  onClose,
  onAdd,
  photosOnly,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd?: (line: CartLine) => void;
  photosOnly?: boolean;
}) {
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const sizes = item ? sizesOf(item) : [];
  const [sizeId, setSizeId] = useState<string | null>(null);
  const size = sizes.find((z) => z.id === sizeId) ?? sizes[0];

  useEffect(() => {
    if (!item) return;
    setQty(1);
    setSizeId(null); // the first (smallest) size is picked to start
    // pre-select the first choice of required single groups, so one tap adds
    const init: Record<string, string[]> = {};
    item.options?.forEach((g) => {
      if (g.type === "single" && g.required) init[g.id] = [g.choices[Math.min(1, g.choices.length - 1)].id];
    });
    setPicked(init);
  }, [item]);

  const { extra, labels } = useMemo(() => {
    let extra = 0;
    const labels: string[] = [];
    item?.options?.forEach((g) =>
      g.choices.forEach((c) => {
        if (picked[g.id]?.includes(c.id)) {
          extra += c.price;
          labels.push(c.name);
        }
      }),
    );
    return { extra, labels };
  }, [item, picked]);

  const toggle = (gid: string, cid: string, single: boolean) =>
    setPicked((p) => {
      const cur = p[gid] ?? [];
      if (single) return { ...p, [gid]: [cid] };
      return { ...p, [gid]: cur.includes(cid) ? cur.filter((x) => x !== cid) : [...cur, cid] };
    });

  const missing = item?.options?.find((g) => g.required && !(picked[g.id]?.length));

  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={item?.name ?? ""}
      footer={
        item && !photosOnly && onAdd ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-sunken p-1">
              <button aria-label="Less" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface"><Minus size={16} /></button>
              <span className="w-7 text-center text-[17px] font-semibold tnum">{qty}</span>
              <button aria-label="More" onClick={() => setQty((q) => q + 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface"><Plus size={16} /></button>
            </div>
            <Button size="lg" className="flex-1" disabled={!!missing} onClick={() => { onAdd(makeLine(item, qty, labels, extra, size)); onClose(); }}>
              {missing ? `Choose ${missing.name.toLowerCase()}` : `Add${size ? ` ${size.name}` : ""} · ${inr(((size?.price ?? item.price) + extra) * qty)}`}
            </Button>
          </div>
        ) : undefined
      }
    >
      {item && (
        <div className="space-y-5">
          <Gallery item={item} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <DietMark diet={item.diet} />
              <ItemBadges item={item} />
              <SpiceMeter level={item.spice} withLabel />
            </div>
            <div className="mt-2 text-[20px] font-semibold tnum">{sizes.length ? `${inr(size!.price)}${size ? ` · ${size.name}` : ""}` : inr(item.price)}</div>
            {item.desc && <p className="mt-1 text-[15px] leading-relaxed text-muted">{item.desc}</p>}
          </div>
          {sizes.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[16px] font-semibold">Size</h3>
                <span className="text-[12.5px] text-muted">Pick one</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(sizes.length, 3)}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Size">
                {sizes.map((z) => {
                  const on = z.id === size?.id;
                  return (
                    <button
                      key={z.id}
                      role="radio"
                      aria-checked={on}
                      disabled={photosOnly}
                      onClick={() => setSizeId(z.id)}
                      className={clsx("flex flex-col items-center rounded-[14px] border px-2 py-2.5 transition", on ? "border-jade bg-jade-soft text-jade-deep" : "border-line bg-surface")}
                    >
                      <span className="text-[15px] font-semibold">{z.name}</span>
                      <span className="text-[13.5px] tnum opacity-80">{inr(z.price)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {!photosOnly &&
            item.options?.map((g) => (
              <section key={g.id}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-[16px] font-semibold">{g.name}</h3>
                  <span className="text-[12.5px] text-muted">{g.required ? "Pick one" : "Optional · pick any"}</span>
                </div>
                <div className="overflow-hidden rounded-group bg-surface">
                  {g.choices.map((c) => {
                    const on = picked[g.id]?.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggle(g.id, c.id, g.type === "single")}
                        className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3.5 text-left last:border-0"
                        aria-pressed={on}
                      >
                        <span
                          className={clsx(
                            "flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 transition",
                            g.type === "single" ? "rounded-full" : "rounded-[6px]",
                            on ? "border-jade bg-jade text-white" : "border-line",
                          )}
                        >
                          {on && (g.type === "single" ? <span className="h-2 w-2 rounded-full bg-white" /> : <Check size={13} strokeWidth={3} />)}
                        </span>
                        <span className="flex-1 text-[15px]">{c.name}</span>
                        {c.price > 0 && <span className="text-[14px] text-muted tnum">+{inr(c.price)}</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </Sheet>
  );
}
