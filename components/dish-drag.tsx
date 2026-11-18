"use client";

// Drag a dish by its handle and drop it on another category (mouse or finger).
// Every category box carries data-drop-cat="<category id>".
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";

export interface DishDrag {
  id: string;
  name: string;
  from: string;
  x: number;
  y: number;
  over: string | null;
}

const catAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-drop-cat]") as HTMLElement | null)?.dataset.dropCat ?? null;

export function useDishDrag(onDrop: (dishId: string, toCat: string) => void) {
  const [drag, setDrag] = useState<DishDrag | null>(null);
  const live = useRef<DishDrag | null>(null);
  const drop = useRef(onDrop);
  drop.current = onDrop;

  useEffect(() => {
    if (!drag) return;
    let raf = 0;
    let vy = 0;
    // scroll the page when the finger is near the top or bottom edge
    const tick = () => {
      if (vy) window.scrollBy(0, vy);
      if (vy && live.current) {
        const over = catAt(live.current.x, live.current.y);
        if (over !== live.current.over) setDrag((live.current = { ...live.current, over }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const move = (e: PointerEvent) => {
      if (!live.current) return;
      e.preventDefault();
      const edge = 90;
      vy = e.clientY < edge ? -Math.ceil((edge - e.clientY) / 6) : e.clientY > window.innerHeight - edge ? Math.ceil((e.clientY - (window.innerHeight - edge)) / 6) : 0;
      setDrag((live.current = { ...live.current, x: e.clientX, y: e.clientY, over: catAt(e.clientX, e.clientY) }));
    };
    const up = () => {
      const d = live.current;
      live.current = null;
      setDrag(null);
      if (d?.over && d.over !== d.from) drop.current(d.id, d.over);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      live.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    document.body.style.userSelect = "none";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
      document.body.style.userSelect = "";
    };
  }, [!!drag]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (dish: { id: string; name: string; categoryId: string }) => (e: RPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const d = { id: dish.id, name: dish.name, from: dish.categoryId, x: e.clientX, y: e.clientY, over: dish.categoryId };
    live.current = d;
    setDrag(d);
  };
  return { drag, start };
}

/** The handle on each dish row. */
export function DragHandle({ name, onPointerDown }: { name: string; onPointerDown: (e: RPointerEvent) => void }) {
  return (
    <button
      type="button"
      aria-label={`Drag ${name} to another category`}
      title="Drag to another category"
      onPointerDown={onPointerDown}
      className="-ml-2 flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-[10px] text-faint hover:bg-sunken hover:text-ink active:cursor-grabbing"
    >
      <GripVertical size={18} />
    </button>
  );
}

/** The dish following the finger, and where it will land. */
export function DragGhost({ drag, label }: { drag: DishDrag | null; label: (catId: string | null) => string }) {
  if (!drag) return null;
  const moving = drag.over && drag.over !== drag.from;
  return (
    <div className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-[130%]" style={{ left: drag.x, top: drag.y }}>
      <div className="whitespace-nowrap rounded-[14px] bg-ink px-3.5 py-2 text-[14px] font-semibold text-canvas shadow-float">
        {drag.name}
        <span className="block text-[12px] font-medium text-canvas/70">{moving ? `→ ${label(drag.over)}` : "Drop on a category"}</span>
      </div>
    </div>
  );
}
