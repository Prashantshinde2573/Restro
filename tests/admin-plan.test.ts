import { describe, expect, it } from "vitest";
import { monthlyRevenue, planState, stateText } from "@/lib/admin-plan";

const NOW = new Date("2026-11-19T04:00:00Z").getTime(); // 9:30 am IST
const base = { status: "active" as const, graceUntil: null, trialUntil: null, plan: "pro" as const };
const at = (days: number) => new Date(NOW + days * 864e5).toISOString();

describe("plan state for the super admin", () => {
  it("a free trial is shown as such and never counted as revenue", () => {
    const r = { ...base, renewsAt: at(9), trialUntil: at(9) };
    expect(planState(r, NOW)).toBe("trial");
    expect(stateText(r, NOW)).toBe("Free trial · 9 days left");
    expect(monthlyRevenue(r, NOW)).toBe(0);
    expect(planState({ ...r, renewsAt: at(-2), trialUntil: at(-2) }, NOW)).toBe("trial_ended");
  });
  it("paying, ending soon, grace, ended, paused", () => {
    expect(planState({ ...base, renewsAt: at(40) }, NOW)).toBe("paying");
    expect(monthlyRevenue({ ...base, renewsAt: at(40) }, NOW)).toBe(2999);
    expect(planState({ ...base, renewsAt: at(5) }, NOW)).toBe("ending");
    expect(planState({ ...base, renewsAt: at(-1), graceUntil: at(3) }, NOW)).toBe("grace");
    expect(planState({ ...base, renewsAt: at(-2) }, NOW)).toBe("ended");
    expect(monthlyRevenue({ ...base, renewsAt: at(-2) }, NOW)).toBe(0);
    expect(planState({ ...base, status: "suspended" as const, renewsAt: at(40) }, NOW)).toBe("paused");
    expect(monthlyRevenue({ ...base, plan: "chain" as const, renewsAt: at(40) }, NOW)).toBe(0);
  });
});
