"use client";

// Guest menu building blocks: filters (kept in separate groups, never mixed
// into one row), the price slider, the category side bar and one dish row.
// Every filter option comes from the owner's own menu: the categories they
// created, the labels they ticked, the price range of their dishes.

import clsx from "clsx";
import { Flame, Minus, Plus, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, DietMark, Sheet } from "./ui";
import { PhotoSlide } from "./menu-bits";
import { inr } from "@/lib/format";
import type { Category, Diet, MenuItem } from "@/lib/types";

type Lang = "en" | "mr";
const tx = (lang: Lang, en: string, mr: string) => (lang === "mr" ? mr : en);

/* ---------------- filter state ---------------- */
export type Taste = "spicy" | "sweet";
export interface MenuFilters {
  diet: "all" | Diet;
  taste: Taste[];
  specials: string[]; // "New", "Bestseller", "Chef special", "Seasonal"
  cats: string[]; // category ids
  price: [number, number] | null; // null = full range
}
export const noFilters: MenuFilters = { diet: "all", taste: [], specials: [], cats: [], price: null };

export const isSpicy = (m: MenuItem) => (m.spice ?? 0) >= 2;
const specialsOf = (m: MenuItem) => [...(m.isNew ? ["New"] : []), ...(m.tags ?? []).filter((t) => t !== "Spicy")];

/** Nice round bounds for the price slider, from the owner's own prices. */
export function priceBounds(menu: MenuItem[]): [number, number] {
  if (!menu.length) return [0, 500];
  const ps = menu.map((m) => m.price);
  return [Math.floor(Math.min(...ps) / 10) * 10, Math.ceil(Math.max(...ps) / 10) * 10];
}

