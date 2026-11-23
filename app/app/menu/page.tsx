"use client";

import { hasPerm, hasTables, inOutlet } from "@/lib/access";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Camera, FolderPlus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Button, DietMark, Field, Group, Hint, Page, PageHeader, Pill, Segmented, SelectMenu, Sheet, Toggle, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { categoryActions, isStampReward, mainOutletId, menuActions, menuFor, useAllMenu, useCategories, useCurrentOutlet, useFeature, useMe, useMenu, useOutletOrders, useOutlets } from "@/lib/live";
import { PhotoSlide } from "@/components/menu-bits";
import { DragGhost, DragHandle, useDishDrag, type DishDrag } from "@/components/dish-drag";
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
  const menuRaw = useMenu(); // the dishes of the outlet on screen
  const orders = useOutletOrders(); // sold here
  // each outlet has its own menu; its people with menu access change it
  const me = useMe();
  const outlets = useOutlets();
  const outletNow = useCurrentOutlet();
  const allMenu = useAllMenu();
  const many = outlets.length > 1;
  const canEditDishes = hasPerm(me, "menu") && inOutlet(me, outletNow.id);
  // copy dishes from another outlet
  const [copyOpen, setCopyOpen] = useState(false);
  const mainId = mainOutletId(outlets);
  const otherOutlets = outlets.filter((o) => o.id !== outletNow.id).map((o) => ({ ...o, dishes: menuFor(allMenu, o, mainId).length })).filter((o) => o.dishes > 0);
  const [confirmDel, setConfirmDel] = useState(false);
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
  const cafe = !hasTables(outletNow); // counter-only café: no tandoor
  const engineeringOn = useFeature("menuEngineering") === "ok";
  const blank = (catId?: string): Draft => ({ name: "", price: "", categoryId: catId ?? cats[0]?.id ?? "", diet: "veg", station: "kitchen", sweet: false, photos: [], spice: 0, isNew: false, tags: [], options: [], sizes: [], cost: "" });
  const [draft, setDraft] = useState<Draft>(blank());
  const setEdit = (m: MenuItem | "new" | null, catId?: string) => {
    setEditRaw(m);
    setConfirmDel(false);
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
        subtitle={`${many ? `${outletNow.name} · ` : ""}${items.length} dish${items.length === 1 ? "" : "es"} · ${items.filter((m) => !m.available).length} sold out`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="plain" aria-label="Categories" onClick={() => { setNewCat(null); setCatsOpen(true); }}><FolderPlus size={16} /> Categories</Button>
            {canEditDishes && <Button size="sm" variant="tinted" onClick={() => setFromPhoto(true)}><Camera size={16} /> <span className="hidden sm:inline">From photo</span><span className="sm:hidden">Photo</span></Button>}
            {canEditDishes && <Button size="sm" onClick={() => setEdit("new")}><Plus size={16} /> Add dish</Button>}
          </div>
        }
      >
        {engineeringOn && <Segmented value={tab} onChange={setTab} options={[{ value: "dishes", label: "Dishes" }, { value: "engineering", label: "What's working" }]} />}
      </PageHeader>
      <MenuFromPhoto open={fromPhoto} onClose={() => setFromPhoto(false)} />

      <Page>
        {/* a new outlet starts empty: offer to copy another outlet's menu (only then) */}
        {many && canEditDishes && otherOutlets.length > 0 && items.length === 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-group bg-surface px-4 py-3">
            <div className="min-w-0 flex-1 text-[14px] font-semibold">
              {outletNow.name} has no dishes yet
              <Hint className="ml-1">Each outlet has its own menu and prices. Copy one to start, then change what you need.</Hint>
            </div>
            <Button size="sm" variant="tinted" onClick={() => setCopyOpen(true)}>Copy a menu</Button>
          </div>
        )}
        {tab === "dishes" || !engineeringOn ? (
          <MenuList
            cats={cats}
            items={items}
            canEdit={canEditDishes}
            drag={drag}
            startDrag={startDrag}
            onOpen={(m) => (canEditDishes ? setEdit(m) : toast("Ask the owner or your manager to change this dish. You can mark it sold out here."))}
            onAdd={(catId) => setEdit("new", catId)}
            onEditCat={(c) => setCatEdit({ id: c.id, name: c.name, icon: c.icon || "🍽️" })}
            onNewCat={() => { setNewCat(null); setCatsOpen(true); }}
            onAvailable={(m, v) => {
              menuActions.setAvailable(m.id, v);
              toast(v ? `${m.name} is back on the menu` : `${m.name} marked sold out${many ? ` at ${outletNow.name}` : ""}`);
            }}
            ghost={<DragGhost drag={drag} label={catName} />}
          />
        ) : (
          <div className="space-y-6">
{(() => {
              const gem = [...byQ.puzzle].sort((x, y) => (y.price - y.cost) - (x.price - x.cost))[0];
              const star = [...byQ.star].sort((x, y) => y.soldThisWeek - x.soldThisWeek)[0];
              if (!gem && !star) return null;
              return (
                <div className="grid gap-2 sm:grid-cols-2">
                  {star && (
                    <button onClick={() => setEdit(star)} className="flex items-center gap-3 rounded-group bg-surface px-4 py-3 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jade-soft text-[17px]">⭐</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold uppercase tracking-wide text-jade-deep">Your star</span>
                        <span className="block truncate text-[15px] font-semibold">{star.name}</span>
                      </span>
                      <span className="shrink-0 text-[13px] text-muted tnum">{star.soldThisWeek} sold</span>
                    </button>
                  )}
                  {gem && (
                    <button onClick={() => setEdit(gem)} className="flex items-center gap-3 rounded-group bg-surface px-4 py-3 text-left" title="Earns well but few people order it: ask captains to suggest it">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-[17px]">💎</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold uppercase tracking-wide text-saffron">Push this</span>
                        <span className="block truncate text-[15px] font-semibold">{gem.name}</span>
                      </span>
                      <span className="shrink-0 text-[13px] text-muted tnum">{inr(gem.price - gem.cost)}/plate</span>
                    </button>
                  )}
                </div>
              );
            })()}

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <EarnedChart items={items} quadrant={quadrant} onOpen={setEdit} />

              <div className="space-y-4">
                {(["star", "puzzle", "plowhorse", "dog"] as Quadrant[]).filter((q) => byQ[q].length > 0).map((q) => (
                  <Group key={q} flush>
                    <div className="flex items-center gap-1 px-4 pt-3.5 lg:px-5">
                      <Pill tone={qMeta[q].tone}>{qMeta[q].name} · {byQ[q].length}</Pill>
                      <Hint align="left">{qMeta[q].hint}</Hint>
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

      <Sheet open={copyOpen} onClose={() => setCopyOpen(false)} title={`Copy dishes to ${outletNow.name}`}>
        <p className="text-[14.5px] text-muted">The dishes are copied with their prices, photos and categories. After that each outlet changes its own; dishes {outletNow.name} already has (same name) are skipped.</p>
        <div className="mt-4 space-y-2.5">
          {otherOutlets.map((o) => (
            <Button
              key={o.id}
              size="lg"
              variant="tinted"
              className="w-full"
              onClick={() => {
                const n = menuActions.copyMenu(o.id, outletNow.id);
                setCopyOpen(false);
                toast(n ? `Copied ${n} dishes from ${o.name}` : `${outletNow.name} already has all of ${o.name}'s dishes`);
              }}
            >
              From {o.name} ({o.dishes} dishes)
            </Button>
          ))}
        </div>
      </Sheet>

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
          {editing && canEditDishes && (
            confirmDel ? (
              <div className="space-y-2 rounded-group bg-rose-soft/50 p-4">
                <p className="text-[14px]">
                  Delete <b>{editing.name}</b> from {outletNow.name}? Old bills and reports keep its name.
                  {isStampReward(editing.id) && " It is the free dish of your stamp card: pick another dish there after this."}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="plain" onClick={() => setConfirmDel(false)}>Keep</Button>
                  <Button variant="danger" onClick={() => { menuActions.remove(editing.id); setConfirmDel(false); setEdit(null); toast(`${editing.name} deleted`); }}>Delete dish</Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" className="w-full" onClick={() => setConfirmDel(true)}><Trash2 size={16} /> Delete dish</Button>
            )
          )}
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
      <div className="flex flex-wrap gap-1">
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
    <Group title="Profit by dish · this week">
      <div className="-mt-1 flex items-center gap-1.5 text-[12.5px] text-muted">
        Plates sold × profit per plate
        <Hint align="left">Longer bar, more money. The colour says what to do with the dish (see the boxes).{noCost ? " Dishes without a cost per plate count the full price as profit." : ""}</Hint>
        {noCost && <span className="ml-1 rounded-full bg-saffron-soft px-2 py-0.5 text-[11.5px] font-semibold text-saffron">Add costs for exact profit</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
        {(["star", "plowhorse", "puzzle", "dog"] as Quadrant[]).map((q) => (
          <span key={q} className="inline-flex items-center gap-1.5"><span className={clsx("h-2.5 w-2.5 rounded-full", qBar[q])} />{qShort[q]}</span>
        ))}
      </div>
      {sold.length === 0 ? (
        <p className="mt-4 rounded-[14px] bg-sunken/60 p-4 text-[14px] text-muted">No orders in the last 7 days yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
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
                <div className="mt-0.5 text-[12px] text-faint tnum">{m.soldThisWeek} × {inr(per)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sold.length > 10 && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-[13.5px] font-semibold text-jade">{all ? "Show top 10" : `Show all ${sold.length} dishes`}</button>
      )}
      {sold.length > 0 && <div className="mt-4 flex justify-between border-t border-line/80 pt-3 text-[14px]"><span className="text-muted">Total this week</span><b className="tnum">{inr(total)}</b></div>}
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

/* ---------------- the dishes, by category ---------------- */
type Cat = { id: string; name: string; icon?: string };
type Item = MenuItem & { soldThisWeek: number };

/** A category's picture: its emoji, or its first letter when it has none. */
function CatIcon({ c, size = 36 }: { c: Cat; size?: number }) {
  const icon = c.icon && c.icon !== "🍽️" ? c.icon : "";
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[10px] bg-sunken font-semibold text-muted" style={{ width: size, height: size, fontSize: icon ? size * 0.5 : size * 0.42 }}>
      {icon || c.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** A dish without a photo: its first letters on a soft colour, so every row looks finished. */
function DishThumb({ m }: { m: Item }) {
  if (m.photos?.length) return <PhotoSlide item={m} className="h-12 w-12 shrink-0 rounded-[12px]" />;
  const words = m.name.trim().split(/\s+/);
  const letters = (words.length > 1 ? words[0][0] + words[1][0] : m.name.trim().slice(0, 2)).toUpperCase();
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] text-[15px] font-bold" style={{ background: `hsl(${m.hue} 55% 92%)`, color: `hsl(${m.hue} 45% 32%)` }}>
      {letters}
    </span>
  );
}

function MenuList({ cats, items, canEdit, drag, startDrag, onOpen, onAdd, onEditCat, onNewCat, onAvailable, ghost }: {
  cats: Cat[]; items: Item[]; canEdit: boolean; drag: DishDrag | null; startDrag: (m: MenuItem) => (e: RPointerEvent) => void;
  onOpen: (m: Item) => void; onAdd: (catId: string) => void; onEditCat: (c: Cat) => void; onNewCat: () => void;
  onAvailable: (m: Item, v: boolean) => void; ghost: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "on" | "off">("all");
  const [active, setActive] = useState(cats[0]?.id ?? "");
  const off = items.filter((m) => !m.available).length;
  const match = (m: Item) => (!q || m.name.toLowerCase().includes(q.trim().toLowerCase())) && (show === "all" || (show === "on" ? m.available : !m.available));
  const filtering = !!q.trim() || show !== "all";
  const groups = cats
    .map((c) => ({ c, all: items.filter((m) => m.categoryId === c.id), list: items.filter((m) => m.categoryId === c.id && match(m)) }))
    .filter((g) => !filtering || g.list.length > 0);
  // dishes whose category was removed still show, at the end
  const lost = items.filter((m) => !cats.some((c) => c.id === m.categoryId) && match(m));

  // the category on screen is highlighted in the list / tabs
  const sections = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        const top = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive((top.target as HTMLElement).dataset.dropCat ?? "");
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    sections.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [groups.length, q, show]);
  const go = (id: string) => {
    setActive(id);
    sections.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById(`cat-tab-${id}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
      {/* desktop: the categories down the side (drop a dish on one to move it) */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 space-y-1">
          <div className="px-3 pb-1 text-[12.5px] font-semibold uppercase tracking-wide text-muted">Categories</div>
          {cats.map((c) => {
            const n = items.filter((m) => m.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                data-drop-cat={c.id}
                onClick={() => go(c.id)}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[14.5px] transition",
                  active === c.id ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted hover:bg-surface/60 hover:text-ink",
                  drag && drag.over === c.id && drag.from !== c.id && "bg-jade-soft ring-2 ring-jade",
                )}
              >
                <CatIcon c={c} size={30} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-[12.5px] tabular-nums text-faint">{n}</span>
              </button>
            );
          })}
          <button onClick={onNewCat} className="mt-2 flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-[14px] font-semibold text-jade hover:bg-surface/60">
            <Plus size={16} /> Category
          </button>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {/* search + filter, and on phones the category tabs */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input className={clsx(inputCls, "h-11 pl-10 pr-9")} placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-sunken"><X size={15} /></button>}
            </div>
            <Segmented value={show} onChange={setShow} options={[{ value: "all", label: `All ${items.length}` }, { value: "on", label: "Available" }, { value: "off", label: `Sold out${off ? ` ${off}` : ""}` }]} />
          </div>
        </div>
        {!filtering && cats.length > 1 && (
          // phones: jump to a category from one dropdown (no sideways scrolling); dishes still drop onto a category's section
          <div className="sticky z-20 -mx-4 bg-canvas/95 px-4 py-2 backdrop-blur lg:hidden" style={{ top: "calc(54px + env(safe-area-inset-top, 0px))" }}>
            <SelectMenu label="Category" value={active ?? cats[0].id} onChange={(id) => go(id)} options={cats.map((c) => ({ value: c.id, label: `${c.icon && c.icon !== "🍽️" ? `${c.icon} ` : ""}${c.name}`, count: items.filter((m) => m.categoryId === c.id).length }))} />
          </div>
        )}

        {filtering && groups.length === 0 && lost.length === 0 && (
          <p className="rounded-group bg-surface px-4 py-10 text-center text-[14.5px] text-muted">No dishes match{q ? ` “${q}”` : ""}.</p>
        )}

        {groups.map(({ c, all, list }) => {
          const soldOut = all.filter((m) => !m.available).length;
          return (
            <section
              key={c.id}
              data-drop-cat={c.id}
              ref={(el) => { if (el) sections.current.set(c.id, el); else sections.current.delete(c.id); }}
              className={clsx("scroll-mt-[120px] rounded-[22px] transition lg:scroll-mt-6", drag && drag.over === c.id && drag.from !== c.id && "bg-jade-soft/60 ring-2 ring-jade ring-offset-4 ring-offset-canvas")}
            >
              <div className="mb-2 flex items-center gap-3 px-1">
                <CatIcon c={c} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-semibold leading-tight">{c.name}</h2>
                  <p className="text-[12.5px] text-muted">{all.length} dish{all.length === 1 ? "" : "es"}{soldOut ? ` · ${soldOut} sold out` : ""}</p>
                </div>
                <button onClick={() => onEditCat(c)} aria-label={`Edit category ${c.name}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-muted hover:bg-surface hover:text-ink"><Pencil size={13} /> <span className="hidden sm:inline">Edit</span></button>
                {canEdit && <button onClick={() => onAdd(c.id)} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-jade ring-1 ring-line hover:bg-jade-soft"><Plus size={14} /> Dish</button>}
              </div>
              <div className="overflow-hidden rounded-group bg-surface">
                {list.length === 0 ? (
                  canEdit ? (
                    <button onClick={() => onAdd(c.id)} className="flex w-full items-center justify-center gap-2 px-4 py-6 text-[14px] font-semibold text-jade"><Plus size={16} /> Add the first dish to {c.name}</button>
                  ) : (
                    <p className="px-4 py-6 text-center text-[14px] text-muted">No dishes yet.</p>
                  )
                ) : (
                  list.map((m) => <DishRow key={m.id} m={m} canEdit={canEdit} dragging={drag?.id === m.id} startDrag={startDrag} onOpen={onOpen} onAvailable={onAvailable} />)
                )}
              </div>
            </section>
          );
        })}

        {lost.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-[17px] font-semibold">No category</h2>
            <div className="overflow-hidden rounded-group bg-surface">
              {lost.map((m) => <DishRow key={m.id} m={m} canEdit={canEdit} dragging={drag?.id === m.id} startDrag={startDrag} onOpen={onOpen} onAvailable={onAvailable} />)}
            </div>
          </section>
        )}
        {canEdit && !filtering && (
          <button onClick={onNewCat} className="flex w-full items-center justify-center gap-2 rounded-group border border-dashed border-line px-4 py-4 text-[14px] font-semibold text-muted hover:text-ink lg:hidden">
            <Plus size={16} /> New category
          </button>
        )}
        {ghost}
      </div>
    </div>
  );
}

function DishRow({ m, canEdit, dragging, startDrag, onOpen, onAvailable }: {
  m: Item; canEdit: boolean; dragging: boolean; startDrag: (m: MenuItem) => (e: RPointerEvent) => void;
  onOpen: (m: Item) => void; onAvailable: (m: Item, v: boolean) => void;
}) {
  const margin = m.price > 0 ? Math.round(((m.price - m.cost) / m.price) * 100) : 0;
  const price = hasSizes(m) ? sizesOf(m).map((z) => `${z.name} ${inr(z.price)}`).join(" · ") : inr(m.price);
  return (
    <div className={clsx("group flex items-center gap-3 border-b border-line/70 px-3 py-3 last:border-0 sm:px-4", dragging && "opacity-40", !m.available && "bg-sunken/40")}>
      {canEdit && <span className="hidden sm:block"><DragHandle name={m.name} onPointerDown={startDrag(m)} /></span>}
      <button onClick={() => onOpen(m)} className={clsx("flex min-w-0 flex-1 items-center gap-3 text-left", !m.available && "opacity-60")}>
        <DishThumb m={m} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <DietMark diet={m.diet} />
            <span className="truncate text-[15px] font-medium">{m.name}</span>
            {m.isNew && <span className="shrink-0 rounded-full bg-saffron-soft px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-saffron">New</span>}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-muted tnum">
            <b className="font-semibold text-ink">{price}</b>
            {m.cost > 0 && <> · <span className={margin < 60 ? "text-saffron" : undefined}>{margin}% margin</span></>}
            {m.soldThisWeek > 0 && <> · {m.soldThisWeek} sold this week</>}
          </span>
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-2.5">
        <span className={clsx("hidden text-[12.5px] font-semibold sm:inline", m.available ? "text-jade-deep" : "text-rose")}>{m.available ? "Available" : "Sold out"}</span>
        <Toggle label={`${m.name} available`} checked={m.available} onChange={(v) => onAvailable(m, v)} />
      </span>
    </div>
  );
}
