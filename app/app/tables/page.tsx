"use client";

import { useCloud } from "@/lib/cloud";
import clsx from "clsx";
import Link from "next/link";
import { ArrowLeftRight, CalendarClock, Check, Clock, Merge, Minus, Plus, QrCode, ReceiptText, MessageCircle, Smartphone, Users, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button, Group, Page, PageHeader, Pill, Segmented, Sheet, Field, inputCls } from "@/components/ui";
import { ScanQr } from "@/components/qr";
import { Checkout } from "@/components/checkout";
import { useToast } from "@/components/toast";
import { inr, minutesSince, timeAgo } from "@/lib/format";
import { getOrders, orderActions } from "@/lib/live";
import { isShared, oldestSince, seatsFree, seatsTaken, tableActions, tableState, tableTotal, useTables } from "@/lib/tables";
import type { Party, Table, TableStatus } from "@/lib/types";

const statusStyle: Record<TableStatus, { label: string; tile: string; dot: string; tone: "neutral" | "jade" | "saffron" | "sky" }> = {
  free: { label: "Free", tile: "bg-surface", dot: "bg-line", tone: "neutral" },
  seated: { label: "Seated", tile: "bg-sky-soft", dot: "bg-sky", tone: "sky" },
  ordered: { label: "Eating", tile: "bg-jade-soft", dot: "bg-jade", tone: "jade" },
  billing: { label: "Wants bill", tile: "bg-saffron-soft", dot: "bg-saffron", tone: "saffron" },
  reserved: { label: "Reserved", tile: "bg-surface", dot: "bg-faint", tone: "neutral" },
};

const waitlist = [
  { name: "Joshi family", size: 6, waited: 14, eta: 10 },
  { name: "Ananya + 1", size: 2, waited: 6, eta: 4 },
  { name: "Kunal", size: 1, waited: 2, eta: 0, shareHint: "T6 has a free seat — offer to share" },
];

const bookings = [
  { name: "Deshpande", size: 8, at: "8:00 pm", table: "T7", note: "Anniversary — cake at 9" },
  { name: "Corporate · Infosys", size: 4, at: "8:15 pm", table: "R4", note: "Needs GST invoice" },
  { name: "Mehta", size: 3, at: "9:00 pm", table: "—", note: "" },
];

