"use client";

// Super admin: Restropi's own business reports. What was collected, renewals, plan coupons,
// who is still free, whose plan is ending, and the full plan history of every restaurant.
// Pick a period and what to include; download it all as one Excel file.
import clsx from "clsx";
import { Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Segmented, Sheet, inputCls } from "./ui";
import { adminPlanEvents, type AdminRestaurant, type PlanEvent } from "@/lib/cloud";
import { plans } from "@/lib/plans";
import { inr } from "@/lib/format";
import { asDate, xlsxBlob, type XCell } from "@/lib/xlsx";

const DAY = 86_400_000;
const SOON_DAYS = 10;
const planName = (id?: string | null) => plans.find((p) => p.id === id)?.name ?? id ?? "—";
const dateText = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const day = (t: number) => Math.floor((t + 5.5 * 3600_000) / DAY); // India calendar day
const daysLeft = (iso: string) => day(new Date(iso).getTime()) - day(Date.now());

type Period = "month" | "last" | "3m" | "year" | "all" | "custom";
const startOfMonth = (d: Date, add = 0) => new Date(d.getFullYear(), d.getMonth() + add, 1).getTime();

/** What happened, in words. */
export function eventText(e: PlanEvent): string {
  switch (e.kind) {
    case "new": return `Added · ${planName(e.plan)}, runs till ${dateText(e.renews_at)}`;
    case "renewed": return `Renewed: ${dateText(e.prev_renews_at)} → ${dateText(e.renews_at)}`;
    case "date_changed": return `End date changed: ${dateText(e.prev_renews_at)} → ${dateText(e.renews_at)}`;
    case "plan_changed": return `Plan changed: ${planName(e.prev_plan)} → ${planName(e.plan)}`;
    case "paused": return "Paused (switched off)";
    case "turned_on": return "Switched on again";
    case "grace": return `Grace period till ${dateText(e.grace_until)}`;
    case "grace_removed": return "Grace period removed";
    case "deleted": return "Restaurant deleted";
    case "payment": return `Paid ${inr(e.amount ?? 0)}${e.months ? ` for ${e.months === 12 ? "1 year" : `${e.months} month${e.months === 1 ? "" : "s"}`}` : ""}${e.coupon ? ` · coupon ${e.coupon} −${inr(e.off ?? 0)}` : ""}${e.note ? ` · ${e.note}` : ""}`;
    case "trial": return e.note || "Free trial";
    default: return e.kind;
  }
}

