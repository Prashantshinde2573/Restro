"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, FolderPlus, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, DietMark, Field, Group, Page, PageHeader, Pill, Segmented, LocalSegmented, Sheet, SwitchRow, Toggle, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { categoryActions, menuActions, useCategories, useCurrentOutlet, useFeature, useMenu, useOrders } from "@/lib/live";
import { PhotoSlide } from "@/components/menu-bits";
import { OptionsEditor, PhotoUploader } from "@/components/dish-editor";
import { inr } from "@/lib/format";
import type { Diet, MenuItem, OptionGroup } from "@/lib/types";

// Emoji the owner can give a category — shown in the guest menu side bar.
const CAT_ICONS = ["🍢", "🍛", "🫓", "🍚", "🍨", "🥤", "☕", "🍕", "🍔", "🥪", "🍜", "🥗", "🍰", "🍦", "🥘", "🍳", "🥟", "🍹", "🧁", "🍽️"];

type Draft = {
  name: string;
  price: string;
  categoryId: string;
  diet: Diet;
  station: MenuItem["station"];
  sweet: boolean;
  photos: string[];
  spice: number;
  isNew: boolean;
  tags: string[];
  options: OptionGroup[];
  cost: string; // ₹ per plate (ingredients)
};

type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";
const qMeta: Record<Quadrant, { name: string; hint: string; tone: "jade" | "sky" | "saffron" | "rose" }> = {
  star: { name: "Stars", hint: "Popular and profitable. Keep them visible and consistent.", tone: "jade" },
  plowhorse: { name: "Workhorses", hint: "Popular but thin margin. Nudge price or trim portion cost.", tone: "sky" },
  puzzle: { name: "Hidden gems", hint: "Profitable but few orders. Move up the menu, let captains suggest them.", tone: "saffron" },
  dog: { name: "Rethink", hint: "Low on both. Rework the recipe or drop them.", tone: "rose" },
};

