"use client";

import { Printer, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Chips, Group, Page, PageHeader, Sheet, DietMark } from "@/components/ui";
import { ChannelIcon, StatusPill, channelLabel } from "@/components/channel";
import { Checkout } from "@/components/checkout";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { clock, inr, minutesSince, orderTotal } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

type Filter = "open" | "online" | "ready" | "paid";

export default function OrdersPage() {
  const toast = useToast();
  const [list, setList] = useState<Order[]>(repo.orders());
  const [filter, setFilter] = useState<Filter>("open");
  const [sel, setSel] = useState<Order | null>(null);
  const [pay, setPay] = useState<Order | null>(null);
  const menu = repo.menu();

  const isOnline = (o: Order) => ["whatsapp", "swiggy", "zomato", "qr"].includes(o.channel);
  const shown = useMemo(() => {
    const f = list.filter((o) =>
      filter === "open" ? !["paid", "cancelled"].includes(o.status) : filter === "online" ? isOnline(o) && o.status !== "paid" : filter === "ready" ? o.status === "ready" : o.status === "paid",
    );
    return f.sort((a, b) => (a.status === "new" ? -1 : 0) - (b.status === "new" ? -1 : 0) || b.number - a.number);
  }, [list, filter]);

  const setStatus = (o: Order, status: OrderStatus, msg: string) => {
    setList((l) => l.map((x) => (x.id === o.id ? { ...x, status } : x)));
    setSel(null);
    toast(msg);
  };

  const count = (f: Filter) =>
    list.filter((o) =>
      f === "open" ? !["paid", "cancelled"].includes(o.status) : f === "online" ? isOnline(o) && o.status !== "paid" : f === "ready" ? o.status === "ready" : o.status === "paid",
    ).length;

  const paidToday = list.filter((o) => o.status === "paid").reduce((s, o) => s + orderTotal(o.lines), 0);

  return (
    <>
      <PageHeader title="Orders" subtitle={`${count("open")} open · ${inr(paidToday)} collected today`}>
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open", count: count("open") },
            { value: "online", label: "Online", count: count("online") },
            { value: "ready", label: "Ready to serve", count: count("ready") },
            { value: "paid", label: "Paid", count: count("paid") },
          ]}
        />
      </PageHeader>
      <Page>
        <Group flush>
          {shown.length === 0 && <div className="px-5 py-14 text-center text-[14px] text-muted">Nothing here right now.</div>}
          {shown.map((o) => {
            const mins = minutesSince(o.createdAt);
            const late = mins > 20 && ["new", "preparing"].includes(o.status);
            return (
              <button
                key={o.id}
                onClick={() => setSel(o)}
                className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3.5 text-left last:border-0 hover:bg-sunken/40 lg:px-5"
              >
                <ChannelIcon channel={o.channel} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{o.tableName ? `Table ${o.tableName}` : o.customer}</span>
                    <span className="text-[13px] text-faint tnum">#{o.number}</span>
                  </div>
                  <div className="truncate text-[13px] text-muted">
                    {o.lines.map((l) => `${l.qty} ${l.name}`).join(", ")}
                  </div>
                </div>
                <div className="hidden w-24 text-right text-[13px] sm:block">
                  <div className={late ? "font-semibold text-rose" : "text-muted"}>{o.status === "paid" ? clock(o.createdAt) : `${mins} min`}</div>
                  <div className="text-faint">{channelLabel(o.channel)}</div>
                </div>
                <div className="flex w-[84px] flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold tnum">{inr(orderTotal(o.lines))}</span>
                  <StatusPill status={o.status} />
                </div>
              </button>
            );
          })}
        </Group>
      </Page>

      <Sheet
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? `#${sel.number} · ${sel.tableName ? `Table ${sel.tableName}` : sel.customer}` : ""}
        footer={
          sel && (
            <div className="flex gap-2">
              {sel.status === "new" && (
                <>
                  <Button variant="danger" size="lg" onClick={() => setStatus(sel, "cancelled", `Order #${sel.number} declined`)}>Decline</Button>
                  <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "preparing", `Accepted · KOT sent to kitchen`)}>Accept and send to kitchen</Button>
                </>
              )}
              {sel.status === "preparing" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "ready", "Marked ready")}>Mark ready</Button>}
              {sel.status === "ready" && <Button size="lg" className="flex-1" onClick={() => setStatus(sel, "served", "Marked served")}>Mark served</Button>}
              {sel.status === "served" && <Button size="lg" className="flex-1" onClick={() => { setPay(sel); setSel(null); }}>Charge {inr(Math.round(orderTotal(sel.lines) * 1.05))}</Button>}
              {sel.status === "paid" && <Button variant="plain" size="lg" className="flex-1" onClick={() => toast("Refund needs a manager PIN")}>Refund</Button>}
            </div>
          )
        }
      >
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <StatusPill status={sel.status} />
              <span>{channelLabel(sel.channel)}</span>·<span>{sel.type}</span>·<span>by {sel.staff}</span>·<span>{clock(sel.createdAt)}</span>
            </div>
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
                <span>Items total</span>
                <span className="tnum">{inr(orderTotal(sel.lines))}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="plain" onClick={() => toast("KOT reprinted")}><Printer size={16} /> Reprint KOT</Button>
              <Button variant="plain" onClick={() => toast("Ask a manager to approve the cancel")}><XCircle size={16} /> Cancel items</Button>
            </div>
          </div>
        )}
      </Sheet>

      <Checkout
        open={!!pay}
        onClose={() => setPay(null)}
        subtotal={pay ? orderTotal(pay.lines) : 0}
        label={pay?.tableName ? `Table ${pay.tableName}` : pay?.customer ?? ""}
        onPaid={() => pay && setList((l) => l.map((x) => (x.id === pay.id ? { ...x, status: "paid" } : x)))}
      />
    </>
  );
}
