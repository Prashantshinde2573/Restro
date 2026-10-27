"use client";

import clsx from "clsx";
import Link from "next/link";
import { ArrowLeftRight, CalendarClock, Clock, Merge, Plus, QrCode, ReceiptText, MessageCircle, Users } from "lucide-react";
import { useState } from "react";
import { Button, Group, Page, PageHeader, Pill, Segmented, Sheet, Field, inputCls } from "@/components/ui";
import { FakeQr } from "@/components/qr";
import { Checkout } from "@/components/checkout";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr, minutesSince, timeAgo } from "@/lib/format";
import type { Table, TableStatus } from "@/lib/types";

const statusStyle: Record<TableStatus, { label: string; tile: string; dot: string }> = {
  free: { label: "Free", tile: "bg-surface text-ink", dot: "bg-line" },
  seated: { label: "Seated", tile: "bg-sky-soft text-ink", dot: "bg-sky" },
  ordered: { label: "Eating", tile: "bg-jade-soft text-ink", dot: "bg-jade" },
  billing: { label: "Wants bill", tile: "bg-saffron-soft text-ink", dot: "bg-saffron" },
  reserved: { label: "Reserved", tile: "bg-surface text-ink ring-2 ring-dashed ring-line", dot: "bg-faint" },
};

const waitlist = [
  { name: "Joshi family", size: 6, waited: 14, eta: 10, phone: "98605 33091" },
  { name: "Ananya + 1", size: 2, waited: 6, eta: 4, phone: "99231 44012" },
  { name: "Kunal", size: 4, waited: 2, eta: 18, phone: "90490 11833" },
];

const bookings = [
  { name: "Deshpande", size: 8, at: "8:00 pm", table: "T7", note: "Anniversary — cake at 9" },
  { name: "Corporate · Infosys", size: 4, at: "8:15 pm", table: "R4", note: "Needs GST invoice" },
  { name: "Mehta", size: 3, at: "9:00 pm", table: "—", note: "" },
];

