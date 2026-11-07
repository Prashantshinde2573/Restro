"use client";

import { hasCounter, hasTables } from "@/lib/access";
import clsx from "clsx";
import { ChevronDown, Mic, Minus, Plus, Search, Send, Trash2, X, Check } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Chips, DietMark, Segmented, Sheet } from "@/components/ui";
import { PhotoSlide } from "@/components/menu-bits";
import { Checkout, billTotals } from "@/components/checkout";
import { GuestCount } from "@/components/guest-count";
import { VoiceOrder } from "@/components/voice";
import { ItemSheet } from "@/components/item-sheet";
import { getOrders, orderActions, useCan, useOrders, useMenu, useCategories, useCurrentOutlet, useFeature, useMe } from "@/lib/live";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n";
import { getTable, isShared, seatsFree, tableActions, tableState, useTables } from "@/lib/tables";
import { closeBill, partyOpenOrders } from "@/lib/billing";
import { inr, gstLabel } from "@/lib/format";
import type { MenuItem, OrderType } from "@/lib/types";

type Line = { item: MenuItem; qty: number; note?: string; unitPrice?: number };
const NOTES = ["Less spicy", "Extra spicy", "No onion", "Jain", "Pack separately"];

export default function PosPage() {
  return (
    <Suspense>
      <PosScreen />
    </Suspense>
  );
}

