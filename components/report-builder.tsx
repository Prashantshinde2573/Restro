"use client";

// Owner's report builder: pick what goes in, filter it, then get a designed PDF
// (the browser's print box saves it) or one Excel file with the same sections.
import clsx from "clsx";
import { Check, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Sheet, inputCls } from "./ui";
import { useToast } from "./toast";
import { billOf, methodLabel, paymentsText } from "@/lib/live";
import { DAY_MS, live, paidAmount, startOfDay, taxSplit, topDishes } from "@/lib/stats";
import { halfGstLabel, inr } from "@/lib/format";
import type { Category, MenuItem, Order, PayMethod } from "@/lib/types";

export type SectionId = "summary" | "days" | "methods" | "gst" | "items" | "categories" | "staff" | "types" | "discounts" | "cancelled" | "bills";
export const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: "summary", label: "Summary", hint: "Sales, bills, average bill, GST" },
  { id: "days", label: "Sales by day", hint: "Date, day, bills, taxable, CGST, SGST, total" },
  { id: "methods", label: "How guests paid", hint: "UPI, cash, card" },
  { id: "gst", label: "GST summary", hint: "Taxable value and CGST / SGST" },
  { id: "items", label: "Item-wise sales", hint: "Every dish: qty and sales" },
  { id: "categories", label: "Sales by category", hint: "Starters, mains, drinks…" },
  { id: "staff", label: "Staff-wise sales", hint: "Bills and sales per person" },
  { id: "types", label: "Dine-in, counter, delivery, QR", hint: "Where orders came from" },
  { id: "discounts", label: "Discounts given", hint: "Bills paid below the bill amount" },
  { id: "cancelled", label: "Cancelled orders", hint: "What was cancelled and its value" },
  { id: "bills", label: "All bills", hint: "Every bill, one line each" },
];
const DEFAULT: SectionId[] = ["summary", "days", "methods", "gst", "items", "categories"];
const SAVE = "restropi.reportSections";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const r2 = (n: number) => Math.round(n * 100) / 100;
const dateText = (t: number) => {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};
const dayName = (t: number) => new Date(t).toLocaleDateString("en-IN", { weekday: "short" });
const typeLabel = (o: Order) => (o.channel === "qr" ? "QR (guest phone)" : o.type === "dine-in" ? "Dine-in" : o.type === "delivery" ? "Delivery" : "Counter / takeaway");

