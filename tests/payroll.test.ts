import { describe, expect, it } from "vitest";
import { daysInMonth, payslip, payslipText, shiftMonth, type Attendance, type PayEntry, type StaffPay } from "@/lib/payroll-math";

const day = (date: string, kind: "full" | "half" = "full", status: Attendance["status"] = "approved", otHours?: number): Attendance => ({
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
});
