"use client";

import { ClaimCheck } from "@/components/claim-check";
import { useCloud } from "@/lib/cloud";
import clsx from "clsx";
import Link from "next/link";
import { Check, Clock, LayoutGrid, Link2, LogOut, Merge, Minus, Plus, Printer, QrCode, ReceiptText, Settings2, Smartphone, SprayCan, Unlink, Users, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button, Empty, Hint, Page, PageHeader, Pill, Segmented, Sheet } from "@/components/ui";
import { ScanQr } from "@/components/qr";
import dynamic from "next/dynamic";
// the payment sheet (UPI QR, receipts) loads when it is first opened, so this page opens faster
const Checkout = dynamic(() => import("@/components/checkout").then((m) => m.Checkout), { ssr: false });
import { useToast } from "@/components/toast";
import { gstRate, inr, minutesSince, timeAgo } from "@/lib/format";
import { counterPref, getOrders, payingOnline, orderActions, paymentsText, useCan, useCanConfirm, useCurrentOutlet, useMe, useOrders } from "@/lib/live";
import { closeBill, confirmPayment, rejectPayment } from "@/lib/billing";
import { capacity, isShared, joinedName, joinedOf, oldestSince, seatsFree, seatsTaken, tableActions, tableState, tableTotal, useLiveTables } from "@/lib/tables";
import { TableManager } from "@/components/table-manager";
import { CleanCard, CleanSheet } from "@/components/table-cleaning";
import { CookingLoader } from "@/components/loader";
import { useReady } from "@/lib/store";
import type { Party, Table, TableStatus } from "@/lib/types";