function Stepper({ value, onChange, min = 1, max = 20 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-sunken p-1">
      <button aria-label="Fewer guests" onClick={() => onChange(Math.max(min, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Minus size={16} /></button>
      <span className="w-8 text-center text-[17px] font-semibold tnum">{value}</span>
      <button aria-label="More guests" onClick={() => onChange(Math.min(max, value + 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Plus size={16} /></button>
    </div>
  );
}

export default function TablesPage() {
  const cloud = useCloud();
  const toast = useToast();
  const tables = useTables();
  const [zone, setZone] = useState("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [qr, setQr] = useState(false);
  const [seat, setSeat] = useState<{ tableId: string; guests: number } | null>(null);
  const [move, setMove] = useState<{ tableId: string; partyId: string } | null>(null);
  const [pay, setPay] = useState<{ tableId: string; party: Party; label: string } | null>(null);
  const [addWait, setAddWait] = useState(false);

  const sel = tables.find((t) => t.id === selId) ?? null;
  const zones = Array.from(new Set(tables.map((t) => t.zone)));
  const shown = tables.filter((t) => zone === "all" || t.zone === zone);
  const busy = tables.filter((t) => t.parties.length).length;
  const shared = tables.filter(isShared).length;
  const pending = tables.flatMap((t) => t.parties.filter((p) => p.pendingApproval).map((p) => ({ t, p })));

  const partyOrders = (tableId: string, partyId: string) =>
    getOrders().filter((o) => o.tableId === tableId && (o.partyId ?? "A") === partyId && !["paid", "cancelled"].includes(o.status));
  const acceptParty = (tableId: string, _name: string, partyId: string) => {
    tableActions.update(tableId, partyId, { pendingApproval: false, server: "Sneha" });
    partyOrders(tableId, partyId).filter((o) => o.status === "new").forEach((o) => orderActions.setStatus(o.id, "accepted"));
  };
  const rejectParty = (tableId: string, _name: string, partyId: string) => {
    partyOrders(tableId, partyId).forEach((o) => orderActions.setStatus(o.id, "cancelled"));
    tableActions.close(tableId, partyId);
  };
  const openSeat = (t: Table) => setSeat({ tableId: t.id, guests: Math.max(1, Math.min(2, seatsFree(t) || 1)) });

  return (
    <>
      <PageHeader
        title="Tables"
        subtitle={`${busy} busy · ${tables.filter((t) => tableState(t) === "free").length} free${shared ? ` · ${shared} shared` : ""} · ${waitlist.length} waiting`}
        actions={<Button variant="tinted" size="sm" onClick={() => setAddWait(true)}><Plus size={16} /> Waitlist</Button>}
      >
        <Segmented value={zone} onChange={setZone} options={[{ value: "all", label: "All" }, ...zones.map((z) => ({ value: z, label: z }))]} />
      </PageHeader>
      <Page>
        {pending.length > 0 && (
          <div className="mb-5 space-y-2">
            {pending.map(({ t, p }) => (
              <div key={t.id + p.id} className="flex animate-pop items-center gap-3 rounded-group bg-saffron-soft p-3.5">
                <Smartphone size={18} className="shrink-0 text-saffron" />
                <p className="flex-1 text-[14px]"><b>New group at {t.name}</b> ordered from the QR. Check they are seated, then accept — their order goes to the kitchen.</p>
                <Button size="sm" variant="plain" onClick={() => { rejectParty(t.id, t.name, p.id); toast("Rejected · guest told to call a captain"); }}>Reject</Button>
                <Button size="sm" onClick={() => { acceptParty(t.id, t.name, p.id); toast(`${t.name} · Group ${p.id} accepted · KOT sent`); }}>Accept</Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {shown.map((t) => {
                const st = tableState(t);
                const s = statusStyle[st];
                const since = oldestSince(t);
                const mins = since ? minutesSince(since) : 0;
                const long = t.parties.length > 0 && mins > 60;
                const total = tableTotal(t);
                const hasPending = t.parties.some((p) => p.pendingApproval);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelId(t.id)}
                    className={clsx(
                      "relative flex flex-col justify-between rounded-[22px] p-3 text-left transition active:scale-[.97] lg:p-4",
                      s.tile,
                      t.seats >= 6 ? "col-span-2 aspect-[2.1/1]" : "aspect-square",
                      st === "reserved" && "outline-dashed outline-2 -outline-offset-2 outline-line",
                      hasPending && "ring-2 ring-saffron",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[22px] font-semibold tracking-tight lg:text-[26px]">{t.name}</span>
                      {isShared(t) ? (
                        <span className="mt-1 flex gap-1">
                          {t.parties.map((p) => (
                            <span key={p.id} className={clsx("flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-bold", p.pendingApproval ? "bg-saffron text-white" : "bg-ink text-canvas")}>{p.id}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={clsx("mt-2 h-2.5 w-2.5 rounded-full", s.dot, st === "billing" && "animate-pulse")} />
                      )}
                    </div>
                    <div className="text-[12px] leading-tight text-muted lg:text-[13px]">
                      {st === "free" && <span className="flex items-center gap-1"><Users size={12} /> {t.seats} seats</span>}
                      {st === "reserved" && t.reservedAt && <span>{timeAgo(t.reservedAt).replace("in ", "In ")}</span>}
                      {t.parties.length > 0 && (
                        <>
                          <span className={clsx("flex items-center gap-1", long && "font-semibold text-rose")}>
                            <Clock size={12} /> {mins} min · {seatsTaken(t)}/{t.seats}
                          </span>
                          {total ? <span className="font-semibold text-ink tnum">{inr(total)}{isShared(t) && <span className="font-normal text-muted"> · {t.parties.length} bills</span>}</span> : <span>Not ordered</span>}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 px-1 text-[12.5px] text-muted">
              {(Object.keys(statusStyle) as TableStatus[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5"><span className={clsx("h-2 w-2 rounded-full", statusStyle[k].dot)} />{statusStyle[k].label}</span>
              ))}
              <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-[8px] font-bold text-canvas">A</span>Shared table, one bill per party</span>
            </div>
          </div>

          <div className="space-y-6">
            <Group title="Waitlist" action={<span className="text-[12px] text-muted">Wait predicted from table pace</span>} flush>
              {waitlist.map((w) => (
                <div key={w.name} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                  <span className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-sunken text-[13px] font-semibold leading-none tnum">{w.size}<span className="text-[9px] font-medium text-muted">pax</span></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{w.name}</div>
                    <div className={clsx("text-[12.5px]", w.shareHint ? "font-medium text-jade" : "text-muted")}>{w.shareHint ?? `Waiting ${w.waited} min · table in ~${w.eta} min`}</div>
                  </div>
                  {w.shareHint ? (
                    <Button size="sm" variant="tinted" onClick={() => { const t = tables.find((x) => x.name === "T6")!; const p = tableActions.seat(t.id, 1); toast(`Kunal seated at T6 · Party ${p.id}, separate bill`); }}>Seat at T6</Button>
                  ) : (
                    <button aria-label={`Message ${w.name}`} onClick={() => toast(`WhatsApp sent: "Your table is ready"`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-jade-soft text-jade"><MessageCircle size={16} /></button>
                  )}
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

      {/* ---------- Table detail ---------- */}
      <Sheet open={!!sel} onClose={() => setSelId(null)} title={sel ? `Table ${sel.name}` : ""} wide>
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-muted">
              <Pill tone={statusStyle[tableState(sel)].tone}>{statusStyle[tableState(sel)].label}</Pill>
              <span>{sel.zone} · {seatsTaken(sel)} of {sel.seats} seats taken</span>
              {isShared(sel) && <Pill tone="neutral">Shared · {sel.parties.length} separate bills</Pill>}
            </div>

            {sel.parties.length === 0 && (
              <Button size="lg" className="w-full" onClick={() => openSeat(sel)}><Users size={18} /> Seat guests</Button>
            )}

            {sel.parties.map((p) => {
              const label = isShared(sel) ? `Party ${p.id}` : "Guests";
              const others = sel.parties.filter((x) => x.id !== p.id);
              return (
                <div key={p.id} className={clsx("overflow-hidden rounded-group bg-surface", p.pendingApproval && "ring-2 ring-saffron")}>
                  <div className="flex items-start gap-3 p-4">
                    {isShared(sel) && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-bold text-canvas">{p.id}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[16px] font-semibold">{label} · {p.guests} {p.guests > 1 ? "guests" : "guest"}</span>
                        <Pill tone={p.status === "billing" ? "saffron" : p.status === "ordered" ? "jade" : "sky"}>{p.status === "billing" ? "Wants bill" : p.status === "ordered" ? "Eating" : "Seated"}</Pill>
                        {p.pendingApproval && <Pill tone="saffron">Ordered from QR · accept?</Pill>}
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted">
                        {minutesSince(p.since)} min · {p.server ?? "No captain yet"} · {p.source === "qr" ? "opened from QR" : "seated by captain"}
                        {p.phoneClaimed && <> · <Smartphone size={12} className="inline -translate-y-px" /> phone linked</>}
                      </div>
                      <div className="mt-1 text-[12.5px] text-muted">Join code for friends: <b className="tracking-widest text-ink tnum">{p.code}</b></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-semibold tnum">{p.total ? inr(p.total) : "—"}</div>
                      <div className="text-[12px] text-muted">{p.total ? "before GST" : "no order yet"}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-line/80 bg-sunken/30 p-3">
                    {p.pendingApproval ? (
                      <Button size="sm" onClick={() => { acceptParty(sel.id, sel.name, p.id); toast(`Party ${p.id} accepted · their order went to the kitchen`); }}><Check size={15} /> Accept order</Button>
                    ) : (
                      <Link href={`/app/pos?table=${sel.name}&party=${p.id}`}><Button size="sm"><Plus size={15} /> Add to order</Button></Link>
                    )}
                    {p.total ? (
                      <Button size="sm" variant="tinted" onClick={() => setPay({ tableId: sel.id, party: p, label: isShared(sel) ? `${sel.name} · Party ${p.id}` : `Table ${sel.name}` })}><ReceiptText size={15} /> Charge {inr(Math.round(p.total * 1.05))}</Button>
                    ) : null}
                    <Button size="sm" variant="plain" onClick={() => setMove({ tableId: sel.id, partyId: p.id })}><ArrowLeftRight size={15} /> Move</Button>
                    {others.map((o) => (
                      <Button key={o.id} size="sm" variant="plain" onClick={() => { tableActions.merge(sel.id, p.id, o.id); toast(`Party ${p.id} joined Party ${o.id} · one bill now`); }}>
                        <Merge size={15} /> Merge with {o.id}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}

            {sel.parties.length > 0 && (
              <button onClick={() => openSeat(sel)} className="flex w-full items-center gap-3 rounded-group border-2 border-dashed border-line px-4 py-3.5 text-left hover:border-jade">
                <UserPlus size={20} className="text-jade" />
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold">Share table · seat another party</span>
                  <span className="block text-[13px] text-muted">
                    {seatsFree(sel) > 0 ? `${seatsFree(sel)} seat${seatsFree(sel) > 1 ? "s" : ""} free. They get their own order and bill.` : "Table is full — add only if guests agree to squeeze in."}
                  </span>
                </span>
              </button>
            )}

            <Button variant="plain" className="w-full" onClick={() => setQr(true)}><QrCode size={16} /> Show table QR</Button>
          </div>
        )}
      </Sheet>

      {/* ---------- Seat a party ---------- */}
      <Sheet
        open={!!seat}
        onClose={() => setSeat(null)}
        title={seat && tables.find((t) => t.id === seat.tableId)?.parties.length ? "Seat another party" : "Seat guests"}
        footer={
          seat && (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                const t = tables.find((x) => x.id === seat.tableId)!;
                const p = tableActions.seat(t.id, seat.guests);
                setSeat(null);
                toast(t.parties.length ? `Party ${p.id} seated at ${t.name} · separate bill` : `${seat.guests} guests seated at ${t.name}`);
              }}
            >
              Seat {seat.guests} {seat.guests > 1 ? "guests" : "guest"}
            </Button>
          )
        }
      >
        {seat && (() => {
          const t = tables.find((x) => x.id === seat.tableId)!;
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-group bg-surface px-4 py-3">
                <span className="text-[15px] font-medium">How many guests?</span>
                <Stepper value={seat.guests} onChange={(n) => setSeat({ ...seat, guests: n })} max={t.seats} />
              </div>
              {t.parties.length > 0 && (
                <div className="rounded-group bg-surface p-4 text-[14px] leading-relaxed text-muted">
                  They become <b className="text-ink">Party {String.fromCharCode(65 + t.parties.length)}</b> at {t.name}. Their dishes print on KOTs as
                  <b className="text-ink"> {t.name} · {String.fromCharCode(65 + t.parties.length)}</b>, and their bill stays separate from the others.
                  When they scan the table QR and pick &ldquo;I&apos;m on my own&rdquo;, their phone links to this party automatically.
                </div>
              )}
              {seatsTaken(t) + seat.guests > t.seats && <p className="text-[13px] font-medium text-saffron">That&apos;s more guests than seats at {t.name}.</p>}
            </div>
          );
        })()}
      </Sheet>

      {/* ---------- Move a party ---------- */}
      <Sheet open={!!move} onClose={() => setMove(null)} title="Move to which table?">
        {move && (
          <div className="grid grid-cols-4 gap-2">
            {tables.filter((t) => t.id !== move.tableId).map((t) => {
              const free = tableState(t) === "free";
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    const from = tables.find((x) => x.id === move.tableId)!;
                    const p = tableActions.move(move.tableId, move.partyId, t.id);
                    setMove(null);
                    setSelId(t.id);
                    toast(`Moved from ${from.name} to ${t.name}${t.parties.length ? ` · Party ${p.id}` : ""} · order moved too`);
                  }}
                  className={clsx("rounded-[14px] py-3 text-center", free ? "bg-surface" : "bg-sunken text-muted")}
                >
                  <div className="text-[17px] font-semibold">{t.name}</div>
                  <div className="text-[11px]">{free ? `${t.seats} seats` : `${seatsFree(t)} free`}</div>
                </button>
              );
            })}
          </div>
        )}
      </Sheet>

      <Sheet open={qr} onClose={() => setQr(false)} title={`Table ${sel?.name ?? ""} QR`}>
        <div className="flex flex-col items-center rounded-group bg-surface p-6 text-center">
          <ScanQr value={`${typeof window !== "undefined" ? window.location.origin : ""}/order/${sel?.name ?? "T3"}${cloud.rid ? `?r=${cloud.rid}` : ""}`} size={220} label={`Table ${sel?.name ?? ""} ordering QR`} />
          <div className="mt-4 text-[17px] font-semibold">Scan to see the menu and order</div>
          <p className="mt-1 max-w-xs text-[14px] text-muted">
            Print once — it never changes.
          </p>
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <Button variant="tinted" onClick={() => toast(`Table ${sel?.name} QR ready to print`)}>Print this QR</Button>
            <Button variant="plain" className="!bg-sunken" onClick={() => toast("All 13 table QRs ready to print (A6 size)")}>Print all tables</Button>
          </div>
          <Link href={`/order/${sel?.name ?? "T3"}${cloud.rid ? `?r=${cloud.rid}` : ""}`} className="mt-4 text-[14px] font-semibold text-jade">Preview what guests see</Link>
        </div>
      </Sheet>

      <Sheet open={addWait} onClose={() => setAddWait(false)} title="Add to waitlist" footer={<Button size="lg" className="w-full" onClick={() => { setAddWait(false); toast("Added · WhatsApp sent with ~12 min wait"); }}>Add and notify guest</Button>}>
        <div className="space-y-4">
          <Field label="Name"><input className={inputCls} placeholder="Guest name" /></Field>
          <Field label="Phone" hint="We'll WhatsApp them when their table is ready."><input className={inputCls} inputMode="tel" placeholder="98xxx xxxxx" /></Field>
          <Field label="Party size"><input className={inputCls} inputMode="numeric" defaultValue={2} /></Field>
        </div>
      </Sheet>

      <Checkout
        open={!!pay}
        onClose={() => setPay(null)}
        subtotal={pay?.party.total ?? 0}
        label={pay?.label ?? ""}
        preferred={pay ? partyOrders(pay.tableId, pay.party.id).find((o) => o.payPreference)?.payPreference : undefined}
        prepaid={pay ? partyOrders(pay.tableId, pay.party.id).flatMap((o) => o.prepaid ?? []) : undefined}
        onPaid={(payments) => {
          if (!pay) return;
          const ids = partyOrders(pay.tableId, pay.party.id).map((o) => o.id);
          if (ids.length) orderActions.pay(ids, payments, "Sneha");
          tableActions.close(pay.tableId, pay.party.id);
        }}
      />
    </>
  );
}
