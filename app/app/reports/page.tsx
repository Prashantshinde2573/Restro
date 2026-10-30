"use client";

import { FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bars, Group, Page, PageHeader, Segmented } from "@/components/ui";
import { billOf, paymentsText, useCategories, useCurrentOutlet, useMenu, useOrders } from "@/lib/live";
import { DAY_MS, between, byCategory, byDay, byMethod, inOutlet, live, paid, paidAmount, startOfDay, topDishes, totals } from "@/lib/stats";
import { inr } from "@/lib/format";
import type { Order } from "@/lib/types";

type Period = "today" | "7d" | "30d";
const DAYS: Record<Period, number> = { today: 1, "7d": 7, "30d": 30 };

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function downloadCsv(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const outlet = useCurrentOutlet();
  const all = inOutlet(useOrders(), outlet.id);
  const menu = useMenu();
  const cats = useCategories();
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "";

  const days = DAYS[period];
  const now = Date.now();
  const from = startOfDay(now) - (days - 1) * DAY_MS;
  const orders = useMemo(() => between(all, from, now + 1), [all, from, now]);
  const t = totals(orders);
  const methods = byMethod(orders);
  const methodTotal = methods.upi + methods.cash + methods.card;
  const top = topDishes(orders, 10);
  const categories = byCategory(orders, menu, catName);
  const net = Math.max(0, t.sales - t.gst);
  const stamp = new Date().toISOString().slice(0, 10);
  const label = period === "today" ? "today" : `last-${days}-days`;

  const reports: { name: string; run: () => void }[] = [
    {
      name: "Bills",
      run: () =>
        downloadCsv(`bills-${label}-${stamp}.csv`, [
          ["Bill no.", "Date", "Time", "Type", "Table", "Status", "Items", "Amount before GST", "GST", "Total", "Paid by", "Staff"],
          ...live(orders).map((o: Order) => {
            const sub = o.lines.reduce((s, l) => s + l.qty * l.price, 0);
            const d = new Date(o.createdAt);
            return [o.number, d.toLocaleDateString("en-IN"), d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), o.type, o.tableName ?? "", o.status,
              o.lines.map((l) => `${l.qty} × ${l.name}`).join("; "), sub, billOf(o) - sub, billOf(o), paymentsText(o.payments), o.staff];
          }),
        ]),
    },
    {
      name: "Item-wise sales",
      run: () => downloadCsv(`items-${label}-${stamp}.csv`, [["Dish", "Qty sold", "Sales (₹, before GST)"], ...topDishes(orders, 1000).map((d) => [d.name, d.qty, d.sales])]),
    },
    {
      name: "Day-wise sales",
      run: () => downloadCsv(`days-${label}-${stamp}.csv`, [["Day", "Sales (₹, with GST)"], ...byDay(all, Math.max(days, 7), now).map((d, i, arr) => [new Date(startOfDay(now) - (arr.length - 1 - i) * DAY_MS).toLocaleDateString("en-IN"), d.value])]),
    },
    {
      name: "GST summary",
      run: () =>
        downloadCsv(`gst-${label}-${stamp}.csv`, [
          ["", "Amount (₹)"],
          ["Taxable sales", net],
          ["CGST 2.5%", Math.round(t.gst / 2)],
          ["SGST 2.5%", t.gst - Math.round(t.gst / 2)],
          ["Total with GST", t.sales],
        ]),
    },
  ];

  return (
    <>
      <PageHeader title="Reports" subtitle={`${outlet.name} · from paid bills`}>
        <Segmented value={period} onChange={setPeriod} options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }]} />
      </PageHeader>
      <Page className="space-y-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            ["Sales", inr(t.sales)],
            ["Paid bills", String(t.paidOrders)],
            ["Average bill", t.avgBill ? inr(t.avgBill) : "—"],
            ["GST collected", inr(t.gst)],
          ].map(([l, v]) => (
            <div key={l} className="bg-surface p-4">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="mt-1 text-[24px] font-semibold tracking-tight tnum">{v}</div>
            </div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="rounded-group bg-surface px-5 py-10 text-center">
            <p className="text-[16px] font-semibold">No orders in this period</p>
            <p className="mt-1 text-[14px] text-muted">Reports fill in by themselves as you take orders.</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Group title={period === "today" ? "Sales · last 7 days" : "Sales by day"}>
            <Bars data={byDay(all, Math.max(days, 7), now)} height={180} highlightLast format={(n) => inr(n)} />
          </Group>
          <Group title="How guests paid" flush>
            {(["upi", "cash", "card"] as const).map((k) => (
              <div key={k} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                <span className="w-14 text-[14.5px] font-medium">{k === "upi" ? "UPI" : k === "cash" ? "Cash" : "Card"}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                  <span className="block h-full rounded-full bg-jade" style={{ width: `${methodTotal ? (methods[k] / methodTotal) * 100 : 0}%` }} />
                </span>
                <span className="w-24 text-right text-[14.5px] font-semibold tnum">{inr(methods[k])}</span>
              </div>
            ))}
            <div className="flex justify-between bg-jade-soft px-4 py-3 text-[15px] font-semibold text-jade-deep lg:px-5">
              <span>Collected</span>
              <span className="tnum">{inr(paid(orders).reduce((s, o) => s + paidAmount(o), 0))}</span>
            </div>
          </Group>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Group title="Top dishes" flush className="lg:col-span-1">
            {top.length ? (
              top.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-2.5 last:border-0 lg:px-5">
                  <span className="w-5 text-center text-[13px] font-semibold text-faint tnum">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px]">{d.name}</span>
                  <span className="text-[13px] text-muted tnum">{d.qty} sold</span>
                  <span className="w-20 text-right text-[14px] font-medium tnum">{inr(d.sales)}</span>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-[14px] text-muted">No dishes sold yet.</p>
            )}
          </Group>

          <Group title="Sales by category" flush>
            {categories.length ? (
              categories.map((c) => (
                <div key={c.label} className="flex justify-between border-b border-line/80 px-4 py-2.5 text-[14.5px] last:border-0 lg:px-5">
                  <span className="text-muted">{c.label}</span>
                  <span className="font-medium tnum">{inr(c.value)}</span>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-[14px] text-muted">Nothing yet.</p>
            )}
          </Group>

          <Group title="GST">
            <div className="space-y-1.5 text-[14px]">
              {[
                ["Taxable sales", inr(net)],
                ["CGST 2.5%", inr(Math.round(t.gst / 2))],
                ["SGST 2.5%", inr(t.gst - Math.round(t.gst / 2))],
                ["Total with GST", inr(t.sales)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between"><span className="text-muted">{l}</span><span className="font-medium tnum">{v}</span></div>
              ))}
            </div>
          </Group>
        </div>

        <Group title="Download" flush>
          {reports.map((r) => (
            <button key={r.name} onClick={r.run} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
              <FileSpreadsheet size={17} className="text-jade" />
              <span className="flex-1 text-[15px]">{r.name}</span>
              <span className="text-[13px] text-muted">Excel (CSV)</span>
            </button>
          ))}
        </Group>
      </Page>
    </>
  );
}
