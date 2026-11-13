"use client";

// Guest menu building blocks: filters (kept in separate groups, never mixed
// into one row), the price slider, ALL/VEG/NON-VEG, category chips, the dish
// card and the bottom tabs.
// Every filter option comes from the owner's own menu: the categories they
// created, the labels they ticked, the price range of their dishes.

import { fromPrice, hasSizes } from "@/lib/sizes";
import { tx, type GuestLang as Lang } from "@/lib/guest-lang";
import clsx from "clsx";
import { BellRing, Check, ChevronDown, ClipboardList, Flame, House, LayoutGrid, Minus, Plus, ShoppingCart, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, DietMark, Sheet } from "./ui";
import { PhotoSlide } from "./menu-bits";
import { inr } from "@/lib/format";
import type { Category, Diet, MenuItem } from "@/lib/types";


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
    if (f.diet === "veg" && m.diet !== "veg") return false;
    if (f.diet === "nonveg" && m.diet === "veg") return false; // egg dishes show under NON-VEG
    if (f.diet === "egg" && m.diet !== "egg") return false;
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
    <button aria-pressed={on} onClick={onClick} className={clsx("flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-semibold transition", on ? "border-jade/40 bg-jade-soft text-jade-deep" : "border-transparent bg-sunken text-ink")}>
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tx(lang, "Filters", "फिल्टर")}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button size="lg" variant="plain" onClick={() => setF({ ...noFilters, diet: f.diet })}>{tx(lang, "Clear all", "सर्व काढा")}</Button>
          <Button size="lg" disabled={shown === 0} onClick={() => { onApply(f); onClose(); }}>
            {shown === 0 ? tx(lang, "No dishes match", "काही सापडलं नाही") : tx(lang, `Show ${shown} dishes`, `${shown} डिश दाखवा`)}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Group title={tx(lang, "Price", "किंमत")} hint={tx(lang, "Before GST, per dish", "GST आधी, प्रति डिश")}>
          <PriceRange bounds={bounds} value={f.price ?? bounds} onChange={(p) => setF({ ...f, price: p[0] === bounds[0] && p[1] === bounds[1] ? null : p })} lang={lang} />
        </Group>

        {(specials.length > 0 || hasSpicy || hasSweet) && (
          <Group title={tx(lang, "Show only", "फक्त हे दाखवा")}>
            <div className="flex flex-wrap gap-2">
              {specials.map((s) => (
                <Choice key={s} on={f.specials.includes(s)} onClick={() => setF({ ...f, specials: toggle(f.specials, s) })}>
                  {s === "New" ? <Sparkles size={14} /> : null} {specialLabel(s, lang)}
                </Choice>
              ))}
              {hasSpicy && <Choice on={f.taste.includes("spicy")} onClick={() => setF({ ...f, taste: toggle(f.taste, "spicy") })}><Flame size={15} /> {tx(lang, "Spicy", "तिखट")}</Choice>}
              {hasSweet && <Choice on={f.taste.includes("sweet")} onClick={() => setF({ ...f, taste: toggle(f.taste, "sweet") })}>🍬 {tx(lang, "Sweet", "गोड")}</Choice>}
            </div>
          </Group>
        )}
      </div>
    </Sheet>
  );
}

export function FilterButton({ count, onClick, lang }: { count: number; onClick: () => void; lang: Lang }) {
  return (
    <button onClick={onClick} className={clsx("relative flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold", count ? "border-jade/40 bg-jade-soft text-jade-deep" : "border-line bg-surface text-ink")}>
      <SlidersHorizontal size={16} /> {tx(lang, "Filters", "फिल्टर")}
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-jade px-1 text-[11.5px] font-bold text-white tnum">{count}</span>}
    </button>
  );
}