function PosScreen() {
  const { t } = useT();
  const params = useSearchParams();
  const toast = useToast();
  const me = useMe();
  const menu = useMenu();
  const cats = useCategories();
  const tables = useTables();

  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const outlet = useCurrentOutlet();
  const cafe = !hasTables(outlet); // counter-only: no dine-in at a table
  const counterToo = hasCounter(outlet);
  const voiceOn = useFeature("voice") === "ok";
  const canCharge = useCan("charge");
  const [type, setType] = useState<OrderType>(outlet.businessType === "cafe" ? "takeaway" : "dine-in");
  const [table, setTable] = useState(params.get("table") ?? "");
  const [cust, setCust] = useState(""); // counter / delivery: guest name or phone
  // no table picked yet (or it was removed): start on the first free one
  useEffect(() => {
    if (tables.length && !tables.some((x) => x.name === table)) setTable((tables.find((x) => tableState(x) === "free") ?? tables[0]).name);
  }, [tables, table]);
  const [party, setParty] = useState<string | null>(params.get("party"));
  const [newGuests, setNewGuests] = useState<number | null>(null); // a new party: how many guests
  const [lines, setLines] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [pickTable, setPickTable] = useState(false);
  const [voice, setVoice] = useState(false);
  const [pay, setPay] = useState(false);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [customize, setCustomize] = useState<MenuItem | null>(null);

  const items = useMemo(
    () =>
      menu.filter(
        (m) => (cat === "all" || m.categoryId === cat) && (!q || m.name.toLowerCase().includes(q.toLowerCase())),
      ),
    [menu, cat, q],
  );

  const add = (item: MenuItem, qty = 1, note?: string, unitPrice?: number) => {
    if (!item.available) return;
    setSent(false);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.item.id === item.id && l.note === note && l.unitPrice === unitPrice);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { item, qty, note, unitPrice }];
    });
  };
  const priceOf = (l: Line) => l.unitPrice ?? l.item.price;
  const change = (idx: number, d: number) =>
    setLines((ls) => ls.flatMap((l, i) => (i !== idx ? [l] : l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }])));

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * priceOf(l), 0);
  const qtyOf = (id: string) => lines.filter((l) => l.item.id === id).reduce((s, l) => s + l.qty, 0);
  const tb = getTable(table);
  const tbShared = tb ? isShared(tb) : false;
  const pty = tb?.parties.find((p) => p.id === party);
  const label =
    type === "dine-in" ? (pty && tbShared ? `${table} · Party ${party}` : `Table ${table}`) : cust.trim() ? `${type === "delivery" ? "Delivery" : counterToo || cafe ? "Counter" : "Takeaway"} · ${cust.trim()}` : type === "takeaway" ? (counterToo || cafe ? "Counter" : "Takeaway") : "Delivery";
  const noTable = type === "dine-in" && !tb;
  const waitingPay = type === "dine-in" && !!pty?.paymentPending;
  // a new party at a table needs its number of guests before it's sent
  const needGuests = type === "dine-in" && !!tb && !pty && !newGuests;

  const [sentIds, setSentIds] = useState<string[]>([]); // takeaway/delivery orders sent but not paid yet
  const allOrders = useOrders();
  const sentTotal = allOrders.filter((o) => sentIds.includes(o.id) && o.status !== "paid" && o.status !== "cancelled").reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty * l.price, 0), 0);
  const running = type === "dine-in" ? pty?.total ?? 0 : sentTotal;
  const chargeAmount = running + (sent ? 0 : subtotal);

  /** Make sure the order belongs to a party: a free table gets Party A. */
  const ensureParty = () => {
    if (type !== "dine-in" || !tb) return null;
    if (pty) return pty.id;
    const p = tableActions.seat(tb.id, newGuests ?? 1);
    setParty(p.id);
    setNewGuests(null);
    return p.id;
  };

  const sendKitchen = (): { id: string; pid: string | null } => {
    const pid = ensureParty();
    if (tb && pid) {
      const cur = getTable(tb.id)!.parties.find((p) => p.id === pid);
      tableActions.update(tb.id, pid, { status: "ordered", total: (cur?.total ?? 0) + subtotal });
    }
    setSent(true);
    const order = orderActions.add({
      type,
      channel: "pos",
      tableId: type === "dine-in" ? tb?.id : undefined,
      tableName: type === "dine-in" ? table : undefined,
      partyId: type === "dine-in" ? pid ?? undefined : undefined,
      customer: type === "dine-in" ? undefined : label,
      staff: me?.name ?? "Staff",
      createdAt: new Date().toISOString(),
      status: "accepted",
      lines: lines.map((l) => ({ itemId: l.item.id, name: l.item.name, qty: l.qty, price: priceOf(l), station: l.item.station, note: l.note })),
    });
    const kot = type === "dine-in" ? (tb && getTable(tb.id)!.parties.length > 1 ? `${table} · ${pid}` : table) : label;
    toast(`KOT sent · ${count} items for ${kot}`);
    if (type !== "dine-in") setSentIds((x) => [...x, order.id]);
    return { id: order.id, pid };
  };

  const Cart = (
    <div className="flex h-full flex-col">
      <div className="space-y-3 px-4 pt-4 lg:px-5 lg:pt-5">
        <Segmented
          className="w-full"
          value={type}
          onChange={setType}
          options={
            cafe
              ? [
                  { value: "takeaway", label: "Counter" },
                  { value: "delivery", label: "Delivery" },
                ]
              : [
                  { value: "dine-in", label: "Dine-in" },
                  { value: "takeaway", label: counterToo ? "Counter" : "Takeaway" },
                  { value: "delivery", label: "Delivery" },
                ]
          }
        />
        {type === "dine-in" && !cafe ? (
          <button onClick={() => setPickTable(true)} className="flex w-full items-center justify-between rounded-ctl bg-sunken/70 px-4 py-2.5 text-left">
            <span>
              <span className="block text-[12px] text-muted">{tbShared ? "Shared table · separate bill" : "Table"}</span>
              <span className="text-[16px] font-semibold">
                {table}
                {pty ? (tbShared ? ` · Party ${pty.id}` : "") : tb && tb.parties.length ? " · new party" : " · new guests"}
              </span>
            </span>
            <ChevronDown size={18} className="text-muted" />
          </button>
        ) : null}
        {type === "dine-in" && !cafe && tb && (
          <GuestCount
            value={pty ? pty.guests : newGuests}
            onChange={(n) => (pty ? tableActions.update(tb.id, pty.id, { guests: n }) : setNewGuests(n))}
            className="px-1"
          />
        )}
        {type === "dine-in" && !cafe ? null : (
          <input value={cust} onChange={(e) => setCust(e.target.value)} className="h-12 w-full rounded-ctl bg-sunken/70 px-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade" placeholder={type === "delivery" ? "Guest name, phone or address" : "Guest name (optional, shows on the order)"} />
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
              <div className="w-16 pt-1 text-right text-[14px] font-semibold tnum">{inr(l.qty * priceOf(l))}</div>
            </div>
          ))
        )}
      </div>

      <div className="pb-safe space-y-3 border-t border-line px-4 pt-3 [--safe-pb:16px] lg:px-5">
        <div className="flex items-baseline justify-between text-[13.5px] text-muted">
          <span>{count} items · GST {gstLabel()} added at checkout</span>
          {running > 0 && <span className="tnum">Already on bill {inr(running)}</span>}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium">{running > 0 ? "Bill so far" : "Total"}</span>
          <span className="text-[26px] font-semibold tracking-tight tnum">{inr(billTotals(chargeAmount).total)}</span>
        </div>
        <div className={clsx("grid gap-2", canCharge ? "grid-cols-2" : "grid-cols-1")}>
          {noTable && <p className="col-span-2 -mb-1 text-center text-[13px] font-medium text-saffron">Pick a table first</p>}
          {needGuests && lines.length > 0 && !noTable && <p className="col-span-2 -mb-1 text-center text-[13px] font-medium text-saffron">Choose how many guests</p>}
          {waitingPay && <p className="col-span-2 -mb-1 text-center text-[13px] font-medium text-saffron">This bill is marked paid · waiting for the owner&apos;s OK</p>}
          <Button variant="tinted" size="lg" className="!px-3 whitespace-nowrap !text-[15px]" disabled={!lines.length || sent || noTable || needGuests} onClick={() => sendKitchen()}>
            {sent ? <><Check size={18} /> Sent</> : <><Send size={17} /> {t("sendKitchen")}</>}
          </Button>
          {canCharge && (
            <Button size="lg" className="!text-[15px]" disabled={chargeAmount === 0 || noTable || waitingPay || (needGuests && lines.length > 0 && !sent)} onClick={() => { setCartOpen(false); setPay(true); }}>
              {t("charge")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh lg:h-[calc(100dvh-24px)] lg:min-h-0">
      {/* Menu side */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-[60px] z-20 space-y-3 bg-canvas/90 lg:top-0 px-4 pb-3 pt-3 backdrop-blur-xl lg:static lg:bg-transparent lg:px-8 lg:pt-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="large-title">{t("pos")}</h1>
            {voiceOn && (
              <Button variant="tinted" size="sm" className="!rounded-full lg:hidden" onClick={() => setVoice(true)}>
                <Mic size={16} /> Speak
              </Button>
            )}
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
            {voiceOn && (
              <Button variant="tinted" className="hidden lg:inline-flex" onClick={() => setVoice(true)}>
                <Mic size={17} /> Speak order
              </Button>
            )}
          </div>
          <Chips
            value={cat}
            onChange={setCat}
            options={[{ value: "all", label: "All" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-36 pt-1 lg:px-8 lg:pb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => {
              const n = qtyOf(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => (m.options?.some((g) => g.required) ? setCustomize(m) : add(m))}
                  disabled={!m.available}
                  className={clsx(
                    "group relative flex flex-col overflow-hidden rounded-[18px] bg-surface text-left transition active:scale-[.97]",
                    n > 0 && "ring-2 ring-jade",
                    !m.available && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between p-3 pb-0">
                    <PhotoSlide item={m} className="h-11 w-11 rounded-full lg:h-12 lg:w-12" />
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
                      ) : m.options?.some((g) => g.required) ? (
                        <span className="text-[11.5px] font-medium text-jade">Choices</span>
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
      {(count > 0 || running > 0) && (
        <div className="fixed inset-x-3 bottom-[76px] z-30 lg:hidden">
          <button onClick={() => setCartOpen(true)} className="flex w-full animate-pop items-center gap-3 rounded-[18px] bg-jade px-4 py-3.5 text-white shadow-float">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-[13px] font-bold tnum">{count}</span>
            <span className="flex-1 text-left text-[15px] font-semibold">View order · {label}</span>
            <span className="text-[16px] font-semibold tnum">{inr(billTotals(chargeAmount).total)}</span>
          </button>
        </div>
      )}
      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={label}>
        <div className="-mx-5 -mb-5 h-[70dvh]">{Cart}</div>
      </Sheet>

      {/* Table picker: a shared table lists each party separately */}
      <Sheet open={pickTable} onClose={() => setPickTable(false)} title="Choose table" wide>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tables.map((tb) => {
            const st = tableState(tb);
            const pick = (pid: string | null) => {
              setTable(tb.name);
              setParty(pid);
              setNewGuests(null);
              setPickTable(false);
              setSent(false);
            };
            return (
              <div key={tb.id} className={clsx("rounded-[16px] p-3", table === tb.name ? "bg-jade-soft ring-2 ring-jade" : "bg-surface")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[18px] font-semibold">{tb.name}</span>
                  <span className="text-[11.5px] text-muted">{st === "free" ? `${tb.seats} seats` : st === "reserved" ? "reserved" : `${seatsFree(tb)} of ${tb.seats} free`}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tb.parties.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pick(p.id)}
                      className={clsx("rounded-full px-2.5 py-1 text-[12.5px] font-semibold", table === tb.name && party === p.id ? "bg-jade text-white" : "bg-sunken")}
                    >
                      {tb.parties.length > 1 ? `${p.id} · ${p.guests}` : `${p.guests} guests`}
                    </button>
                  ))}
                  <button onClick={() => pick(null)} className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-jade hover:bg-jade-soft">
                    {tb.parties.length ? "+ New party" : "Seat here"}
                  </button>
                </div>
              </div>
            );
          })}
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

      <ItemSheet item={customize} onClose={() => setCustomize(null)} onAdd={(l) => add(l.item, l.qty, l.options.join(" · ") || undefined, l.unitPrice)} />
      <VoiceOrder open={voice} onClose={() => setVoice(false)} onAdd={(ls) => ls.forEach((l) => add(l.item, l.qty, l.note))} />
      <Checkout
        open={pay}
        onClose={() => setPay(false)}
        subtotal={chargeAmount}
        label={label}
        lines={[
          ...getOrders()
            .filter((o) => (type === "dine-in" ? !!tb && o.tableId === tb.id && (o.partyId ?? "A") === (pty?.id ?? party ?? "A") : sentIds.includes(o.id)) && o.status !== "paid" && o.status !== "cancelled")
            .flatMap((o) => o.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price }))),
          ...(sent ? [] : lines.map((l) => ({ name: l.item.name, qty: l.qty, price: priceOf(l) }))),
        ]}
        onPaid={(payments, extra) => {
          // Anything still in the cart becomes an order first, so the sale is saved.
          const ids = [...sentIds];
          let pid: string | null = pty?.id ?? party;
          if (!sent && lines.length) {
            const r = sendKitchen();
            ids.push(r.id);
            pid = r.pid ?? pid;
          }
          const dineIn = type === "dine-in" && !!tb && !!pid;
          if (dineIn) partyOpenOrders(tb!.id, pid!).forEach((o) => ids.includes(o.id) || ids.push(o.id));
          const result = closeBill({
            ids,
            payments,
            by: me ? (me.role === "owner" ? `${me.name} (Owner)` : me.name) : "Staff",
            tableId: dineIn ? tb!.id : undefined,
            partyId: dineIn ? pid! : undefined,
            discount: extra?.discount,
            coupon: extra?.coupon,
          });
          setSentIds([]);
          setLines([]);
          setSent(false);
          setParty(null);
          setCust("");
          return result;
        }}
      />

    </div>
  );
}
