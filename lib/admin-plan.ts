// Super admin: where a restaurant's plan stands, in one word, so the list, the restaurant sheet and
// the reports all say the same thing. A restaurant on a free trial is never counted as revenue.
import type { AdminRestaurant } from "./cloud";
import { plans } from "./plans";
import { RENEW_WARN_DAYS } from "./access";

const DAY = 86_400_000;
/** India calendar day number, so "days left" changes at midnight IST. */
const day = (t: number) => Math.floor((t + 5.5 * 3600_000) / DAY);
export const daysTo = (iso: string, now = Date.now()) => day(new Date(iso).getTime()) - day(now);

export type PlanState = "trial" | "paying" | "ending" | "grace" | "ended" | "trial_ended" | "paused";
type R = Pick<AdminRestaurant, "status" | "renewsAt" | "graceUntil" | "trialUntil" | "plan">;

export function planState(r: R, now = Date.now()): PlanState {
  if (r.status === "suspended") return "paused";
  const trial = !!r.trialUntil;
  const left = daysTo(r.renewsAt, now);
  const running = new Date(r.renewsAt).getTime() > now;
  if (trial) return running ? "trial" : "trial_ended";
  if (running) return left <= RENEW_WARN_DAYS ? "ending" : "paying";
  if (r.graceUntil && new Date(r.graceUntil).getTime() > now) return "grace";
  return "ended";
}

export const STATE_LABEL: Record<PlanState, string> = {
  trial: "Free trial",
  paying: "Paying",
  ending: "Ending soon",
  grace: "In grace",
  ended: "Plan ended",
  trial_ended: "Trial ended",
  paused: "Paused",
};
export const STATE_TONE: Record<PlanState, "jade" | "saffron" | "rose" | "neutral" | "sky"> = {
  trial: "sky",
  paying: "jade",
  ending: "saffron",
  grace: "saffron",
  ended: "rose",
  trial_ended: "rose",
  paused: "neutral",
};

/** A short line for the pill: "Free trial · 9 days left", "Plan ended 2 days ago"… */
export function stateText(r: R, now = Date.now()): string {
  const s = planState(r, now);
  const n = daysTo(r.renewsAt, now);
  const d = (k: number) => `${k} day${k === 1 ? "" : "s"}`;
  switch (s) {
    case "trial": return n <= 0 ? "Free trial · ends today" : `Free trial · ${d(n)} left`;
    case "paying": return "Paying";
    case "ending": return n <= 0 ? "Ends today" : `Ends in ${d(n)}`;
    case "grace": return `In grace · ${d(Math.max(0, daysTo(r.graceUntil!, now)))} left`;
    case "ended": return n === 0 ? "Plan ended today" : `Plan ended ${d(-n)} ago`;
    case "trial_ended": return n === 0 ? "Trial ended today" : `Trial ended ${d(-n)} ago`;
    default: return "Paused";
  }
}

/** Monthly plan revenue from this restaurant: only a paid plan that is running (never a trial). */
export function monthlyRevenue(r: R, now = Date.now()): number {
  const s = planState(r, now);
  if (s !== "paying" && s !== "ending" && s !== "grace") return 0;
  return plans.find((p) => p.id === r.plan)?.monthly ?? 0;
}
