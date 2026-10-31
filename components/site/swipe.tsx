"use client";

// On phones: a sideways, snapping carousel with dots (less scrolling down the page).
// Up-and-down swipes on it still scroll the page (overflow-y hidden, pan-y allowed).
// From `from` (lg by default) up: whatever grid you pass in `grid`.
import clsx from "clsx";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

export function Swipe({
  children,
  grid,
  item = "w-[84%] sm:w-[46%]",
  from = "lg",
  className,
  dark = false,
  spans,
}: {
  /** per-slide classes for the desktop grid, e.g. ["lg:col-span-4", ...] */
  spans?: string[];
  children: ReactNode;
  /** desktop layout classes, e.g. "lg:grid lg:grid-cols-3 lg:gap-4" */
  grid: string;
  /** width of each slide below the breakpoint */
  item?: string;
  from?: "md" | "lg";
  className?: string;
  dark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const kids = Children.toArray(children);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => {
      const slides = Array.from(el.children) as HTMLElement[];
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestD = Infinity;
      slides.forEach((s, i) => {
        const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
        if (d < bestD) (bestD = d), (best = i);
      });
      setActive(best);
    };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, []);

  const go = (i: number) => {
    const el = ref.current;
    const s = el?.children[i] as HTMLElement | undefined;
    if (el && s) el.scrollTo({ left: s.offsetLeft - (el.clientWidth - s.offsetWidth) / 2, behavior: "smooth" });
  };

  const bp = from === "md" ? "md" : "lg";
  return (
    <div className={className}>
      <div
        ref={ref}
        className={clsx(
          "-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x touch-pan-y scroll-px-5 px-5 pb-12 pt-3 -mb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          bp === "md" ? "md:mx-0 md:overflow-visible md:p-0" : "lg:mx-0 lg:overflow-visible lg:p-0",
          grid,
        )}
      >
        {kids.map((k, i) => (
          <div key={i} className={clsx("flex shrink-0 snap-center", item, bp === "md" ? "md:w-auto md:shrink" : "lg:w-auto lg:shrink", "[&>*]:w-full", spans?.[i])}>
            {k}
          </div>
        ))}
      </div>
      {kids.length > 1 && (
        <div className={clsx("flex justify-center gap-1.5", bp === "md" ? "md:hidden" : "lg:hidden")}>
          {kids.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Show ${i + 1} of ${kids.length}`}
              className={clsx(
                "h-1.5 rounded-full transition-all duration-300",
                i === active ? "w-6 " + (dark ? "bg-white" : "bg-ink") : "w-1.5 " + (dark ? "bg-white/30" : "bg-ink/20"),
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
