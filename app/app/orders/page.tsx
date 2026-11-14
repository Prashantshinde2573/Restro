"use client";

import clsx from "clsx";
import { ClaimCheck } from "@/components/claim-check";
import { Check, History, PenLine, Phone, Printer, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Chips, Page, PageHeader, Pill, Sheet, DietMark } from "@/components/ui";
import { StatusPill, channelLabel } from "@/components/channel";
import { OrderCard } from "@/components/order-card";
import { startOfDay } from "@/lib/stats";
import { Checkout, billTotals } from "@/components/checkout";
import { printReceipt } from "@/components/receipt";
import { PaymentSplit, paidSum } from "@/components/payment-split";
import { useToast } from "@/components/toast";
import { orderWhere, tableActions, useTables } from "@/lib/tables";
import { billOf, methodLabel, orderActions, paymentsText, pendingClaims, useCan, useCanConfirm, useCurrentOutlet, useMe, useMenu, useOrders, useSettings } from "@/lib/live";
import { closeBill, confirmPayment, markUnpaid, partyOpenOrders, rejectPayment } from "@/lib/billing";
import { PasswordCheck } from "@/components/password-check";
import { isOwner } from "@/lib/access";
import { clock, inr, orderTotal, timeAgo } from "@/lib/format";
import type { Order, OrderStatus, Payment } from "@/lib/types";

type Filter = "open" | "confirm" | "online" | "ready" | "paid" | "all";

