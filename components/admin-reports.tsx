"use client";

// Super admin: Reports & revenue. Four tabs, each answering one question in plain words:
//   Overview     how much have we earned, what is coming in each month, who needs attention
//   Restaurants  each restaurant's plan, what it has paid, and its full history
//   Payments     every payment, month by month, with coupons
//   Download     pick a period and the parts you want, get one Excel file
// A restaurant on a free trial is never counted as revenue.
import clsx from "clsx";
import { ChevronDown, Download, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Chips, Pill, Segmented, Sheet, inputCls } from "./ui";
import { adminPlanEvents, type AdminRestaurant, type PlanEvent } from "@/lib/cloud";
import { STATE_LABEL, STATE_TONE, daysTo, monthlyRevenue, planState, stateText, type PlanState } from "@/lib/admin-plan";
import { plans } from "@/lib/plans";
import { inr } from "@/lib/format";
import { asDate, xlsxBlob, type XCell } from "@/lib/xlsx";

const SOON = 10;
const planName = (id?: string | null) => plans.find((p) => p.id === id)?.name ?? id ?? "—";
const dateText = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const monthKey = (iso: string) => iso.slice(0, 7);
const monthName = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const monthsText = (m?: number | null) => (!m ? "" : m === 12 ? "1 year" : `${m} month${m === 1 ? "" : "s"}`);

/** What happened, in words. */
export function eventText(e: PlanEvent): string {
  switch (e.kind) {
    case "new": return `Added on ${planName(e.plan)}`;
    case "paid_started": return `Paid plan started · runs till ${dateText(e.renews_at)}`;
    case "renewed": return `Renewed · now runs till ${dateText(e.renews_at)}`;
    case "date_changed": return `End date corrected to ${dateText(e.renews_at)}`;
    case "plan_changed": return `Plan changed from ${planName(e.prev_plan)} to ${planName(e.plan)}`;
    case "paused": return "Paused (switched off)";
    case "turned_on": return "Switched on again";
    case "grace": return `Grace period till ${dateText(e.grace_until)}`;
    case "grace_removed": return "Grace period removed";
    case "deleted": return "Restaurant deleted";
    case "payment": return `Paid ${inr(e.amount ?? 0)}${e.months ? ` for ${monthsText(e.months)}` : ""}${e.coupon ? ` (coupon ${e.coupon}, ${inr(e.off ?? 0)} off)` : ""}`;
    case "trial": return e.note || "Free trial";
    default: return e.kind;
  }
}
const isPayment = (e: PlanEvent) => e.kind === "payment" && (e.amount ?? 0) + (e.off ?? 0) > 0;

type Tab = "overview" | "restaurants" | "payments" | "download";
type Period = "month" | "last" | "year" | "all";
function periodRange(p: Period): [number, number, string] {
  const now = new Date();
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (p === "month") return [m0, Infinity, now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })];
  if (p === "last") { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); return [s.getTime(), m0, s.toLocaleDateString("en-IN", { month: "long", year: "numeric" })]; }
  if (p === "year") return [new Date(now.getFullYear(), 0, 1).getTime(), Infinity, String(now.getFullYear())];
  return [0, Infinity, "All time"];
}
const inRange = (iso: string, [a, b]: [number, number, string]) => { const t = new Date(iso).getTime(); return t >= a && t < b; };

