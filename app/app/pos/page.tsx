"use client";

import clsx from "clsx";
import { ChevronDown, Mic, Minus, Plus, Search, Send, Trash2, X, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Chips, DietMark, DishArt, Segmented, Sheet } from "@/components/ui";
import { Checkout, billTotals } from "@/components/checkout";
import { VoiceOrder } from "@/components/voice";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";
import type { MenuItem, OrderType } from "@/lib/types";

type Line = { item: MenuItem; qty: number; note?: string };
const NOTES = ["Less spicy", "Extra spicy", "No onion", "Jain", "Pack separately"];

export default function PosPage() {
  const { t } = useT();
  const toast = useToast();
  const menu = repo.menu();
  const cats = repo.categories();
  const tables = repo.tables();

  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [type, setType] = useState<OrderType>("dine-in");
  const [table, setTable] = useState("T3");
  const [lines, setLines] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [pickTable, setPickTable] = useState(false);
  const [voice, setVoice] = useState(false);
  const [pay, setPay] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const items = useMemo(
    () =>
      menu.filter(
        (m) => (cat === "all" || m.categoryId === cat) && (!q || m.name.toLowerCase().includes(q.toLowerCase())),
      ),
    [menu, cat, q],
  );

  const add = (item: MenuItem, qty = 1, note?: string) => {
    if (!item.available) return;
    setSent(false);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.item.id === item.id && l.note === note);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { item, qty, note }];
    });
  };
  const change = (idx: number, d: number) =>
    setLines((ls) => ls.flatMap((l, i) => (i !== idx ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * l.item.price, 0);
  const totals = billTotals(subtotal);
  const qtyOf = (id: string) => lines.filter((l) => l.item.id === id).reduce((s, l) => s + l.qty, 0);
  const label = type === "dine-in" ? `Table ${table}` : type === "takeaway" ? "Takeaway" : "Delivery";

  const sendKitchen = () => {
    setSent(true);
    toast(`KOT sent · ${count} items for ${label}`);
  };

  const Cart = (
    <div className="flex h-full flex-col">
      <div className="space-y-3 px-4 pt-4 lg:px-5 lg:pt-5">
        <Segmented
          className="w-full"
          value={type}
          onChange={setType}
          options={[
            { value: "dine-in", label: "Dine-in" },
            { value: "takeaway", label: "Takeaway" },
            { value: "delivery", label: "Delivery" },
          ]}
        />
        {type === "dine-in" ? (
          <button onClick={() => setPickTable(true)} className="flex w-full items-center justify-between rounded-ctl bg-sunken/70 px-4 py-2.5 text-left">
            <span>
              <span className="block text-[12px] text-muted">Table</span>
              <span className="text-[16px] font-semibold">{table} · Main hall</span>
            </span>
            <ChevronDown size={18} className="text-muted" />
          </button>
        ) : (
          <input className="h-12 w-full rounded-ctl bg-sunken/70 px-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade" placeholder={type === "delivery" ? "Guest phone or address" : "Guest name or phone (optional)"} />
        )}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 lg:px-3">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center">
            <p className="text-[15px] font-medium">No dishes yet</p>
            <p className="mt-1 text-[13.5px] text-muted">Tap a dish to add it, or press the mic and say the order.</p>
          </div>
        ) : (
          lines.map((l, i) => (
            <div key={`${l.item.id}-${l.note ?? ""}`} className="group flex items-start gap-3 rounded-ctl px-2 py-2.5 hover:bg-sunken/40">
              <div className="mt-1"><DietMark diet={l.item.diet} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium leading-tight">{l.item.name}</div>
                <button onClick={() => setNoteFor(`${i}`)} className={clsx("mt-0.5 text-[12.5px]", l.note ? "font-medium text-saffron" : "text-faint hover:text-jade")}>
                  {l.note ?? "Add note"}
                </button>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-sunken p-0.5">
                <button aria-label="Remove one" onClick={() => change(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface">
                  {l.qty === 1 ? <Trash2 size={13} className="text-rose" /> : <Minus size={13} />}
                </button>
                <span className="w-5 text-center text-[14px] font-semibold tnum">{l.qty}</span>
                <button aria-label="Add one" onClick={() => change(i, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface">
                  <Plus size={13} />
                </button>
              </div>
              <div className="w-16 pt-1 text-right text-[14px] font-semibold tnum">{inr(l.qty * l.item.price)}</div>
            </div>
          ))
        )}
      </div>

      <div className="pb-safe space-y-3 border-t border-line px-4 pt-3 pb-4 lg:px-5">
        <div className="flex items-baseline justify-between text-[13.5px] text-muted">
          <span>{count} items · GST 5% included at checkout</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium">Total</span>
          <span className="text-[26px] font-semibold tracking-tight tnum">{inr(totals.total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="tinted" size="lg" className="!px-3 whitespace-nowrap !text-[15px]" disabled={!lines.length || sent} onClick={sendKitchen}>
            {sent ? <><Check size={18} /> Sent</> : <><Send size={17} /> {t("sendKitchen")}</>}
          </Button>
          <Button size="lg" className="!text-[15px]" disabled={!lines.length} onClick={() => { setCartOpen(false); setPay(true); }}>
            {t("charge")}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh lg:h-[calc(100dvh-24px)] lg:min-h-0">
      {/* Menu side */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 space-y-3 bg-canvas/90 px-4 pb-3 pt-3 backdrop-blur-xl lg:static lg:bg-transparent lg:px-8 lg:pt-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="large-title">{t("pos")}</h1>
            <Button variant="tinted" size="sm" className="!rounded-full lg:hidden" onClick={() => setVoice(true)}>
              <Mic size={16} /> Speak
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search")}
                className="h-11 w-full rounded-ctl bg-surface pl-10 pr-9 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade"
              />
              {q && (
                <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint">
                  <X size={15} />
                </button>
              )}
            </div>
            <Button variant="tinted" className="hidden lg:inline-flex" onClick={() => setVoice(true)}>
              <Mic size={17} /> Speak order
            </Button>
          </div>
          <Chips
            value={cat}
            onChange={setCat}
            options={[{ value: "all", label: "All" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-36 lg:px-8 lg:pb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => {
              const n = qtyOf(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => add(m)}
                  disabled={!m.available}
                  className={clsx(
                    "group relative flex flex-col overflow-hidden rounded-[18px] bg-surface text-left transition active:scale-[.97]",
                    n > 0 && "ring-2 ring-jade",
                    !m.available && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between p-3 pb-0">
                    <DishArt hue={m.hue} className="h-11 w-11 rounded-full lg:h-12 lg:w-12" />
                    {n > 0 && (
                      <span className="flex h-7 min-w-7 animate-pop items-center justify-center rounded-full bg-jade px-2 text-[13px] font-bold text-white tnum">
                        {n}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-[3px]"><DietMark diet={m.diet} /></span>
                      <span className="text-[14.5px] font-semibold leading-tight">{m.name}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-[14px] font-medium text-muted tnum">{inr(m.price)}</span>
                      {!m.available ? (
                        <span className="text-[11.5px] font-semibold text-rose">Sold out</span>
                      ) : m.tags?.[0] ? (
                        <span className="text-[11.5px] font-medium text-saffron">{m.tags[0]}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart: side panel on desktop */}
      <aside className="hidden w-[400px] shrink-0 bg-surface lg:block lg:rounded-r-[28px] lg:border-l lg:border-line">{Cart}</aside>

      {/* Cart bar on phones */}
      {count > 0 && (
        <div className="fixed inset-x-3 bottom-[76px] z-30 lg:hidden">
          <button onClick={() => setCartOpen(true)} className="flex w-full animate-pop items-center gap-3 rounded-[18px] bg-jade px-4 py-3.5 text-white shadow-float">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-[13px] font-bold tnum">{count}</span>
            <span className="flex-1 text-left text-[15px] font-semibold">View order · {label}</span>
            <span className="text-[16px] font-semibold tnum">{inr(totals.total)}</span>
          </button>
        </div>
      )}
      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={label}>
        <div className="-mx-5 -mb-5 h-[70dvh]">{Cart}</div>
      </Sheet>

      {/* Table picker */}
      <Sheet open={pickTable} onClose={() => setPickTable(false)} title="Choose table">
        <div className="grid grid-cols-4 gap-2">
          {tables.map((tb) => (
            <button
              key={tb.id}
              onClick={() => { setTable(tb.name); setPickTable(false); }}
              className={clsx(
                "rounded-[14px] py-3 text-center",
                table === tb.name ? "bg-jade text-white" : tb.status === "free" ? "bg-surface" : "bg-sunken text-muted",
              )}
            >
              <div className="text-[17px] font-semibold">{tb.name}</div>
              <div className="text-[11px] opacity-80">{tb.status === "free" ? `${tb.seats} seats` : tb.status}</div>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Notes */}
      <Sheet open={noteFor !== null} onClose={() => setNoteFor(null)} title="Kitchen note">
        <div className="flex flex-wrap gap-2">
          {NOTES.map((n) => (
            <button
              key={n}
              onClick={() => {
                const idx = Number(noteFor);
                setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, note: l.note === n ? undefined : n } : l)));
                setNoteFor(null);
              }}
              className="rounded-full bg-surface px-4 py-2.5 text-[15px] font-medium active:bg-sunken"
            >
              {n}
            </button>
          ))}
        </div>
      </Sheet>

      <VoiceOrder open={voice} onClose={() => setVoice(false)} onAdd={(ls) => { setTable("T4"); ls.forEach((l) => add(l.item, l.qty, l.note)); }} />
      <Checkout open={pay} onClose={() => setPay(false)} subtotal={subtotal} label={label} onPaid={() => { setLines([]); setSent(false); }} />

    </div>
  );
}