export default function OrdersPage() {
  const toast = useToast();
  const list = useOrders();
  const [filter, setFilter] = useState<Filter>("open");
  const [selId, setSelId] = useState<string | null>(null);
  const [pay, setPay] = useState<Order[] | null>(null); // one bill: a table party's open orders, or one order
  const [edit, setEdit] = useState<{ order: Order; rows: Payment[] } | null>(null);
  const menu = useMenu();
  const me = useMe();
  const settings = useSettings();
  const outlet = useCurrentOutlet();
  const [cancelAsk, setCancelAsk] = useState<string | null>(null);
  const myName = me ? (me.role === "owner" ? `${me.name} (Owner)` : me.name) : "Staff";
  const tables = useTables();
  const sel = list.find((o) => o.id === selId) ?? null;
  const canConfirm = useCanConfirm();
  const canEditPay = useCan("editPayment");
  const canCharge = useCan("charge");
  const canCancel = useCan("refund");
  const owner = isOwner(me);
  const [unpayAsk, setUnpayAsk] = useState<Order | null>(null);
  const claims = pendingClaims(list);
  /** Charging an order at a table charges the party's whole bill. */
  const billFor = (o: Order) => (o.tableId ? partyOpenOrders(o.tableId, o.partyId ?? "A").filter((x) => !x.payClaim) : [o]);

  const isOnline = (o: Order) => ["whatsapp", "swiggy", "zomato", "qr"].includes(o.channel);
  const match = (o: Order, f: Filter) =>
    f === "open" ? !["paid", "cancelled"].includes(o.status) : f === "confirm" ? !!o.payClaim && !["paid", "cancelled"].includes(o.status) : f === "online" ? isOnline(o) && !["paid", "cancelled"].includes(o.status) : f === "ready" ? o.status === "ready" : f === "all" ? true : o.status === "paid" && new Date(o.createdAt).getTime() >= startOfDay();
  const shown = useMemo(
    () => list.filter((o) => match(o, filter)).sort((a, b) => Number(b.status === "new") - Number(a.status === "new") || b.number - a.number),
    [list, filter],
  );
  const count = (f: Filter) => list.filter((o) => match(o, f)).length;

  const setStatus = (o: Order, status: OrderStatus, msg: string) => {
    orderActions.setStatus(o.id, status);
    if (status === "accepted" && o.tableId && o.partyId) tableActions.update(o.tableId, o.partyId, { pendingApproval: false });
    setSelId(null);
    toast(msg);
  };

  // "today" really is today (it used to add up every paid bill ever)
  const today0 = startOfDay();
  const paidTodayList = list.filter((o) => o.status === "paid" && new Date(o.createdAt).getTime() >= today0);
  const paidToday = paidTodayList.reduce((s, o) => s + paidSum(o.payments ?? []), 0);
  const byMethod = (["upi", "cash", "card"] as const).map((m) => ({
    m,
    amt: paidTodayList.reduce((s, o) => s + (o.payments ?? []).filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0), 0),
  }));
  /** The one next step for a card. */
  const nextStep = (o: Order): { label: string; onClick: () => void; tone?: "primary" | "dark" } | null => {
    if (o.payClaim && o.status !== "paid" && o.status !== "cancelled")
      return canConfirm ? { label: "Money received", onClick: () => { confirmPayment(o.payClaim!.id); toast(`Payment confirmed · #${o.number} closed`); } } : null;
    if (o.status === "new") return { label: "Accept & send to kitchen", onClick: () => setStatus(o, "accepted", "Accepted · KOT sent to kitchen") };
    if (o.status === "accepted") return { label: "Mark cooking", onClick: () => setStatus(o, "preparing", "Kitchen started"), tone: "dark" };
    if (o.status === "preparing") return { label: "Mark ready", onClick: () => setStatus(o, "ready", "Marked ready"), tone: "dark" };
    if (o.status === "ready") return { label: "Mark served", onClick: () => setStatus(o, "served", "Marked served"), tone: "dark" };
    if (o.status === "served" && canCharge) return { label: `Charge ${inr(billFor(o).reduce((s, x) => s + billOf(x), 0))}`, onClick: () => setPay(billFor(o)) };
    return null;
  };

  return (
    <>
      <PageHeader title="Orders" subtitle={`${count("open")} open · ${inr(paidToday)} collected today`}>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open", count: count("open") },
            ...(claims.length ? [{ value: "confirm" as Filter, label: "To confirm", count: claims.length }] : []),
            { value: "online", label: "Online & QR", count: count("online") },
            { value: "ready", label: "Ready to serve", count: count("ready") },
            { value: "paid", label: "Paid today", count: count("paid") },
            { value: "all", label: "All orders" },
          ]}
        />
      </PageHeader>
      <Page className="space-y-4">
        {filter === "paid" && (
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-group bg-line/70">
            {byMethod.map(({ m, amt }) => (
              <div key={m} className="bg-surface p-3.5">
                <div className="text-[13px] text-muted">{methodLabel[m]}</div>
                <div className="text-[19px] font-semibold tnum">{inr(amt)}</div>
              </div>
            ))}
          </div>
        )}
        {filter === "all" ? (
          <OrderHistory list={list} where={(o) => orderWhere(o, tables)} onOpen={(o) => setSelId(o.id)} />
        ) : shown.length === 0 ? (
          <div className="rounded-[22px] bg-surface px-5 py-14 text-center">
            <p className="text-[16px] font-semibold">Nothing here right now</p>
            <p className="mt-1 text-[14px] text-muted">{filter === "paid" ? "Paid bills from today show here." : "New orders from New order, captains and the QR show up here live."}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {shown.map((o) => (
              <OrderCard
                key={o.id}
                o={o}
                where={orderWhere(o, tables)}
                total={o.status === "paid" ? paidSum(o.payments ?? []) : billOf(o)}
                onOpen={() => setSelId(o.id)}
                action={nextStep(o)}
              />
            ))}
          </div>
        )}
      </Page>

      <Sheet
        open={!!sel}
        onClose={() => setSelId(null)}
        title={sel ? `#${sel.number} · ${orderWhere(sel, tables)}` : ""}
        footer={
          sel && (
            <div className="flex gap-2">
              {sel.status === "new" && (
                <>
                  <Button variant="danger" size="lg" onClick={() => setStatus(sel, "cancelled", `Order #${sel.number} rejected · the guest sees it on their phone`)}>Reject</Button>
                  <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "accepted", "Accepted · KOT sent to kitchen")}>Accept and send to kitchen</Button>
                </>
              )}
              {sel.status === "accepted" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "preparing", "Kitchen started")}>Mark cooking</Button>}
              {sel.status === "preparing" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "ready", "Marked ready")}>Mark ready</Button>}
              {sel.status === "ready" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "served", "Marked served")}>Mark served</Button>}
              {sel.payClaim && sel.status !== "paid" && sel.status !== "cancelled" ? (
                canConfirm ? (
                  <>
                    <Button variant="plain" size="lg" onClick={() => { rejectPayment(sel.payClaim!.id); setSelId(null); toast("Marked not received · the bill is open again"); }}>Not received</Button>
                    <Button size="lg" className="flex-1" onClick={() => { confirmPayment(sel.payClaim!.id); setSelId(null); toast(`Payment confirmed · #${sel.number} closed`); }}><Check size={17} /> Money received</Button>
                  </>
                ) : null
              ) : sel.status === "served" && canCharge ? (
                <Button size="lg" className="flex-1" onClick={() => { setPay(billFor(sel)); setSelId(null); }}>Charge {inr(billFor(sel).reduce((s, o) => s + billOf(o), 0))}</Button>
              ) : null}
              {sel.status === "paid" && canEditPay && (
                <Button size="lg" variant="tinted" className="flex-1" onClick={() => setEdit({ order: sel, rows: (sel.payments ?? []).map((p) => ({ ...p })) })}>
                  <PenLine size={17} /> Change how it was paid
                </Button>
              )}
              {sel.status === "paid" && owner && (
                <Button size="lg" variant="plain" onClick={() => setUnpayAsk(sel)}><RotateCcw size={17} /> Mark unpaid</Button>
              )}
            </div>
          )
        }
      >
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <StatusPill status={sel.status} />
              <span>{channelLabel(sel.channel)}</span>·<span>{sel.type}</span>·<span>{new Date(sel.createdAt).getTime() >= today0 ? clock(sel.createdAt) : `${dayName(sel.createdAt)}, ${clock(sel.createdAt)}`}</span>
            </div>
            {sel.status === "new" && sel.channel === "qr" && (
              <p className="rounded-ctl bg-saffron-soft px-3 py-2 text-[13.5px]">
                First order from a new group at this table. Check they're seated, then accept.
              </p>
            )}
            {(sel.customer || sel.guestPhone) && (
              <div className="flex items-center gap-3 rounded-group bg-surface px-4 py-3">
                <Phone size={16} className="text-muted" />
                <span className="flex-1 text-[14.5px]">{sel.customer}{sel.guestPhone && <span className="text-muted"> · +91 {sel.guestPhone}</span>}</span>
                {sel.guestPhone && <Pill tone="jade">Number given</Pill>}
              </div>
            )}
            {sel.payClaim && sel.status !== "paid" && sel.status !== "cancelled" && (
              <div className="rounded-ctl bg-saffron-soft px-3 py-2.5 text-[13.5px]">
                <b>{sel.payClaim.by}</b> marked this bill paid · {paymentsText(sel.payClaim.payments)} · {timeAgo(sel.payClaim.at)}.{" "}
                {canConfirm ? "Check the money came in (UPI app, cash drawer), then confirm." : "Waiting for the owner to confirm."}
                <ClaimCheck claimId={sel.payClaim.id} />
              </div>
            )}
            {sel.payPreference && sel.status !== "paid" && !sel.payClaim && (
              <div className="rounded-ctl bg-sky-soft px-3 py-2 text-[13.5px] text-sky">Guest asked for the bill and wants to pay by <b>{methodLabel[sel.payPreference]}</b>.</div>
            )}
            <div className="overflow-hidden rounded-group bg-surface">
              {sel.lines.map((l, i) => {
                const m = menu.find((x) => x.id === l.itemId);
                return (
                  <div key={i} className="flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0">
                    {m && <DietMark diet={m.diet} />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px]"><b className="tnum">{l.qty}×</b> {l.name}</div>
                      {l.note && <div className="text-[12.5px] text-saffron">{l.note}</div>}
                    </div>
                    {l.done && <span className="text-[12px] font-medium text-jade">Done</span>}
                    <span className="w-16 text-right text-[14px] tnum">{inr(l.qty * l.price)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between bg-sunken/50 px-4 py-3 text-[15px] font-semibold">
                <span>Bill incl. GST</span>
                <span className="tnum">{inr(billOf(sel))}</span>
              </div>
            </div>

            {(sel.status === "paid" || (sel.paymentLog?.length ?? 0) > 0) && (
              <div className="rounded-group bg-surface p-4">
                {sel.status === "paid" && <div className="text-[13px] text-muted">Paid by</div>}
                {sel.status === "paid" && <div className="mt-0.5 text-[17px] font-semibold">{paymentsText(sel.payments)}</div>}
                {sel.paymentLog && sel.paymentLog.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted"><History size={13} /> Payment history</div>
                    {sel.paymentLog.map((e, i) => (
                      <div key={i} className="text-[13px]">
                        <span className="text-muted">{clock(e.at)} · {e.by}:</span> {e.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="plain"
                onClick={() => {
                  const sub = orderTotal(sel.lines);
                  const ok = printReceipt({
                    settings, outletName: outlet.name, label: orderWhere(sel, tables), billNo: sel.number,
                    lines: sel.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
                    totals: billTotals(sub), payments: sel.payments ?? [],
                  });
                  if (!ok) toast("Allow pop-ups for this site to print");
                }}
              >
                <Printer size={16} /> Print bill
              </Button>
              {sel.status !== "paid" && sel.status !== "cancelled" && (sel.status === "new" || canCancel) && (
                cancelAsk === sel.id ? (
                  <Button variant="danger" onClick={() => { orderActions.setStatus(sel.id, "cancelled"); setCancelAsk(null); toast(`#${sel.number} cancelled`); }}>
                    <XCircle size={16} /> Yes, cancel
                  </Button>
                ) : (
                  <Button variant="plain" onClick={() => setCancelAsk(sel.id)}><XCircle size={16} /> Cancel order</Button>
                )
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* change how a paid bill was settled */}
      <Sheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Change payment"
        footer={
          edit && (
            <Button
              size="lg"
              className="w-full"
              disabled={paidSum(edit.rows) !== paidSum(edit.order.payments ?? []) || edit.rows.some((r) => r.amount <= 0)}
              onClick={() => {
                orderActions.editPayment(edit.order.id, edit.rows, myName);
                setEdit(null);
                toast("Payment updated · change saved in history");
              }}
            >
              Save · {paymentsText(edit.rows.filter((r) => r.amount > 0))}
            </Button>
          )
        }
      >
        {edit && (
          <div className="space-y-4">
            <p className="text-[14px] text-muted">
              Bill #{edit.order.number} · {inr(paidSum(edit.order.payments ?? []))}. Changes are logged with your name.
            </p>
            <PaymentSplit total={paidSum(edit.order.payments ?? [])} rows={edit.rows} onChange={(rows) => setEdit({ ...edit, rows })} />
            {edit.order.paymentLog?.length ? <p className="text-[12.5px] text-faint">Last change {timeAgo(edit.order.paymentLog[edit.order.paymentLog.length - 1].at)}</p> : null}
          </div>
        )}
      </Sheet>

      <Checkout
        open={!!pay}
        onClose={() => setPay(null)}
        subtotal={pay ? pay.reduce((s, o) => s + orderTotal(o.lines), 0) : 0}
        label={pay?.[0] ? orderWhere(pay[0], tables) : ""}
        preferred={pay?.find((o) => o.payPreference)?.payPreference}
        prepaid={pay?.flatMap((o) => o.prepaid ?? [])}
        lines={pay?.flatMap((o) => o.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })))}
        billNo={pay?.[0]?.number}
        guest={(() => {
          const o = pay?.find((x) => x.guestPhone);
          return o ? { name: o.customer, phone: o.guestPhone } : undefined;
        })()}
        onPaid={(payments, extra) => {
          if (!pay?.length) return;
          const o = pay[0];
          return closeBill({ ids: pay.map((x) => x.id), payments, by: myName, tableId: o.tableId, partyId: o.tableId ? o.partyId ?? "A" : undefined, discount: extra?.discount, coupon: extra?.coupon });
        }}
      />

      <PasswordCheck
        open={!!unpayAsk}
        onClose={() => setUnpayAsk(null)}
        title={unpayAsk ? `Mark #${unpayAsk.number} unpaid?` : ""}
        body={unpayAsk ? `${paymentsText(unpayAsk.payments)} comes off today's sales and the bill opens again${unpayAsk.tableId ? " on its table" : ""}. This is saved in the activity log.` : ""}
        confirmLabel="Mark unpaid"
        onConfirmed={() => {
          if (!unpayAsk) return;
          // a table bill can span several orders paid together: open all of them
          const group = unpayAsk.tableId
            ? list.filter((o) => o.status === "paid" && o.tableId === unpayAsk.tableId && (o.partyId ?? "A") === (unpayAsk.partyId ?? "A") && o.paymentLog?.at(-1)?.at === unpayAsk.paymentLog?.at(-1)?.at).map((o) => o.id)
            : [unpayAsk.id];
          markUnpaid(group.length ? group : [unpayAsk.id]);
          setUnpayAsk(null);
          setSelId(null);
          toast(`#${unpayAsk.number} is unpaid again`);
        }}
      />
    </>
  );
}

/* ---------------- All orders: every order, by day ---------------- */
type Range = "today" | "yesterday" | "7d" | "30d" | "all";
type StatusF = "any" | "paid" | "open" | "cancelled";
const DAY = 86_400_000;
const dayName = (iso: string | number) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });

function OrderHistory({ list, where, onOpen }: { list: Order[]; where: (o: Order) => string; onOpen: (o: Order) => void }) {
  const [range, setRange] = useState<Range>("7d");
  const [status, setStatus] = useState<StatusF>("any");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(80);
  const t0 = startOfDay();
  const from = range === "today" ? t0 : range === "yesterday" ? t0 - DAY : range === "7d" ? t0 - 6 * DAY : range === "30d" ? t0 - 29 * DAY : 0;
  const to = range === "yesterday" ? t0 : Infinity;
  const amountOf = (o: Order) => (o.status === "paid" ? paidSum(o.payments ?? []) : billOf(o));

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, "");
    return list
      .filter((o) => {
        const t = new Date(o.createdAt).getTime();
        if (t < from || t >= to) return false;
        if (status === "paid" && o.status !== "paid") return false;
        if (status === "cancelled" && o.status !== "cancelled") return false;
        if (status === "open" && (o.status === "paid" || o.status === "cancelled")) return false;
        if (!term) return true;
        const hay = [String(o.number), where(o), o.customer ?? "", o.guestPhone ?? "", o.staff ?? "", ...o.lines.map((l) => l.name)].join(" ").toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [list, from, to, status, q, where]);

  const paidRows = rows.filter((o) => o.status === "paid");
  const total = paidRows.reduce((s, o) => s + amountOf(o), 0);
  const visible = rows.slice(0, limit);
  const groups: { day: number; items: Order[] }[] = [];
  for (const o of visible) {
    const d = startOfDay(new Date(o.createdAt));
    const g = groups[groups.length - 1];
    if (g && g.day === d) g.items.push(o);
    else groups.push({ day: d, items: [o] });
  }
  const dayTotals = (day: number) => {
    const all = rows.filter((o) => startOfDay(new Date(o.createdAt)) === day);
    return { n: all.length, paid: all.filter((o) => o.status === "paid").reduce((s, o) => s + amountOf(o), 0) };
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(80); }}
          placeholder="Search order no., table, guest, phone, dish…"
          aria-label="Search orders"
          className="col-span-2 h-11 w-full rounded-ctl bg-surface px-4 text-[15px] outline-none ring-1 ring-line placeholder:text-faint focus:ring-1 focus:ring-jade/40 sm:col-span-1"
        />
        <select
          value={range}
          onChange={(e) => { setRange(e.target.value as Range); setLimit(80); }}
          aria-label="Time range"
          className="h-11 w-full rounded-ctl bg-surface pl-4 text-[15px] font-medium outline-none ring-1 ring-line focus:ring-1 focus:ring-jade/40"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as StatusF); setLimit(80); }}
          aria-label="Order status"
          className="h-11 w-full rounded-ctl bg-surface pl-4 text-[15px] font-medium outline-none ring-1 ring-line focus:ring-1 focus:ring-jade/40"
        >
          <option value="any">Any status</option>
          <option value="paid">Paid</option>
          <option value="open">Not paid yet</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="-mt-1 px-1 text-[13.5px] text-muted">
        <b className="text-ink tnum">{rows.length}</b> orders · <b className="text-ink tnum">{inr(total)}</b> paid
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[22px] bg-surface px-5 py-14 text-center">
          <p className="text-[16px] font-semibold">No orders found</p>
          <p className="mt-1 text-[14px] text-muted">Try a longer time range, another status, or a different search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const dt = dayTotals(g.day);
            return (
              <section key={g.day} className="overflow-hidden rounded-group bg-surface">
                <div className="flex items-baseline justify-between gap-3 border-b border-line/70 bg-sunken/40 px-4 py-2.5">
                  <span className="text-[14px] font-semibold">{g.day === t0 ? "Today" : g.day === t0 - DAY ? "Yesterday" : dayName(g.day)}</span>
                  <span className="text-[12.5px] text-muted tnum">{dt.n} orders · {inr(dt.paid)} paid</span>
                </div>
                {g.items.map((o) => (
                  <button key={o.id} onClick={() => onOpen(o)} className="flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left last:border-0 hover:bg-sunken/40">
                    <span className="w-14 shrink-0 text-[14px] font-semibold tnum">#{o.number || "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{where(o)}{o.customer && !where(o).includes(o.customer) ? <span className="text-muted"> · {o.customer}</span> : null}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {clock(o.createdAt)} · {o.lines.reduce((s, l) => s + l.qty, 0)} items · {o.status === "paid" && o.payments?.length ? paymentsText(o.payments) : channelLabel(o.channel)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={clsx("text-[15px] font-semibold tnum", o.status === "cancelled" && "text-faint line-through")}>{inr(amountOf(o))}</span>
                      <StatusPill status={o.status} />
                    </span>
                  </button>
                ))}
              </section>
            );
          })}
          {rows.length > limit && (
            <Button variant="plain" className="w-full" onClick={() => setLimit((n) => n + 80)}>Show more · {rows.length - limit} left</Button>
          )}
        </div>
      )}
    </div>
  );
}