export function AdminReportsSheet({ open, onClose, list, onOpen }: { open: boolean; onClose: () => void; list: AdminRestaurant[]; onOpen: (rid: string) => void }) {
  const [events, setEvents] = useState<PlanEvent[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr("");
    adminPlanEvents().then(setEvents).catch((e) => { setEvents([]); setErr((e as Error).message); });
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);
  const [tab, setTab] = useState<Tab>("overview");

  const d = useMemo(() => {
    const all = events ?? [];
    const pays = all.filter(isPayment);
    const byRid = new Map<string, PlanEvent[]>();
    for (const e of all) byRid.set(e.rid, [...(byRid.get(e.rid) ?? []), e]);
    const paidOf = (rid: string) => (byRid.get(rid) ?? []).filter(isPayment);
    const byMonth = new Map<string, { amount: number; off: number; n: number }>();
    for (const e of pays) {
      const k = monthKey(e.at);
      const x = byMonth.get(k) ?? { amount: 0, off: 0, n: 0 };
      x.amount += e.amount ?? 0; x.off += e.off ?? 0; x.n++;
      byMonth.set(k, x);
    }
    return {
      all, pays, byRid, paidOf, byMonth,
      earned: pays.reduce((s, e) => s + (e.amount ?? 0), 0),
      discount: pays.reduce((s, e) => s + (e.off ?? 0), 0),
      mrr: list.reduce((s, r) => s + monthlyRevenue(r), 0),
      count: (st: PlanState[]) => list.filter((r) => st.includes(planState(r))).length,
    };
  }, [events, list]);

  return (
    <Sheet open={open} onClose={onClose} title="Reports & revenue" wide>
      <div className="space-y-5">
        <Segmented className="w-full" value={tab} onChange={setTab} options={[
          { value: "overview", label: "Overview" }, { value: "restaurants", label: "Restaurants" },
          { value: "payments", label: "Payments" }, { value: "download", label: "Download" },
        ]} />
        {err && <p className="rounded-group bg-rose-soft p-3 text-[14px] text-rose">{err}</p>}
        {events === null ? (
          <p className="py-10 text-center text-[14px] text-muted">Loading…</p>
        ) : tab === "overview" ? (
          <Overview d={d} list={list} onOpen={onOpen} />
        ) : tab === "restaurants" ? (
          <Restaurants d={d} list={list} onOpen={onOpen} />
        ) : tab === "payments" ? (
          <Payments pays={d.pays} />
        ) : (
          <DownloadTab d={d} list={list} />
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-faint">Payments and history are kept from 19 Nov 2026. Free trials are never counted as revenue.</p>
          <button type="button" onClick={load} className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-muted hover:bg-sunken"><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>
    </Sheet>
  );
}

type D = {
  all: PlanEvent[]; pays: PlanEvent[]; byRid: Map<string, PlanEvent[]>; paidOf: (rid: string) => PlanEvent[];
  byMonth: Map<string, { amount: number; off: number; n: number }>; earned: number; discount: number; mrr: number; count: (st: PlanState[]) => number;
};

function Big({ l, v, h, tone }: { l: string; v: string; h?: string; tone?: string }) {
  return (
    <div className="bg-surface p-4">
      <div className="text-[13px] text-muted">{l}</div>
      <div className={clsx("mt-1 text-[24px] font-semibold tracking-tight tnum", tone)}>{v}</div>
      {h && <div className="text-[12.5px] text-muted">{h}</div>}
    </div>
  );
}

/* ---------- Overview ---------- */
function Overview({ d, list, onOpen }: { d: D; list: AdminRestaurant[]; onOpen: (rid: string) => void }) {
  const thisMonth = d.byMonth.get(new Date().toISOString().slice(0, 7));
  const paying = d.count(["paying", "ending", "grace"]);
  const trials = d.count(["trial"]);
  const months = [...Array(6)].map((_, i) => { const t = new Date(); t.setDate(1); t.setMonth(t.getMonth() - (5 - i)); return t.toISOString().slice(0, 7); });
  const top = Math.max(1, ...months.map((k) => d.byMonth.get(k)?.amount ?? 0));
  const attention = list
    .map((r) => ({ r, st: planState(r), n: daysTo(r.renewsAt) }))
    .filter((x) => x.st === "ended" || x.st === "trial_ended" || x.st === "ending" || x.st === "grace" || (x.st === "trial" && x.n <= SOON))
    .sort((a, b) => a.n - b.n);
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Earned from plans</h3>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          <Big l="Total so far" v={inr(d.earned)} h={`${d.pays.length} payment${d.pays.length === 1 ? "" : "s"}`} tone="text-jade-deep" />
          <Big l="This month" v={inr(thisMonth?.amount ?? 0)} h={`${thisMonth?.n ?? 0} payment${thisMonth?.n === 1 ? "" : "s"}`} />
          <Big l="Discount given" v={inr(d.discount)} h="through plan coupons, so far" />
          <Big l="Coming in each month" v={inr(d.mrr)} h={`${paying} paying restaurant${paying === 1 ? "" : "s"}`} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Restaurants right now</h3>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          <Big l="Paying" v={String(paying)} h="plan running" tone="text-jade-deep" />
          <Big l="On free trial" v={String(trials)} h="not counted as revenue" tone="text-sky" />
          <Big l="Plan ended" v={String(d.count(["ended", "trial_ended"]))} h="not renewed yet" tone={d.count(["ended", "trial_ended"]) ? "text-rose" : ""} />
          <Big l="Paused" v={String(d.count(["paused"]))} h="switched off" />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Earned by month</h3>
        <div className="space-y-2 rounded-group bg-surface p-4">
          {months.map((k) => {
            const v = d.byMonth.get(k)?.amount ?? 0;
            return (
              <div key={k} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13.5px]">
                <span className="text-muted">{monthName(k)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-sunken"><span className="block h-full rounded-full bg-jade" style={{ width: `${(v / top) * 100}%` }} /></span>
                <span className="w-24 text-right font-semibold tnum">{inr(v)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Needs your attention</h3>
        {attention.length === 0 ? (
          <p className="rounded-group bg-surface px-4 py-6 text-center text-[14px] text-muted">All good. No plan or trial is ending in the next {SOON} days.</p>
        ) : (
          <div className="overflow-hidden rounded-group bg-surface">
            {attention.map(({ r }) => (
              <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 border-b border-line/70 px-4 py-3 text-left last:border-0 hover:bg-sunken/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{r.name}</span>
                  <span className="block text-[12.5px] text-muted">{planName(r.plan)} · {r.owner} · {r.phone}</span>
                </span>
                <Pill tone={STATE_TONE[planState(r)]}>{stateText(r)}</Pill>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Restaurants (each one's money and history) ---------- */
function Restaurants({ d, list, onOpen }: { d: D; list: AdminRestaurant[]; onOpen: (rid: string) => void }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "paying" | "trial" | "ended" | "paused">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const groups: Record<typeof f, PlanState[]> = { all: [], paying: ["paying", "ending", "grace"], trial: ["trial"], ended: ["ended", "trial_ended"], paused: ["paused"] };
  // restaurants that were deleted still have history: list them too
  const gone = [...d.byRid.entries()].filter(([rid]) => !list.some((r) => r.id === rid)).map(([rid, ev]) => ({ rid, name: ev.find((e) => e.restaurant_name)?.restaurant_name ?? rid }));
  const rows = list
    .filter((r) => (f === "all" || groups[f].includes(planState(r))) && (!q || `${r.name} ${r.owner} ${r.city} ${r.phone}`.toLowerCase().includes(q.toLowerCase())))
    .map((r) => { const p = d.paidOf(r.id); return { r, paid: p.reduce((s, e) => s + (e.amount ?? 0), 0), off: p.reduce((s, e) => s + (e.off ?? 0), 0), n: p.length }; })
    .sort((a, b) => b.paid - a.paid || a.r.name.localeCompare(b.r.name));
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input className={clsx(inputCls, "h-11 pl-10")} placeholder="Find a restaurant" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Chips value={f} onChange={setF} options={[
        { value: "all", label: "All", count: list.length },
        { value: "paying", label: "Paying", count: d.count(groups.paying) },
        { value: "trial", label: "Free trial", count: d.count(groups.trial) },
        { value: "ended", label: "Ended", count: d.count(groups.ended) },
        { value: "paused", label: "Paused", count: d.count(groups.paused) },
      ]} />
      <div className="overflow-hidden rounded-group bg-surface">
        {rows.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-muted">No restaurants match.</p>}
        {rows.map(({ r, paid, off, n }) => {
          const opened = openId === r.id;
          const ev = d.byRid.get(r.id) ?? [];
          return (
            <div key={r.id} className="border-b border-line/70 last:border-0">
              <button type="button" aria-expanded={opened} onClick={() => setOpenId(opened ? null : r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/50">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{r.name}</span>
                    <Pill tone={STATE_TONE[planState(r)]}>{STATE_LABEL[planState(r)]}</Pill>
                  </span>
                  <span className="block text-[12.5px] text-muted">{planName(r.plan)} · {planState(r) === "trial" ? "free till" : "paid till"} {dateText(r.renewsAt)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[15px] font-semibold tnum">{inr(paid)}</span>
                  <span className="block text-[12px] text-muted">{n ? `${n} payment${n === 1 ? "" : "s"}${off ? ` · ${inr(off)} off` : ""}` : "nothing paid yet"}</span>
                </span>
                <ChevronDown size={16} className={clsx("shrink-0 text-muted transition", opened && "rotate-180")} />
              </button>
              {opened && (
                <div className="space-y-3 bg-canvas/60 px-4 pb-4 pt-1">
                  <Timeline ev={ev} />
                  <Button variant="tinted" size="sm" onClick={() => onOpen(r.id)}>Open {r.name}</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {gone.length > 0 && f === "all" && !q && (
        <details className="rounded-group bg-surface px-4 py-3 text-[13.5px]">
          <summary className="cursor-pointer font-semibold text-muted">Deleted restaurants ({gone.length})</summary>
          {gone.map((g) => (
            <div key={g.rid} className="mt-3">
              <div className="font-semibold">{g.name}</div>
              <Timeline ev={d.byRid.get(g.rid) ?? []} />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function Timeline({ ev }: { ev: PlanEvent[] }) {
  if (!ev.length) return <p className="text-[13px] text-muted">No history yet.</p>;
  return (
    <ol className="relative ml-1 space-y-2.5 border-l border-line pl-4">
      {ev.map((e) => (
        <li key={e.id} className="text-[13.5px]">
          <span className={clsx("absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full", isPayment(e) ? "bg-jade" : e.kind === "trial" ? "bg-sky" : "bg-line")} />
          <span className="block text-[12px] text-muted">{dateText(e.at)}</span>
          <span className={clsx(isPayment(e) && "font-semibold text-jade-deep")}>{eventText(e)}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Payments (month by month) ---------- */
function Payments({ pays }: { pays: PlanEvent[] }) {
  const [p, setP] = useState<Period>("all");
  const range = periodRange(p);
  const shown = pays.filter((e) => inRange(e.at, range));
  const months = [...new Set(shown.map((e) => monthKey(e.at)))];
  const total = shown.reduce((s, e) => s + (e.amount ?? 0), 0);
  const off = shown.reduce((s, e) => s + (e.off ?? 0), 0);
  return (
    <div className="space-y-3">
      <Segmented value={p} onChange={setP} options={[{ value: "month", label: "This month" }, { value: "last", label: "Last month" }, { value: "year", label: "This year" }, { value: "all", label: "All time" }]} />
      <div className="rounded-group bg-jade-soft px-4 py-3 text-[14.5px] text-jade-deep">
        <b>{inr(total)}</b> collected · {range[2]}
        <span className="block text-[13px]">{shown.length} payment{shown.length === 1 ? "" : "s"}{off ? ` · ${inr(off)} given as coupon discount` : ""}</span>
      </div>
      {shown.length === 0 && <p className="rounded-group bg-surface px-4 py-8 text-center text-[14px] text-muted">No payments in this period.</p>}
      {months.map((k) => {
        const m = shown.filter((e) => monthKey(e.at) === k);
        return (
          <section key={k} className="overflow-hidden rounded-group bg-surface">
            <div className="flex items-baseline justify-between border-b border-line/80 px-4 py-2.5">
              <span className="text-[14px] font-semibold">{monthName(k)}</span>
              <span className="text-[14px] font-semibold tnum">{inr(m.reduce((s, e) => s + (e.amount ?? 0), 0))}</span>
            </div>
            {m.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2.5 last:border-0">
                <span className="w-14 shrink-0 text-[12.5px] text-muted">{new Date(e.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{e.restaurant_name ?? e.rid}</span>
                  <span className="block text-[12.5px] text-muted">
                    {planName(e.plan)} · {monthsText(e.months) || "—"} · {e.note === "Renewal" ? "renewal" : e.note === "New restaurant" ? "new" : (e.note ?? "").toLowerCase()}
                    {e.coupon && <span className="ml-1.5 rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-ink">{e.coupon} −{inr(e.off ?? 0)}</span>}
                  </span>
                </span>
                <span className="text-[14.5px] font-semibold tnum">{inr(e.amount ?? 0)}</span>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/* ---------- Download ---------- */
const PARTS = [
  { id: "payments", name: "Payments", hint: "Every payment: date, restaurant, plan, months, price, coupon, discount, paid." },
  { id: "restaurants", name: "Restaurants", hint: "Each restaurant: plan, status, paid till, total paid, discount, last payment." },
  { id: "history", name: "Full history", hint: "Everything that happened to each plan, in words." },
  { id: "trials", name: "Free trials", hint: "Who is on a free trial and till when." },
  { id: "attention", name: "Ending & ended", hint: `Plans and trials ending in ${SOON} days, and ended ones, with phone numbers.` },
] as const;
type PartId = (typeof PARTS)[number]["id"];

function DownloadTab({ d, list }: { d: D; list: AdminRestaurant[] }) {
  const [p, setP] = useState<Period>("all");
  const [pick, setPick] = useState<Set<PartId>>(() => new Set(PARTS.map((x) => x.id)));
  const range = periodRange(p);
  const toggle = (id: PartId) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const download = () => {
    const pays = d.pays.filter((e) => inRange(e.at, range));
    const t = (iso: string) => asDate(new Date(iso));
    const sheets: { name: string; rows: XCell[][] }[] = [{
      name: "Summary",
      rows: [
        ["Restropi · plans report"], [`Period: ${range[2]}`, "", `Made ${dateText(new Date().toISOString())}`], [],
        ["In this period", ""],
        ["Collected (Rs)", pays.reduce((s, e) => s + (e.amount ?? 0), 0)],
        ["Coupon discount given (Rs)", pays.reduce((s, e) => s + (e.off ?? 0), 0)],
        ["Payments", pays.length], [],
        ["Right now", ""],
        ["Coming in each month (Rs)", d.mrr],
        ["Paying restaurants", d.count(["paying", "ending", "grace"])],
        ["On free trial", d.count(["trial"])],
        ["Plan ended", d.count(["ended", "trial_ended"])],
        ["Paused", d.count(["paused"])],
        [], ["Free trials are not counted as revenue."],
      ],
    }];
    const add = (name: string, head: string[], rows: XCell[][], total?: XCell[]) => sheets.push({ name, rows: [[name], [p === "all" || name === "Free trials" || name === "Ending & ended" || name === "Restaurants" ? "As of today" : `Period: ${range[2]}`], [], head, ...rows, ...(total ? [total] : [])] });
    if (pick.has("payments")) add("Payments", ["Date", "Restaurant", "Plan", "Months", "For", "Price (Rs)", "Coupon", "Discount (Rs)", "Paid (Rs)"],
      pays.map((e) => [t(e.at), e.restaurant_name ?? e.rid, planName(e.plan), e.months ?? "", e.note ?? "", e.list_price ?? "", e.coupon ?? "", e.off || "", e.amount ?? 0]),
      ["Total", "", "", "", "", pays.reduce((s, e) => s + (e.list_price ?? 0), 0), "", pays.reduce((s, e) => s + (e.off ?? 0), 0), pays.reduce((s, e) => s + (e.amount ?? 0), 0)]);
    if (pick.has("restaurants")) {
      const rows = [...list].sort((a, b) => a.name.localeCompare(b.name)).map((r) => {
        const ps = d.paidOf(r.id);
        const last = ps[0];
        return [r.name, r.city, r.owner, r.phone, planName(r.plan), STATE_LABEL[planState(r)], t(r.createdAt), t(r.renewsAt), monthlyRevenue(r), ps.reduce((s, e) => s + (e.amount ?? 0), 0), ps.reduce((s, e) => s + (e.off ?? 0), 0), ps.length, last ? t(last.at) : "Never"] as XCell[];
      });
      add("Restaurants", ["Restaurant", "City", "Owner", "Phone", "Plan", "Status", "Customer since", "Paid / free till", "Per month now (Rs)", "Total paid (Rs)", "Discount (Rs)", "Payments", "Last payment"], rows,
        ["Total", "", "", "", "", "", "", "", d.mrr, d.earned, d.discount, d.pays.length, ""]);
    }
    if (pick.has("history")) add("Full history", ["Date", "Restaurant", "What happened", "Plan"],
      d.all.filter((e) => inRange(e.at, range)).map((e) => [t(e.at), e.restaurant_name ?? e.rid, eventText(e), planName(e.plan)]));
    if (pick.has("trials")) add("Free trials", ["Restaurant", "Owner", "Phone", "Plan", "Free till", "Status"],
      list.filter((r) => ["trial", "trial_ended"].includes(planState(r))).map((r) => [r.name, r.owner, r.phone, planName(r.plan), t(r.renewsAt), stateText(r)]));
    if (pick.has("attention")) add("Ending & ended", ["Restaurant", "Owner", "Phone", "Plan", "Till", "Status"],
      list.filter((r) => { const s = planState(r); return s === "ending" || s === "grace" || s === "ended" || s === "trial_ended" || (s === "trial" && daysTo(r.renewsAt) <= SOON); })
        .sort((a, b) => a.renewsAt.localeCompare(b.renewsAt)).map((r) => [r.name, r.owner, r.phone, planName(r.plan), t(r.renewsAt), stateText(r)]));
    const url = URL.createObjectURL(xlsxBlob(sheets));
    const el = document.createElement("a");
    el.href = url;
    el.download = `restropi-plans-${range[2].toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[14px] font-semibold">1 · Which period?</div>
        <Segmented value={p} onChange={setP} options={[{ value: "month", label: "This month" }, { value: "last", label: "Last month" }, { value: "year", label: "This year" }, { value: "all", label: "All time" }]} />
      </div>
      <div>
        <div className="mb-2 text-[14px] font-semibold">2 · What should be in it?</div>
        <div className="overflow-hidden rounded-group bg-surface">
          {PARTS.map((x) => (
            <label key={x.id} className="flex cursor-pointer items-start gap-3 border-b border-line/70 px-4 py-3 last:border-0">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--jade))]" checked={pick.has(x.id)} onChange={() => toggle(x.id)} />
              <span><span className="block text-[14.5px] font-medium">{x.name}</span><span className="block text-[12.5px] text-muted">{x.hint}</span></span>
            </label>
          ))}
        </div>
      </div>
      <Button size="lg" className="w-full" disabled={!pick.size} onClick={download}><Download size={16} /> 3 · Download Excel · {range[2]}</Button>
      <p className="-mt-2 text-center text-[12.5px] text-muted">One file: a short summary first, then one sheet for each part you ticked.</p>
    </div>
  );
}
