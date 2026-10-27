"use client";

import { Download, FileSpreadsheet, Lock, Plus, Send } from "lucide-react";
import { useState } from "react";
import { Bars, Button, Field, Group, Page, PageHeader, Segmented, Sheet, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";

const pnl = [
  ["Food sales", 1438200],
  ["Drinks", 214600],
  ["Food cost", -497300],
  ["Staff", -185000],
  ["Rent", -120000],
  ["Electricity + gas", -64800],
  ["Aggregator commission", -41200],
  ["Marketing", -9600],
  ["Other", -22400],
] as const;

const expenses = [
  ["Gas cylinder × 4", "Utilities", 7600, "Today"],
  ["Vegetables — market yard", "Food", 3420, "Today"],
  ["Plumber", "Repairs", 1200, "Yesterday"],
  ["Diwali lights", "Decor", 4800, "Sat"],
] as const;

export default function ReportsPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");
  const [close, setClose] = useState(false);
  const [expense, setExpense] = useState(false);
  const week = repo.weekSales();
  const revenue = pnl.filter(([, v]) => v > 0).reduce((s, [, v]) => s + v, 0);
  const profit = pnl.reduce((s, [, v]) => s + v, 0);
  const scale = period === "today" ? 1 / 30 : period === "week" ? 7 / 30 : 1;
  const s = (n: number) => Math.round(n * scale);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Sales, profit, GST and cash in one place"
        actions={<Button size="sm" variant="tinted" onClick={() => toast("Sent to your CA on WhatsApp")}><Send size={15} /> Send to CA</Button>}
      >
        <Segmented value={period} onChange={setPeriod} options={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "October" }]} />
      </PageHeader>
      <Page className="space-y-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            ["Sales", inr(s(revenue))],
            ["Profit", inr(s(profit))],
            ["Food cost", `${Math.round((497300 / 1438200) * 100)}%`],
            ["GST collected", inr(s(Math.round(revenue * 0.05)))],
          ].map(([l, v]) => (
            <div key={l} className="bg-surface p-4">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="mt-1 text-[24px] font-semibold tracking-tight tnum">{v}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Group title="Sales by day">
            <Bars data={week.map((w) => ({ label: w.d, value: w.v }))} height={180} format={(n) => inr(n)} />
          </Group>
          <Group title="Profit and loss" flush>
            {pnl.map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-line/80 px-4 py-2.5 text-[14.5px] lg:px-5">
                <span className="text-muted">{l}</span>
                <span className={v < 0 ? "tnum" : "font-medium tnum"}>{v < 0 ? `−${inr(s(-v))}` : inr(s(v))}</span>
              </div>
            ))}
            <div className="flex justify-between bg-jade-soft px-4 py-3 text-[15px] font-semibold text-jade-deep lg:px-5">
              <span>Profit</span>
              <span className="tnum">{inr(s(profit))} · {Math.round((profit / revenue) * 100)}%</span>
            </div>
          </Group>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Group title="Day close">
            <p className="text-[14px] text-muted">Count the cash drawer at the end of the night. Restro tells you if it&apos;s short or over.</p>
            <div className="mt-3 space-y-1.5 text-[14px]">
              <div className="flex justify-between"><span className="text-muted">Expected cash</span><span className="font-medium tnum">{inr(19000)}</span></div>
              <div className="flex justify-between"><span className="text-muted">UPI</span><span className="font-medium tnum">{inr(48210)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Card</span><span className="font-medium tnum">{inr(11640)}</span></div>
            </div>
            <Button className="mt-4 w-full" onClick={() => setClose(true)}><Lock size={16} /> Close today</Button>
          </Group>

          <Group title="GST for October">
            <div className="space-y-1.5 text-[14px]">
              {[["Taxable sales", inr(s(revenue))], ["CGST 2.5%", inr(s(Math.round(revenue * 0.025)))], ["SGST 2.5%", inr(s(Math.round(revenue * 0.025)))], ["B2B invoices", "14"]].map(([l, v]) => (
                <div key={l} className="flex justify-between"><span className="text-muted">{l}</span><span className="font-medium tnum">{v}</span></div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="plain" size="sm" onClick={() => toast("GSTR-1 file downloaded")}><Download size={15} /> GSTR-1</Button>
              <Button variant="plain" size="sm" onClick={() => toast("GSTR-3B summary downloaded")}><Download size={15} /> GSTR-3B</Button>
            </div>
          </Group>

          <Group title="Expenses" flush action={<button onClick={() => setExpense(true)} className="flex items-center gap-1 text-[14px] font-semibold text-jade"><Plus size={15} /> Add</button>}>
            {expenses.map(([n, c, v, d]) => (
              <div key={n} className="flex items-center justify-between border-b border-line/80 px-4 py-2.5 last:border-0 lg:px-5">
                <div className="min-w-0">
                  <div className="truncate text-[14.5px]">{n}</div>
                  <div className="text-[12.5px] text-muted">{c} · {d}</div>
                </div>
                <span className="text-[14px] font-medium tnum">{inr(v)}</span>
              </div>
            ))}
          </Group>
        </div>

        <Group title="Download any report" flush>
          {["Item-wise sales", "Hourly sales", "Staff performance", "Discounts and voids", "Stock usage vs recipe", "Guest list"].map((r) => (
            <button key={r} onClick={() => toast(`${r} · Excel downloaded`)} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
              <FileSpreadsheet size={17} className="text-jade" />
              <span className="flex-1 text-[15px]">{r}</span>
              <span className="text-[13px] text-muted">Excel · PDF</span>
            </button>
          ))}
        </Group>
      </Page>

      <Sheet open={close} onClose={() => setClose(false)} title="Close today" footer={<Button size="lg" className="w-full" onClick={() => { setClose(false); toast("Day closed · summary sent to owner"); }}>Close day</Button>}>
        <div className="space-y-4">
          <Field label="Cash counted in drawer (₹)"><input className={inputCls} inputMode="numeric" defaultValue={18980} /></Field>
          <div className="flex items-baseline justify-between rounded-group bg-saffron-soft px-4 py-3">
            <span className="text-[15px]">Short by</span>
            <span className="text-[22px] font-semibold text-saffron tnum">{inr(20)}</span>
          </div>
          <Field label="Note (optional)"><input className={inputCls} placeholder="e.g. gave change from drawer for parking" /></Field>
        </div>
      </Sheet>
      <Sheet open={expense} onClose={() => setExpense(false)} title="Add expense" footer={<Button size="lg" className="w-full" onClick={() => { setExpense(false); toast("Expense saved"); }}>Save expense</Button>}>
        <div className="space-y-4">
          <Field label="What for"><input className={inputCls} placeholder="Gas cylinder" /></Field>
          <Field label="Amount (₹)"><input className={inputCls} inputMode="numeric" /></Field>
          <button className="w-full rounded-group border-2 border-dashed border-line py-5 text-[14px] font-medium text-muted">Snap the bill</button>
        </div>
      </Sheet>
    </>
  );
}
