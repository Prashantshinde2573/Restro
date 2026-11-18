"use client";

import clsx from "clsx";
import { ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { OptionGroup, Size } from "@/lib/types";
import { uploadMenuPhoto } from "@/lib/cloud";

/** Shrink a photo on the phone before uploading: max 1200 px, JPEG. */
async function shrink(file: File, maxSide = 1200): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
}

/**
 * Several photos per dish. The first one is the cover shown on the menu;
 * the rest open in the guest's gallery. Everything is cropped to a square on
 * screen so the menu stays even. Photos are shrunk on the phone (max 1200 px)
 * and stored in Supabase Storage; the menu item keeps their links.
 */
export function PhotoUploader({ photos, onChange, max = 6 }: { photos: string[]; onChange: (p: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const latest = useRef(photos);
  latest.current = photos;
  const addFiles = async (files: File[] | FileList | null) => {
    if (!files) return;
    setErr("");
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, max - photos.length);
    setBusy(list.length);
    for (const f of list) {
      try {
        const url = await uploadMenuPhoto(await shrink(f));
        latest.current = [...latest.current, url];
        onChange(latest.current);
      } catch (e) {
        setErr(`Couldn't upload a photo: ${(e as Error).message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-muted">Photos</span>
        <span className="text-[12px] text-faint">{photos.length}/{max} · first one is the cover</span>
      </div>
      {err && <p className="mb-2 text-[13px] font-medium text-rose">{err}</p>}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((src, i) => (
          <div key={src} className="group relative aspect-square overflow-hidden rounded-[14px] bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">Cover</span>
            ) : (
              <button
                aria-label="Make cover photo"
                onClick={() => onChange([src, ...photos.filter((p) => p !== src)])}
                className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <Star size={13} />
              </button>
            )}
            <button
              aria-label="Remove photo"
              onClick={() => onChange(photos.filter((p) => p !== src))}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addFiles(Array.from(e.dataTransfer.files));
            }}
            className={clsx(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-line bg-surface text-muted hover:border-jade hover:text-jade",
              photos.length === 0 && "col-span-3 aspect-auto h-36",
            )}
          >
            <ImagePlus size={22} />
            <span className="text-[13px] font-medium">{busy > 0 ? "Uploading…" : photos.length ? "Add more" : "Add photos — take or upload"}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; void addFiles(fs); }} />
      <p className="mt-1.5 text-[12px] text-faint">Tip: shoot from above in daylight. Photos are shown square everywhere, so the menu looks even.</p>
    </div>
  );
}

/** Sizes, each with its own full price (Pizza S / M / L). */
export function SizesEditor({ sizes, onChange }: { sizes: Size[]; onChange: (s: Size[]) => void }) {
  const set = (i: number, patch: Partial<Size>) => onChange(sizes.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const preset = (names: string[]) => onChange(names.map((n, k) => ({ id: `s${Date.now()}${k}`, name: n, price: sizes[k]?.price ?? 0 })));
  return (
    <div className="rounded-group bg-surface p-3">
      {sizes.length === 0 ? (
        <p className="px-1 pb-2 text-[13px] text-muted">One price for this dish. Sold in sizes (pizza, shakes, half / full)? Add them here — each size has its own price.</p>
      ) : (
        <div className="space-y-1.5">
          {sizes.map((z, i) => (
            <div key={z.id} className="flex items-center gap-2">
              <input aria-label="Size name" value={z.name} placeholder="e.g. Medium" onChange={(e) => set(i, { name: e.target.value })} className="h-10 min-w-0 flex-1 rounded-[10px] bg-sunken/50 px-3 text-[15px] font-medium outline-none focus:ring-1 focus:ring-jade/40" />
              <span className="text-[13px] text-muted">₹</span>
              <input aria-label={`Price for ${z.name || "this size"}`} inputMode="numeric" value={z.price || ""} placeholder="0" onChange={(e) => set(i, { price: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="h-10 w-20 rounded-[10px] bg-sunken/50 px-2 text-right text-[15px] font-semibold outline-none tnum focus:ring-1 focus:ring-jade/40" />
              <button aria-label="Remove size" onClick={() => onChange(sizes.filter((_, j) => j !== i))} className="p-1 text-faint"><X size={15} /></button>
            </div>
          ))}
          <button onClick={() => onChange([...sizes, { id: `s${Date.now()}`, name: "", price: 0 }])} className="pt-1 text-[13px] font-semibold text-jade">+ Add size</button>
          {sizes.length === 1 && <p className="text-[12px] text-saffron">Add at least two sizes, or remove this one.</p>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {[["S", "M", "L"], ["Regular", "Medium", "Large"], ["Half", "Full"]].map((names) => (
          <button key={names.join()} onClick={() => preset(names)} className="flex items-center gap-1 rounded-full bg-sunken px-3 py-1.5 text-[13px] font-semibold">
            <Plus size={13} /> {names.join(" / ")}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Customisations: spice level, add-ons… */
export function OptionsEditor({ groups, onChange }: { groups: OptionGroup[]; onChange: (g: OptionGroup[]) => void }) {
  const setGroup = (i: number, patch: Partial<OptionGroup>) => onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <div key={g.id + i} className="rounded-group bg-surface p-3">
          <div className="flex items-center gap-2">
            <input aria-label="Option group name" value={g.name} onChange={(e) => setGroup(i, { name: e.target.value })} className="h-10 min-w-0 flex-1 rounded-[10px] bg-sunken/60 px-3 text-[15px] font-semibold outline-none focus:ring-1 focus:ring-jade/40" />
            <select
              aria-label="Choice type"
              value={g.type === "single" ? (g.required ? "one" : "one-opt") : "any"}
              onChange={(e) => setGroup(i, { type: e.target.value === "any" ? "multi" : "single", required: e.target.value === "one" })}
              className="h-10 rounded-[10px] bg-sunken/60 pl-3 text-[13px] outline-none"
            >
              <option value="one">Must pick one</option>
              <option value="one-opt">Pick one (optional)</option>
              <option value="any">Pick any</option>
            </select>
            <button aria-label="Remove group" onClick={() => onChange(groups.filter((_, j) => j !== i))} className="flex h-9 w-9 items-center justify-center rounded-full text-faint hover:bg-sunken">
              <Trash2 size={15} />
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {g.choices.map((c, k) => (
              <div key={k} className="flex items-center gap-2">
                <input
                  aria-label="Choice name"
                  value={c.name}
                  onChange={(e) => setGroup(i, { choices: g.choices.map((x, m) => (m === k ? { ...x, name: e.target.value } : x)) })}
                  className="h-9 min-w-0 flex-1 rounded-[10px] bg-sunken/40 px-3 text-[14px] outline-none focus:ring-1 focus:ring-jade/40"
                />
                <span className="text-[13px] text-muted">+₹</span>
                <input
                  aria-label="Extra price"
                  inputMode="numeric"
                  value={c.price || ""}
                  placeholder="0"
                  onChange={(e) => setGroup(i, { choices: g.choices.map((x, m) => (m === k ? { ...x, price: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)) })}
                  className="h-9 w-16 rounded-[10px] bg-sunken/40 px-2 text-right text-[14px] outline-none tnum focus:ring-1 focus:ring-jade/40"
                />
                <button aria-label="Remove choice" onClick={() => setGroup(i, { choices: g.choices.filter((_, m) => m !== k) })} className="p-1 text-faint"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setGroup(i, { choices: [...g.choices, { id: `c${Date.now()}`, name: "", price: 0 }] })} className="text-[13px] font-semibold text-jade">+ Add choice</button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {[
          { name: "Spice level", type: "single" as const, required: true, choices: ["Mild", "Medium", "Hot"] },
          { name: "Add extra", type: "multi" as const, required: false, choices: ["Extra cheese"] },
        ]
          .filter((p) => !groups.some((g) => g.name === p.name))
          .map((p) => (
            <button
              key={p.name}
              onClick={() => onChange([...groups, { id: `g${Date.now()}`, name: p.name, type: p.type, required: p.required, choices: p.choices.map((c, k) => ({ id: `${k}`, name: c, price: c === "Extra cheese" ? 40 : 0 })) }])}
              className="flex items-center gap-1 rounded-full bg-sunken px-3 py-1.5 text-[13px] font-semibold"
            >
              <Plus size={13} /> {p.name}
            </button>
          ))}
      </div>
    </div>
  );
}
