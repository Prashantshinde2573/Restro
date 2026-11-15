// Staff attendance and salary: the types and the arithmetic (no React, no Supabase),
// so the numbers can be tested on their own. Stores and actions are in lib/payroll.ts.

/** How a person is paid. Kept in its own table (staff_pay), never in `members`. */
export interface StaffPay {
  /** the member's id */
  id: string;
  /** monthly: a fixed amount for the month, cut for days not worked. daily: per day worked. */
  type: "monthly" | "daily";
  /** ₹ per month (monthly) or per day (daily) */
  amount: number;
  /** ₹ per overtime hour (0 / empty = no overtime pay) */
  otRate?: number;
  /** weekday off, paid for monthly staff: 0 = Sunday … 6 = Saturday; empty = none */
  weeklyOff?: number;
  updatedAt?: string;
}

export type AttendanceStatus = "pending" | "approved" | "rejected";
/** One person, one day. id = `${memberId}_${date}`. */
export interface Attendance {
  id: string;
  memberId: string;
  /** YYYY-MM-DD, India date */
  date: string;
  kind: "full" | "half";
  /** extra hours worked that day */
  otHours?: number;
  note?: string;
  status: AttendanceStatus;
  requestedAt: string;
  /** who approved or rejected it, and when */
  decidedBy?: string;
  decidedAt?: string;
  /** added by the owner / manager directly (not asked by the staff member) */
  byManager?: boolean;
  outletId?: string;
}

export type PayEntryType = "advance" | "bonus" | "fine" | "paid";
/** Money lines for a month: advance (उचल), bonus, fine, and salary paid. */
export interface PayEntry {
  id: string;
  memberId: string;
  /** YYYY-MM the line counts in */
  month: string;
  type: PayEntryType;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  note?: string;
  method?: "cash" | "upi" | "bank";
  by?: string;
}

export const PAY_ENTRY_LABEL: Record<PayEntryType, string> = { advance: "Advance", bonus: "Bonus", fine: "Fine", paid: "Salary paid" };

export const attendanceId = (memberId: string, date: string) => `${memberId}_${date}`;

/** Today's date in India, YYYY-MM-DD. */
export const todayIN = (now = Date.now()) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
export const monthOf = (date: string) => date.slice(0, 7);
export const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** "2026-11" → "November 2026" */
export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
};
export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};
/** "2026-11-15" → "Sun, 15 Nov" */
export const dayLabel = (date: string) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const weekday = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const round = (n: number) => Math.round(n);

export interface Payslip {
  month: string;
  daysInMonth: number;
  /** approved full days and half days */
  fullDays: number;
  halfDays: number;
  /** full + half/2 */
  workedDays: number;
  /** weekly offs that count as paid (monthly pay only, days not otherwise worked) */
  paidOffs: number;
  /** days the pay is worked out on */
  paidDays: number;
  otHours: number;
  base: number;
  ot: number;
  bonus: number;
  fine: number;
  advance: number;
  /** base + ot + bonus − fine − advance (never below 0) */
  net: number;
  paid: number;
  /** still to pay (negative = paid more than earned) */
  due: number;
  pending: number;
}

/**
 * Salary for one person for one month.
 *  monthly: amount × paid days ÷ days in the month, where paid days = days worked
 *           (a half day counts ½) + their weekly offs that month, at most the whole month.
 *  daily:   amount × days worked.
 *  overtime: approved overtime hours × overtime rate.
 * Only approved days count; pending ones are shown separately.
 */
export function payslip(month: string, pay: StaffPay | undefined, days: Attendance[], entries: PayEntry[], today = todayIN()): Payslip {
  const mine = days.filter((d) => monthOf(d.date) === month);
  const ok = mine.filter((d) => d.status === "approved");
  const fullDays = ok.filter((d) => d.kind === "full").length;
  const halfDays = ok.filter((d) => d.kind === "half").length;
  const workedDays = fullDays + halfDays / 2;
  const otHours = ok.reduce((s, d) => s + Math.max(0, Number(d.otHours) || 0), 0);
  const D = daysInMonth(month);

  let paidOffs = 0;
  if (pay?.type === "monthly" && pay.weeklyOff !== undefined && pay.weeklyOff !== null && pay.weeklyOff >= 0) {
    const worked = new Set(ok.map((d) => d.date));
    // only offs that have already come (a month in progress pays for days so far)
    const last = month === monthOf(today) ? Number(today.slice(8, 10)) : month < monthOf(today) ? D : 0;
    for (let i = 1; i <= last; i++) {
      const date = `${month}-${String(i).padStart(2, "0")}`;
      if (weekday(date) === pay.weeklyOff && !worked.has(date)) paidOffs++;
    }
  }
  const amount = Math.max(0, Number(pay?.amount) || 0);
  const paidDays = pay?.type === "monthly" ? Math.min(D, workedDays + paidOffs) : workedDays;
  const base = !pay ? 0 : pay.type === "monthly" ? round((amount * paidDays) / D) : round(amount * workedDays);
  const ot = round(otHours * Math.max(0, Number(pay?.otRate) || 0));

  const sum = (t: PayEntryType) => entries.filter((e) => e.month === month && e.type === t).reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);
  const bonus = sum("bonus"), fine = sum("fine"), advance = sum("advance"), paid = sum("paid");
  const net = Math.max(0, base + ot + bonus - fine - advance);
  return {
    month, daysInMonth: D, fullDays, halfDays, workedDays, paidOffs, paidDays, otHours,
    base, ot, bonus, fine, advance, net, paid, due: net - paid,
    pending: mine.filter((d) => d.status === "pending").length,
  };
}

/** WhatsApp / text payslip. */
export function payslipText(p: Payslip, who: { name: string; title?: string }, restaurant: string, pay?: StaffPay) {
  const r = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const days = (n: number) => `${+n.toFixed(1)}`;
  const lines = [
    `*Salary slip · ${monthLabel(p.month)}*`,
    `${restaurant}`,
    `${who.name}${who.title ? ` (${who.title})` : ""}`,
    "",
    `Days worked: ${days(p.workedDays)} (${p.fullDays} full${p.halfDays ? `, ${p.halfDays} half` : ""})`,
    ...(p.paidOffs ? [`Paid weekly offs: ${p.paidOffs}`] : []),
    pay?.type === "daily" ? `Pay: ${r(pay.amount)} × ${days(p.workedDays)} days = ${r(p.base)}` : `Salary for ${days(p.paidDays)} of ${p.daysInMonth} days: ${r(p.base)}`,
    ...(p.ot ? [`Overtime: ${+p.otHours.toFixed(1)} h = ${r(p.ot)}`] : []),
    ...(p.bonus ? [`Bonus: + ${r(p.bonus)}`] : []),
    ...(p.fine ? [`Fine: − ${r(p.fine)}`] : []),
    ...(p.advance ? [`Advance taken: − ${r(p.advance)}`] : []),
    "",
    `*Total salary: ${r(p.net)}*`,
    ...(p.paid ? [`Paid: ${r(p.paid)}`] : []),
    ...(p.paid ? [p.due > 0 ? `*Still to pay: ${r(p.due)}*` : p.due < 0 ? `Paid extra: ${r(-p.due)}` : "Fully paid ✅"] : []),
  ];
  return lines.join("\n");
}
