"use client";

import { hasTables } from "@/lib/access";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Camera, FolderPlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, DietMark, Field, Group, Page, PageHeader, Pill, Segmented, Sheet, Toggle, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { categoryActions, menuActions, useCategories, useCurrentOutlet, useFeature, useMenu, useOrders } from "@/lib/live";
import { PhotoSlide } from "@/components/menu-bits";
import { DragGhost, DragHandle, useDishDrag } from "@/components/dish-drag";
import { MenuFromPhoto } from "@/components/menu-import";
import { OptionsEditor, PhotoUploader, SizesEditor } from "@/components/dish-editor";
import { hasSizes, sizesOf } from "@/lib/sizes";
import { inr } from "@/lib/format";
import type { Diet, MenuItem, OptionGroup, Size } from "@/lib/types";

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
  sizes: Size[];
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
  // edit / delete a category
  const [catEdit, setCatEdit] = useState<{ id: string; name: string; icon: string } | null>(null);
  const [catDel, setCatDel] = useState<{ id: string; dishes: string } | null>(null); // dishes: another category id, or "delete"
  const askDelete = (id: string) => {
    setCatEdit(null);
    setCatDel({ id, dishes: cats.find((x) => x.id !== id)?.id ?? "delete" });
  };
  const cafe = !hasTables(useCurrentOutlet()); // counter-only café: no tandoor
  const engineeringOn = useFeature("menuEngineering") === "ok";
  const blank = (catId?: string): Draft => ({ name: "", price: "", categoryId: catId ?? cats[0]?.id ?? "", diet: "veg", station: "kitchen", sweet: false, photos: [], spice: 0, isNew: false, tags: [], options: [], sizes: [], cost: "" });
  const [draft, setDraft] = useState<Draft>(blank());
  const setEdit = (m: MenuItem | "new" | null, catId?: string) => {
    setEditRaw(m);
    const it = m && m !== "new" ? m : null;
    setDraft(
      it
        ? { name: it.name, price: String(it.price), categoryId: it.categoryId, diet: it.diet, station: it.station, sweet: !!it.sweet, photos: it.photos ?? [], spice: it.spice ?? 0, isNew: !!it.isNew, tags: it.tags ?? [], options: it.options ?? [], sizes: it.sizes ?? [], cost: it.cost ? String(it.cost) : "" }
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
  // sizes: at least two, each with a name and a price; the dish's price is then the smallest
  const sizes = draft.sizes.filter((z) => z.name.trim() && z.price > 0).map((z) => ({ ...z, name: z.name.trim() }));
  const sized = sizes.length > 1;
  const sizesBad = draft.sizes.length > 0 && (draft.sizes.length < 2 || sizes.length !== draft.sizes.length);
  const priceNum = sized ? Math.min(...sizes.map((z) => z.price)) : Number(draft.price);
  const draftOk = draft.name.trim().length > 1 && priceNum > 0 && !!draft.categoryId && !sizesBad;

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

  const editing = edit && edit !== "new" ? edit : null;
  const [fromPhoto, setFromPhoto] = useState(false);
  // drag a dish onto another category
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "";
  const { drag, start: startDrag } = useDishDrag((dishId, toCat) => {
    const m = items.find((x) => x.id === dishId);
    menuActions.update(dishId, { categoryId: toCat });
    toast(`${m?.name ?? "Dish"} moved to ${catName(toCat)}`);
  });

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${items.length} dishes · ${items.filter((m) => !m.available).length} sold out`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="plain" aria-label="Categories" onClick={() => { setNewCat(null); setCatsOpen(true); }}><FolderPlus size={16} /><span className="hidden sm:inline">Categories</span></Button>
            <Button size="sm" variant="tinted" onClick={() => setFromPhoto(true)}><Camera size={16} /> <span className="hidden sm:inline">From</span> photo</Button>
            <Button size="sm" onClick={() => setEdit("new")}><Plus size={16} /> Add dish</Button>
          </div>
        }
      >
        {engineeringOn && <Segmented value={tab} onChange={setTab} options={[{ value: "dishes", label: "Dishes" }, { value: "engineering", label: "What's working" }]} />}
      </PageHeader>
      <MenuFromPhoto open={fromPhoto} onClose={() => setFromPhoto(false)} />

      <Page>
        {tab === "dishes" || !engineeringOn ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {cats.map((c) => (
              <div
                key={c.id}
                data-drop-cat={c.id}
                className={clsx("rounded-[24px] transition", drag && drag.over === c.id && drag.from !== c.id && "bg-jade-soft/60 ring-2 ring-jade ring-offset-4 ring-offset-canvas")}
              >
              <Group
                title={`${c.icon ? c.icon + " " : ""}${c.name}`}
                action={<button onClick={() => setCatEdit({ id: c.id, name: c.name, icon: c.icon || "🍽️" })} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold text-muted hover:bg-surface hover:text-ink"><Pencil size={13} /> Edit</button>}
                flush
              >
                {!items.some((m) => m.categoryId === c.id) && (
                  <button onClick={() => setEdit("new", c.id)} className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-[14px] font-semibold text-jade lg:px-5">
                    <Plus size={16} /> Add the first dish to {c.name}
                  </button>
                )}
                {items.filter((m) => m.categoryId === c.id).map((m) => {
                  const margin = Math.round(((m.price - m.cost) / m.price) * 100);
                  return (
                    <div key={m.id} className={clsx("flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5", drag?.id === m.id && "opacity-40")}>
                      <DragHandle name={m.name} onPointerDown={startDrag(m)} />
                      <button onClick={() => setEdit(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <PhotoSlide item={m} className="h-11 w-11 shrink-0 rounded-[12px]" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <DietMark diet={m.diet} />
                            <span className={clsx("truncate text-[15px] font-medium", !m.available && "text-muted")}>{m.name}</span>
                          </div>
                          <div className="text-[13px] text-muted tnum">
                            {hasSizes(m) ? `${sizesOf(m).map((z) => `${z.name} ${inr(z.price)}`).join(" · ")}` : inr(m.price)}{m.cost > 0 && <> · <span className={margin < 60 ? "text-saffron" : undefined}>{margin}% margin</span></>} · {m.soldThisWeek} sold
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
              </div>
            ))}
            <DragGhost drag={drag} label={catName} />
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
              <EarnedChart items={items} quadrant={quadrant} onOpen={setEdit} />

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
                sizes: sized ? sizes : [],
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
            {sizesBad ? "Give every size a name and price" : !draftOk ? "Add a name, price and category" : editing ? "Save dish" : "Add dish"}
          </Button>
        }
      >
        <div className="space-y-4">
          <PhotoUploader photos={draft.photos} onChange={(photos) => setDraft({ ...draft, photos })} />
          <Field label="Dish name"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Paneer Tikka" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹, before GST)">
              {sized ? (
                <div className="flex h-12 items-center rounded-ctl bg-sunken/60 px-4 text-[15px] text-muted">from ₹{priceNum} · sizes below</div>
              ) : (
                <input className={inputCls} inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" />
              )}
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
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">Sizes (each with its own price)</div>
            <SizesEditor sizes={draft.sizes} onChange={(sizes) => setDraft({ ...draft, sizes })} />
          </div>
          <Field label="Choices for guests (spice, add-ons)">
            <OptionsEditor groups={draft.options} onChange={(options) => setDraft({ ...draft, options })} />
          </Field>
          <Field label="Cost per plate (₹)" hint="What the ingredients cost you. Used for margins in “What's working”. Optional.">
            <input className={inputCls} inputMode="decimal" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" />
          </Field>
        </div>
      </Sheet>

      {/* edit a category */}
      <Sheet
        open={!!catEdit}
        onClose={() => setCatEdit(null)}
        title="Edit category"
        footer={
          catEdit && (() => {
            const name = catEdit.name.trim();
            const taken = cats.some((x) => x.id !== catEdit.id && x.name.trim().toLowerCase() === name.toLowerCase());
            return (
              <div className="space-y-2">
                {taken && <p className="text-center text-[13px] font-medium text-rose">{name} already exists</p>}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Button variant="plain" className="!text-rose" onClick={() => askDelete(catEdit.id)}><Trash2 size={16} /> Delete</Button>
                  <Button disabled={!name || taken} onClick={() => { categoryActions.update(catEdit.id, { name, icon: catEdit.icon }); toast(`${name} saved`); setCatEdit(null); }}>Save</Button>
                </div>
              </div>
            );
          })()
        }
      >
        {catEdit && (
          <div className="space-y-4">
            <Field label="Category name">
              <input autoFocus className={inputCls} value={catEdit.name} onChange={(e) => setCatEdit({ ...catEdit, name: e.target.value })} placeholder="e.g. Cold drinks" />
            </Field>
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-muted">Icon (shown in the guest menu side bar)</div>
              <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
                {[...new Set([catEdit.icon, ...CAT_ICONS])].map((x) => (
                  <button key={x} aria-pressed={catEdit.icon === x} onClick={() => setCatEdit({ ...catEdit, icon: x })} className={clsx("flex aspect-square items-center justify-center rounded-[10px] text-[20px]", catEdit.icon === x ? "bg-jade-soft ring-2 ring-jade" : "bg-sunken")}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>

      {/* delete a category */}
      <Sheet
        open={!!catDel}
        onClose={() => setCatDel(null)}
        title={`Delete ${cats.find((x) => x.id === catDel?.id)?.name ?? "category"}?`}
        footer={
          catDel && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="plain" onClick={() => setCatDel(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const c = cats.find((x) => x.id === catDel.id);
                  const n = items.filter((m) => m.categoryId === catDel.id).length;
                  const to = cats.find((x) => x.id === catDel.dishes);
                  categoryActions.remove(catDel.id, n ? (catDel.dishes === "delete" ? "delete" : { moveTo: catDel.dishes }) : null);
                  toast(`${c?.name ?? "Category"} deleted${n ? (to ? ` · ${n} dishes moved to ${to.name}` : ` with its ${n} dishes`) : ""}`);
                  setCatDel(null);
                }}
              >
                Delete category
              </Button>
            </div>
          )
        }
      >
        {catDel && (() => {
          const n = items.filter((m) => m.categoryId === catDel.id).length;
          const others = cats.filter((x) => x.id !== catDel.id);
          return n === 0 ? (
            <p className="text-[15px] text-muted">This category has no dishes. Guests won&apos;t see it any more.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-[15px] text-muted">It has <b className="text-ink">{n} {n === 1 ? "dish" : "dishes"}</b>. What should happen to {n === 1 ? "it" : "them"}?</p>
              <Field label="Dishes in this category">
                <select className={inputCls} value={catDel.dishes} onChange={(e) => setCatDel({ ...catDel, dishes: e.target.value })}>
                  {others.map((o) => <option key={o.id} value={o.id}>Move to {o.icon ? o.icon + " " : ""}{o.name}</option>)}
                  <option value="delete">Delete the {n === 1 ? "dish" : `${n} dishes`} too</option>
                </select>
              </Field>
              {catDel.dishes === "delete" && <p className="rounded-ctl bg-rose-soft px-3 py-2 text-[13.5px] text-rose">The dishes are removed from your menu. Past bills and reports keep them.</p>}
            </div>
          );
        })()}
      </Sheet>

      <Sheet open={catsOpen} onClose={() => setCatsOpen(false)} title="Categories">
        <div className="space-y-4">
          <p className="text-[14px] text-muted">Shown to guests as filters and side-bar entries, in this order.</p>
          <div className="overflow-hidden rounded-group bg-surface">
            {cats.map((c, i) => {
              const n = items.filter((m) => m.categoryId === c.id).length;
              return (
                <div key={c.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-2.5 last:border-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-[20px]">{c.icon || "🍽️"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{c.name}</div>
                    <div className="text-[12.5px] text-muted tnum">{n} {n === 1 ? "dish" : "dishes"}</div>
                  </div>
                  <div className="flex">
                    <button aria-label="Move up" disabled={i === 0} onClick={() => categoryActions.move(c.id, -1)} className="p-1.5 text-muted disabled:opacity-30"><ArrowUp size={16} /></button>
                    <button aria-label="Move down" disabled={i === cats.length - 1} onClick={() => categoryActions.move(c.id, 1)} className="p-1.5 text-muted disabled:opacity-30"><ArrowDown size={16} /></button>
                  </div>
                  <button aria-label={`Edit ${c.name}`} onClick={() => setCatEdit({ id: c.id, name: c.name, icon: c.icon || "🍽️" })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink"><Pencil size={15} /></button>
                  <button aria-label={`Delete ${c.name}`} onClick={() => askDelete(c.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose/10 text-rose"><Trash2 size={15} /></button>
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
      <div className="no-scrollbar -mx-1 -my-1 flex gap-1 overflow-x-auto px-1 py-1">
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

/** "What each dish earned you this week": plates sold × profit per plate, biggest first. */
const qBar: Record<Quadrant, string> = { star: "bg-jade", plowhorse: "bg-sky", puzzle: "bg-saffron", dog: "bg-rose" };
const qShort: Record<Quadrant, string> = { star: "Star", plowhorse: "Workhorse", puzzle: "Hidden gem", dog: "Rethink" };
function EarnedChart({ items, quadrant, onOpen }: { items: MenuItem[]; quadrant: (m: MenuItem) => Quadrant; onOpen: (m: MenuItem) => void }) {
  const [all, setAll] = useState(false);
  const sold = items.filter((m) => m.soldThisWeek > 0).map((m) => ({ m, per: Math.max(0, m.price - m.cost), q: quadrant(m) })).map((r) => ({ ...r, earned: r.per * r.m.soldThisWeek }));
  sold.sort((a, b) => b.earned - a.earned || b.m.soldThisWeek - a.m.soldThisWeek);
  const none = items.filter((m) => m.soldThisWeek === 0);
  const max = Math.max(1, ...sold.map((r) => r.earned));
  const total = sold.reduce((s, r) => s + r.earned, 0);
  const noCost = items.some((m) => !m.cost);
  const shown = all ? sold : sold.slice(0, 10);
  return (
    <Group title="What each dish earned you this week">
      <p className="text-[13px] leading-relaxed text-muted">
        Each bar = <b className="text-ink">plates sold × profit per plate</b>. Longer bar, more money. The colour tells you what to do with the dish (see the boxes).
        {noCost && " Dishes without a cost per plate count the full price as profit, so add costs for true numbers."}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
        {(["star", "plowhorse", "puzzle", "dog"] as Quadrant[]).map((q) => (
          <span key={q} className="inline-flex items-center gap-1.5"><span className={clsx("h-2.5 w-2.5 rounded-full", qBar[q])} />{qShort[q]}</span>
        ))}
      </div>
      {sold.length === 0 ? (
        <p className="mt-4 rounded-[14px] bg-sunken/60 p-4 text-[14px] text-muted">No dish was ordered in the last 7 days yet. Bars show up as orders come in.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map(({ m, per, q, earned }) => (
            <li key={m.id}>
              <button onClick={() => onOpen(m)} title={`${m.name}: ${m.soldThisWeek} sold × ${inr(per)} = ${inr(earned)}`} className="group block w-full text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[14.5px] font-medium group-hover:underline">{m.name}</span>
                  <span className="shrink-0 text-[14.5px] font-semibold tnum">{inr(earned)}</span>
                </div>
                <div className="mt-1 h-2.5 w-full rounded-full bg-sunken">
                  <div className={clsx("h-full rounded-full", qBar[q])} style={{ width: `${Math.max(2, (earned / max) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[12.5px] text-muted tnum">
                  {qShort[q]} · {m.soldThisWeek} sold × {inr(per)} profit
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sold.length > 10 && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-[13.5px] font-semibold text-jade">{all ? "Show top 10" : `Show all ${sold.length} dishes`}</button>
      )}
      {sold.length > 0 && <div className="mt-4 flex justify-between border-t border-line/80 pt-3 text-[14px]"><span className="text-muted">Total profit from all dishes this week</span><b className="tnum">{inr(total)}</b></div>}
      {none.length > 0 && (
        <div className="mt-4">
          <div className="text-[12.5px] font-semibold text-muted">Not ordered this week ({none.length})</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {none.slice(0, all ? undefined : 12).map((m) => (
              <button key={m.id} onClick={() => onOpen(m)} className="rounded-full bg-sunken px-2.5 py-1 text-[12.5px] font-medium hover:bg-line">{m.name}</button>
            ))}
            {!all && none.length > 12 && <span className="px-1 py-1 text-[12.5px] text-muted">+{none.length - 12} more</span>}
          </div>
        </div>
      )}
    </Group>
  );
}
