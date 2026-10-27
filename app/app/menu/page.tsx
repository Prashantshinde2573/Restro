"use client";

import clsx from "clsx";
import { ImagePlus, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, DietMark, DishArt, Field, Group, Page, PageHeader, Pill, Segmented, LocalSegmented, Sheet, SwitchRow, Toggle, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

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
  const [items, setItems] = useState<MenuItem[]>(repo.menu());
  const [edit, setEdit] = useState<MenuItem | "new" | null>(null);
  const cats = repo.categories();

  const avgSold = items.reduce((s, m) => s + m.soldThisWeek, 0) / items.length;
  const avgMargin = items.reduce((s, m) => s + (m.price - m.cost), 0) / items.length;
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

  const maxSold = Math.max(...items.map((m) => m.soldThisWeek));
  const maxMargin = Math.max(...items.map((m) => m.price - m.cost));
  const editing = edit && edit !== "new" ? edit : null;

  return (
    <>
      <PageHeader
        title="Menu"
        subtitle={`${items.length} dishes · ${items.filter((m) => !m.available).length} sold out`}
        actions={<Button size="sm" onClick={() => setEdit("new")}><Plus size={16} /> Add dish</Button>}
      >
        <Segmented value={tab} onChange={setTab} options={[{ value: "dishes", label: "Dishes" }, { value: "engineering", label: "What's working" }]} />
      </PageHeader>

      <Page>
        {tab === "dishes" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {cats.map((c) => (
              <Group key={c.id} title={c.name} flush>
                {items.filter((m) => m.categoryId === c.id).map((m) => {
                  const margin = Math.round(((m.price - m.cost) / m.price) * 100);
                  return (
                    <div key={m.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                      <button onClick={() => setEdit(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <DishArt hue={m.hue} className="h-11 w-11 shrink-0 rounded-[12px]" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <DietMark diet={m.diet} />
                            <span className={clsx("truncate text-[15px] font-medium", !m.available && "text-muted")}>{m.name}</span>
                          </div>
                          <div className="text-[13px] text-muted tnum">
                            {inr(m.price)} · <span className={margin < 60 ? "text-saffron" : undefined}>{margin}% margin</span> · {m.soldThisWeek} sold
                          </div>
                        </div>
                      </button>
                      <Toggle
                        label={`${m.name} available`}
                        checked={m.available}
                        onChange={(v) => {
                          setItems((is) => is.map((x) => (x.id === m.id ? { ...x, available: v } : x)));
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
            <Group>
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-saffron" />
                <p className="text-[15px] leading-relaxed">
                  <b>Kothimbir Vadi</b> earns 80% margin but only 36 orders this week. Ask captains to recommend it with drinks — at Butter Chicken&apos;s volume it would add about <b>{inr(168 * 30)}</b> a month.
                  {" "}<b>Kolhapuri Mutton</b> costs {inr(245)} to make; a ₹40 price rise keeps it under neighbourhood rates.
                </p>
              </div>
            </Group>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <Group title="Popularity vs profit, this week">
                <div className="relative aspect-[4/3] w-full">
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-[14px] bg-line/70">
                    {(["puzzle", "star", "dog", "plowhorse"] as Quadrant[]).map((q) => (
                      <div key={q} className="relative bg-sunken/40 p-2.5">
                        <span className="text-[12px] font-semibold text-muted">{qMeta[q].name}</span>
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
                          "group absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition hover:scale-150",
                          q === "star" ? "bg-jade" : q === "plowhorse" ? "bg-sky" : q === "puzzle" ? "bg-saffron" : "bg-rose",
                        )}
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <span className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-canvas group-hover:block">{m.name}</span>
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
        footer={<Button size="lg" className="w-full" onClick={() => { setEdit(null); toast(editing ? "Dish saved" : "Dish added to menu"); }}>{editing ? "Save dish" : "Add dish"}</Button>}
      >
        <div className="space-y-4">
          <button className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-group border-2 border-dashed border-line bg-surface text-muted hover:border-jade hover:text-jade">
            <ImagePlus size={24} />
            <span className="text-[14px] font-medium">Add a photo</span>
          </button>
          <Field label="Dish name"><input className={inputCls} defaultValue={editing?.name} placeholder="e.g. Paneer Tikka" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹, before GST)"><input className={inputCls} inputMode="decimal" defaultValue={editing?.price} /></Field>
            <Field label="Category">
              <select className={inputCls} defaultValue={editing?.categoryId}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Type">
            <LocalSegmented className="w-full" initial={editing?.diet ?? "veg"} options={[{ value: "veg", label: "Veg" }, { value: "egg", label: "Egg" }, { value: "nonveg", label: "Non-veg" }]} />
          </Field>
          <Field label="Cooked at">
            <LocalSegmented className="w-full" initial={editing?.station ?? "kitchen"} options={[{ value: "kitchen", label: "Kitchen" }, { value: "tandoor", label: "Tandoor" }, { value: "bar", label: "Bar" }, { value: "dessert", label: "Desserts" }]} />
          </Field>
          <div className="rounded-group bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">Recipe</span>
              <span className="text-[13px] text-muted">Cost {inr(editing?.cost ?? 0)} per plate</span>
            </div>
            <div className="mt-2 space-y-1.5 text-[14px]">
              {[["Paneer", "150 g"], ["Curd + spices", "60 g"], ["Butter", "10 g"]].map(([n, q]) => (
                <div key={n} className="flex justify-between text-muted"><span>{n}</span><span className="tnum">{q}</span></div>
              ))}
            </div>
            <button className="mt-3 text-[14px] font-semibold text-jade">Add ingredient</button>
          </div>
          <div className="space-y-px overflow-hidden rounded-group">
            <SwitchRow label="Show on table QR menu" initial />
            <SwitchRow label="Show on WhatsApp ordering" initial />
            <SwitchRow label="Only between 12 and 4 pm" hint="Lunch-only dishes hide themselves after 4." />
          </div>
        </div>
      </Sheet>
    </>
  );
}
