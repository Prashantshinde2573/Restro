"use client";

import { L, dateLocale } from "@/lib/i18n";
import clsx from "clsx";
import { MessageCircle, Package, PackagePlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Group, Hint, Page, PageHeader, Pill, Segmented, Sheet, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { stockActions, useCurrentOutlet, useFeature, useMe, useMenu, useOrders, useStock } from "@/lib/live";
import { dayKey, forecastItem, recipeNeeds, toOrder, type StockForecast } from "@/lib/stock-forecast";
import type { MenuItem, Order } from "@/lib/types";
import { DAY_MS, between, inOutlet, startOfDay, topDishes } from "@/lib/stats";
import { inr } from "@/lib/format";
import type { StockItem, StockLog } from "@/lib/types";

function level(i: StockItem, f?: StockForecast) {
  if (i.stock <= 0) return { tone: "rose" as const, label: "Out" };
  if (i.par > 0 && i.stock < i.par * 0.5) return { tone: "rose" as const, label: "Low" };
  if (f?.daysLeft !== null && f?.daysLeft !== undefined && f.daysLeft < 1) return { tone: "rose" as const, label: "Runs out tomorrow" };
  if (i.par > 0 && i.stock < i.par) return { tone: "saffron" as const, label: "Order soon" };
  if (f?.daysLeft !== null && f?.daysLeft !== undefined && f.daysLeft < 2.5) return { tone: "saffron" as const, label: "Order soon" };
  return { tone: "jade" as const, label: "OK" };
}

/** Plates expected tomorrow: the same weekday over the last 4 weeks (as in Tomorrow's prep). */
function expectedPlates(orders: Order[]) {
  const tomorrow0 = startOfDay() + DAY_MS;
  const weeks = [1, 2, 3, 4].map((w) => between(orders, tomorrow0 - w * 7 * DAY_MS, tomorrow0 - w * 7 * DAY_MS + DAY_MS));
  const withData = weeks.filter((w) => w.length > 0).length;
  return topDishes(weeks.flat(), 1000).map((d) => ({ ...d, plates: Math.ceil(d.qty / Math.max(1, withData)) }));
}
/** The smart forecast of every item: recipe use + what counts taught + the weekly pattern. */
function useForecasts(items: StockItem[], outletId: string) {
  const orders = inOutlet(useOrders(), outletId);
  const menu = useMenu() as MenuItem[];
  const need = recipeNeeds(expectedPlates(orders), menu);
  const map = new Map<string, StockForecast>();
  for (const i of items) map.set(i.id, forecastItem(i, Date.now(), need.has(i.id) ? need.get(i.id) : undefined));
  const dishesOf = (id: string) => menu.filter((m) => m.recipe?.some((r) => r.stockId === id));
  return { of: (i: StockItem) => map.get(i.id)!, dishesOf };
}
const UNITS = ["kg", "g", "L", "ml", "pcs", "packet", "box", "dozen"];
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

export default function InventoryPage() {
  const prepOn = useFeature("prepForecast") === "ok";
  const toast = useToast();
  const me = useMe();
  const outlet = useCurrentOutlet();
  const [tab, setTab] = useState<"stock" | "buy" | "prep">("stock");
  const [edit, setEdit] = useState<Partial<StockItem> | null>(null);
  const [move, setMove] = useState<{ item: StockItem; kind: StockLog["kind"] } | null>(null);
  const items = useStock().filter((i) => !i.outletId || i.outletId === outlet.id);
  const fc = useForecasts(items, outlet.id);

  const value = items.reduce((s, i) => s + i.stock * i.costPerUnit, 0);
  const low = items.filter((i) => level(i, fc.of(i)).tone !== "jade");
  const weekAgo = Date.now() - 7 * DAY_MS;
  const wasted = items.reduce(
    (s, i) => s + (i.log ?? []).filter((l) => l.kind === "waste" && new Date(l.at).getTime() > weekAgo).reduce((a, l) => a + l.qty * i.costPerUnit, 0),
    0,
  );
  // to buy: below the minimum, or running out within ~2.5 days at the expected rate (enough for 3 days)
  const toBuy = items
    .map((i) => ({ ...i, need: toOrder(i, fc.of(i)) }))
    .filter((i) => (i.par > 0 && i.stock < i.par) || (fc.of(i).daysLeft !== null && fc.of(i).daysLeft! < 2.5))
    .filter((i) => i.need > 0);
  const usedToday = items.reduce((s, i) => s + fc.of(i).today * i.costPerUnit, 0);
  const bySupplier = toBuy.reduce<Record<string, typeof toBuy>>((acc, i) => ((acc[i.supplier || "No supplier set"] ??= []).push(i), acc), {});

  return (
    <>
      <PageHeader
        title={L("Stock")}
        subtitle={items.length ? L("{0} in stock · {1} need ordering", inr(Math.round(value)), low.length) : outlet.name}
        actions={<Button variant="tinted" size="sm" onClick={() => setEdit({ unit: "kg", stock: 0, par: 0, costPerUnit: 0, supplier: "" })}><Plus size={15} /> {L("Add item")}</Button>}
      >
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "stock", label: "In stock" },
            { value: "buy", label: `To buy${toBuy.length ? ` · ${toBuy.length}` : ""}` },
            ...(prepOn ? [{ value: "prep" as const, label: "Tomorrow's prep" }] : []),
          ]}
        />
      </PageHeader>

      <Page>
        {tab === "stock" &&
          (items.length === 0 ? (
            <div className="flex flex-col items-center rounded-group bg-surface px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade"><Package size={26} /></span>
              <h2 className="mt-4 text-[18px] font-semibold">{L("Track your stock")}</h2>
              <p className="mt-1 max-w-sm text-[14.5px] text-muted">{L("Add raw materials like paneer, oil or milk with a minimum level. Restropi tells you what to order.")}</p>
              <Button className="mt-5" onClick={() => setEdit({ unit: "kg", stock: 0, par: 0, costPerUnit: 0, supplier: "" })}><Plus size={17} /> {L("Add first item")}</Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
                {[
                  [L("Stock value"), inr(Math.round(value))],
                  [L("Need ordering"), `${low.length} item${low.length === 1 ? "" : "s"}`],
                  [L("Used today"), inr(Math.round(usedToday))],
                  [L("Wasted · 7 days"), inr(Math.round(wasted))],
                ].map(([l, v]) => (
                  <div key={l} className="bg-surface p-4">
                    <div className="text-[13px] text-muted">{l}</div>
                    <div className="mt-1 text-[22px] font-semibold tracking-tight tnum">{v}</div>
                  </div>
                ))}
              </div>
              <Group flush>
                {items
                  .slice()
                  .sort((a, b) => (fc.of(a).daysLeft ?? (a.par ? (a.stock / a.par) * 3 : 99)) - (fc.of(b).daysLeft ?? (b.par ? (b.stock / b.par) * 3 : 99)) || a.name.localeCompare(b.name))
                  .map((i) => {
                    const f = fc.of(i);
                    const l = level(i, f);
                    const pct = i.par ? Math.min(100, (i.stock / i.par) * 100) : 100;
                    return (
                      <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                        <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(i)}>
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-medium">{i.name}</span>
                            <Pill tone={l.tone}>{L(l.label)}</Pill>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-sunken">
                              <div className={clsx("h-full rounded-full", l.tone === "rose" ? "bg-rose" : l.tone === "saffron" ? "bg-saffron" : "bg-jade")} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[12.5px] text-muted tnum">{fmt(i.stock)}{i.par ? ` / ${fmt(i.par)}` : ""} {i.unit}</span>
                          </div>
                          {f.basis !== "learning" && (
                            <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted tnum">
                              <span>{L("Today")} <b className="font-semibold text-ink">{fmt(f.today)} {i.unit}</b></span>
                              <span>{L("Tomorrow")} <b className="font-semibold text-ink">~{fmt(f.tomorrow)} {i.unit}</b></span>
                              {f.daysLeft !== null && <span>{L("Lasts")} <b className={clsx("font-semibold", f.daysLeft < 1 ? "text-rose" : f.daysLeft < 2.5 ? "text-saffron" : "text-ink")}>{f.daysLeft < 1 ? "<1 day" : L("{0} days", fmt(f.daysLeft))}</b></span>}
                            </div>
                          )}
                        </button>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="tinted" onClick={() => setMove({ item: i, kind: "in" })}><PackagePlus size={15} /> {L("In")}</Button>
                          <Button size="sm" variant="plain" onClick={() => setMove({ item: i, kind: "used" })}>{L("Used")}</Button>
                          <Button size="sm" variant="plain" onClick={() => setMove({ item: i, kind: "count" })}>{L("Count")}</Button>
                        </div>
                      </div>
                    );
                  })}
              </Group>
            </div>
          ))}

        {tab === "buy" &&
          (toBuy.length === 0 ? (
            <div className="rounded-group bg-surface px-5 py-10 text-center">
              <p className="text-[16px] font-semibold">{L("Nothing to buy")}</p>
              <p className="mt-1 text-[14px] text-muted">{L("Items show up here when they fall below their minimum level.")}</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {Object.entries(bySupplier).map(([sup, list]) => {
                const total = list.reduce((s, i) => s + i.need * i.costPerUnit, 0);
                const msg = [
                  `Hello ${sup},`,
                  "",
                  `Please send the following to *${outlet.name}*${outlet.address ? ` (${outlet.address})` : ""}:`,
                  "",
                  ...list.map((i, n) => `${n + 1}. ${i.name} — *${fmt(i.need)} ${i.unit}*`),
                  "",
                  `Delivery: ${new Date(Date.now() + 86_400_000).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "short" })}, before 10 am if possible.`,
                  "Please confirm the rates and total. Thank you!",
                ].join("\n");
                return (
                  <Group key={sup} title={sup} flush>
                    {list.map((i) => (
                      <div key={i.id} className="flex items-center justify-between border-b border-line/80 px-4 py-2.5 text-[14.5px] lg:px-5">
                        <span>{i.name}</span>
                        <span className="font-medium tnum">{fmt(i.need)} {i.unit}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5">
                      <span className="text-[13.5px] text-muted">{L("About")} {inr(Math.round(total))}</span>
                      <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
                        <Button size="sm"><MessageCircle size={15} /> {L("Send on WhatsApp")}</Button>
                      </a>
                    </div>
                  </Group>
                );
              })}
            </div>
          ))}

        {tab === "prep" && prepOn && <Prep outletId={outlet.id} items={items} />}
      </Page>

      <ItemSheet value={edit} onClose={() => setEdit(null)} onSaved={(n) => toast(L("{0} saved", n))} forecast={edit?.id ? fc.of(edit as StockItem) : undefined} dishes={edit?.id ? fc.dishesOf(edit.id).map((m) => m.name) : []} />
      <MoveSheet
        value={move}
        onClose={() => setMove(null)}
        onSave={(qty, note, kind) => {
          if (!move) return;
          stockActions.move(move.item.id, kind, qty, me?.name ?? "Staff", note);
          toast(kind === "in" ? "Added to stock" : kind === "count" ? "Stock count saved" : kind === "waste" ? "Waste logged" : "Stock updated");
          setMove(null);
        }}
      />
    </>
  );
}

function ItemSheet({ value, onClose, onSaved, forecast: f, dishes = [] }: { value: Partial<StockItem> | null; onClose: () => void; onSaved: (name: string) => void; forecast?: StockForecast; dishes?: string[] }) {
  const outlet = useCurrentOutlet();
  const [d, setD] = useState<Partial<StockItem>>({});
  const [confirm, setConfirm] = useState(false);
  const key = value ? value.id ?? "new" : null;
  useEffect(() => {
    if (value) { setD(value); setConfirm(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const ok = (d.name ?? "").trim().length > 1 && !!d.unit;
  const num = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={value?.id ? L("Edit item") : L("Add stock item")}
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={!ok}
          onClick={() => {
            stockActions.save({
              id: d.id, name: d.name!.trim(), unit: d.unit!, stock: d.stock ?? 0, par: d.par ?? 0, costPerUnit: d.costPerUnit ?? 0,
              supplier: (d.supplier ?? "").trim(), outletId: d.outletId ?? outlet.id, log: d.log,
              ...(d.usage ? { usage: d.usage } : {}), ...(d.adjust ? { adjust: d.adjust } : {}), ...(d.lastCount ? { lastCount: d.lastCount } : {}),
            });
            onSaved(d.name!.trim());
            onClose();
          }}
        >
          {L("Save")}</Button>
      }
    >
      <div className="space-y-4">
        <Field label={L("Name")}><input className={inputCls} placeholder={L("e.g. Paneer")} value={d.name ?? ""} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label={L("Unit")}>
          <div className="flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <button key={u} type="button" onClick={() => setD({ ...d, unit: u })} className={clsx("rounded-full px-3.5 py-1.5 text-[14px] font-medium", d.unit === u ? "bg-ink text-canvas" : "bg-surface")}>{u}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          {!value?.id && <Field label={L("In stock now ({0})", d.unit ?? "")}><input className={inputCls} inputMode="decimal" value={d.stock ?? ""} onChange={(e) => setD({ ...d, stock: num(e.target.value) })} /></Field>}
          <Field label={L("Minimum level ({0})", d.unit ?? "")} hint={L("Below this it goes on the buy list.")}><input className={inputCls} inputMode="decimal" value={d.par ?? ""} onChange={(e) => setD({ ...d, par: num(e.target.value) })} /></Field>
          <Field label={L("Cost per {0} (₹)", d.unit ?? "unit")}><input className={inputCls} inputMode="decimal" value={d.costPerUnit ?? ""} onChange={(e) => setD({ ...d, costPerUnit: num(e.target.value) })} /></Field>
        </div>
        <Field label={L("Supplier")} hint={L("Optional")}><input className={inputCls} value={d.supplier ?? ""} onChange={(e) => setD({ ...d, supplier: e.target.value })} /></Field>

        {value?.id && f && <Smart item={value as StockItem} f={f} dishes={dishes} />}
        {value?.id && (d.log?.length ?? 0) > 0 && (
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">{L("History")}</div>
            <div className="max-h-56 overflow-y-auto rounded-group bg-surface">
              {d.log!.map((l, i) => (
                <div key={i} className="flex justify-between border-b border-line/70 px-4 py-2 text-[13.5px] last:border-0">
                  <span>
                    {l.kind === "in" ? `+${fmt(l.qty)}` : l.kind === "count" ? L("Counted {0}", fmt(l.qty)) : `−${fmt(l.qty)}`} {d.unit}
                    {l.kind === "waste" && <span className="ml-1.5 text-rose">{L("wasted")}</span>}
                    {l.note && <span className="ml-1.5 text-muted">· {L(l.note)}</span>}
                  </span>
                  <span className="text-muted">{l.by} · {new Date(l.at).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {value?.id &&
          (!confirm ? (
            <button onClick={() => setConfirm(true)} className="flex items-center gap-2 text-[14px] font-semibold text-rose"><Trash2 size={16} /> {L("Remove item")}</button>
          ) : (
            <div className="flex items-center gap-2 rounded-group bg-rose-soft p-3">
              <span className="flex-1 text-[14px] text-rose">{L("Remove")} {d.name}?</span>
              <Button size="sm" variant="plain" onClick={() => setConfirm(false)}>{L("Keep")}</Button>
              <Button size="sm" variant="danger" onClick={() => { stockActions.remove(value.id!); onClose(); }}>{L("Remove")}</Button>
            </div>
          ))}
        {value?.id && <p className="flex items-center gap-1.5 text-[12.5px] text-faint"><Pencil size={12} /> {L("Use In / Used / Count on the list to change the stock level.")}</p>}
      </div>
    </Sheet>
  );
}

function MoveSheet({ value, onClose, onSave }: { value: { item: StockItem; kind: StockLog["kind"] } | null; onClose: () => void; onSave: (qty: number, note: string, kind: StockLog["kind"]) => void }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<StockLog["kind"]>("in");
  const key = value ? `${value.item.id}-${value.kind}` : "";
  useEffect(() => {
    if (value) { setQty(""); setNote(""); setKind(value.kind); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const n = Number(qty.replace(",", "."));
  const i = value?.item;
  // can't use or waste more than is in stock (do a Count first if the real amount is higher)
  const tooMuch = !!i && (kind === "used" || kind === "waste") && n > i.stock + 1e-9;
  const ok = qty !== "" && Number.isFinite(n) && n >= 0 && (kind === "count" || n > 0) && !tooMuch;

  return (
    <Sheet
      open={!!value}
      onClose={onClose}
      title={i ? i.name : ""}
      footer={<Button size="lg" className="w-full" disabled={!ok} onClick={() => onSave(n, note.trim(), kind)}>{tooMuch ? L("Only {0} {1} in stock", fmt(i!.stock), i!.unit) : L("Save")}</Button>}
    >
      {i && (
        <div className="space-y-4">
          <p className="text-[14px] text-muted">{L("In stock now:")} <b className="text-ink">{fmt(i.stock)} {i.unit}</b></p>
          <Segmented
            className="w-full"
            value={kind}
            onChange={setKind}
            options={[{ value: "in", label: "Received" }, { value: "used", label: "Used" }, { value: "waste", label: "Wasted" }, { value: "count", label: "Count" }]}
          />
          <Field label={kind === "count" ? L("Counted now ({0})", i.unit) : L("How much ({0})", i.unit)}>
            <input className={inputCls} inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          {tooMuch && (
            <p className="-mt-2 rounded-ctl bg-saffron-soft px-3 py-2 text-[13px]">
              {L("That's more than the")} {fmt(i.stock)} {i.unit} {L("in stock. If you really have more, use")} <b>{L("Count")}</b> {L("to set the right amount first.")}</p>
          )}
          <Field label={L("Note")} hint={L("Optional, e.g. bill number or why it was wasted")}><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      )}
    </Sheet>
  );
}

/** Tomorrow's prep: average of what sold on the same weekday over the last 4 weeks. */
function Prep({ outletId, items }: { outletId: string; items: StockItem[] }) {
  const fc = useForecasts(items, outletId);
  const needs = items.map((i) => ({ i, f: fc.of(i) })).filter((x) => x.f.tomorrow > 0).sort((a, b) => (a.f.daysLeft ?? 99) - (b.f.daysLeft ?? 99));
  const orders = inOutlet(useOrders(), outletId);
  const tomorrow0 = startOfDay() + DAY_MS;
  const weeks = [1, 2, 3, 4].map((w) => between(orders, tomorrow0 - w * 7 * DAY_MS, tomorrow0 - w * 7 * DAY_MS + DAY_MS));
  const withData = weeks.filter((w) => w.length > 0).length;
  const all = topDishes(weeks.flat(), 1000);
  const rows = all.map((d) => ({ ...d, plates: Math.ceil(d.qty / Math.max(1, withData)) })).sort((a, b) => b.plates - a.plates).slice(0, 15);
  const day = new Date(tomorrow0).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      <section className="rounded-group bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron"><Sparkles size={18} /></span>
          <div>
            <div className="text-[13px] text-muted">{L("Prep for")} {day}</div>
            <p className="mt-1 text-[17px] font-medium leading-snug">
              {withData ? L("Based on the last {0} {1}{2}.", withData, new Date(tomorrow0).toLocaleDateString(dateLocale(), { weekday: "long" }), withData > 1 ? "s" : "") : needs.length ? L("Stock below follows your recent use · plates show after a week of sales.") : L("Not enough orders yet. This fills in after a week of sales.")}
            </p>
          </div>
        </div>
      </section>
      {needs.length > 0 && (
        <Group title={L("Stock needed tomorrow")} flush>
          {needs.map(({ i, f }) => (
            <div key={i.id} className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 text-[14.5px] last:border-0 lg:px-5">
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              <span className="font-semibold tnum">~{fmt(f.tomorrow)} {i.unit}</span>
              <span className={clsx("w-28 text-right text-[12.5px] tnum", f.tomorrow > i.stock ? "font-semibold text-rose" : "text-muted")}>{f.tomorrow > i.stock ? L("short {0}", fmt(Math.round((f.tomorrow - i.stock) * 100) / 100)) : L("{0} {1} in stock", fmt(i.stock), i.unit)}</span>
            </div>
          ))}
        </Group>
      )}
      {rows.length > 0 && (
        <Group title={L("Expected plates")} flush>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-line/80 px-4 py-2.5 text-[14.5px] last:border-0 lg:px-5">
              <span>{r.name}</span>
              <span className="font-semibold tnum">{r.plates}</span>
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}

/** An item's smart numbers: today, a usual day, tomorrow, how long it lasts, how close the kitchen is to the recipes. */
function Smart({ item, f, dishes }: { item: StockItem; f: StockForecast; dishes: string[] }) {
  const days = Array.from({ length: 14 }, (_, k) => dayKey(Date.now() - (13 - k) * DAY_MS));
  const vals = days.map((d) => (item.usage?.[d] ?? 0) * f.adjust);
  const max = Math.max(...vals, 0.0001);
  const pct = Math.round((f.adjust - 1) * 100);
  return (
    <div className="rounded-group bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
        <Sparkles size={14} className="text-saffron" /> {L("Smart stock")}<Hint align="left">{L("Each paid plate takes its recipe off stock. Your counts teach how much the kitchen really uses, and the forecast follows the same weekday, the last 7 days and tomorrow's expected plates.")}</Hint>
      </div>
      {f.basis === "learning" ? (
        <p className="mt-2 text-[13.5px] text-muted">{dishes.length ? L("Learning: numbers show after a few days of sales.") : L("Link dishes to this item (Menu → dish → Uses from stock) to track it by itself.")}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              [L("Today"), fmt(f.today)],
              [L("A day"), fmt(f.avg7)],
              [L("Tomorrow"), `~${fmt(f.tomorrow)}`],
              [L("Lasts"), f.daysLeft === null ? "—" : f.daysLeft < 1 ? "<1 d" : `${fmt(f.daysLeft)} d`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-[12px] bg-sunken/60 px-1 py-2">
                <div className="text-[16px] font-semibold tnum">{v}</div>
                <div className="text-[11.5px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex h-12 items-end gap-1" aria-label={L("Use in the last 14 days")}>
            {vals.map((v, k) => (
              <span key={k} title={`${days[k]}: ${fmt(Math.round(v * 100) / 100)} ${item.unit}`} className={clsx("flex-1 rounded-t-[3px]", k === 13 ? "bg-jade" : "bg-jade/35")} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
            ))}
          </div>
        </>
      )}
      <div className="mt-3 space-y-1 text-[12.5px] text-muted">
        {item.adjust && Math.abs(pct) >= 2 ? (
          <div>{L("Kitchen uses")} <b className={pct > 0 ? "text-saffron" : "text-jade"}>{Math.abs(pct)}% {pct > 0 ? "more" : "less"}</b> {L("than the recipes (from your counts)")}</div>
        ) : item.lastCount ? (
          <div>{L("Last count matched the recipes")}</div>
        ) : null}
        {dishes.length > 0 && <div className="truncate">{L("Used in:")} {dishes.join(", ")}</div>}
      </div>
    </div>
  );
}
