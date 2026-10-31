"use client";

import { Banknote, CreditCard, History, PenLine, Phone, Printer, QrCode, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Chips, Group, Page, PageHeader, Pill, Sheet, DietMark } from "@/components/ui";
import { ChannelIcon, StatusPill, channelLabel } from "@/components/channel";
import { Checkout, billTotals } from "@/components/checkout";
import { printReceipt } from "@/components/receipt";
import { PaymentSplit, paidSum } from "@/components/payment-split";
import { useToast } from "@/components/toast";
import { orderWhere, tableActions, useTables } from "@/lib/tables";
import { billOf, guestActions, methodLabel, orderActions, paymentsText, useCurrentOutlet, useMe, useMenu, useOrders, useSettings } from "@/lib/live";
import { clock, inr, minutesSince, orderTotal, timeAgo } from "@/lib/format";
import type { Order, OrderStatus, Payment } from "@/lib/types";

type Filter = "open" | "online" | "ready" | "paid";
const prefIcon = { upi: QrCode, cash: Banknote, card: CreditCard };

export default function OrdersPage() {
  const toast = useToast();
  const list = useOrders();
  const [filter, setFilter] = useState<Filter>("open");
  const [selId, setSelId] = useState<string | null>(null);
  const [pay, setPay] = useState<Order | null>(null);
  const [edit, setEdit] = useState<{ order: Order; rows: Payment[] } | null>(null);
  const menu = useMenu();
  const me = useMe();
  const settings = useSettings();
  const outlet = useCurrentOutlet();
  const [cancelAsk, setCancelAsk] = useState<string | null>(null);
  const myName = me ? (me.role === "owner" ? `${me.name} (Owner)` : me.name) : "Staff";
  const tables = useTables();
  const sel = list.find((o) => o.id === selId) ?? null;

  const isOnline = (o: Order) => ["whatsapp", "swiggy", "zomato", "qr"].includes(o.channel);
  const match = (o: Order, f: Filter) =>
    f === "open" ? !["paid", "cancelled"].includes(o.status) : f === "online" ? isOnline(o) && !["paid", "cancelled"].includes(o.status) : f === "ready" ? o.status === "ready" : o.status === "paid";
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

  const paidToday = list.filter((o) => o.status === "paid").reduce((s, o) => s + paidSum(o.payments ?? []), 0);
  const byMethod = (["upi", "cash", "card"] as const).map((m) => ({
    m,
    amt: list.filter((o) => o.status === "paid").reduce((s, o) => s + (o.payments ?? []).filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0), 0),
  }));

  return (
    <>
      <PageHeader title="Orders" subtitle={`${count("open")} open · ${inr(paidToday)} collected today`}>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open", count: count("open") },
            { value: "online", label: "Online & QR", count: count("online") },
            { value: "ready", label: "Ready to serve", count: count("ready") },
            { value: "paid", label: "Paid", count: count("paid") },
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
        <Group flush>
          {shown.length === 0 && <div className="px-5 py-14 text-center text-[14px] text-muted">Nothing here right now.</div>}
          {shown.map((o) => {
            const mins = minutesSince(o.createdAt);
            const late = mins > 20 && ["new", "accepted", "preparing"].includes(o.status);
            const Pref = o.payPreference ? prefIcon[o.payPreference] : null;
            return (
              <button key={o.id} onClick={() => setSelId(o.id)} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3.5 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
                <ChannelIcon channel={o.channel} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{orderWhere(o, tables)}</span>
                    <span className="text-[13px] text-faint tnum">#{o.number}</span>
                    {o.status === "new" && o.channel === "qr" && <Pill tone="saffron">Needs OK</Pill>}
                  </div>
                  <div className="truncate text-[13px] text-muted">
                    {o.status === "paid" ? paymentsText(o.payments) : o.lines.map((l) => `${l.qty} ${l.name}`).join(", ")}
                  </div>
                </div>
                <div className="hidden w-28 text-right text-[13px] sm:block">
                  <div className={late ? "font-semibold text-rose" : "text-muted"}>{o.status === "paid" ? clock(o.createdAt) : `${mins} min`}</div>
                  <div className="text-faint">{o.customer && o.channel === "qr" ? o.customer : channelLabel(o.channel)}</div>
                </div>
                <div className="flex w-[92px] flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold tnum">{inr(o.status === "paid" ? paidSum(o.payments ?? []) : orderTotal(o.lines))}</span>
                  {Pref && o.status !== "paid" ? (
                    <Pill tone="sky"><Pref size={11} /> Bill · {methodLabel[o.payPreference!]}</Pill>
                  ) : (
                    <StatusPill status={o.status} />
                  )}
                </div>
              </button>
            );
          })}
        </Group>
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
                  <Button variant="danger" size="lg" onClick={() => setStatus(sel, "cancelled", `Order #${sel.number} rejected · guest told on their phone`)}>Reject</Button>
                  <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "accepted", "Accepted · KOT sent to kitchen")}>Accept and send to kitchen</Button>
                </>
              )}
              {sel.status === "accepted" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "preparing", "Kitchen started")}>Mark cooking</Button>}
              {sel.status === "preparing" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "ready", "Marked ready")}>Mark ready</Button>}
              {sel.status === "ready" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "served", "Marked served")}>Mark served</Button>}
              {sel.status === "served" && <Button size="lg" className="flex-1" onClick={() => { setPay(sel); setSelId(null); }}>Charge {inr(billOf(sel))}</Button>}
              {sel.status === "paid" && (
                <Button size="lg" variant="tinted" className="flex-1" onClick={() => setEdit({ order: sel, rows: (sel.payments ?? []).map((p) => ({ ...p })) })}>
                  <PenLine size={17} /> Change how it was paid
                </Button>
              )}
            </div>
          )
        }
      >
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <StatusPill status={sel.status} />
              <span>{channelLabel(sel.channel)}</span>·<span>{sel.type}</span>·<span>{clock(sel.createdAt)}</span>
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
            {sel.payPreference && sel.status !== "paid" && (
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

            {sel.status === "paid" && (
              <div className="rounded-group bg-surface p-4">
                <div className="text-[13px] text-muted">Paid by</div>
                <div className="mt-0.5 text-[17px] font-semibold">{paymentsText(sel.payments)}</div>
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
              {sel.status !== "paid" && sel.status !== "cancelled" && (
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
        subtotal={pay ? orderTotal(pay.lines) : 0}
        label={pay ? orderWhere(pay, tables) : ""}
        preferred={pay?.payPreference}
        prepaid={pay?.prepaid}
        lines={pay?.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price }))}
        billNo={pay?.number}
        onPaid={(payments) => {
          if (!pay) return;
          orderActions.pay([pay.id], payments, myName);
          if (pay.tableId && pay.partyId) tableActions.close(pay.tableId, pay.partyId);
        }}
      />
    </>
  );
}