export default function MenuPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"dishes" | "engineering">("dishes");
  const menuRaw = useMenu();
  const orders = useOrders();
  // "sold" = plates in the last 7 days, from real orders
  const items = useMemo(() => {
    const since = Date.now() - 7 * 86_400_000;
    const sold = new Map<string, number>();
    for (const o of orders) {
      if (o.status === "cancelled" || new Date(o.createdAt).getTime() < since) continue;
      for (const l of o.lines) sold.set(l.itemId, (sold.get(l.itemId) ?? 0) + l.qty);
    }
    return menuRaw.map((m) => ({ ...m, soldThisWeek: sold.get(m.id) ?? 0 }));
  }, [menuRaw, orders]);
  const [edit, setEditRaw] = useState<MenuItem | "new" | null>(null);
  const cats = useCategories();
  const cafe = useCurrentOutlet().businessType === "cafe";
  const engineeringOn = useFeature("menuEngineering") === "ok";
  const blank = (catId?: string): Draft => ({ name: "", price: "", categoryId: catId ?? cats[0]?.id ?? "", diet: "veg", station: "kitchen", sweet: false, photos: [], spice: 0, isNew: false, tags: [], options: [], cost: "" });
  const [draft, setDraft] = useState<Draft>(blank());
  const setEdit = (m: MenuItem | "new" | null, catId?: string) => {
    setEditRaw(m);
    const it = m && m !== "new" ? m : null;
    setDraft(
      it
        ? { name: it.name, price: String(it.price), categoryId: it.categoryId, diet: it.diet, station: it.station, sweet: !!it.sweet, photos: it.photos ?? [], spice: it.spice ?? 0, isNew: !!it.isNew, tags: it.tags ?? [], options: it.options ?? [], cost: it.cost ? String(it.cost) : "" }
        : blank(catId),
    );
    setNewCat(null);
  };
  // categories: created here, shown to guests as filters + side bar
  const [catsOpen, setCatsOpen] = useState(false);
  const [newCat, setNewCat] = useState<{ name: string; icon: string } | null>(null);
  const addCategory = (): string | null => {
    if (!newCat?.name.trim()) return null;
    if (cats.some((c) => c.name.toLowerCase() === newCat.name.trim().toLowerCase())) {
      toast("That category already exists");
      return null;
    }
    const c = categoryActions.add(newCat.name, newCat.icon);
    setNewCat(null);
    toast(`“${c.name}” added · guests see it as a filter now`);
    return c.id;
  };
  const priceNum = Number(draft.price);
  const draftOk = draft.name.trim().length > 1 && priceNum > 0 && !!draft.categoryId;

  const avgSold = items.length ? items.reduce((s, m) => s + m.soldThisWeek, 0) / items.length : 0;
  const avgMargin = items.length ? items.reduce((s, m) => s + (m.price - m.cost), 0) / items.length : 0;
  const quadrant = (m: MenuItem): Quadrant => {
    const pop = m.soldThisWeek >= avgSold * 0.7;
    const prof = m.price - m.cost >= avgMargin;
    return pop && prof ? "star" : pop ? "plowhorse" : prof ? "puzzle" : "dog";
  };

  const byQ = useMemo(() => {
    const r: Record<Quadrant, MenuItem[]> = { star: [], plowhorse: [], puzzle: [], dog: [] };
    items.forEach((m) => r[quadrant(m)].push(m));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const maxSold = Math.max(1, ...items.map((m) => m.soldThisWeek));
  const maxMargin = Math.max(1, ...items.map((m) => m.price - m.cost));
  const editing = edit && edit !== "new" ? edit : null;

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${items.length} dishes · ${items.filter((m) => !m.available).length} sold out`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="plain" onClick={() => { setNewCat(null); setCatsOpen(true); }}><FolderPlus size={16} /> Categories</Button>
            <Button size="sm" onClick={() => setEdit("new")}><Plus size={16} /> Add dish</Button>
          </div>
        }
      >
        {engineeringOn && <Segmented value={tab} onChange={setTab} options={[{ value: "dishes", label: "Dishes" }, { value: "engineering", label: "What's working" }]} />}
      </PageHeader>

      <Page>
        {tab === "dishes" || !engineeringOn ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {cats.map((c) => (
              <Group key={c.id} title={`${c.icon ? c.icon + " " : ""}${c.name}`} flush>
                {!items.some((m) => m.categoryId === c.id) && (
                  <button onClick={() => setEdit("new", c.id)} className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-[14px] font-semibold text-jade lg:px-5">
                    <Plus size={16} /> Add the first dish to {c.name}
                  </button>
                )}
                {items.filter((m) => m.categoryId === c.id).map((m) => {
                  const margin = Math.round(((m.price - m.cost) / m.price) * 100);
                  return (
                    <div key={m.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                      <button onClick={() => setEdit(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <PhotoSlide item={m} className="h-11 w-11 shrink-0 rounded-[12px]" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <DietMark diet={m.diet} />
                            <span className={clsx("truncate text-[15px] font-medium", !m.available && "text-muted")}>{m.name}</span>
                          </div>
                          <div className="text-[13px] text-muted tnum">
                            {inr(m.price)}{m.cost > 0 && <> · <span className={margin < 60 ? "text-saffron" : undefined}>{margin}% margin</span></>} · {m.soldThisWeek} sold
                            {m.photos?.length ? ` · ${m.photos.length} photos` : ""}
                          </div>
                        </div>
                      </button>
                      <Toggle
                        label={`${m.name} available`}
                        checked={m.available}
                        onChange={(v) => {
                          menuActions.update(m.id, { available: v });
                          toast(v ? `${m.name} is back on the menu` : `${m.name} marked sold out everywhere`);
                        }}
                      />
                    </div>
                  );
                })}
              </Group>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
{(() => {
              const gem = [...byQ.puzzle].sort((x, y) => (y.price - y.cost) - (x.price - x.cost))[0];
              const star = [...byQ.star].sort((x, y) => y.soldThisWeek - x.soldThisWeek)[0];
              if (!gem && !star) return null;
              return (
                <Group>
                  <div className="flex items-start gap-3">
                    <Sparkles size={18} className="mt-0.5 shrink-0 text-saffron" />
                    <p className="text-[15px] leading-relaxed">
                      {gem && <><b>{gem.name}</b> earns {inr(gem.price - gem.cost)} a plate but sold only {gem.soldThisWeek} this week. Ask captains to suggest it. </>}
                      {star && <><b>{star.name}</b> is your star: {star.soldThisWeek} sold with a good margin. Keep it consistent and easy to find.</>}
                    </p>
                  </div>
                </Group>
              );
            })()}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <Group title="Popularity vs profit, this week" overflowVisible>
                <div className="relative aspect-[4/3] w-full">
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-[14px] bg-line/70">
                    {(["puzzle", "star", "dog", "plowhorse"] as Quadrant[]).map((q) => (
                      <div key={q} className="relative bg-sunken/40 p-2.5">
                        <span className="rounded-full bg-surface/80 px-2 py-0.5 text-[12px] font-semibold text-muted">{qMeta[q].name}</span>
                      </div>
                    ))}
                  </div>
                  {items.map((m) => {
                    const x = (m.soldThisWeek / maxSold) * 92 + 4;
                    const y = 100 - (((m.price - m.cost) / maxMargin) * 88 + 6);
                    const q = quadrant(m);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setEdit(m)}
                        title={`${m.name} · ${m.soldThisWeek} sold · ${inr(m.price - m.cost)} margin`}
                        className={clsx(
                          "group absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition hover:z-20 hover:scale-150 focus-visible:z-20",
                          q === "star" ? "bg-jade" : q === "plowhorse" ? "bg-sky" : q === "puzzle" ? "bg-saffron" : "bg-rose",
                        )}
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <span className="pointer-events-none absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-canvas group-hover:block group-focus-visible:block">{m.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[12px] text-faint">
                  <span>Fewer orders</span>
                  <span>More orders</span>
                </div>
              </Group>

              <div className="space-y-4">
                {(["star", "puzzle", "plowhorse", "dog"] as Quadrant[]).map((q) => (
                  <Group key={q} flush>
                    <div className="px-4 pt-3.5 lg:px-5">
                      <div className="flex items-center justify-between">
                        <Pill tone={qMeta[q].tone}>{qMeta[q].name} · {byQ[q].length}</Pill>
                      </div>
                      <p className="mt-1.5 text-[13px] text-muted">{qMeta[q].hint}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-2.5 lg:px-5">
                      {byQ[q].map((m) => (
                        <button key={m.id} onClick={() => setEdit(m)} className="rounded-full bg-sunken px-2.5 py-1 text-[13px] font-medium hover:bg-line">
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </Group>
                ))}
              </div>
            </div>
          </div>
        )}
      </Page>

      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title={editing ? editing.name : "New dish"}
        footer={
          <Button
            size="lg"
            className="w-full"
            disabled={!draftOk}
            onClick={() => {
              const patch = {
                name: draft.name.trim(),
                price: Math.round(priceNum),
                categoryId: draft.categoryId,
                diet: draft.diet,
                station: draft.station,
                sweet: draft.sweet,
                photos: draft.photos,
                spice: draft.spice as MenuItem["spice"],
                isNew: draft.isNew,
                tags: draft.tags,
                cost: Math.max(0, Math.round(Number(draft.cost) || 0)),
                options: draft.options.filter((g) => g.name && g.choices.some((c) => c.name)).map((g) => ({ ...g, choices: g.choices.filter((c) => c.name) })),
              };
              if (editing) menuActions.update(editing.id, patch);
              else
                menuActions.add({
                  ...patch,
                  id: `m${Date.now()}`,
                  available: true,
                  soldThisWeek: 0,
                  prepMins: 10,
                  hue: Math.floor(Math.random() * 360),
                });
              setEdit(null);
              toast(editing ? "Dish saved · guests see it on the QR menu now" : "Dish added · it's on the guest menu now");
            }}
          >
            {!draftOk ? "Add a name, price and category" : editing ? "Save dish" : "Add dish"}
          </Button>
        }
      >
        <div className="space-y-4">
          <PhotoUploader photos={draft.photos} onChange={(photos) => setDraft({ ...draft, photos })} />
          <Field label="Dish name"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Paneer Tikka" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹, before GST)">
              <input className={inputCls} inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" />
            </Field>
            <Field label="Category">
              <select
                className={inputCls}
                value={newCat ? "__new" : draft.categoryId}
                onChange={(e) => (e.target.value === "__new" ? setNewCat({ name: "", icon: "🍽️" }) : (setNewCat(null), setDraft({ ...draft, categoryId: e.target.value })))}
              >
                {cats.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
                <option value="__new">+ New category…</option>
              </select>
            </Field>
          </div>
          {newCat && (
            <NewCategory
              value={newCat}
              onChange={setNewCat}
              onAdd={() => {
                const id = addCategory();
                if (id) setDraft({ ...draft, categoryId: id });
              }}
              onCancel={() => setNewCat(null)}
            />
          )}
          <Field label="Veg or non-veg">
            <Segmented className="w-full" value={draft.diet} onChange={(diet) => setDraft({ ...draft, diet })} options={[{ value: "veg", label: "Veg" }, { value: "egg", label: "Egg" }, { value: "nonveg", label: "Non-veg" }]} />
          </Field>
          <Field label="Cooked at">
            <Segmented className="w-full" value={draft.station} onChange={(station) => setDraft({ ...draft, station })} options={[{ value: "kitchen", label: "Kitchen" }, ...(cafe ? [] : [{ value: "tandoor" as const, label: "Tandoor" }]), { value: "bar", label: "Bar / drinks" }, { value: "dessert", label: "Desserts" }]} />
          </Field>
          <Field label="How spicy?">
            <Segmented
              className="w-full"
              value={String(draft.spice)}
              onChange={(v) => setDraft({ ...draft, spice: Number(v) })}
              options={[{ value: "0", label: "Not spicy" }, { value: "1", label: "Mild" }, { value: "2", label: "Medium" }, { value: "3", label: "Very spicy" }]}
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
            <div>
              <div className="text-[15px] font-medium">🍬 Sweet</div>
              <div className="text-[12.5px] text-muted">Shows under the guest “Sweet” filter (desserts, shakes, sweet drinks).</div>
            </div>
            <Toggle checked={draft.sweet} onChange={(sweet) => setDraft({ ...draft, sweet })} label="Sweet" />
          </div>
          <Field label="Labels guests see (also the “Specials” filter)">
            <div className="flex flex-wrap gap-2">
              {[["New", draft.isNew], ["Bestseller", draft.tags.includes("Bestseller")], ["Chef special", draft.tags.includes("Chef special")], ["Seasonal", draft.tags.includes("Seasonal")]].map(([l, on]) => (
                <button
                  key={String(l)}
                  aria-pressed={!!on}
                  onClick={() =>
                    l === "New"
                      ? setDraft({ ...draft, isNew: !draft.isNew })
                      : setDraft({ ...draft, tags: on ? draft.tags.filter((t) => t !== l) : [...draft.tags, String(l)] })
                  }
                  className={clsx("rounded-full px-3.5 py-2 text-[14px] font-semibold", on ? "bg-ink text-canvas" : "bg-surface")}
                >
                  {l === "Chef special" ? "Chef's special" : String(l)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Choices for guests (spice, add-ons, size)">
            <OptionsEditor groups={draft.options} onChange={(options) => setDraft({ ...draft, options })} />
          </Field>
          <Field label="Cost per plate (₹)" hint="What the ingredients cost you. Used for margins in “What's working”. Optional.">
            <input className={inputCls} inputMode="decimal" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" />
          </Field>
        </div>
      </Sheet>

      <Sheet open={catsOpen} onClose={() => setCatsOpen(false)} title="Categories">
        <div className="space-y-4">
          <p className="text-[14px] text-muted">Shown to guests as filters and side-bar entries, in this order.</p>
          <div className="overflow-hidden rounded-group bg-surface">
            {cats.map((c, i) => {
              const n = items.filter((m) => m.categoryId === c.id).length;
              return (
                <div key={c.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-2.5 last:border-0">
                  <select
                    aria-label={`Icon for ${c.name}`}
                    value={c.icon ?? ""}
                    onChange={(e) => categoryActions.update(c.id, { icon: e.target.value })}
                    className="h-10 w-14 rounded-[10px] bg-sunken text-center text-[20px] outline-none"
                  >
                    {[...new Set([c.icon ?? "🍽️", ...CAT_ICONS])].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <input
                    aria-label="Category name"
                    value={c.name}
                    onChange={(e) => categoryActions.update(c.id, { name: e.target.value })}
                    className="h-10 min-w-0 flex-1 rounded-[10px] bg-transparent px-2 text-[15px] font-medium outline-none focus:bg-sunken/60"
                  />
                  <span className="text-[13px] text-muted tnum">{n} {n === 1 ? "dish" : "dishes"}</span>
                  <div className="flex">
                    <button aria-label="Move up" disabled={i === 0} onClick={() => categoryActions.move(c.id, -1)} className="p-1.5 text-muted disabled:opacity-30"><ArrowUp size={16} /></button>
                    <button aria-label="Move down" disabled={i === cats.length - 1} onClick={() => categoryActions.move(c.id, 1)} className="p-1.5 text-muted disabled:opacity-30"><ArrowDown size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          {newCat ? (
            <NewCategory value={newCat} onChange={setNewCat} onAdd={addCategory} onCancel={() => setNewCat(null)} />
          ) : (
            <Button variant="tinted" className="w-full" onClick={() => setNewCat({ name: "", icon: "🍽️" })}><Plus size={16} /> New category</Button>
          )}
          <p className="text-[12.5px] text-faint">Examples: Cold drinks, Shakes, Breakfast, Thalis, Pizzas, Combos.</p>
        </div>
      </Sheet>
    </>
  );
}

function NewCategory({
  value,
  onChange,
  onAdd,
  onCancel,
}: {
  value: { name: string; icon: string };
  onChange: (v: { name: string; icon: string }) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="animate-fade-in space-y-3 rounded-group bg-surface p-4">
      <div className="text-[14px] font-semibold">New category</div>
      <div className="flex gap-2">
        <input
          autoFocus
          className={inputCls}
          placeholder="e.g. Cold drinks"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {CAT_ICONS.map((x) => (
          <button key={x} aria-pressed={value.icon === x} onClick={() => onChange({ ...value, icon: x })} className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[20px]", value.icon === x ? "bg-jade-soft ring-2 ring-jade" : "bg-sunken")}>
            {x}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="plain" onClick={onCancel}>Cancel</Button>
        <Button disabled={!value.name.trim()} onClick={onAdd}>Add category</Button>
      </div>
    </div>
  );
}
