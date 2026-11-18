import { describe, expect, it } from "vitest";
import { daysInMonth, daysText, explainSalary, payslip, payslipText, shiftMonth, type Attendance, type PayEntry, type StaffPay } from "@/lib/payroll-math";

const day = (date: string, kind: Attendance["kind"] = "full", status: Attendance["status"] = "approved", otHours?: number): Attendance => ({
  id: `m1_${date}`, memberId: "m1", date, kind, status, requestedAt: date, ...(otHours ? { otHours } : {}),
});
const entry = (type: PayEntry["type"], amount: number, month = "2026-11"): PayEntry => ({ id: `${type}${amount}`, memberId: "m1", month, type, amount, date: `${month}-10` });
// a past month, so nothing depends on today's date
const NOV = "2026-11";
const AFTER = "2026-12-05";

describe("payroll math", () => {
  it("knows the length of months", () => {
    expect(daysInMonth("2026-11")).toBe(30);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("monthly: a full month worked is the full salary", () => {
    const pay: StaffPay = { id: "m1", type: "monthly", amount: 12000 };
    const days = Array.from({ length: 30 }, (_, i) => day(`2026-11-${String(i + 1).padStart(2, "0")}`));
    const p = payslip(NOV, pay, days, [], AFTER);
    expect(p.workedDays).toBe(30);
    expect(p.base).toBe(12000);
    expect(p.net).toBe(12000);
  });

  it("monthly: pays for days worked, half days count half, weekly offs are paid", () => {
    // 20 full + 2 half = 21 days; Sundays in Nov 2026: 1, 8, 15, 22, 29 = 5 offs
    const pay: StaffPay = { id: "m1", type: "monthly", amount: 15000, weeklyOff: 0 };
    const days = [
      ...["02", "03", "04", "05", "06", "07", "09", "10", "11", "12", "13", "14", "16", "17", "18", "19", "20", "21", "23", "24"].map((d) => day(`2026-11-${d}`)),
      day("2026-11-25", "half"),
      day("2026-11-26", "half"),
    ];
    const p = payslip(NOV, pay, days, [], AFTER);
    expect(p.fullDays).toBe(20);
    expect(p.halfDays).toBe(2);
    expect(p.workedDays).toBe(21);
    expect(p.paidOffs).toBe(5);
    expect(p.paidDays).toBe(26);
    expect(p.base).toBe(13000); // 15000 × 26 / 30
  });

  it("a worked weekly off is not paid twice, and paid days never pass the month", () => {
    const pay: StaffPay = { id: "m1", type: "monthly", amount: 3000, weeklyOff: 0 };
    const days = Array.from({ length: 30 }, (_, i) => day(`2026-11-${String(i + 1).padStart(2, "0")}`));
    const p = payslip(NOV, pay, days, [], AFTER);
    expect(p.paidOffs).toBe(0);
    expect(p.paidDays).toBe(30);
    expect(p.base).toBe(3000);
  });

  it("in the current month only weekly offs so far are paid", () => {
    const pay: StaffPay = { id: "m1", type: "monthly", amount: 3000, weeklyOff: 0 };
    const p = payslip(NOV, pay, [], [], "2026-11-15"); // Sundays so far: 1, 8, 15
    expect(p.paidOffs).toBe(3);
  });

  it("daily pay, overtime, bonus, fine, advance and paid", () => {
    const pay: StaffPay = { id: "m1", type: "daily", amount: 500, otRate: 60 };
    const days = [day("2026-11-02", "full", "approved", 2), day("2026-11-03", "half"), day("2026-11-04", "full", "pending", 3), day("2026-11-05", "full", "rejected")];
    const p = payslip(NOV, pay, days, [entry("bonus", 300), entry("fine", 100), entry("advance", 200), entry("paid", 500), entry("bonus", 999, "2026-10")], AFTER);
    expect(p.workedDays).toBe(1.5);
    expect(p.base).toBe(750);
    expect(p.otHours).toBe(2); // the pending day's overtime doesn't count
    expect(p.ot).toBe(120);
    expect(p.pending).toBe(1);
    expect(p.net).toBe(750 + 120 + 300 - 100 - 200);
    expect(p.paid).toBe(500);
    expect(p.due).toBe(870 - 500);
  });

  it("no pay set: nothing to pay, but days still counted", () => {
    const p = payslip(NOV, undefined, [day("2026-11-02")], [], AFTER);
    expect(p.workedDays).toBe(1);
    expect(p.net).toBe(0);
  });

  it("salary never goes below zero", () => {
    const pay: StaffPay = { id: "m1", type: "daily", amount: 100 };
    const p = payslip(NOV, pay, [day("2026-11-02")], [entry("advance", 5000)], AFTER);
    expect(p.net).toBe(0);
  });

  it("writes a WhatsApp slip", () => {
    const pay: StaffPay = { id: "m1", type: "daily", amount: 500, otRate: 60 };
    const p = payslip(NOV, pay, [day("2026-11-02", "full", "approved", 1)], [entry("paid", 560)], AFTER);
    const t = payslipText(p, { name: "Ravi", title: "Captain" }, "Cafe A", pay);
    expect(t).toContain("November 2026");
    expect(t).toContain("Ravi (Captain)");
    expect(t).toContain("Total salary: ₹560");
    expect(t).toContain("Fully paid");
  });

  it("explains ₹10,000 with 1 day worked and Sunday holidays (mid-month) in plain steps", () => {
    const pay: StaffPay = { id: "m1", type: "monthly", amount: 10000, weeklyOff: 0 };
    const p = payslip(NOV, pay, [day("2026-11-10")], [], "2026-11-15");
    expect(p.base).toBe(1333);
    expect(p.inProgress).toBe(true);
    const steps = explainSalary(p, pay).map((x) => `${x.label} = ${x.value}`);
    expect(steps).toEqual([
      "Per day: ₹10,000 ÷ 30 days = ₹333.33",
      "Days to pay: 1 day worked + 3 Sundays (holiday) = 4 days",
      "Salary: ₹333.33 × 4 days = ₹1,333",
    ]);
  });

  it("writes half days as ½", () => {
    expect(daysText(1.5)).toBe("1½");
    expect(daysText(0.5)).toBe("½");
    expect(daysText(3)).toBe("3");
  });

  it("doesn't pay holidays before joining or after leaving", () => {
    // joined Sat 14 Nov: only Sunday 15 is a paid holiday so far
    const pay: StaffPay = { id: "m1", type: "monthly", amount: 10000, weeklyOff: 0, joinedOn: "2026-11-14" };
    const p = payslip(NOV, pay, [day("2026-11-14")], [], "2026-11-15");
    expect(p.paidOffs).toBe(1);
    expect(p.paidDays).toBe(2);
    expect(p.base).toBe(667);
    expect(explainSalary(p, pay)[0].label).toBe("Joined on 14 Nov: holidays before that are not paid");
    // left on 10 Nov: Sundays 1 and 8 only
    const left: StaffPay = { id: "m1", type: "monthly", amount: 3000, weeklyOff: 0, leftOn: "2026-11-10" };
    expect(payslip(NOV, left, [], [], AFTER).paidOffs).toBe(2);
    // joined next month / left last month: nothing
    expect(payslip(NOV, { ...pay, joinedOn: "2026-12-01" }, [], [], AFTER).employed).toBe(false);
    expect(payslip(NOV, { ...pay, joinedOn: undefined, leftOn: "2026-10-31" }, [], [], AFTER).paidOffs).toBe(0);
  });
});

describe("paid leave", () => {
  it("monthly: leave up to the paid leaves a month is paid, more is not", () => {
    const pay: StaffPay = { id: "m1", type: "monthly", amount: 30000, paidLeaves: 2 };
    const days = [
      ...Array.from({ length: 25 }, (_, i) => day(`2026-11-${String(i + 1).padStart(2, "0")}`)),
      day("2026-11-26", "leave"), day("2026-11-27", "leave"), day("2026-11-28", "leave"),
    ];
    const p = payslip(NOV, pay, days, [], AFTER);
    expect(p.leaveDays).toBe(3);
    expect(p.paidLeave).toBe(2);
    expect(p.unpaidLeave).toBe(1);
    expect(p.paidDays).toBe(27);
    expect(p.base).toBe(27000);
    expect(explainSalary(p, pay).some((s) => /without pay/.test(s.label))).toBe(true);
  });
  it("daily: paid leave days are paid at the day rate; no paid leave set = unpaid", () => {
    const days = [day("2026-11-02"), day("2026-11-03", "leave")];
    expect(payslip(NOV, { id: "m1", type: "daily", amount: 500, paidLeaves: 1 }, days, [], AFTER).base).toBe(1000);
    expect(payslip(NOV, { id: "m1", type: "daily", amount: 500 }, days, [], AFTER).base).toBe(500);
  });
  it("a pending leave is not counted", () => {
    const p = payslip(NOV, { id: "m1", type: "daily", amount: 500, paidLeaves: 2 }, [day("2026-11-03", "leave", "pending")], [], AFTER);
    expect(p.leaveDays).toBe(0);
    expect(p.pending).toBe(1);
  });
});
