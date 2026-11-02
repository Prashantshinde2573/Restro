"use client";

// Super admin: sales of every restaurant (store-wise) and Restropi's own
// subscription revenue, with date, plan and status filters.
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Chips, Segmented, Sheet, inputCls } from "./ui";
import { adminSales, type AdminRestaurant } from "@/lib/cloud";
import { plans } from "@/lib/plans";
import { inr } from "@/lib/format";

type Range = "today" | "7d" | "30d" | "month" | "custom";
const DAY = 86_400_000;
const sod = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const iso = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const price = (id: string) => plans.find((p) => p.id === id)?.monthly ?? 0;

export function RevenueSheet({ open, onClose, list }: { open: boolean; onClose: () => void; list: AdminRestaurant[] }) {
  const [range, setRange] = useState<Range>("30d");
  const [fromIso, setFromIso] = useState(iso(Date.now() - 29 * DAY));
  const [toIso, setToIso] = useState(iso(Date.now()));
  const [plan, setPlan] = useState<"all" | AdminRestaurant["plan"]>("all");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("active");
  const [sort, setSort] = useState<"sales" | "bills" | "name">("sales");
  const [rows, setRows] = useState<{ rid: string; bills: number; sales: number }[] | null>(null);
  const [err, setErr] = useState("");

  const [from, to] = useMemo(() => {
    const now = Date.now();
    if (range === "today") return [sod(now), now + 1];
    if (range === "7d") return [sod(now) - 6 * DAY, now + 1];
    if (range === "30d") return [sod(now) - 29 * DAY, now + 1];
    if (range === "month") {
      const d = new Date(now);
      return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), now + 1];
    }
    const a = new Date(`${fromIso}T00:00:00`).getTime();
    const b = new Date(`${toIso}T00:00:00`).getTime();
    return [Math.min(a, b), Math.max(a, b) + DAY];
  }, [range, fromIso, toIso]);

  useEffect(() => {
    if (!open) return;
    let on = true;
    setRows(null);
    setErr("");
    adminSales(new Date(from), new Date(to))
      .then((r) => on && setRows(r))
      .catch((e) => on && (setErr(e instanceof Error ? e.message : "Couldn't load sales"), setRows([])));
    return () => {
      on = false;
    };
  }, [open, from, to]);

  const shown = list.filter((r) => (plan === "all" || r.plan === plan) && (status === "all" || r.status === status));
  const byId = new Map((rows ?? []).map((r) => [r.rid, r]));
  const table = shown
    .map((r) => ({ r, bills: byId.get(r.id)?.bills ?? 0, sales: byId.get(r.id)?.sales ?? 0, mrr: r.status === "active" && r.plan !== "chain" ? price(r.plan) * Math.max(1, r.outlets) : 0 }))
    .sort((a, b) => (sort === "name" ? a.r.name.localeCompare(b.r.name) : sort === "bills" ? b.bills - a.bills : b.sales - a.sales));
  const totalSales = table.reduce((s, x) => s + x.sales, 0);
  const totalBills = table.reduce((s, x) => s + x.bills, 0);
  const mrr = table.reduce((s, x) => s + x.mrr, 0);
  const days = Math.max(1, Math.round((to - from) / DAY));
  const planMix = plans.map((p) => ({ p, n: shown.filter((r) => r.plan === p.id && r.status === "active").length, v: table.filter((x) => x.r.plan === p.id).reduce((s, x) => s + x.mrr, 0) }));

  const csv = () => {
    const cell = (v: unknown) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [
      ["Restropi revenue", iso(from), "to", iso(to - 1)],
      [],
      ["Restaurant", "City", "Plan", "Status", "Outlets", "Paid bills", "Sales (Rs)", "Subscription per month (Rs)"],
      ...table.map((x) => [x.r.name, x.r.city, x.r.plan, x.r.status, x.r.outlets, x.bills, x.sales, x.mrr]),
      ["Total", "", "", "", "", totalBills, totalSales, mrr],
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `restropi-revenue-${iso(from)}-to-${iso(to - 1)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Revenue" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "month", label: "This month" }, { value: "custom", label: "Custom" }]} />
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" aria-label="From" className={clsx(inputCls, "!h-10 !w-[150px] !text-[14px]")} value={fromIso} onChange={(e) => setFromIso(e.target.value)} />
              <span className="text-[13px] text-muted">to</span>
              <input type="date" aria-label="To" className={clsx(inputCls, "!h-10 !w-[150px] !text-[14px]")} value={toIso} onChange={(e) => setToIso(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chips value={plan} onChange={setPlan} options={[{ value: "all", label: "All plans" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]} />
          <Chips value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "all", label: "Any status" }]} />
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            ["Restaurant sales", rows ? inr(totalSales) : "…", `${totalBills} paid bills`],
            ["Avg sales / day", rows ? inr(Math.round(totalSales / days)) : "…", `${days} day${days === 1 ? "" : "s"}`],
            ["Restropi revenue / month", inr(mrr), "active plans × outlets"],
            ["Restropi revenue / year", inr(mrr * 12), "if all renew"],
          ].map(([l, v, h]) => (
            <div key={l} className="bg-surface p-4">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight tnum">{v}</div>
              <div className="text-[12px] text-faint">{h}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-[12.5px]">
          {planMix.map(({ p, n, v }) => (
            <span key={p.id} className="rounded-full bg-surface px-3 py-1.5 ring-1 ring-line">
              <b>{p.name}</b> · {n} active{p.monthly ? ` · ${inr(v)}/mo` : ""}
            </span>
          ))}
        </div>

        {err && <p className="rounded-ctl bg-rose-soft px-3 py-2 text-[13.5px] text-rose">{err}</p>}

        <div className="overflow-hidden rounded-group bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-line/80 px-4 py-2.5">
            <span className="text-[13px] font-semibold text-muted">Store-wise</span>
            <div className="flex items-center gap-2">
              <Segmented value={sort} onChange={setSort} options={[{ value: "sales", label: "Sales" }, { value: "bills", label: "Bills" }, { value: "name", label: "A–Z" }]} />
              <button onClick={csv} className="rounded-full bg-sunken px-3 py-1.5 text-[12.5px] font-semibold hover:bg-line">Excel</button>
            </div>
          </div>
          {table.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-muted">No restaurants match.</p>}
          {table.map((x) => (
            <div key={x.r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-b border-line/80 px-4 py-3 last:border-0 sm:grid-cols-[1.6fr_.8fr_.6fr_.9fr_.9fr]">
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-medium">{x.r.name}</div>
                <div className="truncate text-[12px] text-muted">{x.r.city || "—"} · {x.r.outlets} outlet{x.r.outlets === 1 ? "" : "s"}</div>
              </div>
              <span className="hidden text-[13px] capitalize text-muted sm:block">{x.r.plan}{x.r.status === "suspended" ? " · paused" : ""}</span>
              <span className="hidden text-right text-[13px] text-muted tnum sm:block">{rows ? x.bills : "…"}</span>
              <span className="text-right text-[14.5px] font-semibold tnum">{rows ? inr(x.sales) : "…"}</span>
              <span className="hidden text-right text-[13px] text-jade tnum sm:block">{x.mrr ? `${inr(x.mrr)}/mo` : "—"}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-faint">Restaurant sales = paid bills in the dates above. Restropi revenue = plan price × outlets for active restaurants (Chain is priced by hand, so not counted).</p>
      </div>
    </Sheet>
  );
}