const SECTIONS = [
  { id: "payments", name: "Payments", hint: "what each restaurant paid" },
  { id: "history", name: "Plan history", hint: "added, renewed, plan changed, paused…" },
  { id: "coupons", name: "Coupons used", hint: "which code, for whom" },
  { id: "free", name: "Not paid yet", hint: "free / trial restaurants" },
  { id: "ending", name: "Ending & ended", hint: `plans ending in ${SOON_DAYS} days, ended, in grace` },
  { id: "all", name: "All restaurants", hint: "status and total paid" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function AdminReportsSheet({ open, onClose, list }: { open: boolean; onClose: () => void; list: AdminRestaurant[] }) {
  const [events, setEvents] = useState<PlanEvent[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr("");
    adminPlanEvents().then(setEvents).catch((e) => { setEvents([]); setErr((e as Error).message); });
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(() => new Date(startOfMonth(new Date())).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [pick, setPick] = useState<Set<SectionId>>(() => new Set(SECTIONS.map((s) => s.id)));
  const toggle = (id: SectionId) => setPick((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const [a, b, label] = useMemo((): [number, number, string] => {
    const now = new Date();
    switch (period) {
      case "month": return [startOfMonth(now), Date.now() + DAY, now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })];
      case "last": { const s = startOfMonth(now, -1); return [s, startOfMonth(now), new Date(s).toLocaleDateString("en-IN", { month: "long", year: "numeric" })]; }
      case "3m": return [startOfMonth(now, -2), Date.now() + DAY, "Last 3 months"];
      case "year": return [new Date(now.getFullYear(), 0, 1).getTime(), Date.now() + DAY, String(now.getFullYear())];
      case "all": return [0, Date.now() + DAY, "All time"];
      default: return [new Date(`${from}T00:00:00+05:30`).getTime(), new Date(`${to}T23:59:59+05:30`).getTime(), `${dateText(from)} – ${dateText(to)}`];
    }
  }, [period, from, to]);

  const d = useMemo(() => {
    const all = events ?? [];
    const inP = all.filter((e) => { const t = new Date(e.at).getTime(); return t >= a && t < b; });
    const payments = inP.filter((e) => e.kind === "payment" && (e.amount ?? 0) + (e.off ?? 0) > 0);
    const coupons = payments.filter((e) => e.coupon);
    const paidBy = new Map<string, { total: number; last?: PlanEvent; coupons: number }>();
    for (const e of all) if (e.kind === "payment") {
      const x = paidBy.get(e.rid) ?? { total: 0, coupons: 0 };
      x.total += e.amount ?? 0;
      if (e.coupon) x.coupons++;
      if (!x.last || e.at > x.last.at) x.last = e;
      paidBy.set(e.rid, x);
    }
    const trialOf = new Map<string, PlanEvent>();
    for (const e of all) if (e.kind === "trial" && !trialOf.has(e.rid)) trialOf.set(e.rid, e);
    const free = list.filter((r) => !(paidBy.get(r.id)?.total));
    const ending = list
      .filter((r) => r.status === "active" && daysLeft(r.renewsAt) <= SOON_DAYS)
      .sort((x, y) => x.renewsAt.localeCompare(y.renewsAt));
    return {
      inP,
      payments,
      coupons,
      paidBy,
      trialOf,
      free,
      ending,
      collected: payments.reduce((s, e) => s + (e.amount ?? 0), 0),
      discount: payments.reduce((s, e) => s + (e.off ?? 0), 0),
      renewals: inP.filter((e) => e.kind === "renewed").length,
      added: inP.filter((e) => e.kind === "new").length,
      endedNow: list.filter((r) => r.status === "active" && daysLeft(r.renewsAt) < 0).length,
      soonNow: list.filter((r) => r.status === "active" && daysLeft(r.renewsAt) >= 0 && daysLeft(r.renewsAt) <= SOON_DAYS).length,
      paused: list.filter((r) => r.status === "suspended").length,
    };
  }, [events, list, a, b]);

  const status = (r: AdminRestaurant) => {
    if (r.status === "suspended") return "Paused";
    const n = daysLeft(r.renewsAt);
    if (r.graceUntil && new Date(r.graceUntil).getTime() > Date.now() && n < 0) return `In grace till ${dateText(r.graceUntil)}`;
    return n < 0 ? `Ended ${-n} day${n === -1 ? "" : "s"} ago` : n === 0 ? "Ends today" : `${n} day${n === 1 ? "" : "s"} left`;
  };

  // the tables: one place for the screen and the Excel file
  const tables = useMemo(() => {
    const t = (e: PlanEvent) => asDate(new Date(e.at));
    const out: Record<SectionId, { head: string[]; rows: XCell[][]; total?: XCell[] }> = {
      payments: {
        head: ["Date", "Restaurant", "Plan", "For", "Months", "Price (Rs)", "Coupon", "Discount (Rs)", "Paid (Rs)"],
        rows: d.payments.map((e) => [t(e), e.restaurant_name ?? e.rid, planName(e.plan), e.note ?? "", e.months ?? "", e.list_price ?? "", e.coupon ?? "", e.off || "", e.amount ?? 0]),
        total: ["Total", "", "", "", "", d.payments.reduce((s, e) => s + (e.list_price ?? 0), 0), "", d.discount, d.collected],
      },
      history: {
        head: ["Date", "Restaurant", "What happened", "Plan", "Runs till"],
        rows: d.inP.map((e) => [t(e), e.restaurant_name ?? e.rid, eventText(e), planName(e.plan), e.renews_at ? asDate(new Date(e.renews_at)) : ""]),
      },
      coupons: {
        head: ["Date", "Restaurant", "Code", "Plan", "Price (Rs)", "Discount (Rs)", "Paid (Rs)"],
        rows: d.coupons.map((e) => [t(e), e.restaurant_name ?? e.rid, e.coupon ?? "", planName(e.plan), e.list_price ?? "", e.off ?? 0, e.amount ?? 0]),
        total: ["Total", "", `${d.coupons.length} use${d.coupons.length === 1 ? "" : "s"}`, "", "", d.discount, d.coupons.reduce((s, e) => s + (e.amount ?? 0), 0)],
      },
      free: {
        head: ["Restaurant", "Owner", "Phone", "Plan", "Added", "Runs till", "Status", "Trial"],
        rows: d.free.map((r) => [r.name, r.owner, r.phone, planName(r.plan), asDate(new Date(r.createdAt)), asDate(new Date(r.renewsAt)), status(r), d.trialOf.get(r.id)?.note ?? ""]),
      },
      ending: {
        head: ["Restaurant", "Owner", "Phone", "Plan", "Paid till", "Status", "Last paid (Rs)", "Last paid on"],
        rows: d.ending.map((r) => { const p = d.paidBy.get(r.id)?.last; return [r.name, r.owner, r.phone, planName(r.plan), asDate(new Date(r.renewsAt)), status(r), p?.amount ?? "", p ? asDate(new Date(p.at)) : "Never"]; }),
      },
      all: {
        head: ["Restaurant", "City", "Owner", "Phone", "Plan", "Outlets", "Added", "Paid till", "Status", "Total paid (Rs)", "Last paid on", "Coupons used"],
        rows: [...list].sort((x, y) => x.name.localeCompare(y.name)).map((r) => { const p = d.paidBy.get(r.id); return [r.name, r.city, r.owner, r.phone, planName(r.plan), r.outlets, asDate(new Date(r.createdAt)), asDate(new Date(r.renewsAt)), status(r), p?.total ?? 0, p?.last ? asDate(new Date(p.last.at)) : "Never", p?.coupons ?? 0]; }),
        total: ["Total", "", "", "", "", "", "", "", "", [...d.paidBy.values()].reduce((s, x) => s + x.total, 0), "", ""],
      },
    };
    return out;
  }, [d, list]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = () => {
    const now = new Date().toISOString().slice(0, 10);
    const sheets = [
      {
        name: "Summary",
        rows: [
          ["Restropi report"],
          [`Period: ${label}`, "", `Made ${dateText(new Date().toISOString())}`],
          [],
          ["", "Value"],
          ["Collected (Rs)", d.collected],
          ["Payments", d.payments.length],
          ["Renewals", d.renewals],
          ["New restaurants", d.added],
          ["Coupon discount given (Rs)", d.discount],
          ["Coupons used", d.coupons.length],
          [],
          ["Right now", ""],
          ["Restaurants", list.length],
          ["Not paid yet (free / trial)", d.free.length],
          [`Ending in ${SOON_DAYS} days`, d.soonNow],
          ["Plan ended", d.endedNow],
          ["Paused", d.paused],
        ] as XCell[][],
      },
      ...SECTIONS.filter((s) => pick.has(s.id)).map((s) => {
        const x = tables[s.id];
        const now2 = s.id === "free" || s.id === "ending" || s.id === "all";
        return { name: s.name, rows: [[s.name], [now2 ? "As of today" : `Period: ${label}`], [], x.head, ...x.rows, ...(x.total ? [x.total] : [])] as XCell[][] };
      }),
    ];
    const url = URL.createObjectURL(xlsxBlob(sheets));
    const el = document.createElement("a");
    el.href = url;
    el.download = `restropi-report-${period === "all" ? "all-time" : label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${now}.xlsx`;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const Tile = ({ l, v, h, tone }: { l: string; v: string; h?: string; tone?: string }) => (
    <div className="bg-surface p-4">
      <div className="text-[13px] text-muted">{l}</div>
      <div className={clsx("mt-1 text-[22px] font-semibold tracking-tight tnum", tone)}>{v}</div>
      {h && <div className="text-[12px] text-faint">{h}</div>}
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Reports" wide>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented value={period} onChange={setPeriod} options={[
              { value: "month", label: "This month" }, { value: "last", label: "Last month" }, { value: "3m", label: "3 months" },
              { value: "year", label: "This year" }, { value: "all", label: "All time" }, { value: "custom", label: "Dates" },
            ]} />
            <button type="button" aria-label="Refresh" onClick={load} className="rounded-full bg-surface p-2 ring-1 ring-line hover:bg-sunken"><RefreshCw size={15} /></button>
          </div>
          {period === "custom" && (
            <div className="flex flex-wrap gap-2">
              <input type="date" aria-label="From" className={clsx(inputCls, "w-auto")} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" aria-label="To" className={clsx(inputCls, "w-auto")} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          )}
          <p className="text-[13px] text-muted">{label}. Plan history is kept from 19 Nov 2026; restaurants added earlier show when they were added.</p>
        </div>

        {err && <p className="rounded-group bg-rose-soft p-3 text-[14px] text-rose">{err}</p>}
        {events === null ? (
          <p className="py-10 text-center text-[14px] text-muted">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
              <Tile l="Collected" v={inr(d.collected)} h={`${d.payments.length} payment${d.payments.length === 1 ? "" : "s"}`} tone="text-jade-deep" />
              <Tile l="Renewals" v={String(d.renewals)} h="plans extended" />
              <Tile l="New restaurants" v={String(d.added)} h="added in this period" />
              <Tile l="Coupon discount" v={inr(d.discount)} h={`${d.coupons.length} coupon${d.coupons.length === 1 ? "" : "s"} used`} />
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
              <Tile l="Not paid yet" v={String(d.free.length)} h="free / trial, today" />
              <Tile l={`Ending in ${SOON_DAYS} days`} v={String(d.soonNow)} h="renew soon" tone={d.soonNow ? "text-saffron" : ""} />
              <Tile l="Plan ended" v={String(d.endedNow)} h="still switched on" tone={d.endedNow ? "text-rose" : ""} />
              <Tile l="Paused" v={String(d.paused)} h="switched off" />
            </div>

            <div className="rounded-group bg-surface p-4">
              <div className="mb-2 text-[13px] font-semibold text-muted">What goes in the report</div>
              <div className="flex flex-wrap gap-2">
                {SECTIONS.map((s) => (
                  <button key={s.id} type="button" aria-pressed={pick.has(s.id)} onClick={() => toggle(s.id)}
                    className={clsx("rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ring-1", pick.has(s.id) ? "bg-ink text-canvas ring-ink" : "bg-surface text-muted ring-line")}>
                    {pick.has(s.id) ? "✓ " : ""}{s.name}
                  </button>
                ))}
              </div>
              <Button size="lg" className="mt-3 w-full" onClick={download}>
                <Download size={16} /> Download Excel · {label}
              </Button>
              <p className="mt-1 text-center text-[12px] text-muted">One file: a summary sheet, then one sheet for each part you picked.</p>
            </div>

            {SECTIONS.filter((s) => pick.has(s.id)).map((s) => <Table key={s.id} title={s.name} hint={s.hint} t={tables[s.id]} />)}
          </>
        )}
      </div>
    </Sheet>
  );
}

const show = (v: XCell) => (v && typeof v === "object" && "date" in v ? new Date(v.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : v == null ? "" : typeof v === "number" ? v.toLocaleString("en-IN") : String(v));

function Table({ title, hint, t }: { title: string; hint: string; t: { head: string[]; rows: XCell[][]; total?: XCell[] } }) {
  const [all, setAll] = useState(false);
  const rows = all ? t.rows : t.rows.slice(0, 25);
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[15px] font-semibold">{title} <span className="text-[13px] font-normal text-muted">· {hint}</span></h3>
        <span className="text-[12.5px] text-muted">{t.rows.length} row{t.rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="overflow-x-auto rounded-group bg-surface">
        {t.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13.5px] text-muted">Nothing here for this period.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line/80 text-muted">{t.head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">{h.replace(" (Rs)", "")}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  {r.map((c, j) => <td key={j} className={clsx("px-3 py-2", typeof c === "number" ? "whitespace-nowrap text-right tnum" : c && typeof c === "object" ? "whitespace-nowrap" : "")}>{typeof c === "number" && /Rs/.test(t.head[j]) ? inr(c) : show(c)}</td>)}
                </tr>
              ))}
              {t.total && (
                <tr className="border-t border-line font-semibold">
                  {t.total.map((c, j) => <td key={j} className={clsx("px-3 py-2", typeof c === "number" ? "text-right tnum" : "")}>{typeof c === "number" && /Rs/.test(t.head[j]) ? inr(c) : show(c)}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {t.rows.length > 25 && (
        <button type="button" className="mt-1 px-1 text-[13px] font-semibold text-jade underline" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${t.rows.length}`}
        </button>
      )}
    </section>
  );
}
