"use client";

import { CalendarRange, FileSpreadsheet, FileText, MessageCircle, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Bars, Button, Group, Page, PageHeader, Segmented, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { billOf, paymentsText, useAccount, useCategories, useCurrentOutlet, useMenu, useOrders } from "@/lib/live";
import { DAY_MS, between, byCategory, byDay, byMethod, inOutlet, live, paid, paidAmount, startOfDay, taxSplit, topDishes, totals } from "@/lib/stats";
import { gstRate, halfGstLabel, inr } from "@/lib/format";
import type { Order } from "@/lib/types";

type Period = "today" | "7d" | "30d" | "custom";
const DAYS: Record<Exclude<Period, "custom">, number> = { today: 1, "7d": 7, "30d": 30 };
const isoDay = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayOf = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
const niceDay = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
/** Most days drawn in the chart; longer ranges show their last 62 days. */
const CHART_MAX = 62;

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvBlob = (rows: unknown[][]) => new Blob(["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/** Phone share sheet (WhatsApp and the rest) with the file; false when the browser can't share files. */
async function shareFile(name: string, blob: Blob, text: string): Promise<boolean> {
  const file = new File([blob], name, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], text });
  } catch {
    /* closed the share sheet */
  }
  return true;
}
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const today = isoDay(Date.now());
  const [fromIso, setFromIso] = useState(isoDay(Date.now() - 6 * DAY_MS));
  const [toIso, setToIso] = useState(today);
  const toast = useToast();
  const account = useAccount();
  const outlet = useCurrentOutlet();
  const all = inOutlet(useOrders(), outlet.id);
  const menu = useMenu();
  const cats = useCategories();
  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "";

  // the range: [from, to) in ms; `end` is the last day shown
  const now = Date.now();
  let from: number, to: number;
  if (period === "custom") {
    const a = dayOf(fromIso || today);
    const b = dayOf(toIso || today);
    from = Math.min(a, b);
    to = Math.min(Math.max(a, b) + DAY_MS, startOfDay(now) + DAY_MS);
  } else {
    from = startOfDay(now) - (DAYS[period] - 1) * DAY_MS;
    to = now + 1;
  }
  const end = Math.min(to - 1, now);
  const days = Math.max(1, Math.round((startOfDay(end) - from) / DAY_MS) + 1);
  const orders = useMemo(() => between(all, from, to), [all, from, to]);
  const t = totals(orders);
  const methods = byMethod(orders);
  const methodTotal = methods.upi + methods.cash + methods.card;
  const top = topDishes(orders, 10);
  const categories = byCategory(orders, menu, catName);
  const net = Math.max(0, t.sales - t.gst);
  const stamp = new Date().toISOString().slice(0, 10);
  const label = period === "today" ? "today" : period === "custom" ? `${isoDay(from)}-to-${isoDay(end)}` : `last-${days}-days`;
  const rangeText = days === 1 ? niceDay(from) : `${niceDay(from)} – ${niceDay(end)}`;
  const chartDays = Math.min(Math.max(days, 7), CHART_MAX);

  // Excel files: every one starts with who / which dates, and carries Date + Day and CGST + SGST
  const dateText = (t: number) => {
    const d = new Date(t);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };
  const dayName = (t: number) => new Date(t).toLocaleDateString("en-IN", { weekday: "long" });
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const head = (title: string): unknown[][] => [[`${title} - ${account.name || "Restropi"}${outlet.name ? ` (${outlet.name})` : ""}`], ["From", dateText(from), "To", dateText(end)], []];
  const paidList = live(orders).filter((o) => o.status === "paid");
  const dayRows = Array.from({ length: days }, (_, i) => {
    const d0 = startOfDay(from) + i * DAY_MS;
    const list = paidList.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= d0 && t < d0 + DAY_MS;
    });
    const sp = list.map(taxSplit);
    return { d0, bills: list.length, taxable: r2(sp.reduce((s, x) => s + x.taxable, 0)), cgst: r2(sp.reduce((s, x) => s + x.cgst, 0)), sgst: r2(sp.reduce((s, x) => s + x.sgst, 0)), total: r2(sp.reduce((s, x) => s + x.total, 0)) };
  });
  const sum = (k: "bills" | "taxable" | "cgst" | "sgst" | "total") => r2(dayRows.reduce((s, x) => s + x[k], 0));

  const reports: { name: string; file: () => [string, unknown[][]] }[] = [
    {
      name: "Bills",
      file: () => [
        `bills-${label}-${stamp}.csv`,
        [
          ...head("Bills"),
          ["Bill no.", "Date", "Day", "Time", "Type", "Table", "Status", "Items", "Taxable value (Rs)", `CGST ${halfGstLabel()} (Rs)`, `SGST ${halfGstLabel()} (Rs)`, "Total (Rs)", "Paid by", "Staff"],
          ...live(orders).map((o: Order) => {
            const t0 = new Date(o.createdAt).getTime();
            const x = taxSplit(o);
            return [o.number, dateText(t0), dayName(t0), new Date(t0).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), o.type, o.tableName ?? "", o.status,
              o.lines.map((l) => `${l.qty} x ${l.name}`).join("; "), x.taxable, x.cgst, x.sgst, x.total, paymentsText(o.payments).replace(/₹/g, "Rs "), o.staff];
          }),
        ],
      ],
    },
    {
      name: "Item-wise sales",
      file: () => [
        `items-${label}-${stamp}.csv`,
        [
          ...head("Item-wise sales"),
          ["Dish", "Category", "Qty sold", "Taxable value (Rs)", `CGST ${halfGstLabel()} (Rs)`, `SGST ${halfGstLabel()} (Rs)`, "Total with GST (Rs)"],
          ...topDishes(orders, 1000).map((d) => {
            const g = r2(d.sales * gstRate());
            const cat = catName(menu.find((m) => m.id === d.id)?.categoryId ?? "");
            return [d.name, cat, d.qty, d.sales, r2(g / 2), r2(g - r2(g / 2)), r2(d.sales + g)];
          }),
        ],
      ],
    },
    {
      name: "Day-wise sales",
      file: () => [
        `days-${label}-${stamp}.csv`,
        [
          ...head("Day-wise sales"),
          ["Date", "Day", "Paid bills", "Taxable value (Rs)", `CGST ${halfGstLabel()} (Rs)`, `SGST ${halfGstLabel()} (Rs)`, "Total with GST (Rs)"],
          ...dayRows.map((d) => [dateText(d.d0), dayName(d.d0), d.bills, d.taxable, d.cgst, d.sgst, d.total]),
          ["Total", "", sum("bills"), sum("taxable"), sum("cgst"), sum("sgst"), sum("total")],
        ],
      ],
    },
    {
      name: "GST summary",
      file: () => [
        `gst-${label}-${stamp}.csv`,
        [
          ...head("GST summary"),
          ["", "Amount (Rs)"],
          ["Paid bills", sum("bills")],
          ["Taxable value", sum("taxable")],
          [`CGST ${halfGstLabel()}`, sum("cgst")],
          [`SGST ${halfGstLabel()}`, sum("sgst")],
          ["Total GST", r2(sum("cgst") + sum("sgst"))],
          ["Total with GST", sum("total")],
          [],
          ["Date", "Day", "Taxable value (Rs)", `CGST ${halfGstLabel()} (Rs)`, `SGST ${halfGstLabel()} (Rs)`, "Total with GST (Rs)"],
          ...dayRows.filter((d) => d.bills).map((d) => [dateText(d.d0), dayName(d.d0), d.taxable, d.cgst, d.sgst, d.total]),
        ],
      ],
    },
  ];

  const who = `${account.name || "Restropi"}${outlet.name ? ` · ${outlet.name}` : ""}`;
  // short text for WhatsApp
  const summary = [
    `*${who}* — sales report`,
    rangeText,
    "",
    `Sales: ${inr(t.sales)}`,
    `Paid bills: ${t.paidOrders}`,
    `Average bill: ${t.avgBill ? inr(t.avgBill) : "—"}`,
    `GST collected: ${inr(t.gst)}`,
    `UPI ${inr(methods.upi)} · Cash ${inr(methods.cash)} · Card ${inr(methods.card)}`,
    ...(top.length ? ["", "Top dishes:", ...top.slice(0, 5).map((d, i) => `${i + 1}. ${d.name} — ${d.qty} sold`)] : []),
  ].join("\n");

  const shareSummary = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: summary });
        return;
      } catch {
        return; // closed the sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank", "noopener");
  };

  const shareCsv = async (r: (typeof reports)[number]) => {
    const [name, rows] = r.file();
    const ok = await shareFile(name, csvBlob(rows), `${r.name} · ${who} · ${rangeText}`);
    if (!ok) {
      downloadBlob(name, csvBlob(rows));
      toast("Downloaded. Attach it in WhatsApp to send.");
    }
  };

  // A clean one-page report; the browser's print box saves it as PDF.
  const printPdf = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast("Allow pop-ups to save the PDF");
      return;
    }
    const row = (l: string, v: string) => `<tr><td>${esc(l)}</td><td class="n">${esc(v)}</td></tr>`;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sales report ${esc(rangeText)}</title><style>
      body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#18211e;margin:32px;max-width:720px}
      h1{font-size:22px;margin:0}.sub{color:#68716d;margin:4px 0 22px}
      .k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}.k div{border:1px solid #e3e6e3;border-radius:10px;padding:10px 12px}
      .k b{display:block;font-size:18px;margin-top:2px}.k span{color:#68716d;font-size:12px}
      h2{font-size:14px;margin:22px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:#68716d}
      table{width:100%;border-collapse:collapse;font-size:13.5px}td{padding:6px 0;border-bottom:1px solid #eef0ee}.n{text-align:right;font-variant-numeric:tabular-nums}
      .f{margin-top:28px;color:#9aa19e;font-size:11px}@media print{body{margin:12mm}}
    </style></head><body>
      <h1>${esc(who)}</h1><div class="sub">Sales report · ${esc(rangeText)}</div>
      <div class="k">
        <div><span>Sales</span><b>${esc(inr(t.sales))}</b></div><div><span>Paid bills</span><b>${t.paidOrders}</b></div>
        <div><span>Average bill</span><b>${esc(t.avgBill ? inr(t.avgBill) : "—")}</b></div><div><span>GST collected</span><b>${esc(inr(t.gst))}</b></div>
      </div>
      <h2>How guests paid</h2><table>${row("UPI", inr(methods.upi))}${row("Cash", inr(methods.cash))}${row("Card", inr(methods.card))}</table>
      <h2>GST</h2><table>${row("Taxable sales", inr(net))}${row(`CGST ${halfGstLabel()}`, inr(Math.round(t.gst / 2)))}${row(`SGST ${halfGstLabel()}`, inr(t.gst - Math.round(t.gst / 2)))}${row("Total with GST", inr(t.sales))}</table>
      <h2>Top dishes</h2><table>${top.length ? top.map((d, i) => `<tr><td>${i + 1}. ${esc(d.name)}</td><td class="n">${d.qty} sold</td><td class="n">${esc(inr(d.sales))}</td></tr>`).join("") : "<tr><td>No dishes sold.</td></tr>"}</table>
      <h2>Sales by category</h2><table>${categories.length ? categories.map((c) => row(c.label, inr(c.value))).join("") : "<tr><td>Nothing yet.</td></tr>"}</table>
      <h2>Sales by day</h2><table>${byDay(all, days, end).map((d, i, arr) => row(new Date(startOfDay(end) - (arr.length - 1 - i) * DAY_MS).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }), inr(d.value))).join("")}</table>
      <div class="f">Made with Restropi · ${esc(new Date().toLocaleString("en-IN"))}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${outlet.name} · ${rangeText}`}
        actions={
          <div className="hidden gap-2 sm:flex">
            <Button size="sm" variant="tinted" onClick={printPdf}><FileText size={16} /> PDF</Button>
            <Button size="sm" className="!bg-[#25D366] hover:!bg-[#1fb757]" onClick={shareSummary}><MessageCircle size={16} /> Share</Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: "today", label: "Today" },
              { value: "7d", label: "7 days" },
              { value: "30d", label: "30 days" },
              { value: "custom", label: <span className="inline-flex items-center gap-1"><CalendarRange size={14} /> Custom</span> },
            ]}
          />
          {period === "custom" && (
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <input type="date" aria-label="From" className={inputCls + " !h-10 min-w-0 flex-1 !text-[14px] sm:w-[150px] sm:flex-none"} max={today} value={fromIso} onChange={(e) => setFromIso(e.target.value)} />
              <span className="text-[13px] text-muted">to</span>
              <input type="date" aria-label="To" className={inputCls + " !h-10 min-w-0 flex-1 !text-[14px] sm:w-[150px] sm:flex-none"} max={today} value={toIso} onChange={(e) => setToIso(e.target.value)} />
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
          <Button size="sm" variant="tinted" onClick={printPdf}><FileText size={16} /> Save PDF</Button>
          <Button size="sm" className="!bg-[#25D366] hover:!bg-[#1fb757]" onClick={shareSummary}><MessageCircle size={16} /> WhatsApp</Button>
        </div>
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
          <Group title={days === 1 ? "Sales · last 7 days" : days > CHART_MAX ? `Sales by day · last ${CHART_MAX} days of the range` : "Sales by day"}>
            <Bars data={byDay(all, chartDays, end)} height={180} highlightLast format={(n) => inr(n)} />
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
                [`CGST ${halfGstLabel()}`, inr(Math.round(t.gst / 2))],
                [`SGST ${halfGstLabel()}`, inr(t.gst - Math.round(t.gst / 2))],
                ["Total with GST", inr(t.sales)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between"><span className="text-muted">{l}</span><span className="font-medium tnum">{v}</span></div>
              ))}
            </div>
          </Group>
        </div>

        <Group title={`Download · ${rangeText}`} flush>
          {reports.map((r) => (
            <div key={r.name} className="flex items-center gap-1 border-b border-line/80 pr-2 last:border-0 lg:pr-3">
              <button
                onClick={() => {
                  const [name, rows] = r.file();
                  downloadBlob(name, csvBlob(rows));
                }}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-sunken/40 lg:px-5"
              >
                <FileSpreadsheet size={17} className="shrink-0 text-jade" />
                <span className="flex-1 truncate text-[15px]">{r.name}</span>
                <span className="text-[13px] text-muted">Excel (CSV)</span>
              </button>
              <button onClick={() => shareCsv(r)} aria-label={`Share ${r.name} on WhatsApp`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1fa855] hover:bg-sunken">
                <Share2 size={17} />
              </button>
            </div>
          ))}
          <button onClick={printPdf} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/40 lg:px-5">
            <FileText size={17} className="text-jade" />
            <span className="flex-1 text-[15px]">Summary report</span>
            <span className="text-[13px] text-muted">PDF</span>
          </button>
        </Group>
      </Page>
    </>
  );
}
