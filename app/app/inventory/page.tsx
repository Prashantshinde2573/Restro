"use client";

import clsx from "clsx";
import { MessageCircle, Package, PackagePlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Group, Page, PageHeader, Pill, Segmented, Sheet, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { stockActions, useCurrentOutlet, useFeature, useMe, useOrders, useStock } from "@/lib/live";
import { DAY_MS, between, inOutlet, startOfDay, topDishes } from "@/lib/stats";
import { inr } from "@/lib/format";
import type { StockItem, StockLog } from "@/lib/types";

function level(i: StockItem) {
  if (i.stock <= 0) return { tone: "rose" as const, label: "Out" };
  if (i.par > 0 && i.stock < i.par * 0.5) return { tone: "rose" as const, label: "Low" };
  if (i.par > 0 && i.stock < i.par) return { tone: "saffron" as const, label: "Order soon" };
  return { tone: "jade" as const, label: "OK" };
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

  const value = items.reduce((s, i) => s + i.stock * i.costPerUnit, 0);
  const low = items.filter((i) => level(i).tone !== "jade");
  const weekAgo = Date.now() - 7 * DAY_MS;
  const wasted = items.reduce(
    (s, i) => s + (i.log ?? []).filter((l) => l.kind === "waste" && new Date(l.at).getTime() > weekAgo).reduce((a, l) => a + l.qty * i.costPerUnit, 0),
    0,
  );
  const toBuy = items.filter((i) => i.par > 0 && i.stock < i.par).map((i) => ({ ...i, need: Math.ceil((i.par - i.stock) * 2) / 2 }));
  const bySupplier = toBuy.reduce<Record<string, typeof toBuy>>((acc, i) => ((acc[i.supplier || "No supplier set"] ??= []).push(i), acc), {});

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle={items.length ? `${inr(Math.round(value))} in stock · ${low.length} need ordering` : outlet.name}
        actions={<Button variant="tinted" size="sm" onClick={() => setEdit({ unit: "kg", stock: 0, par: 0, costPerUnit: 0, supplier: "" })}><Plus size={15} /> Add item</Button>}
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
              <h2 className="mt-4 text-[18px] font-semibold">Track your stock</h2>
              <p className="mt-1 max-w-sm text-[14.5px] text-muted">Add raw materials like paneer, oil or milk with a minimum level. Restropi tells you what to order.</p>
              <Button className="mt-5" onClick={() => setEdit({ unit: "kg", stock: 0, par: 0, costPerUnit: 0, supplier: "" })}><Plus size={17} /> Add first item</Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
                {[
                  ["Stock value", inr(Math.round(value))],
                  ["Need ordering", `${low.length} item${low.length === 1 ? "" : "s"}`],
                  ["Items tracked", String(items.length)],
                  ["Wasted · 7 days", inr(Math.round(wasted))],
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
                  .sort((a, b) => (a.par ? a.stock / a.par : 99) - (b.par ? b.stock / b.par : 99) || a.name.localeCompare(b.name))
                  .map((i) => {
                    const l = level(i);
                    const pct = i.par ? Math.min(100, (i.stock / i.par) * 100) : 100;
                    return (
                      <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                        <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(i)}>
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-medium">{i.name}</span>
                            <Pill tone={l.tone}>{l.label}</Pill>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-sunken">
                              <div className={clsx("h-full rounded-full", l.tone === "rose" ? "bg-rose" : l.tone === "saffron" ? "bg-saffron" : "bg-jade")} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[12.5px] text-muted tnum">{fmt(i.stock)}{i.par ? ` / ${fmt(i.par)}` : ""} {i.unit}</span>
                          </div>
                        </button>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="tinted" onClick={() => setMove({ item: i, kind: "in" })}><PackagePlus size={15} /> In</Button>
                          <Button size="sm" variant="plain" onClick={() => setMove({ item: i, kind: "used" })}>Used</Button>
                          <Button size="sm" variant="plain" onClick={() => setMove({ item: i, kind: "count" })}>Count</Button>
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
              <p className="text-[16px] font-semibold">Nothing to buy</p>
              <p className="mt-1 text-[14px] text-muted">Items show up here when they fall below their minimum level.</p>
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
                  `Delivery: ${new Date(Date.now() + 86_400_000).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}, before 10 am if possible.`,
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
                      <span className="text-[13.5px] text-muted">About {inr(Math.round(total))}</span>
                      <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
                        <Button size="sm"><MessageCircle size={15} /> Send on WhatsApp</Button>
                      </a>
                    </div>
                  </Group>
                );
              })}
            </div>
          ))}

        {tab === "prep" && prepOn && <Prep outletId={outlet.id} />}
      </Page>

      <ItemSheet value={edit} onClose={() => setEdit(null)} onSaved={(n) => toast(`${n} saved`)} />
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