export function ReportBuilder({
  open,
  onClose,
  orders,
  from,
  end,
  rangeText,
  business,
  outletName,
  menu,
  cats,
}: {
  open: boolean;
  onClose: () => void;
  orders: Order[]; // already the date range and outlet
  from: number;
  end: number;
  rangeText: string;
  business: string;
  outletName: string;
  menu: MenuItem[];
  cats: Category[];
}) {
  const toast = useToast();
  const [sel, setSel] = useState<SectionId[]>(DEFAULT);
  const [method, setMethod] = useState<"all" | PayMethod>("all");
  const [kind, setKind] = useState<"all" | "dine-in" | "takeaway" | "delivery" | "qr">("all");
  const [staff, setStaff] = useState("all");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE);
      if (raw) setSel((JSON.parse(raw) as SectionId[]).filter((x) => SECTIONS.some((s) => s.id === x)));
    } catch {}
  }, []);
  const toggle = (id: SectionId) => {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : SECTIONS.map((s) => s.id).filter((x) => x === id || sel.includes(x));
    setSel(next);
    try {
      localStorage.setItem(SAVE, JSON.stringify(next));
    } catch {}
  };

  const people = useMemo(() => [...new Set(orders.map((o) => o.staff).filter(Boolean))].sort(), [orders]);
  const list = useMemo(
    () =>
      orders.filter(
        (o) =>
          (staff === "all" || o.staff === staff) &&
          (kind === "all" || (kind === "qr" ? o.channel === "qr" : o.type === kind && o.channel !== "qr")) &&
          (method === "all" || (o.payments ?? []).some((p) => p.method === method)),
      ),
    [orders, staff, kind, method],
  );
  const filterText = [method !== "all" && `Paid by ${methodLabel[method]}`, kind !== "all" && (kind === "qr" ? "QR orders" : kind === "dine-in" ? "Dine-in" : kind === "delivery" ? "Delivery" : "Counter / takeaway"), staff !== "all" && `Staff: ${staff}`]
    .filter(Boolean)
    .join(" · ");

  // ---------- the numbers ----------
  const data = useMemo(() => {
    const paidList = live(list).filter((o) => o.status === "paid");
    const splits = paidList.map(taxSplit);
    const sales = r2(splits.reduce((s, x) => s + x.total, 0));
    const gst = r2(splits.reduce((s, x) => s + x.gst, 0));
    const taxable = r2(splits.reduce((s, x) => s + x.taxable, 0));
    const cgst = r2(splits.reduce((s, x) => s + x.cgst, 0));
    const sgst = r2(splits.reduce((s, x) => s + x.sgst, 0));
    const days = Math.max(1, Math.round((startOfDay(end) - startOfDay(from)) / DAY_MS) + 1);
    const dayRows = Array.from({ length: days }, (_, i) => {
      const d0 = startOfDay(from) + i * DAY_MS;
      const l = paidList.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= d0 && t < d0 + DAY_MS;
      });
      const sp = l.map(taxSplit);
      return { d0, bills: l.length, taxable: r2(sp.reduce((s, x) => s + x.taxable, 0)), cgst: r2(sp.reduce((s, x) => s + x.cgst, 0)), sgst: r2(sp.reduce((s, x) => s + x.sgst, 0)), total: r2(sp.reduce((s, x) => s + x.total, 0)) };
    });
    const methods: Record<PayMethod, number> = { upi: 0, cash: 0, card: 0 };
    paidList.forEach((o) => (o.payments ?? []).forEach((p) => (methods[p.method] += p.amount)));
    const catOf = new Map(menu.map((m) => [m.id, m.categoryId]));
    const catName = (id?: string) => cats.find((c) => c.id === id)?.name || "Other";
    const items = topDishes(paidList, 10000).map((d) => ({ ...d, cat: catName(catOf.get(d.id)) }));
    const catMap = new Map<string, { qty: number; sales: number }>();
    items.forEach((d) => {
      const c = catMap.get(d.cat) ?? { qty: 0, sales: 0 };
      c.qty += d.qty;
      c.sales += d.sales;
      catMap.set(d.cat, c);
    });
    const categories = [...catMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sales - a.sales);
    const staffMap = new Map<string, { bills: number; sales: number }>();
    paidList.forEach((o) => {
      const k = o.staff || "—";
      const c = staffMap.get(k) ?? { bills: 0, sales: 0 };
      c.bills++;
      c.sales += paidAmount(o);
      staffMap.set(k, c);
    });
    const staffRows = [...staffMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sales - a.sales);
    const typeMap = new Map<string, { bills: number; sales: number }>();
    paidList.forEach((o) => {
      const k = typeLabel(o);
      const c = typeMap.get(k) ?? { bills: 0, sales: 0 };
      c.bills++;
      c.sales += paidAmount(o);
      typeMap.set(k, c);
    });
    const types = [...typeMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.sales - a.sales);
    const discounts = paidList
      .map((o) => ({ o, bill: billOf(o), paid: paidAmount(o) }))
      .filter((x) => x.bill - x.paid >= 1)
      .map((x) => ({ ...x, off: x.bill - x.paid }));
    const cancelled = list.filter((o) => o.status === "cancelled");
    const open = live(list).filter((o) => o.status !== "paid");
    return { paidList, sales, gst, taxable, cgst, sgst, dayRows, methods, items, categories, staffRows, types, discounts, cancelled, open, avg: paidList.length ? Math.round(sales / paidList.length) : 0 };
  }, [list, from, end, menu, cats]);

  // ---------- PDF ----------
  const pdf = () => {
    const w = window.open("", "_blank");
    if (!w) return toast("Allow pop-ups to save the PDF");
    const has = (id: SectionId) => sel.includes(id);
    const money = (n: number) => esc(inr(Math.round(n)));
    const table = (head: string[], rows: (string | number)[][], foot?: (string | number)[], numFrom = 1) =>
      `<table><thead><tr>${head.map((h, i) => `<th class="${i >= numFrom ? "n" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${
        rows.length ? rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i >= numFrom ? "n" : ""}">${typeof c === "string" ? c : esc(c)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}" class="none">Nothing in this period.</td></tr>`
      }</tbody>${foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${i >= numFrom ? "n" : ""}">${typeof c === "string" ? c : esc(c)}</td>`).join("")}</tr></tfoot>` : ""}</table>`;
    const sec = (title: string, body: string) => `<section><h2>${esc(title)}</h2>${body}</section>`;
    const mt = data.methods.upi + data.methods.cash + data.methods.card;
    const bar = (v: number, max: number) => `<span class="bar"><i style="width:${max ? Math.max(2, (v / max) * 100) : 0}%"></i></span>`;
    const maxDay = Math.max(0, ...data.dayRows.map((d) => d.total));
    const parts: string[] = [];
    if (has("summary"))
      parts.push(`<div class="kpis">
        <div><span>Sales (with GST)</span><b>${money(data.sales)}</b></div>
        <div><span>Paid bills</span><b>${data.paidList.length}</b></div>
        <div><span>Average bill</span><b>${data.avg ? money(data.avg) : "—"}</b></div>
        <div><span>GST collected</span><b>${money(data.gst)}</b></div>
      </div>
      ${data.open.length ? `<p class="note">${data.open.length} bill${data.open.length > 1 ? "s" : ""} not paid yet in this period (${money(data.open.reduce((s, o) => s + billOf(o), 0))}).</p>` : ""}`);
    if (has("days"))
      parts.push(
        sec(
          "Sales by day",
          table(
            ["Date", "Day", "Bills", "Taxable", `CGST ${halfGstLabel()}`, `SGST ${halfGstLabel()}`, "Total", ""],
            data.dayRows.map((d) => [dateText(d.d0), dayName(d.d0), d.bills, money(d.taxable), money(d.cgst), money(d.sgst), `<b>${money(d.total)}</b>`, bar(d.total, maxDay)]),
            ["<b>Total</b>", "", data.paidList.length, money(data.taxable), money(data.cgst), money(data.sgst), `<b>${money(data.sales)}</b>`, ""],
            2,
          ),
        ),
      );
    if (has("methods"))
      parts.push(
        sec(
          "How guests paid",
          table(
            ["Method", "Amount", "Share"],
            (["upi", "cash", "card"] as const).map((m) => [methodLabel[m], money(data.methods[m]), `${mt ? Math.round((data.methods[m] / mt) * 100) : 0}%`]),
            ["<b>Total</b>", `<b>${money(mt)}</b>`, ""],
          ),
        ),
      );
    if (has("gst"))
      parts.push(
        sec(
          "GST summary",
          table(["", "Amount"], [["Taxable value", money(data.taxable)], [`CGST ${halfGstLabel()}`, money(data.cgst)], [`SGST ${halfGstLabel()}`, money(data.sgst)], ["Total GST", money(data.gst)]], ["<b>Total with GST</b>", `<b>${money(data.sales)}</b>`]),
        ),
      );
    if (has("items")) parts.push(sec("Item-wise sales", table(["Dish", "Category", "Qty", "Sales (before GST)"], data.items.map((d) => [esc(d.name), esc(d.cat), d.qty, money(d.sales)]), undefined, 2)));
    if (has("categories")) parts.push(sec("Sales by category", table(["Category", "Qty", "Sales (before GST)"], data.categories.map((c) => [esc(c.name), c.qty, money(c.sales)]))));
    if (has("staff")) parts.push(sec("Staff-wise sales", table(["Person", "Bills", "Sales"], data.staffRows.map((s) => [esc(s.name), s.bills, money(s.sales)]))));
    if (has("types")) parts.push(sec("Where orders came from", table(["Type", "Bills", "Sales"], data.types.map((t) => [esc(t.name), t.bills, money(t.sales)]))));
    if (has("discounts"))
      parts.push(
        sec(
          "Discounts given",
          table(["Bill", "Date", "Staff", "Bill amount", "Paid", "Discount"], data.discounts.map((x) => [`#${x.o.number}`, dateText(new Date(x.o.createdAt).getTime()), esc(x.o.staff), money(x.bill), money(x.paid), `<b>${money(x.off)}</b>`]), data.discounts.length ? ["<b>Total</b>", "", "", "", "", `<b>${money(data.discounts.reduce((s, x) => s + x.off, 0))}</b>`] : undefined, 3),
        ),
      );
    if (has("cancelled"))
      parts.push(
        sec(
          "Cancelled orders",
          table(["Order", "Date", "Where", "Items", "Value"], data.cancelled.map((o) => [`#${o.number}`, dateText(new Date(o.createdAt).getTime()), esc(o.tableName ? `Table ${o.tableName}` : typeLabel(o)), esc(o.lines.map((l) => `${l.qty} ${l.name}`).join(", ")), money(billOf(o))]), undefined, 4),
        ),
      );
    if (has("bills"))
      parts.push(
        sec(
          "All bills",
          table(
            ["Bill", "Date", "Time", "Where", "Staff", "Paid by", "Total"],
            data.paidList.map((o) => {
              const t = new Date(o.createdAt);
              return [`#${o.number}`, dateText(t.getTime()), t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), esc(o.tableName ? `Table ${o.tableName}` : typeLabel(o)), esc(o.staff), esc(paymentsText(o.payments)), money(paidAmount(o))];
            }),
            ["<b>Total</b>", "", "", "", "", "", `<b>${money(data.sales)}</b>`],
            6,
          ),
        ),
      );
    const logo = `${window.location.origin}/brand/restropi-logo-dark.png`;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(business)} · Report · ${esc(rangeText)}</title><style>
      @page{size:A4;margin:14mm 12mm 16mm}
      *{box-sizing:border-box}
      body{font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;color:#17201c;margin:0;font-size:12.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .wrap{max-width:780px;margin:0 auto;padding:28px 24px}
      header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;border-bottom:3px solid #0f7a55}
      header h1{font-size:24px;margin:0;letter-spacing:-.01em}
      header .sub{color:#5d6863;margin-top:4px;font-size:13px}
      header .meta{text-align:right;color:#5d6863;font-size:11.5px;line-height:1.6}
      header img{height:22px;display:block;margin:0 0 6px auto}
      .period{display:inline-block;margin-top:10px;background:#e8f4ee;color:#0b5e41;font-weight:600;border-radius:999px;padding:4px 12px;font-size:12px}
      .filters{margin-top:6px;color:#8a5a00;font-size:12px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0 6px}
      .kpis div{background:#f4f6f5;border-radius:12px;padding:12px 14px}
      .kpis span{display:block;color:#5d6863;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      .kpis b{display:block;font-size:20px;margin-top:4px;font-variant-numeric:tabular-nums}
      .note{color:#8a5a00;font-size:12px;margin:8px 0 0}
      section{margin-top:22px;break-inside:auto}
      h2{font-size:13px;margin:0 0 8px;color:#0b5e41;text-transform:uppercase;letter-spacing:.06em}
      table{width:100%;border-collapse:collapse}
      thead th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#5d6863;font-weight:600;padding:7px 8px;border-bottom:1.5px solid #cfd6d2;background:#f8faf9}
      tbody td{padding:6.5px 8px;border-bottom:1px solid #edf0ee;vertical-align:top}
      tbody tr:nth-child(even) td{background:#fbfcfb}
      tfoot td{padding:8px;border-top:1.5px solid #17201c;font-weight:600}
      .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
      .none{color:#8b938f;text-align:center;padding:14px}
      .bar{display:inline-block;width:70px;height:6px;background:#edf0ee;border-radius:9px;overflow:hidden;vertical-align:middle}.bar i{display:block;height:100%;background:#0f7a55;border-radius:9px}
      tr{break-inside:avoid}
      footer{margin-top:28px;padding-top:10px;border-top:1px solid #e3e7e5;color:#8b938f;font-size:10.5px;display:flex;justify-content:space-between}
      @media print{.wrap{padding:0}}
    </style></head><body><div class="wrap">
      <header>
        <div>
          <h1>${esc(business || "Your restaurant")}</h1>
          <div class="sub">${esc(outletName)} · Sales report</div>
          <div class="period">${esc(rangeText)}</div>
          ${filterText ? `<div class="filters">Filtered: ${esc(filterText)}</div>` : ""}
        </div>
        <div class="meta"><img src="${logo}" alt="Restropi">Made ${esc(new Date().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</div>
      </header>
      ${parts.join("") || '<p class="none">Pick at least one section.</p>'}
      <footer><span>${esc(business)} · ${esc(outletName)}</span><span>Made with Restropi</span></footer>
      <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
    </div></body></html>`);
    w.document.close();
  };

  // ---------- Excel: the same sections stacked in one file ----------
  const excel = () => {
    const has = (id: SectionId) => sel.includes(id);
    const rows: unknown[][] = [[`Sales report - ${business}${outletName ? ` (${outletName})` : ""}`], ["From", dateText(from), "To", dateText(end)], ...(filterText ? [["Filtered", filterText]] : []), []];
    const add = (title: string, head: string[], body: unknown[][]) => rows.push([title], head, ...body, []);
    if (has("summary")) add("Summary", ["", "Value"], [["Sales with GST (Rs)", data.sales], ["Paid bills", data.paidList.length], ["Average bill (Rs)", data.avg], ["GST collected (Rs)", data.gst]]);
    if (has("days")) add("Sales by day", ["Date", "Day", "Bills", "Taxable (Rs)", `CGST ${halfGstLabel()} (Rs)`, `SGST ${halfGstLabel()} (Rs)`, "Total (Rs)"], [...data.dayRows.map((d) => [dateText(d.d0), dayName(d.d0), d.bills, d.taxable, d.cgst, d.sgst, d.total]), ["Total", "", data.paidList.length, data.taxable, data.cgst, data.sgst, data.sales]]);
    if (has("methods")) add("How guests paid", ["Method", "Amount (Rs)"], (["upi", "cash", "card"] as const).map((m) => [methodLabel[m], data.methods[m]]));
    if (has("gst")) add("GST summary", ["", "Amount (Rs)"], [["Taxable value", data.taxable], [`CGST ${halfGstLabel()}`, data.cgst], [`SGST ${halfGstLabel()}`, data.sgst], ["Total GST", data.gst], ["Total with GST", data.sales]]);
    if (has("items")) add("Item-wise sales", ["Dish", "Category", "Qty", "Sales before GST (Rs)"], data.items.map((d) => [d.name, d.cat, d.qty, d.sales]));
    if (has("categories")) add("Sales by category", ["Category", "Qty", "Sales before GST (Rs)"], data.categories.map((c) => [c.name, c.qty, c.sales]));
    if (has("staff")) add("Staff-wise sales", ["Person", "Bills", "Sales (Rs)"], data.staffRows.map((s) => [s.name, s.bills, s.sales]));
    if (has("types")) add("Where orders came from", ["Type", "Bills", "Sales (Rs)"], data.types.map((t) => [t.name, t.bills, t.sales]));
    if (has("discounts")) add("Discounts given", ["Bill", "Date", "Staff", "Bill amount (Rs)", "Paid (Rs)", "Discount (Rs)"], data.discounts.map((x) => [x.o.number, dateText(new Date(x.o.createdAt).getTime()), x.o.staff, x.bill, x.paid, x.off]));
    if (has("cancelled")) add("Cancelled orders", ["Order", "Date", "Where", "Items", "Value (Rs)"], data.cancelled.map((o) => [o.number, dateText(new Date(o.createdAt).getTime()), o.tableName ?? typeLabel(o), o.lines.map((l) => `${l.qty} x ${l.name}`).join("; "), billOf(o)]));
    if (has("bills")) add("All bills", ["Bill", "Date", "Time", "Where", "Staff", "Paid by", "Total (Rs)"], data.paidList.map((o) => { const t = new Date(o.createdAt); return [o.number, dateText(t.getTime()), t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), o.tableName ?? typeLabel(o), o.staff, paymentsText(o.payments).replace(/₹/g, "Rs "), paidAmount(o)]; }));
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${dateText(from)}-to-${dateText(end)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Build a report"
      wide
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" variant="tinted" disabled={!sel.length} onClick={excel}><FileSpreadsheet size={18} /> Excel</Button>
          <Button size="lg" disabled={!sel.length} onClick={pdf}><FileText size={18} /> PDF</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-[14px] text-muted">{rangeText}{outletName ? ` · ${outletName}` : ""} · {data.paidList.length} paid bill{data.paidList.length === 1 ? "" : "s"} · {inr(Math.round(data.sales))}</p>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-muted">What goes in the report</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTIONS.map((s) => {
              const on = sel.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)} className={clsx("flex items-start gap-3 rounded-[14px] px-3 py-2.5 text-left transition", on ? "bg-jade-soft ring-1 ring-jade/40" : "bg-surface hover:bg-sunken")}>
                  <span className={clsx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]", on ? "bg-jade text-white" : "ring-2 ring-line")}>{on && <Check size={13} strokeWidth={3} />}</span>
                  <span>
                    <span className="block text-[14.5px] font-medium">{s.label}</span>
                    <span className="block text-[12.5px] text-muted">{s.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3 text-[13px] font-semibold">
            <button className="text-jade" onClick={() => { setSel(SECTIONS.map((s) => s.id)); try { localStorage.setItem(SAVE, JSON.stringify(SECTIONS.map((s) => s.id))); } catch {} }}>Select all</button>
            <button className="text-muted" onClick={() => { setSel(DEFAULT); try { localStorage.setItem(SAVE, JSON.stringify(DEFAULT)); } catch {} }}>Reset</button>
          </div>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-muted">Only include</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className={clsx(inputCls, "!h-11 !text-[14px]")}>
              <option value="all">Every payment method</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
            <select aria-label="Order type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={clsx(inputCls, "!h-11 !text-[14px]")}>
              <option value="all">Every order type</option>
              <option value="dine-in">Dine-in</option>
              <option value="takeaway">Counter / takeaway</option>
              <option value="delivery">Delivery</option>
              <option value="qr">QR (guest phone)</option>
            </select>
            <select aria-label="Staff" value={staff} onChange={(e) => setStaff(e.target.value)} className={clsx(inputCls, "!h-11 !text-[14px]")}>
              <option value="all">Every staff member</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[12.5px] text-faint">PDF opens a print-ready page: choose &ldquo;Save as PDF&rdquo;. On a phone, share the saved file on WhatsApp.</p>
      </div>
    </Sheet>
  );
}

