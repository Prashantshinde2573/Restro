// Salary slip as a print-ready page (the browser's print box saves it as PDF).
import { inr } from "@/lib/format";
import { dayLabel, explainSalary, monthLabel, PAY_ENTRY_LABEL, type Attendance, type PayEntry, type Payslip, type StaffPay } from "@/lib/payroll-math";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function openPayslipPdf(args: {
  slip: Payslip;
  pay?: StaffPay;
  who: { name: string; title?: string; phone?: string };
  restaurant: string;
  outlet?: string;
  days: Attendance[];
  entries: PayEntry[];
}): boolean {
  const { slip: p, pay, who, restaurant, outlet, days, entries } = args;
  const w = window.open("", "_blank");
  if (!w) return false;
  const money = (n: number) => esc(inr(Math.round(n)));
  const d1 = (n: number) => esc(+n.toFixed(1));
  const row = (label: string, value: string, cls = "") => `<tr class="${cls}"><td>${esc(label)}</td><td class="n">${value}</td></tr>`;
  const earn = explainSalary(p, pay).map((x) => row(x.label, esc(x.value))).join("");
  const dayRows = days
    .filter((d) => d.status === "approved" && d.date.startsWith(p.month))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => `<tr><td>${esc(dayLabel(d.date))}</td><td>${d.kind === "half" ? "Half day" : "Full day"}</td><td class="n">${d.otHours ? `${d1(d.otHours)} h` : ""}</td></tr>`)
    .join("");
  const lines = entries
    .filter((e) => e.month === p.month)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => `<tr><td>${esc(dayLabel(e.date))}</td><td>${esc(PAY_ENTRY_LABEL[e.type])}${e.method ? ` · ${esc(e.method.toUpperCase())}` : ""}${e.note ? ` · ${esc(e.note)}` : ""}</td><td class="n">${money(e.amount)}</td></tr>`)
    .join("");
  const logo = `${window.location.origin}/brand/restropi-logo-dark.png`;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary slip · ${esc(who.name)} · ${esc(monthLabel(p.month))}</title><style>
    @page{size:A4;margin:14mm 12mm 16mm}
    *{box-sizing:border-box}
    body{font-family:"Segoe UI",system-ui,-apple-system,Roboto,sans-serif;color:#17201c;margin:0;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .wrap{max-width:680px;margin:0 auto;padding:28px 24px}
    header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;border-bottom:3px solid #0f7a55}
    header h1{font-size:22px;margin:0}
    header .sub{color:#5d6863;margin-top:4px}
    header img{height:22px;display:block;margin:0 0 6px auto}
    .meta{text-align:right;color:#5d6863;font-size:11.5px}
    .who{display:flex;justify-content:space-between;gap:12px;margin:18px 0 6px;background:#f4f6f5;border-radius:12px;padding:12px 14px}
    .who b{font-size:16px}.who span{color:#5d6863}
    .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
    .kpis div{background:#f4f6f5;border-radius:12px;padding:10px 12px}
    .kpis span{display:block;color:#5d6863;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
    .kpis b{display:block;font-size:18px;margin-top:3px;font-variant-numeric:tabular-nums}
    h2{font-size:12px;margin:20px 0 6px;color:#0b5e41;text-transform:uppercase;letter-spacing:.06em}
    table{width:100%;border-collapse:collapse}
    td{padding:7px 8px;border-bottom:1px solid #edf0ee}
    .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    tr.total td{border-top:1.5px solid #17201c;border-bottom:0;font-weight:700;font-size:15px}
    tr.due td{font-weight:700;color:#0b5e41}
    .sign{display:flex;justify-content:space-between;margin-top:48px;color:#5d6863;font-size:12px}
    .sign div{border-top:1px solid #cfd6d2;padding-top:6px;width:42%}
    footer{margin-top:28px;padding-top:10px;border-top:1px solid #e3e7e5;color:#8b938f;font-size:10.5px;display:flex;justify-content:space-between}
    @media print{.wrap{padding:0}}
  </style></head><body><div class="wrap">
    <header>
      <div><h1>${esc(restaurant || "Salary slip")}</h1><div class="sub">${outlet ? `${esc(outlet)} · ` : ""}Salary slip · ${esc(monthLabel(p.month))}${p.inProgress ? " (till today)" : ""}</div></div>
      <div class="meta"><img src="${logo}" alt="Restropi">Made ${esc(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</div>
    </header>
    <div class="who"><div><b>${esc(who.name)}</b><br><span>${esc(who.title ?? "")}</span></div><div style="text-align:right"><span>${esc(who.phone ?? "")}</span></div></div>
    <div class="kpis">
      <div><span>Days worked</span><b>${d1(p.workedDays)}</b></div>
      <div><span>Overtime</span><b>${d1(p.otHours)} h</b></div>
      <div><span>Total salary</span><b>${money(p.net)}</b></div>
    </div>
    <h2>Salary</h2>
    <table>${earn}${row("Total salary", money(p.net), "total")}${p.paid ? row("Paid", money(p.paid)) + row(p.due > 0 ? "Still to pay" : p.due < 0 ? "Paid extra" : "Fully paid", money(Math.abs(p.due)), "due") : ""}</table>
    <h2>Days (${p.fullDays} full${p.halfDays ? `, ${p.halfDays} half` : ""}${p.paidOffs ? `, ${p.paidOffs} paid holiday${p.paidOffs === 1 ? "" : "s"}` : ""})</h2>
    <table>${dayRows || '<tr><td colspan="3" style="color:#8b938f">No approved days this month.</td></tr>'}</table>
    ${lines ? `<h2>Advance, bonus, fine and payments</h2><table>${lines}</table>` : ""}
    <div class="sign"><div>Employee signature</div><div style="text-align:right">For ${esc(restaurant)}</div></div>
    <footer><span>${esc(restaurant)}</span><span>Made with Restropi</span></footer>
    <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
  </div></body></html>`);
  w.document.close();
  return true;
}