/** Within a group = any of (OR). Across groups = all of (AND). */
export function applyFilters(menu: MenuItem[], f: MenuFilters, term: string, cats: Category[]) {
  const q = term.trim().toLowerCase();
  const catName = new Map(cats.map((c) => [c.id, c.name.toLowerCase()]));
  return menu.filter((m) => {
    if (f.diet !== "all" && m.diet !== f.diet) return false;
    if (f.taste.length && !f.taste.some((t) => (t === "spicy" ? isSpicy(m) : !!m.sweet))) return false;
    if (f.specials.length && !specialsOf(m).some((s) => f.specials.includes(s))) return false;
    if (f.cats.length && !f.cats.includes(m.categoryId)) return false;
    if (f.price && (m.price < f.price[0] || m.price > f.price[1])) return false;
    if (q && !`${m.name} ${m.desc ?? ""} ${catName.get(m.categoryId) ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Count of filters applied from the Filters sheet (diet has its own control). */
export const sheetFilterCount = (f: MenuFilters) => (f.diet !== "all" ? 1 : 0) + f.taste.length + f.specials.length + f.cats.length + (f.price ? 1 : 0);

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const specialLabel = (s: string, lang: Lang) =>
  s === "Chef special" ? tx(lang, "Chef's special", "शेफ स्पेशल") : s === "Bestseller" ? tx(lang, "Bestseller", "बेस्टसेलर") : s === "New" ? tx(lang, "New", "नवीन") : s === "Seasonal" ? tx(lang, "Seasonal", "सीझनल") : s;

/* ---------------- diet switch (always visible) ---------------- */
export function DietSwitch({ value, onChange, menu, lang }: { value: MenuFilters["diet"]; onChange: (d: MenuFilters["diet"]) => void; menu: MenuItem[]; lang: Lang }) {
  const has = (d: Diet) => menu.some((m) => m.diet === d);
  const opts: { v: MenuFilters["diet"]; label: string }[] = [
    { v: "all", label: tx(lang, "All", "सर्व") },
    ...(has("veg") ? [{ v: "veg" as const, label: tx(lang, "Veg", "व्हेज") }] : []),
    ...(has("nonveg") ? [{ v: "nonveg" as const, label: tx(lang, "Non-veg", "नॉन-व्हेज") }] : []),
    ...(has("egg") ? [{ v: "egg" as const, label: tx(lang, "Egg", "अंडा") }] : []),
  ];
  return (
    <div className="flex rounded-ctl bg-surface p-[3px]" role="radiogroup" aria-label={tx(lang, "Veg or non-veg", "व्हेज / नॉन-व्हेज")}>
      {opts.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={clsx(
            "flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[13.5px] font-semibold transition",
            value === o.v ? (o.v === "veg" ? "bg-jade text-white" : o.v === "nonveg" ? "bg-rose text-white" : o.v === "egg" ? "bg-saffron text-white" : "bg-ink text-canvas") : "text-muted",
          )}
        >
          {o.v !== "all" && <span className={clsx("inline-block h-2 w-2 rounded-full", value === o.v ? "bg-white" : o.v === "veg" ? "bg-jade" : o.v === "nonveg" ? "bg-rose" : "bg-saffron")} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- active filter pills (removable) ---------------- */
export function ActiveFilters({ f, setF, cats, lang }: { f: MenuFilters; setF: (f: MenuFilters) => void; cats: Category[]; lang: Lang }) {
  const dietLabel = f.diet === "veg" ? tx(lang, "Veg", "व्हेज") : f.diet === "nonveg" ? tx(lang, "Non-veg", "नॉन-व्हेज") : tx(lang, "Egg", "अंडा");
  const pills: { key: string; label: string; remove: () => void }[] = [
    ...(f.diet !== "all" ? [{ key: "diet", label: dietLabel, remove: () => setF({ ...f, diet: "all" }) }] : []),
    ...f.taste.map((t) => ({ key: t, label: t === "spicy" ? tx(lang, "🌶 Spicy", "🌶 तिखट") : tx(lang, "🍬 Sweet", "🍬 गोड"), remove: () => setF({ ...f, taste: f.taste.filter((x) => x !== t) }) })),
    ...(f.price ? [{ key: "price", label: `${inr(f.price[0])} – ${inr(f.price[1])}`, remove: () => setF({ ...f, price: null }) }] : []),
    ...f.specials.map((s) => ({ key: s, label: specialLabel(s, lang), remove: () => setF({ ...f, specials: f.specials.filter((x) => x !== s) }) })),
    ...f.cats.map((id) => {
      const c = cats.find((x) => x.id === id);
      return { key: id, label: `${c?.icon ?? ""} ${c?.name ?? id}`.trim(), remove: () => setF({ ...f, cats: f.cats.filter((x) => x !== id) }) };
    }),
  ];
  if (!pills.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {pills.map((p) => (
        <button key={p.key} onClick={p.remove} className="flex shrink-0 items-center gap-1 rounded-full bg-jade-soft py-1 pl-3 pr-2 text-[13px] font-semibold text-jade-deep">
          {p.label} <X size={13} />
        </button>
      ))}
      <button onClick={() => setF({ ...noFilters })} className="shrink-0 px-2 text-[13px] font-semibold text-muted">
        {tx(lang, "Clear", "काढा")}
      </button>
    </div>
  );
}

/* ---------------- price slider (min – max) ---------------- */
export function PriceRange({ bounds, value, onChange, lang }: { bounds: [number, number]; value: [number, number]; onChange: (v: [number, number]) => void; lang: Lang }) {
  const [lo, hi] = bounds;
  const span = Math.max(1, hi - lo);
  const step = span > 600 ? 20 : 10;
  const left = ((value[0] - lo) / span) * 100;
  const right = ((value[1] - lo) / span) * 100;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[15px] font-semibold tnum">
        <span className="rounded-ctl bg-sunken px-3 py-1.5">{inr(value[0])}</span>
        <span className="text-[13px] font-medium text-muted">{tx(lang, "to", "ते")}</span>
        <span className="rounded-ctl bg-sunken px-3 py-1.5">{inr(value[1])}</span>
      </div>
      <div className="range-dual">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sunken" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-jade" style={{ left: `${left}%`, right: `${100 - right}%` }} />
        <input
          type="range"
          aria-label={tx(lang, "Lowest price", "किमान किंमत")}
          min={lo}
          max={hi}
          step={step}
          value={value[0]}
          onChange={(e) => onChange([Math.min(Number(e.target.value), value[1] - step), value[1]])}
        />
        <input
          type="range"
          aria-label={tx(lang, "Highest price", "कमाल किंमत")}
          min={lo}
          max={hi}
          step={step}
          value={value[1]}
          onChange={(e) => onChange([value[0], Math.max(Number(e.target.value), value[0] + step)])}
        />
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-faint tnum">
        <span>{inr(lo)}</span>
        <span>{inr(hi)}</span>
      </div>
    </div>
  );
}

/* ---------------- the Filters sheet ---------------- */
function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-group bg-surface p-4">
      <div className="mb-3">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-pressed={on} onClick={onClick} className={clsx("flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold transition", on ? "bg-ink text-canvas" : "bg-sunken text-ink")}>
      {children}
    </button>
  );
}

export function FilterSheet({
  open,
  onClose,
  value,
  onApply,
  menu,
  cats,
  term,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  value: MenuFilters;
  onApply: (f: MenuFilters) => void;
  menu: MenuItem[];
  cats: Category[];
  term: string;
  lang: Lang;
}) {
  const [f, setF] = useState<MenuFilters>(value);
  useEffect(() => {
    if (open) setF(value);
  }, [open, value]);
  const bounds = useMemo(() => priceBounds(menu), [menu]);
  const shown = applyFilters(menu, f, term, cats).length;
  const specials = useMemo(() => ["Bestseller", "Chef special", "New", "Seasonal"].filter((s) => menu.some((m) => specialsOf(m).includes(s))), [menu]);
  const hasSweet = menu.some((m) => m.sweet);
  const hasSpicy = menu.some(isSpicy);
  const catCount = (id: string) => menu.filter((m) => m.categoryId === id).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tx(lang, "Filters", "फिल्टर")}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button size="lg" variant="plain" onClick={() => setF({ ...noFilters })}>{tx(lang, "Clear all", "सर्व काढा")}</Button>
          <Button size="lg" disabled={shown === 0} onClick={() => { onApply(f); onClose(); }}>
            {shown === 0 ? tx(lang, "No dishes match", "काही सापडलं नाही") : tx(lang, `Show ${shown} dishes`, `${shown} डिश दाखवा`)}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Group title={tx(lang, "Veg or non-veg", "व्हेज / नॉन-व्हेज")}>
          <DietSwitch value={f.diet} onChange={(diet) => setF({ ...f, diet })} menu={menu} lang={lang} />
        </Group>

        {(hasSpicy || hasSweet) && (
          <Group title={tx(lang, "Taste", "चव")}>
            <div className="flex flex-wrap gap-2">
              {hasSpicy && <Choice on={f.taste.includes("spicy")} onClick={() => setF({ ...f, taste: toggle(f.taste, "spicy") })}><Flame size={15} /> {tx(lang, "Spicy", "तिखट")}</Choice>}
              {hasSweet && <Choice on={f.taste.includes("sweet")} onClick={() => setF({ ...f, taste: toggle(f.taste, "sweet") })}>🍬 {tx(lang, "Sweet", "गोड")}</Choice>}
            </div>
          </Group>
        )}

        <Group title={tx(lang, "Price", "किंमत")} hint={tx(lang, "Before GST, per dish", "GST आधी, प्रति डिश")}>
          <PriceRange bounds={bounds} value={f.price ?? bounds} onChange={(p) => setF({ ...f, price: p[0] === bounds[0] && p[1] === bounds[1] ? null : p })} lang={lang} />
        </Group>

        {specials.length > 0 && (
          <Group title={tx(lang, "Specials", "स्पेशल")}>
            <div className="flex flex-wrap gap-2">
              {specials.map((s) => (
                <Choice key={s} on={f.specials.includes(s)} onClick={() => setF({ ...f, specials: toggle(f.specials, s) })}>
                  {s === "New" ? <Sparkles size={14} /> : null} {specialLabel(s, lang)}
                </Choice>
              ))}
            </div>
          </Group>
        )}

        <Group title={tx(lang, "Categories", "प्रकार")} hint={tx(lang, "Pick one or more", "एक किंवा जास्त निवडा")}>
          <div className="flex flex-wrap gap-2">
            {cats.filter((c) => catCount(c.id) > 0).map((c) => (
              <Choice key={c.id} on={f.cats.includes(c.id)} onClick={() => setF({ ...f, cats: toggle(f.cats, c.id) })}>
                {c.icon && <span>{c.icon}</span>} {c.name} <span className="font-normal opacity-60 tnum">{catCount(c.id)}</span>
              </Choice>
            ))}
          </div>
        </Group>
      </div>
    </Sheet>
  );
}

export function FilterButton({ count, onClick, lang }: { count: number; onClick: () => void; lang: Lang }) {
  return (
    <button onClick={onClick} className={clsx("relative flex h-11 shrink-0 items-center gap-1.5 rounded-ctl px-3.5 text-[14px] font-semibold", count ? "bg-ink text-canvas" : "bg-surface text-ink")}>
      <SlidersHorizontal size={16} /> {tx(lang, "Filters", "फिल्टर")}
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-jade px-1 text-[11.5px] font-bold text-white tnum">{count}</span>}
    </button>
  );
}

/* ---------------- category side bar (right side) ---------------- */
export function CategoryRail({ groups, active, onPick, lang }: { groups: { c: Category; n: number }[]; active: string | null; onPick: (id: string) => void; lang: Lang }) {
  const railRef = useRef<HTMLElement>(null);
  // keep the active category visible inside the rail
  useEffect(() => {
    if (!active) return;
    railRef.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);
  return (
    <nav ref={railRef} aria-label={tx(lang, "Menu categories", "मेनू प्रकार")} className="no-scrollbar flex max-h-full flex-col gap-0.5 overflow-y-auto rounded-[18px] bg-surface p-1 pb-5 [mask-image:linear-gradient(to_bottom,black_calc(100%-22px),transparent)]">
      {groups.map(({ c, n }) => {
        const on = active === c.id;
        return (
          <button
            key={c.id}
            data-cat={c.id}
            onClick={() => onPick(c.id)}
            aria-current={on ? "true" : undefined}
            className={clsx("relative flex flex-col items-center gap-0.5 rounded-[14px] px-1 py-1.5 text-center transition", on ? "bg-jade-soft" : "lg:hover:bg-sunken/60")}
          >
            {on && <span className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-jade" aria-hidden />}
            <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full text-[17px]", on ? "bg-jade text-white" : "bg-sunken")}>{c.icon ?? c.name[0]}</span>
            <span className={clsx("w-full break-words text-[11px] font-semibold leading-[1.2]", on ? "text-jade-deep" : "text-ink")}>{c.name}</span>
            <span className="text-[10.5px] leading-none text-faint tnum">{n}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------- one dish (grid card) ---------------- */
// First look stays simple: photo, veg/non-veg mark, name, price. Description,
// spice, labels and choices open when the guest taps the dish.
export function DishCard({
  m,
  qty,
  onOpen,
  onAdd,
  onLess,
  lang,
  readOnly,
}: {
  m: MenuItem;
  qty: number;
  onOpen: () => void;
  onAdd: () => void;
  onLess: () => void;
  lang: Lang;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] bg-surface">
      <button onClick={onOpen} aria-label={`Open ${m.name}`} className="block">
        <PhotoSlide item={m} className="aspect-square w-full" />
      </button>
      <div className="flex flex-1 flex-col p-2.5">
        <button onClick={onOpen} className="flex items-start gap-1.5 text-left">
          <span className="mt-[3px] shrink-0"><DietMark diet={m.diet} /></span>
          <span className="line-clamp-2 min-h-[2.5em] text-[14px] font-semibold leading-[1.25]">{m.name}</span>
        </button>
        <div className="mt-1.5 text-[14px] font-semibold tnum">{inr(m.price)}</div>
        {!readOnly && (
          <div className="mt-2">
            {qty === 0 ? (
              <button onClick={onAdd} className="h-9 w-full rounded-[10px] border border-jade/30 bg-jade-soft text-[13.5px] font-bold text-jade">
                {tx(lang, "ADD", "जोडा")}
              </button>
            ) : (
              <div className="flex h-9 w-full items-center justify-between rounded-[10px] bg-jade px-1 text-white">
                <button aria-label="Less" onClick={onLess} className="flex h-8 w-8 items-center justify-center"><Minus size={15} /></button>
                <span className="text-[14px] font-bold tnum">{qty}</span>
                <button aria-label="More" onClick={onAdd} className="flex h-8 w-8 items-center justify-center"><Plus size={15} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- one dish (list row) ---------------- */
// One dish per row: veg/non-veg mark, name and price on the left; photo with
// the ADD button on the right. Details open on tap.
export function DishRow({
  m,
  qty,
  onOpen,
  onAdd,
  onLess,
  lang,
  readOnly,
}: {
  m: MenuItem;
  qty: number;
  onOpen: () => void;
  onAdd: () => void;
  onLess: () => void;
  lang: Lang;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line/80 px-3.5 py-3 last:border-0">
      <button onClick={onOpen} className="min-w-0 flex-1 self-stretch text-left">
        <span className="flex h-full flex-col justify-center">
          <DietMark diet={m.diet} />
          <span className="mt-1.5 line-clamp-2 text-[15.5px] font-semibold leading-snug">{m.name}</span>
          <span className="mt-1 text-[14.5px] font-semibold tnum">{inr(m.price)}</span>
        </span>
      </button>
      <div className={clsx("relative w-[92px] shrink-0", !readOnly && "pb-4")}>
        <button onClick={onOpen} aria-label={`Open ${m.name}`} className="block overflow-hidden rounded-[14px]">
          <PhotoSlide item={m} className="aspect-square w-[92px]" />
        </button>
        {!readOnly && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            {qty === 0 ? (
              <button onClick={onAdd} className="h-8 w-[80px] rounded-[10px] border border-line bg-surface text-[13.5px] font-bold text-jade shadow-float">{tx(lang, "ADD", "जोडा")}</button>
            ) : (
              <div className="flex h-8 w-[80px] items-center justify-between rounded-[10px] bg-jade px-1 text-white shadow-float">
                <button aria-label="Less" onClick={onLess} className="flex h-7 w-7 items-center justify-center"><Minus size={14} /></button>
                <span className="text-[14px] font-bold tnum">{qty}</span>
                <button aria-label="More" onClick={onAdd} className="flex h-7 w-7 items-center justify-center"><Plus size={14} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
