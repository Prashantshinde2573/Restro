"use client";

import { useFeature } from "@/lib/live";
import clsx from "clsx";
import { CloudSun, MessageCircle, PackageCheck, Plus, Sparkles, Trash } from "lucide-react";
import { useState } from "react";
import { Button, Field, Group, Page, PageHeader, Pill, Segmented, Sheet, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";
import type { Ingredient } from "@/lib/types";

const pos = [
  { id: "PO-311", supplier: "Chitale Dairy", items: "Paneer 6 kg, Cream 4 L, Milk 10 L", total: 5260, status: "sent", when: "Today, 10:40" },
  { id: "PO-310", supplier: "Metro Cash & Carry", items: "Maida 25 kg, Basmati 25 kg", total: 3800, status: "received", when: "Yesterday" },
  { id: "PO-309", supplier: "Sassoon Dock", items: "Surmai 4 kg", total: 3520, status: "late", when: "Due yesterday" },
  { id: "PO-308", supplier: "Venky's", items: "Chicken boneless 15 kg", total: 4200, status: "received", when: "Sat" },
];

const prep = [
  { dish: "Butter Naan", plates: 92 },
  { dish: "Butter Chicken", plates: 44 },
  { dish: "Dal Makhani", plates: 38 },
  { dish: "Hyderabadi Dum Biryani", plates: 33 },
  { dish: "Paneer Tikka", plates: 31 },
  { dish: "Masala Chaas", plates: 48 },
];

function level(i: Ingredient) {
  if (i.stock <= 0) return { tone: "rose" as const, label: "Out" };
  if (i.stock < i.par * 0.5) return { tone: "rose" as const, label: "Low" };
  if (i.stock < i.par) return { tone: "saffron" as const, label: "Below par" };
  return { tone: "jade" as const, label: "OK" };
}

export default function InventoryPage() {
  const prepOn = useFeature("prepForecast") === "ok";
  const toast = useToast();
  const [tab, setTab] = useState<"stock" | "prep" | "purchases">("stock");
  const [waste, setWaste] = useState(false);
  const [receive, setReceive] = useState<string | null>(null);
  const items = repo.ingredients();

  const value = items.reduce((s, i) => s + i.stock * i.costPerUnit, 0);
  const low = items.filter((i) => i.stock < i.par * 0.5);
  const expiring = items.filter((i) => (i.expiresInDays ?? 99) <= 2);
  const toOrder = items
    .map((i) => ({ ...i, need: Math.max(0, Math.ceil((i.forecastTomorrow + i.par * 0.3 - i.stock) * 2) / 2) }))
    .filter((i) => i.need > 0);
  const bySupplier = toOrder.reduce<Record<string, typeof toOrder>>((acc, i) => ((acc[i.supplier] ??= []).push(i), acc), {});

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle={`${inr(Math.round(value))} in stock · ${low.length} running low`}
        actions={<Button variant="tinted" size="sm" onClick={() => setWaste(true)}><Trash size={15} /> Log waste</Button>}
      >
        <Segmented value={tab} onChange={setTab} options={[{ value: "stock", label: "In stock" }, ...(prepOn ? [{ value: "prep" as const, label: "Tomorrow's prep" }] : []), { value: "purchases", label: "Purchases" }]} />
      </PageHeader>

      <Page>
        {tab === "stock" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
              {[
                ["Stock value", inr(Math.round(value))],
                ["Running low", `${low.length} items`],
                ["Use within 2 days", `${expiring.length} items`],
                ["Wasted this week", inr(2140)],
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
                .sort((a, b) => a.stock / a.par - b.stock / b.par)
                .map((i) => {
                  const l = level(i);
                  const pct = Math.min(100, (i.stock / i.par) * 100);
                  return (
                    <div key={i.id} className="flex items-center gap-4 border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium">{i.name}</span>
                          {(i.expiresInDays ?? 99) <= 2 && <Pill tone="saffron">Use in {i.expiresInDays}d</Pill>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-sunken">
                            <div className={clsx("h-full rounded-full", l.tone === "rose" ? "bg-rose" : l.tone === "saffron" ? "bg-saffron" : "bg-jade")} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[12.5px] text-muted tnum">{i.stock} / {i.par} {i.unit}</span>
                        </div>
                      </div>
                      <div className="hidden text-right text-[13px] text-muted sm:block">
                        <div className="tnum">{inr(i.costPerUnit)}/{i.unit}</div>
                        <div>{i.supplier}</div>
                      </div>
                      <Pill tone={l.tone}>{l.label}</Pill>
                    </div>
                  );
                })}
            </Group>
          </div>
        )}

        {tab === "prep" && prepOn && (
          <div className="space-y-6">
            <section className="rounded-group bg-surface p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron"><Sparkles size={18} /></span>
                <div>
                  <div className="text-[13px] text-muted">Forecast for Wednesday, 28 Oct</div>
                  <p className="mt-1 text-[18px] font-medium leading-snug tracking-tight lg:text-[20px]">
                    Expect about <b>240 guests</b> — 18% more than a normal Wednesday. Diwali shopping crowds and a clear evening.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[13px] text-muted">
                    <span className="flex items-center gap-1"><CloudSun size={14} /> 27°, no rain</span>
                    <span>Based on 8 weeks of your sales</span>
                    <span>2 bookings so far</span>
                  </div>
                </div>
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-2">
              <Group title="Prep list for the kitchen" flush action={<button onClick={() => toast("Prep list sent to Chef Ganesh")} className="text-[14px] font-semibold text-jade">Send to chef</button>}>
                {prep.map((p) => (
                  <div key={p.dish} className="flex items-center justify-between border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                    <span className="text-[15px]">{p.dish}</span>
                    <span className="text-[15px] font-semibold tnum">{p.plates} plates</span>
                  </div>
                ))}
              </Group>
              <Group title="Order today so you don't run out" flush>
                {Object.entries(bySupplier).map(([sup, list]) => (
                  <div key={sup} className="border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-semibold">{sup}</span>
                      <span className="text-[14px] font-semibold tnum">{inr(Math.round(list.reduce((s, i) => s + i.need * i.costPerUnit, 0)))}</span>
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">{list.map((i) => `${i.name} ${i.need} ${i.unit}`).join(" · ")}</div>
                  </div>
                ))}
                <div className="p-4 lg:p-5">
                  <Button className="w-full" onClick={() => { setTab("purchases"); toast(`${Object.keys(bySupplier).length} purchase orders sent on WhatsApp`); }}>
                    <MessageCircle size={17} /> Send {Object.keys(bySupplier).length} orders on WhatsApp
                  </Button>
                </div>
              </Group>
            </div>
          </div>
        )}

        {tab === "purchases" && (
          <Group flush title="Purchase orders" action={<button onClick={() => toast("New purchase order")} className="flex items-center gap-1 text-[14px] font-semibold text-jade"><Plus size={15} /> New</button>}>
            {pos.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{p.supplier}</span>
                    <span className="text-[12.5px] text-faint">{p.id}</span>
                  </div>
                  <div className="truncate text-[13px] text-muted">{p.items}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-semibold tnum">{inr(p.total)}</div>
                  <div className="text-[12px] text-muted">{p.when}</div>
                </div>
                {p.status === "received" ? (
                  <Pill tone="jade">Received</Pill>
                ) : (
                  <Button size="sm" variant={p.status === "late" ? "danger" : "tinted"} onClick={() => setReceive(p.id)}>
                    <PackageCheck size={15} /> Receive
                  </Button>
                )}
              </div>
            ))}
          </Group>
        )}
      </Page>

      <Sheet open={waste} onClose={() => setWaste(false)} title="Log waste" footer={<Button size="lg" className="w-full" onClick={() => { setWaste(false); toast("Waste logged · stock updated"); }}>Save</Button>}>
        <div className="space-y-4">
          <Field label="Item">
            <select className={inputCls}>{items.map((i) => <option key={i.id}>{i.name}</option>)}</select>
          </Field>
          <Field label="Quantity"><input className={inputCls} inputMode="decimal" placeholder="0.5" /></Field>
          <Field label="Reason">
            <div className="flex flex-wrap gap-2">
              {["Spoiled", "Over-cooked", "Dropped", "Returned by guest", "Expired"].map((r) => (
                <button key={r} className="rounded-full bg-surface px-3.5 py-2 text-[14px] font-medium focus:bg-ink focus:text-canvas">{r}</button>
              ))}
            </div>
          </Field>
        </div>
      </Sheet>

      <Sheet open={!!receive} onClose={() => setReceive(null)} title="Receive delivery" footer={<Button size="lg" className="w-full" onClick={() => { setReceive(null); toast("Stock updated · bill saved to supplier account"); }}>Add to stock</Button>}>
        <p className="mb-4 text-[14px] text-muted">Check what actually arrived. Short or damaged items are noted against the supplier.</p>
        <div className="overflow-hidden rounded-group bg-surface">
          {[["Paneer", "6 kg", "Exp 31 Oct"], ["Fresh cream", "4 L", "Exp 29 Oct"], ["Milk", "10 L", "Exp 28 Oct"]].map(([n, q, e]) => (
            <div key={n} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
              <span className="flex-1 text-[15px]">{n}<span className="block text-[12.5px] text-muted">{e}</span></span>
              <input className="h-10 w-20 rounded-[10px] bg-sunken px-3 text-right text-[15px] tnum outline-none focus:ring-2 focus:ring-jade" defaultValue={q} />
            </div>
          ))}
        </div>
        <button className="mt-4 w-full rounded-group border-2 border-dashed border-line py-5 text-[14px] font-medium text-muted">Snap the supplier bill</button>
      </Sheet>
    </>
  );
}