/* ---------------- one row: diet ▾ · category ▾ · filters ---------------- */
// Our own dropdown (the phone's picker is a big dark sheet).
type DropOption = { value: string; label: string; dot?: "veg" | "nonveg" };
function Drop({ label, value, options, onChange }: { label: string; value: string; options: DropOption[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cur = options.find((o) => o.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    // keep the picked one in view
    box.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const dot = (d?: DropOption["dot"]) => d && <span className={clsx("h-2 w-2 shrink-0 rounded-full", d === "veg" ? "bg-jade" : "bg-rose")} />;
  return (
    <div ref={box} className="relative min-w-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={clsx("flex h-10 w-full min-w-0 items-center gap-2 rounded-full border bg-surface pl-3.5 pr-3 text-left text-[13.5px] font-semibold transition-colors", open ? "border-jade/40" : "border-line")}
      >
        {dot(cur?.dot)}
        <span className="min-w-0 flex-1 truncate">{cur?.label}</span>
        <ChevronDown size={16} className={clsx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute left-0 top-full z-40 mt-1.5 max-h-[55vh] w-max min-w-full max-w-[78vw] animate-pop overflow-y-auto rounded-[16px] border border-line bg-surface p-1 shadow-[0_14px_34px_-14px_rgb(16_24_20/.28)]">
          {options.map((o) => {
            const on = o.value === cur?.value;
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={clsx("flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[14px]", on ? "bg-jade-soft font-semibold text-jade-deep" : "font-medium text-ink active:bg-sunken")}
                >
                  {dot(o.dot)}
                  <span className="min-w-0 flex-1">{o.label}</span>
                  {on && <Check size={16} className="shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MenuBar({
  diet,
  onDiet,
  menu,
  groups,
  active,
  onPick,
  filterCount,
  onFilters,
  lang,
}: {
  diet: MenuFilters["diet"];
  onDiet: (d: MenuFilters["diet"]) => void;
  menu: MenuItem[];
  groups: { c: Category; n: number }[];
  active: string | null;
  onPick: (id: string) => void;
  filterCount: number;
  onFilters: () => void;
  lang: Lang;
}) {
  const mixed = menu.some((m) => m.diet !== "veg");
  return (
    <div className="flex items-center gap-2">
      {mixed && (
        <div className="w-[118px] shrink-0">
          <Drop
            label={tx(lang, "Veg or non-veg", "व्हेज / नॉन-व्हेज")}
            value={diet === "egg" ? "nonveg" : diet}
            onChange={(v) => onDiet(v as MenuFilters["diet"])}
            options={[
              { value: "all", label: tx(lang, "All", "सर्व") },
              { value: "veg", label: tx(lang, "Veg", "व्हेज"), dot: "veg" },
              { value: "nonveg", label: tx(lang, "Non-veg", "नॉन-व्हेज"), dot: "nonveg" },
            ]}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Drop
          label={tx(lang, "Menu categories", "मेनू प्रकार")}
          value={active && groups.some((g) => g.c.id === active) ? active : groups[0]?.c.id ?? ""}
          onChange={onPick}
          options={groups.map(({ c, n }) => ({ value: c.id, label: `${c.icon ? `${c.icon} ` : ""}${c.name} (${n})` }))}
        />
      </div>
      <button
        onClick={onFilters}
        aria-label={tx(lang, "Filters", "फिल्टर")}
        className={clsx("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", filterCount ? "border-jade/40 bg-jade-soft text-jade-deep" : "border-line bg-surface text-ink")}
      >
        <SlidersHorizontal size={17} />
        {filterCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white tnum">{filterCount}</span>}
      </button>
    </div>
  );
}

/* ---------------- one dish (grid card) ---------------- */
// Photo on top, veg mark, name, one line about it, price and a round + button.
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
  const badge = m.tags?.includes("Bestseller") ? tx(lang, "Bestseller", "बेस्टसेलर") : m.isNew ? tx(lang, "New", "नवीन") : m.tags?.includes("Chef special") ? tx(lang, "Chef's special", "शेफ स्पेशल") : null;
  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] bg-surface ring-1 ring-line/70">
      <button onClick={onOpen} aria-label={`Open ${m.name}`} className="relative block">
        <PhotoSlide item={m} className="aspect-[4/3] w-full" />
        {badge && <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-ink backdrop-blur">{badge}</span>}
      </button>
      <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2">
        <button onClick={onOpen} className="flex flex-1 flex-col items-start justify-start text-left">
          <span className="flex items-center gap-1.5">
            <DietMark diet={m.diet} />
            {isSpicy(m) && <span className="text-[11px]" aria-label="Spicy">🌶</span>}
          </span>
          <span className="mt-1 line-clamp-2 text-[14px] font-bold leading-snug tracking-tight">{m.name}</span>
          {m.desc && <span className="mt-0.5 line-clamp-1 text-[12px] text-muted">{m.desc}</span>}
        </button>
        <div className="mt-2 flex min-h-8 items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-jade-deep tnum">{hasSizes(m) && <span className="mr-0.5 text-[11.5px] font-semibold text-muted">{tx(lang, "from", "पासून")}</span>}{inr(fromPrice(m))}</span>
          {!readOnly &&
            (qty === 0 ? (
              <button onClick={onAdd} aria-label={tx(lang, `Add ${m.name}`, `${m.name} जोडा`)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jade-soft text-jade-deep transition active:scale-90">
                <Plus size={17} strokeWidth={2.4} />
              </button>
            ) : (
              <div className="flex h-8 shrink-0 items-center rounded-full bg-jade-deep text-white">
                <button aria-label={`One less ${m.name}`} onClick={onLess} className="flex h-8 w-7 items-center justify-center"><Minus size={14} strokeWidth={2.4} /></button>
                <span className="min-w-3 text-center text-[13.5px] font-bold tnum">{qty}</span>
                <button aria-label={`One more ${m.name}`} onClick={onAdd} className="flex h-8 w-7 items-center justify-center"><Plus size={14} strokeWidth={2.4} /></button>
              </div>
            ))}
        </div>
        {!readOnly && m.options?.length ? <span className="mt-0.5 text-[10.5px] text-faint">{tx(lang, "Customisable", "बदल करता येतात")}</span> : null}
      </div>
    </div>
  );
}

/* ---------------- bottom tabs: Home · Menu · Cart · Orders ---------------- */
export type GuestTab = "home" | "menu" | "cart" | "orders";
export function GuestTabs({
  tab,
  onTab,
  cartCount,
  ordersBadge,
  showCart,
  waiter,
  onWaiter,
  lang,
}: {
  tab: GuestTab;
  onTab: (t: GuestTab) => void;
  cartCount: number;
  ordersBadge: number;
  showCart: boolean;
  /** table orders: call a waiter (null hides it on the counter QR) */
  waiter: "idle" | "open" | "taken" | null;
  onWaiter: () => void;
  lang: Lang;
}) {
  const items: { id: GuestTab; label: string; icon: ReactNode; badge?: number }[] = [
    { id: "home", label: tx(lang, "Home", "होम"), icon: <House size={21} strokeWidth={tab === "home" ? 2.4 : 1.8} fill={tab === "home" ? "currentColor" : "none"} /> },
    { id: "menu", label: tx(lang, "Menu", "मेनू"), icon: <LayoutGrid size={21} strokeWidth={tab === "menu" ? 2.4 : 1.8} /> },
    ...(showCart ? [{ id: "cart" as const, label: tx(lang, "Cart", "कार्ट"), icon: <ShoppingCart size={21} strokeWidth={tab === "cart" ? 2.4 : 1.8} />, badge: cartCount }] : []),
    { id: "orders", label: tx(lang, "Orders", "ऑर्डर्स"), icon: <ClipboardList size={21} strokeWidth={tab === "orders" ? 2.4 : 1.8} />, badge: ordersBadge },
  ];
  return (
    <nav aria-label={tx(lang, "Sections", "विभाग")} className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md rounded-t-[20px] border-t border-line bg-surface [--safe-pb:4px] sm:max-w-2xl">
      <div className="mx-auto flex h-14 max-w-[420px] px-2">
        {items.map((it) => {
          const on = tab === it.id;
          return (
            <button key={it.id} onClick={() => onTab(it.id)} aria-current={on ? "page" : undefined} className={clsx("relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11.5px]", on ? "font-bold text-jade-deep" : "font-medium text-ink/80")}>
              <span className="relative">
                {it.icon}
                {!!it.badge && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[10px] font-bold text-white tnum">{it.badge}</span>
                )}
              </span>
              {it.label}
            </button>
          );
        })}
        {waiter !== null && (
          <button
            onClick={onWaiter}
            aria-label={waiter === "open" ? tx(lang, "Cancel waiter call", "वेटर कॉल रद्द करा") : tx(lang, "Call a waiter", "वेटरला बोलवा")}
            className={clsx("relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11.5px]", waiter === "idle" ? "font-medium text-ink/80" : waiter === "open" ? "font-bold text-saffron" : "font-bold text-jade-deep")}
          >
            <BellRing size={21} strokeWidth={waiter === "idle" ? 1.8 : 2.4} className={clsx(waiter === "open" && "animate-pulse")} />
            {waiter === "open" ? tx(lang, "Calling…", "बोलावत आहे…") : waiter === "taken" ? tx(lang, "Coming", "येत आहे") : tx(lang, "Waiter", "वेटर")}
          </button>
        )}
      </div>
    </nav>
  );
}