export default function TablesPage() {
  const toast = useToast();
  const [zone, setZone] = useState("all");
  const [tables, setTables] = useState<Table[]>(repo.tables());
  const [sel, setSel] = useState<Table | null>(null);
  const [qr, setQr] = useState(false);
  const [pay, setPay] = useState<Table | null>(null);
  const [addWait, setAddWait] = useState(false);

  const zones = Array.from(new Set(tables.map((t) => t.zone)));
  const shown = tables.filter((t) => zone === "all" || t.zone === zone);
  const busy = tables.filter((t) => ["seated", "ordered", "billing"].includes(t.status)).length;

  const update = (id: string, patch: Partial<Table>, msg: string) => {
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setSel(null);
    toast(msg);
  };

  return (
    <>
      <PageHeader
        title="Tables"
        subtitle={`${busy} busy · ${tables.filter((t) => t.status === "free").length} free · ${waitlist.length} waiting`}
        actions={<Button variant="tinted" size="sm" onClick={() => setAddWait(true)}><Plus size={16} /> Waitlist</Button>}
      >
        <Segmented
          value={zone}
          onChange={setZone}
          options={[{ value: "all", label: "All" }, ...zones.map((z) => ({ value: z, label: z }))]}
        />
      </PageHeader>
      <Page>
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {shown.map((t) => {
                const s = statusStyle[t.status];
                const mins = t.since ? minutesSince(t.since) : 0;
                const long = t.status !== "reserved" && t.status !== "free" && mins > 60;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSel(t)}
                    className={clsx(
                      "relative flex flex-col justify-between rounded-[22px] p-3 text-left transition active:scale-[.97] lg:p-4",
                      s.tile,
                      t.seats >= 6 ? "col-span-2 aspect-[2.1/1]" : "aspect-square",
                      t.status === "reserved" && "outline-dashed outline-2 -outline-offset-2 outline-line ring-0",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[22px] font-semibold tracking-tight lg:text-[26px]">{t.name}</span>
                      <span className={clsx("mt-2 h-2.5 w-2.5 rounded-full", s.dot, t.status === "billing" && "animate-pulse")} />
                    </div>
                    <div className="text-[12px] leading-tight text-muted lg:text-[13px]">
                      {t.status === "free" && <span className="flex items-center gap-1"><Users size={12} /> {t.seats} seats</span>}
                      {t.status === "reserved" && <span>{timeAgo(t.since!).replace("in ", "In ")}</span>}
                      {["seated", "ordered", "billing"].includes(t.status) && (
                        <>
                          <span className={clsx("flex items-center gap-1", long && "font-semibold text-rose")}>
                            <Clock size={12} /> {mins} min · {t.guests} pax
                          </span>
                          {t.total ? <span className="font-semibold text-ink tnum">{inr(t.total)}</span> : <span>Not ordered</span>}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-[12.5px] text-muted">
              {(Object.keys(statusStyle) as TableStatus[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={clsx("h-2 w-2 rounded-full", statusStyle[k].dot)} />
                  {statusStyle[k].label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Group
              title="Waitlist"
              action={<span className="text-[12px] text-muted">Wait times predicted from table pace</span>}
              flush
            >
              {waitlist.map((w) => (
                <div key={w.name} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                  <span className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-sunken text-[13px] font-semibold leading-none tnum">
                    {w.size}
                    <span className="text-[9px] font-medium text-muted">pax</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{w.name}</div>
                    <div className="text-[12.5px] text-muted">Waiting {w.waited} min · table in ~{w.eta} min</div>
                  </div>
                  <button aria-label={`Message ${w.name}`} onClick={() => toast(`WhatsApp sent: "Your table is ready"`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-jade-soft text-jade">
                    <MessageCircle size={16} />
                  </button>
                </div>
              ))}
            </Group>

            <Group title="Bookings tonight" flush>
              {bookings.map((b) => (
                <div key={b.name} className="flex items-start gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                  <CalendarClock size={18} className="mt-0.5 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[15px] font-medium">{b.name} · {b.size}</span>
                      <span className="text-[13px] font-semibold tnum">{b.at}</span>
                    </div>
                    <div className="text-[12.5px] text-muted">{b.table === "—" ? "No table yet" : `Table ${b.table}`}{b.note && ` · ${b.note}`}</div>
                  </div>
                </div>
              ))}
            </Group>
          </div>
        </div>
      </Page>

      {/* Table actions */}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `Table ${sel.name}` : ""}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[14px] text-muted">
              <Pill tone={sel.status === "billing" ? "saffron" : sel.status === "ordered" ? "jade" : sel.status === "seated" ? "sky" : "neutral"}>{statusStyle[sel.status].label}</Pill>
              {sel.zone} · {sel.seats} seats{sel.server && ` · ${sel.server}`}
            </div>
            {sel.total ? (
              <div className="flex items-baseline justify-between rounded-group bg-surface p-4">
                <span className="text-[15px] text-muted">Running bill</span>
                <span className="text-[28px] font-semibold tnum">{inr(sel.total)}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {sel.status === "free" && (
                <Button size="lg" className="col-span-2" onClick={() => update(sel.id, { status: "seated", guests: 2, since: new Date().toISOString(), server: "Rohit" }, `Guests seated at ${sel.name}`)}>
                  <Users size={18} /> Seat guests
                </Button>
              )}
              {sel.status === "reserved" && (
                <Button size="lg" className="col-span-2" onClick={() => update(sel.id, { status: "seated", guests: sel.seats, since: new Date().toISOString() }, `Booking arrived at ${sel.name}`)}>
                  Guests arrived
                </Button>
              )}
              {["seated", "ordered", "billing"].includes(sel.status) && (
                <>
                  <Link href="/app/pos" className="col-span-2">
                    <Button size="lg" variant={sel.status === "billing" ? "tinted" : "primary"} className="w-full"><Plus size={18} /> Add to order</Button>
                  </Link>
                  {sel.total ? (
                    <Button size="lg" className="col-span-2" variant={sel.status === "billing" ? "primary" : "tinted"} onClick={() => { setPay(sel); setSel(null); }}>
                      <ReceiptText size={18} /> Charge {inr(Math.round(sel.total * 1.05))}
                    </Button>
                  ) : null}
                  <Button variant="plain" onClick={() => toast("Pick the table to move to")}><ArrowLeftRight size={16} /> Move</Button>
                  <Button variant="plain" onClick={() => toast("Pick a table to merge with")}><Merge size={16} /> Merge</Button>
                </>
              )}
              <Button variant="plain" className={sel.status === "free" || sel.status === "reserved" ? "col-span-2" : "col-span-2"} onClick={() => setQr(true)}>
                <QrCode size={16} /> Show table QR
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={qr} onClose={() => setQr(false)} title="Table QR">
        <div className="flex flex-col items-center rounded-group bg-surface p-6 text-center">
          <FakeQr seed={sel?.name ?? "T"} size={220} />
          <div className="mt-4 text-[17px] font-semibold">Scan to see the menu and order</div>
          <p className="mt-1 max-w-xs text-[14px] text-muted">Guests order from their phone, call a waiter, and split the bill. Orders land straight in the kitchen.</p>
          <Link href="/order/T3" className="mt-4 text-[14px] font-semibold text-jade">Preview what guests see</Link>
        </div>
      </Sheet>

      <Sheet open={addWait} onClose={() => setAddWait(false)} title="Add to waitlist" footer={<Button size="lg" className="w-full" onClick={() => { setAddWait(false); toast("Added · WhatsApp sent with ~12 min wait"); }}>Add and notify guest</Button>}>
        <div className="space-y-4">
          <Field label="Name"><input className={inputCls} placeholder="Guest name" /></Field>
          <Field label="Phone" hint="We'll WhatsApp them when their table is ready."><input className={inputCls} inputMode="tel" placeholder="98xxx xxxxx" /></Field>
          <Field label="Party size"><input className={inputCls} inputMode="numeric" defaultValue={2} /></Field>
        </div>
      </Sheet>

      <Checkout open={!!pay} onClose={() => setPay(null)} subtotal={pay?.total ?? 0} label={pay ? `Table ${pay.name}` : ""} onPaid={() => pay && setTables((ts) => ts.map((t) => (t.id === pay.id ? { id: t.id, name: t.name, zone: t.zone, seats: t.seats, status: "free" } : t)))} />
    </>
  );
}