function ItemSheet({ value, onClose, onSaved }: { value: Partial<StockItem> | null; onClose: () => void; onSaved: (name: string) => void }) {
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
      title={value?.id ? "Edit item" : "Add stock item"}
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={!ok}
          onClick={() => {
            stockActions.save({
              id: d.id, name: d.name!.trim(), unit: d.unit!, stock: d.stock ?? 0, par: d.par ?? 0, costPerUnit: d.costPerUnit ?? 0,
              supplier: (d.supplier ?? "").trim(), outletId: d.outletId ?? outlet.id, log: d.log,
            });
            onSaved(d.name!.trim());
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name"><input className={inputCls} placeholder="e.g. Paneer" value={d.name ?? ""} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Unit">
          <div className="flex flex-wrap gap-2">
            {UNITS.map((u) => (
              <button key={u} type="button" onClick={() => setD({ ...d, unit: u })} className={clsx("rounded-full px-3.5 py-1.5 text-[14px] font-medium", d.unit === u ? "bg-ink text-canvas" : "bg-surface")}>{u}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          {!value?.id && <Field label={`In stock now (${d.unit ?? ""})`}><input className={inputCls} inputMode="decimal" value={d.stock ?? ""} onChange={(e) => setD({ ...d, stock: num(e.target.value) })} /></Field>}
          <Field label={`Minimum level (${d.unit ?? ""})`} hint="Below this it goes on the buy list."><input className={inputCls} inputMode="decimal" value={d.par ?? ""} onChange={(e) => setD({ ...d, par: num(e.target.value) })} /></Field>
          <Field label={`Cost per ${d.unit ?? "unit"} (₹)`}><input className={inputCls} inputMode="decimal" value={d.costPerUnit ?? ""} onChange={(e) => setD({ ...d, costPerUnit: num(e.target.value) })} /></Field>
        </div>
        <Field label="Supplier" hint="Optional"><input className={inputCls} value={d.supplier ?? ""} onChange={(e) => setD({ ...d, supplier: e.target.value })} /></Field>

        {value?.id && (d.log?.length ?? 0) > 0 && (
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">History</div>
            <div className="max-h-56 overflow-y-auto rounded-group bg-surface">
              {d.log!.map((l, i) => (
                <div key={i} className="flex justify-between border-b border-line/70 px-4 py-2 text-[13.5px] last:border-0">
                  <span>
                    {l.kind === "in" ? `+${fmt(l.qty)}` : l.kind === "count" ? `Counted ${fmt(l.qty)}` : `−${fmt(l.qty)}`} {d.unit}
                    {l.kind === "waste" && <span className="ml-1.5 text-rose">wasted</span>}
                    {l.note && <span className="ml-1.5 text-muted">· {l.note}</span>}
                  </span>
                  <span className="text-muted">{l.by} · {new Date(l.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {value?.id &&
          (!confirm ? (
            <button onClick={() => setConfirm(true)} className="flex items-center gap-2 text-[14px] font-semibold text-rose"><Trash2 size={16} /> Remove item</button>
          ) : (
            <div className="flex items-center gap-2 rounded-group bg-rose-soft p-3">
              <span className="flex-1 text-[14px] text-rose">Remove {d.name}?</span>
              <Button size="sm" variant="plain" onClick={() => setConfirm(false)}>Keep</Button>
              <Button size="sm" variant="danger" onClick={() => { stockActions.remove(value.id!); onClose(); }}>Remove</Button>
            </div>
          ))}
        {value?.id && <p className="flex items-center gap-1.5 text-[12.5px] text-faint"><Pencil size={12} /> Use In / Used / Count on the list to change the stock level.</p>}
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
      footer={<Button size="lg" className="w-full" disabled={!ok} onClick={() => onSave(n, note.trim(), kind)}>{tooMuch ? `Only ${fmt(i!.stock)} ${i!.unit} in stock` : "Save"}</Button>}
    >
      {i && (
        <div className="space-y-4">
          <p className="text-[14px] text-muted">In stock now: <b className="text-ink">{fmt(i.stock)} {i.unit}</b></p>
          <Segmented
            className="w-full"
            value={kind}
            onChange={setKind}
            options={[{ value: "in", label: "Received" }, { value: "used", label: "Used" }, { value: "waste", label: "Wasted" }, { value: "count", label: "Count" }]}
          />
          <Field label={kind === "count" ? `Counted now (${i.unit})` : `How much (${i.unit})`}>
            <input className={inputCls} inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          {tooMuch && (
            <p className="-mt-2 rounded-ctl bg-saffron-soft px-3 py-2 text-[13px]">
              That&apos;s more than the {fmt(i.stock)} {i.unit} in stock. If you really have more, use <b>Count</b> to set the right amount first.
            </p>
          )}
          <Field label="Note" hint="Optional, e.g. bill number or why it was wasted"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      )}
    </Sheet>
  );
}

/** Tomorrow's prep: average of what sold on the same weekday over the last 4 weeks. */
function Prep({ outletId }: { outletId: string }) {
  const orders = inOutlet(useOrders(), outletId);
  const tomorrow0 = startOfDay() + DAY_MS;
  const weeks = [1, 2, 3, 4].map((w) => between(orders, tomorrow0 - w * 7 * DAY_MS, tomorrow0 - w * 7 * DAY_MS + DAY_MS));
  const withData = weeks.filter((w) => w.length > 0).length;
  const all = topDishes(weeks.flat(), 1000);
  const rows = all.map((d) => ({ ...d, plates: Math.ceil(d.qty / Math.max(1, withData)) })).sort((a, b) => b.plates - a.plates).slice(0, 15);
  const day = new Date(tomorrow0).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      <section className="rounded-group bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron"><Sparkles size={18} /></span>
          <div>
            <div className="text-[13px] text-muted">Prep for {day}</div>
            <p className="mt-1 text-[17px] font-medium leading-snug">
              {withData ? `Based on the last ${withData} ${new Date(tomorrow0).toLocaleDateString("en-IN", { weekday: "long" })}${withData > 1 ? "s" : ""}.` : "Not enough orders yet. This fills in after a week of sales."}
            </p>
          </div>
        </div>
      </section>
      {rows.length > 0 && (
        <Group title="Expected plates" flush>
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
