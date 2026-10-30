"use client";

import clsx from "clsx";
import { Flame, ImageIcon } from "lucide-react";
import type { MenuItem } from "@/lib/types";

/** Bestseller / Chef's special / New / Seasonal, each with its own look. */
export function ItemBadges({ item, className }: { item: MenuItem; className?: string }) {
  const tags = [...(item.isNew ? ["New"] : []), ...(item.tags ?? [])];
  if (!tags.length) return null;
  const style = (t: string) =>
    t === "Bestseller"
      ? "bg-saffron-soft text-saffron"
      : t === "Chef special"
        ? "bg-ink text-canvas"
        : t === "New"
          ? "bg-sky-soft text-sky"
          : "bg-jade-soft text-jade-deep";
  return (
    <span className={clsx("flex flex-wrap gap-1", className)}>
      {tags.map((t) => (
        <span key={t} className={clsx("rounded-[6px] px-1.5 py-[1px] text-[11px] font-bold", style(t))}>
          {t === "Chef special" ? "Chef's special" : t}
        </span>
      ))}
    </span>
  );
}

/** 0–3 chillies. Nothing shown for non-spicy dishes. */
export function SpiceMeter({ level, withLabel }: { level?: number; withLabel?: boolean }) {
  if (!level) return null;
  const label = ["", "Mild", "Medium spicy", "Very spicy"][level];
  return (
    <span className="inline-flex items-center gap-0.5 text-rose" aria-label={label} title={label}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Flame key={i} size={12} className={i < level ? "fill-rose" : "opacity-25"} />
      ))}
      {withLabel && <span className="ml-1 text-[12px] font-medium">{label}</span>}
    </span>
  );
}

/**
 * One photo slide. Uses the uploaded photo when there is one; otherwise a
 * consistent placeholder so every card keeps the same ratio.
 */
export function PhotoSlide({ item, index = 0, className }: { item: MenuItem; index?: number; className?: string }) {
  const src = item.photos?.[index];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${item.name} photo ${index + 1}`} className={clsx("object-cover", className)} />;
  }
  const h = item.hue + index * 14;
  const pos = [
    [50, 52, 62],
    [38, 46, 74],
    [60, 58, 54],
    [50, 40, 84],
  ][index % 4];
  return (
    <div
      role="img"
      aria-label={`${item.name} photo ${index + 1}`}
      className={clsx("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(150deg, hsl(${h} 70% 88%), hsl(${h} 55% 72%))` }}
    >
      <span
        className="absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${pos[0]}%`,
          top: `${pos[1]}%`,
          height: `${pos[2]}%`,
          background: `radial-gradient(circle, hsl(${h} 62% 58%) 0 44%, rgb(255 255 255 / .6) 45% 62%, rgb(255 255 255 / .2) 63%)`,
        }}
      />
    </div>
  );
}

export const photoTotal = (item: MenuItem) => item.photos?.length || item.photoCount || 1;

export function PhotosChip({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  const n = photoTotal(item);
  if (n < 2) return null;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur"
      aria-label={`See ${n} photos of ${item.name}`}
    >
      <ImageIcon size={11} /> {n}
    </button>
  );
}

/** Swipeable gallery: same 4:3 ratio for every photo. */
export function Gallery({ item }: { item: MenuItem }) {
  const n = photoTotal(item);
  const captions = ["As served", "Close-up", "Portion size", "With sides"];
  return (
    <div>
      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5">
        {Array.from({ length: n }).map((_, i) => (
          <figure key={i} className="w-[86%] shrink-0 snap-center">
            <PhotoSlide item={item} index={i} className="aspect-[4/3] w-full rounded-[18px]" />
            <figcaption className="mt-1.5 text-[12px] text-muted">
              {i + 1} of {n} · {item.photos?.[i] ? "Photo" : captions[i % captions.length]}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
