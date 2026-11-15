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
  /** YYYY-MM-DD: first day at work. Holidays before it are not paid. */
  joinedOn?: string;
  /** YYYY-MM-DD: last day at work (left the job). Holidays after it are not paid. */
  leftOn?: string;
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
  /** the month isn't over yet: the numbers are "till today" */
  inProgress: boolean;
  /** joined / left during this month (YYYY-MM-DD), for the explanation */
  joinedInMonth?: string;
  leftInMonth?: string;
  /** worked here at all this month (false: joined later or left before it) */
  employed: boolean;
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

  // the days of this month the person worked here: from joining to leaving
  const monthStart = `${month}-01`, monthEnd = `${month}-${String(D).padStart(2, "0")}`;
  const joined = pay?.joinedOn && /^\d{4}-\d{2}-\d{2}$/.test(pay.joinedOn) ? pay.joinedOn : undefined;
  const left = pay?.leftOn && /^\d{4}-\d{2}-\d{2}$/.test(pay.leftOn) ? pay.leftOn : undefined;
  const employed = !(joined && joined > monthEnd) && !(left && left < monthStart);
  const firstDay = joined && joined > monthStart ? Number(joined.slice(8, 10)) : 1;
  const lastEmployed = left && left < monthEnd ? Number(left.slice(8, 10)) : D;

  let paidOffs = 0;
  if (employed && pay?.type === "monthly" && pay.weeklyOff !== undefined && pay.weeklyOff !== null && pay.weeklyOff >= 0) {
    const worked = new Set(ok.map((d) => d.date));
    // only offs that have already come (a month in progress pays for days so far),
    // and only while the person worked here
    const soFar = month === monthOf(today) ? Number(today.slice(8, 10)) : month < monthOf(today) ? D : 0;
    const last = Math.min(soFar, lastEmployed);
    for (let i = firstDay; i <= last; i++) {
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
    inProgress: month === monthOf(today),
    employed,
    ...(joined && joined >= monthStart && joined <= monthEnd ? { joinedInMonth: joined } : {}),
    ...(left && left >= monthStart && left <= monthEnd ? { leftInMonth: left } : {}),
  };
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
/** ₹333.33 when the per-day pay isn't a whole number. */
const rupees2 = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
/** "2026-11-14" → "14 Nov" */
export const shortDate = (date: string) => new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
/** 1.5 → "1½" */
export const daysText = (n: number) => {
  const whole = Math.floor(n + 1e-9);
  const half = n - whole >= 0.5 - 1e-9;
  return `${whole || !half ? whole : ""}${half ? "½" : ""}`;
};
const plural = (n: number, one: string, many: string) => `${daysText(n)} ${n === 1 ? one : many}`;
const PLURAL_DAY = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

/** The salary worked out step by step, in plain words, for the screen, the PDF and WhatsApp. */
export function explainSalary(p: Payslip, pay: StaffPay | undefined): { label: string; value: string; strong?: boolean }[] {
  if (!pay) return [];
  const steps: { label: string; value: string; strong?: boolean }[] = [];
  const holidays = pay.type === "monthly" && pay.weeklyOff !== undefined && pay.weeklyOff !== null && pay.weeklyOff >= 0;
  if (p.joinedInMonth) steps.push({ label: `Joined on ${shortDate(p.joinedInMonth)}${holidays ? ": holidays before that are not paid" : ""}`, value: "" });
  if (p.leftInMonth) steps.push({ label: `Last working day ${shortDate(p.leftInMonth)}${holidays ? ": holidays after that are not paid" : ""}`, value: "" });
  if (pay.type === "monthly") {
    const perDay = pay.amount / p.daysInMonth;
    steps.push({ label: `Per day: ${rupees(pay.amount)} ÷ ${p.daysInMonth} days`, value: rupees2(perDay) });
    const off = pay.weeklyOff !== undefined && pay.weeklyOff !== null && pay.weeklyOff >= 0 ? pay.weeklyOff : null;
    const parts = [plural(p.workedDays, "day worked", "days worked")];
    if (p.paidOffs) parts.push(`${p.paidOffs} ${p.paidOffs === 1 ? WEEKDAYS[off ?? 0] : PLURAL_DAY[off ?? 0]} (holiday)`);
    steps.push({ label: `Days to pay: ${parts.join(" + ")}`, value: plural(p.paidDays, "day", "days") });
    steps.push({ label: `Salary: ${rupees2(perDay)} × ${plural(p.paidDays, "day", "days")}`, value: rupees(p.base) });
  } else {
    steps.push({ label: "Pay per day", value: rupees(pay.amount) });
    steps.push({ label: "Days worked", value: plural(p.workedDays, "day", "days") });
    steps.push({ label: `Salary: ${rupees(pay.amount)} × ${plural(p.workedDays, "day", "days")}`, value: rupees(p.base) });
  }
  if (p.ot) steps.push({ label: `Overtime: ${+p.otHours.toFixed(1)} h × ${rupees(pay.otRate ?? 0)}`, value: `+ ${rupees(p.ot)}` });
  if (p.bonus) steps.push({ label: "Bonus", value: `+ ${rupees(p.bonus)}` });
  if (p.fine) steps.push({ label: "Fine", value: `− ${rupees(p.fine)}` });
  if (p.advance) steps.push({ label: "Advance taken", value: `− ${rupees(p.advance)}` });
  return steps;
}

/** WhatsApp / text payslip. */
export function payslipText(p: Payslip, who: { name: string; title?: string }, restaurant: string, pay?: StaffPay) {
  const r = rupees;
  const lines = [
    `*Salary slip · ${monthLabel(p.month)}*${p.inProgress ? " (till today)" : ""}`,
    `${restaurant}`,
    `${who.name}${who.title ? ` (${who.title})` : ""}`,
    "",
    ...explainSalary(p, pay).map((x) => (x.value ? `${x.label}: ${x.value}` : x.label)),
    "",
    `*Total salary: ${r(p.net)}*`,
    ...(p.paid ? [`Paid: ${r(p.paid)}`] : []),
    ...(p.paid ? [p.due > 0 ? `*Still to pay: ${r(p.due)}*` : p.due < 0 ? `Paid extra: ${r(-p.due)}` : "Fully paid ✅"] : []),
  ];
  return lines.join("\n");
}