const statusStyle: Record<TableStatus, { label: string; tile: string; dot: string; tone: "neutral" | "jade" | "saffron" | "sky" }> = {
  free: { label: "Free", tile: "bg-surface", dot: "bg-line", tone: "neutral" },
  seated: { label: "Seated", tile: "bg-sky-soft", dot: "bg-sky", tone: "sky" },
  ordered: { label: "Eating", tile: "bg-jade-soft", dot: "bg-jade", tone: "jade" },
  billing: { label: "Wants bill", tile: "bg-saffron-soft", dot: "bg-saffron", tone: "saffron" },
  reserved: { label: "Reserved", tile: "bg-surface", dot: "bg-faint", tone: "neutral" },
};

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
  const tables = useLiveTables();
  const tablesReady = useReady("tables");
  const [zone, setZone] = useState("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [qr, setQr] = useState(false);
  const [seat, setSeat] = useState<{ tableId: string; guests: number } | null>(null);
  const [pay, setPay] = useState<{ tableId: string; party: Party; label: string } | null>(null);
  const [manage, setManage] = useState(false);
  const [joining, setJoining] = useState(false);
  const [cleanId, setCleanId] = useState<string | null>(null);
  const me = useMe();
  const outlet = useCurrentOutlet();
  const canManage = useCan("outletSettings");
  const myName = me ? (me.role === "owner" ? `${me.name} (Owner)` : me.name) : "Staff";
  const canConfirm = useCanConfirm();
  const canCharge = useCan("charge");
  useOrders(); // re-draw when orders change (payment claims)
  const qrUrl = (t: Table | null) => `${typeof window !== "undefined" ? window.location.origin : ""}/order/${t?.id ?? ""}${cloud.rid ? `?r=${cloud.rid}` : ""}`;

  const sel = tables.find((t) => t.id === selId) ?? null;
  const zones = Array.from(new Set(tables.map((t) => t.zone)));
  const shown = tables.filter((t) => zone === "all" || t.zone === zone);
  const busy = tables.filter((t) => t.parties.length).length;
  const shared = tables.filter(isShared).length;
  const toClean = tables.filter((t) => t.cleaning).length;
  const pending = tables.flatMap((t) => t.parties.filter((p) => p.pendingApproval).map((p) => ({ t, p })));

  const partyOrders = (tableId: string, partyId: string) =>
    getOrders().filter((o) => o.tableId === tableId && (o.partyId ?? "A") === partyId && !["paid", "cancelled"].includes(o.status));
  const acceptParty = (tableId: string, _name: string, partyId: string) => {
    tableActions.update(tableId, partyId, { pendingApproval: false, server: myName });
    partyOrders(tableId, partyId).filter((o) => o.status === "new" && !payingOnline(o)).forEach((o) => orderActions.setStatus(o.id, "accepted"));
  };
  const rejectParty = (tableId: string, _name: string, partyId: string) => {
    partyOrders(tableId, partyId).forEach((o) => orderActions.setStatus(o.id, "cancelled"));
    tableActions.close(tableId, partyId);
  };
  const openSeat = (t: Table) => setSeat({ tableId: t.id, guests: Math.max(1, Math.min(2, seatsFree(t, tables) || 1)) });
  const mainOf = (t: Table) => (t.joinedTo ? tables.find((x) => x.id === t.joinedTo) : undefined);
  // tables that can be pushed up against the open one: free, not joined to anything
  const joinable = sel ? tables.filter((x) => x.id !== sel.id && !x.parties.length && !x.joinedTo && !joinedOf(x, tables).length) : [];

  return (
    <>
      <PageHeader
        title="Tables"
        subtitle={tables.length ? `${outlet.name ? `${outlet.name} · ` : ""}${busy} busy · ${tables.filter((t) => tableState(t) === "free").length} free${shared ? ` · ${shared} shared` : ""}${toClean ? ` · ${toClean} to clean` : ""}` : outlet.name}
        actions={
          <div className="flex gap-2">
            {tables.length > 0 && (me?.role === "owner" || me?.role === "subadmin") && <Link href="/print/tables"><Button variant="plain" size="sm"><Printer size={16} /> QR codes</Button></Link>}
            {canManage && <Button variant="tinted" size="sm" onClick={() => setManage(true)}><Settings2 size={16} /> Manage tables</Button>}
          </div>
        }
      >
        {zones.length > 1 && <Segmented value={zone} onChange={setZone} options={[{ value: "all", label: "All" }, ...zones.map((z) => ({ value: z, label: z }))]} />}
      </PageHeader>
      <Page>
        {pending.length > 0 && (
          <div className="mb-5 space-y-2">
            {pending.map(({ t, p }) => (
              <div key={t.id + p.id} className="flex animate-pop flex-col gap-3 rounded-group bg-saffron-soft p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-start gap-3">
                  <Smartphone size={18} className="mt-0.5 shrink-0 text-saffron" />
                  <p className="text-[14px]"><b>New group at {t.name}</b> ordered from the QR. Check they are seated, then accept — their order goes to the kitchen.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button size="sm" variant="plain" onClick={() => { rejectParty(t.id, t.name, p.id); toast("Rejected"); }}>Reject</Button>
                  <Button size="sm" onClick={() => { acceptParty(t.id, t.name, p.id); toast(`${t.name} · Group ${p.id} accepted · KOT sent`); }}>Accept</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tables.length === 0 && !tablesReady ? (
          <div className="flex justify-center py-20"><CookingLoader size={56} label="Loading tables" /></div>
        ) : tables.length === 0 ? (
          <Empty
            icon={<LayoutGrid size={26} />}
            title="No tables yet"
            body={canManage ? "Add your tables once. Each one gets its own QR code for ordering." : "Ask the owner or manager to add tables."}
            action={canManage ? <Button onClick={() => setManage(true)}><Plus size={16} /> Add tables</Button> : undefined}
          />
        ) : (
          <div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {shown.map((t) => {
                const main = mainOf(t);
                if (main)
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelId(main.id)}
                      className={clsx("relative flex flex-col justify-between rounded-[22px] border-2 border-dashed border-line bg-sunken/60 p-3 text-left transition active:scale-[.97] lg:p-4", t.seats >= 6 ? "col-span-2 aspect-[2.1/1]" : "aspect-square")}
                    >
                      <span className="text-[22px] font-semibold tracking-tight text-muted lg:text-[26px]">{t.name}</span>
                      <span className="flex items-center gap-1 text-[12px] font-semibold leading-tight text-jade lg:text-[13px]"><Link2 size={12} /> Joined with {main.name}</span>
                    </button>
                  );
                const joined = joinedOf(t, tables);
                const cap = capacity(t, tables);
                const st = tableState(t);
                const s = statusStyle[st];
                const since = oldestSince(t);
                const mins = since ? minutesSince(since) : 0;
                const long = t.parties.length > 0 && mins > 60;
                const total = tableTotal(t);
                const hasPending = t.parties.some((p) => p.pendingApproval);
                const toConfirm = t.parties.some((p) => p.paymentPending);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelId(t.id)}
                    className={clsx(
                      "relative flex flex-col justify-between rounded-[22px] p-3 text-left transition active:scale-[.97] lg:p-4",
                      s.tile,
                      t.seats >= 6 ? "col-span-2 aspect-[2.1/1]" : "aspect-square",
                      st === "reserved" && "outline-dashed outline-2 -outline-offset-2 outline-line",
                      (hasPending || toConfirm) && "ring-2 ring-saffron",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[22px] font-semibold tracking-tight lg:text-[26px]">
                        {t.name}
                        {joined.length > 0 && <span className="ml-1 text-[13px] font-semibold text-jade lg:text-[14px]">+{joined.map((x) => x.name).join(" +")}</span>}
                      </span>
                      {isShared(t) ? (
                        <span className="mt-1 flex gap-1">
                          {t.parties.map((p) => (
                            <span key={p.id} className={clsx("flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-bold", p.pendingApproval ? "bg-saffron text-white" : "bg-ink text-canvas")}>{p.id}</span>
                          ))}
                        </span>
                      ) : (
                        <span className={clsx("mt-2 h-2.5 w-2.5 rounded-full", st === "free" && t.cleaning ? "bg-rose" : s.dot, st === "billing" && "animate-pulse")} />
                      )}
                    </div>
                    <div className="text-[12px] leading-tight text-muted lg:text-[13px]">
                      {t.cleaning ? (
                        <span className="flex items-center gap-1 font-semibold text-rose"><SprayCan size={12} /> <span className="truncate">{t.cleaning.toName ? `Clean · ${t.cleaning.toName}` : "To clean"}</span></span>
                      ) : st === "free" && <span className="flex items-center gap-1"><Users size={12} /> {cap} seats</span>}
                      {st === "reserved" && t.reservedAt && <span>{timeAgo(t.reservedAt).replace("in ", "In ")}</span>}
                      {t.parties.length > 0 && (
                        <>
                          <span className={clsx("flex items-center gap-1", long && "font-semibold text-rose")}>
                            <Clock size={12} /> {mins} min · {seatsTaken(t)}/{cap}
                          </span>
                          {toConfirm ? <span className="font-semibold text-saffron">Paid? Confirm</span> : total ? <span className="font-semibold text-ink tnum">{inr(Math.round(total * (1 + gstRate())))}{isShared(t) && <span className="font-normal text-muted"> · {t.parties.length} bills</span>}</span> : <span>Not ordered</span>}
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
              <span className="flex items-center gap-1.5"><SprayCan size={12} className="text-rose" />To clean</span>
              <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink text-[8px] font-bold text-canvas">A</span>Shared table, one bill per party</span>
            </div>
          </div>

        )}
      </Page>

      {/* ---------- Table detail ---------- */}
      <Sheet open={!!sel} onClose={() => setSelId(null)} title={sel ? `Table ${joinedName(sel, tables)}` : ""} wide>
        {sel && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
              <Pill tone={statusStyle[tableState(sel)].tone}>{statusStyle[tableState(sel)].label}</Pill>
              <span className="inline-flex items-center gap-1 tnum"><Users size={14} /> {seatsTaken(sel)}/{capacity(sel, tables)}</span>
              {sel.zone && <span>· {sel.zone}</span>}
              {isShared(sel) && <Pill tone="neutral">{sel.parties.length} bills</Pill>}
            </div>

            <CleanCard table={sel} onChange={() => setCleanId(sel.id)} />

            {sel.parties.length === 0 && (
              <Button size="lg" className="w-full" onClick={() => openSeat(sel)}><Users size={18} /> Seat guests</Button>
            )}

            {/* tables joined to this one (big group) */}
            {joinedOf(sel, tables).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Link2 size={16} className="text-jade" />
                {joinedOf(sel, tables).map((x) => (
                  <span key={x.id} className="flex items-center gap-2 rounded-full bg-jade-soft py-1 pl-3 pr-1 text-[13.5px] font-semibold text-jade-deep">
                    + {x.name} · {x.seats}
                    <button onClick={() => { tableActions.separate(x.id); toast(`${x.name} is a separate table again`); }} title="Make it a separate table again" className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[12px]" aria-label={`Separate ${x.name}`}><Unlink size={12} /> Separate</button>
                  </span>
                ))}
              </div>
            )}

            {sel.parties.map((p) => {
              const label = isShared(sel) ? `Party ${p.id}` : "Guests";
              const others = sel.parties.filter((x) => x.id !== p.id);
              const claim = partyOrders(sel.id, p.id).find((o) => o.payClaim)?.payClaim;
              return (
                <div key={p.id} className={clsx("overflow-hidden rounded-group bg-surface", p.pendingApproval && "ring-2 ring-saffron")}>
                  <div className="flex items-start gap-3 p-4">
                    {isShared(sel) && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-bold text-canvas">{p.id}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[16px] font-semibold">{label} · {p.guests} {p.guests > 1 ? "guests" : "guest"}</span>
                        <Pill tone={p.status === "billing" ? "saffron" : p.status === "ordered" ? "jade" : "sky"}>{p.status === "billing" ? "Wants bill" : p.status === "ordered" ? "Eating" : "Seated"}</Pill>
                        {p.pendingApproval && <Pill tone="saffron">Ordered from QR · accept?</Pill>}
                        {(() => {
                          const code = partyOrders(sel.id, p.id).find((o) => o.wantsCoupon)?.wantsCoupon;
                          return code ? <Pill tone="jade">Guest coupon {code}</Pill> : null;
                        })()}
                        {partyOrders(sel.id, p.id).some((o) => o.wantsReward) && <Pill tone="jade">Stamp reward</Pill>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
                        <span className="tnum">{minutesSince(p.since)}m</span>
                        {p.server && <span>· {p.server}</span>}
                        {p.source === "qr" && <span title="Opened from the table QR"><QrCode size={12} /></span>}
                        {p.phoneClaimed && <span title="Guest's phone is linked"><Smartphone size={12} /></span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-semibold tnum" title={p.total ? "Including GST" : "No order yet"}>{p.total ? inr(Math.round(p.total * (1 + gstRate()))) : "—"}</div>
                    </div>
                  </div>
                  {claim && (
                    <div className="border-t border-line/80 bg-saffron-soft/60 px-4 py-3 text-[13.5px]">
                      <div className="flex items-center gap-1">
                        <span><b>{claim.by}</b> paid · {paymentsText(claim.payments)} · {minutesSince(claim.at)}m</span>
                        <Hint align="right">{canConfirm ? "Check the money reached your account, then confirm." : "Waiting for the owner to confirm."}</Hint>
                      </div>
                      <ClaimCheck claimId={claim.id} />
                      {canConfirm && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => { confirmPayment(claim.id); toast(`Payment confirmed · ${label} closed`); }}><Check size={15} /> Money received</Button>
                          <Button size="sm" variant="plain" onClick={() => { rejectPayment(claim.id); toast("Marked not received · the bill is open again"); }}>Not received</Button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 border-t border-line/80 bg-sunken/30 p-3">
                    {p.pendingApproval && partyOrders(sel.id, p.id).length ? (
                      <Button size="sm" onClick={() => { acceptParty(sel.id, sel.name, p.id); toast(`Party ${p.id} accepted · their order went to the kitchen`); }}><Check size={15} /> Accept order</Button>
                    ) : (
                      <Link href={`/app/pos?table=${sel.name}&party=${p.id}`}><Button size="sm"><Plus size={15} /> Add to order</Button></Link>
                    )}
                    {p.total && !claim && canCharge ? (
                      <Button size="sm" variant="tinted" onClick={() => setPay({ tableId: sel.id, party: p, label: isShared(sel) ? `${sel.name} · Party ${p.id}` : `Table ${sel.name}` })}><ReceiptText size={15} /> Charge {inr(Math.round(p.total * (1 + gstRate())))}</Button>
                    ) : null}
                    {!partyOrders(sel.id, p.id).length && !claim && (
                      <Button size="sm" variant="plain" onClick={() => { tableActions.close(sel.id, p.id, "freed, no order"); toast(isShared(sel) ? `Party ${p.id} removed · no order` : `${sel.name} is free`); if (sel.parties.length <= 1) setSelId(null); }}>
                        <LogOut size={15} /> Free table
                      </Button>
                    )}
                    {others.map((o) => (
                      <Button key={o.id} size="sm" variant="plain" onClick={() => { tableActions.merge(sel.id, p.id, o.id); orderActions.moveParty(sel.id, p.id, { tableId: sel.id, tableName: sel.name, partyId: o.id }); toast(`Party ${p.id} joined Party ${o.id} · one bill now`); }}>
                        <Merge size={15} /> Merge with {o.id}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* more: seat another party · join a table · QR — small, out of the way */}
            <div className="flex flex-wrap gap-2">
              {sel.parties.length > 0 && (
                <Button size="sm" variant="plain" onClick={() => openSeat(sel)} title={seatsFree(sel, tables) > 0 ? `${seatsFree(sel, tables)} seats free · they get their own bill` : "Table is full"}>
                  <UserPlus size={15} /> Seat another party
                </Button>
              )}
              {joinable.length > 0 && (
                <Button size="sm" variant="plain" onClick={() => setJoining(true)} title={`Big group: join a free table to ${sel.name}. It separates by itself when they leave.`}>
                  <Link2 size={15} /> Join a table
                </Button>
              )}
              {!sel.cleaning && (
                <Button size="sm" variant="plain" onClick={() => setCleanId(sel.id)} title="Send someone to clean this table">
                  <SprayCan size={15} /> Clean table
                </Button>
              )}
              <Button size="sm" variant="plain" onClick={() => setQr(true)}><QrCode size={15} /> Table QR</Button>
            </div>
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
                const p = tableActions.seat(t.id, seat.guests, { server: myName });
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
                <Stepper value={seat.guests} onChange={(n) => setSeat({ ...seat, guests: n })} max={40} />
              </div>
              {t.parties.length > 0 && (
                <div className="rounded-group bg-surface p-4 text-[14px] leading-relaxed text-muted">
                  They become <b className="text-ink">Party {String.fromCharCode(65 + t.parties.length)}</b> at {t.name}. Their dishes print on KOTs as
                  <b className="text-ink"> {t.name} · {String.fromCharCode(65 + t.parties.length)}</b>, and their bill stays separate from the others.
                  When they scan the table QR and pick &ldquo;I&apos;m on my own&rdquo;, their phone links to this party automatically.
                </div>
              )}
              {seatsTaken(t) + seat.guests > capacity(t, tables) && <p className="text-[13px] font-medium text-saffron">That&apos;s more guests than seats at {joinedName(t, tables)}. Join a table for them from the table screen.</p>}
            </div>
          );
        })()}
      </Sheet>

      <Sheet open={joining && !!sel} onClose={() => setJoining(false)} title={`Join a table to ${sel?.name ?? ""}`}>
        <p className="mb-3 text-[14px] text-muted">Pick the free table you pushed up against {sel?.name}. Guests order and pay on {sel?.name}&apos;s QR; the joined table&apos;s QR sends them there.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {joinable.map((x) => (
            <button
              key={x.id}
              onClick={() => { if (sel && tableActions.join(sel.id, x.id)) toast(`${x.name} joined with ${sel.name} · ${capacity(sel, tables) + x.seats} seats`); setJoining(false); }}
              className="flex aspect-square flex-col items-center justify-center rounded-[18px] bg-surface ring-1 ring-line hover:ring-jade"
            >
              <span className="text-[20px] font-semibold">{x.name}</span>
              <span className="text-[12.5px] text-muted">{x.seats} seats · {x.zone}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={qr} onClose={() => setQr(false)} title={`Table ${sel?.name ?? ""} QR`}>
        <div className="flex flex-col items-center rounded-group bg-surface p-6 text-center">
          <ScanQr value={qrUrl(sel)} size={220} label={`Table ${sel?.name ?? ""} ordering QR`} />
          <div className="mt-4 text-[17px] font-semibold">Scan to see the menu and order</div>
          <p className="mt-1 max-w-xs text-[14px] text-muted">
            Print once — it never changes.
          </p>
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <Link href={`/print/tables?t=${sel?.id ?? ""}`}><Button variant="tinted" className="w-full"><Printer size={16} /> Print this QR</Button></Link>
            <Link href="/print/tables"><Button variant="plain" className="w-full !bg-sunken">Print all tables</Button></Link>
          </div>
          <a href={qrUrl(sel)} target="_blank" rel="noreferrer" className="mt-4 text-[14px] font-semibold text-jade">Preview what guests see</a>
        </div>
      </Sheet>

      <CleanSheet table={tables.find((t) => t.id === cleanId) ?? null} onClose={() => setCleanId(null)} />

      <TableManager open={manage} onClose={() => setManage(false)} />

      <Checkout
        open={!!pay}
        onClose={() => setPay(null)}
        subtotal={pay?.party.total ?? 0}
        label={pay?.label ?? ""}
        preferred={pay ? counterPref(partyOrders(pay.tableId, pay.party.id)) : undefined}
        prepaid={pay ? partyOrders(pay.tableId, pay.party.id).flatMap((o) => o.prepaid ?? []) : undefined}
        lines={pay ? partyOrders(pay.tableId, pay.party.id).flatMap((o) => o.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price }))) : undefined}
        billNo={pay ? partyOrders(pay.tableId, pay.party.id)[0]?.number : undefined}
        couponCode={pay ? partyOrders(pay.tableId, pay.party.id).find((o) => o.wantsCoupon)?.wantsCoupon : undefined}
        onCoupon={(code) => { if (pay) orderActions.askCoupon(partyOrders(pay.tableId, pay.party.id).map((o) => o.id), code); }}
        guest={(() => {
          const o = pay ? partyOrders(pay.tableId, pay.party.id).find((x) => x.guestPhone) : undefined;
          return o ? { name: o.customer, phone: o.guestPhone } : undefined;
        })()}
        onPaid={(payments, extra) => {
          if (!pay) return;
          const ids = partyOrders(pay.tableId, pay.party.id).map((o) => o.id);
          return closeBill({ ids, payments, by: myName, tableId: pay.tableId, partyId: pay.party.id, discount: extra?.discount, coupon: extra?.coupon, discounts: extra?.discounts });
        }}
      />
    </>
  );
}
