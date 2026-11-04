// The plans Restropi sells. Prices in ₹ per outlet per month.
import type { Plan } from "./types";

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 699,
    yearly: 6990,
    blurb: "For a café or a single small outlet.",
    outlets: "1 outlet · 3 staff logins",
    features: ["Billing with UPI QR and GST", "Menu and tables", "Kitchen orders (KOT) on phone or tablet", "WhatsApp e-bills", "Daily sales report"],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 1999,
    yearly: 19990,
    blurb: "For a busy restaurant that wants fewer leaks.",
    outlets: "1 outlet · unlimited staff",
    features: ["Everything in Starter", "QR ordering and payment from the table", "Split the bill equally by guest", "Stock and dish costing", "Restropi Pulse daily briefing", "Guest book and feedback", "WhatsApp campaigns", "Discount coupons for guests"],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 2999,
    yearly: 29990,
    blurb: "For owners who want the numbers to run themselves.",
    outlets: "Up to 3 outlets",
    features: ["Everything in Growth", "Voice ordering", "Prep forecast", "Leak guard alerts", "Menu engineering"],
  },
  {
    id: "chain",
    name: "Chain",
    monthly: null,
    yearly: null,
    blurb: "For brands with 4 or more outlets.",
    outlets: "4+ outlets",
    features: ["Everything in Pro", "4 or more outlets in one login", "Dedicated onboarding", "Priority support on WhatsApp"],
  },
];

/** How long a plan is paid for. 6 months = 1 month free, 1 year = 2 months free. */
export type Cycle = "monthly" | "half" | "yearly";
export const CYCLES: { id: Cycle; label: string; short: string; per: string; months: number }[] = [
  { id: "monthly", label: "Monthly", short: "1 month", per: "month", months: 1 },
  { id: "half", label: "6 months · 1 free", short: "6 months · 1 month free", per: "6 months", months: 6 },
  { id: "yearly", label: "Yearly · 2 free", short: "1 year · 2 months free", per: "year", months: 12 },
];
/** Price of a plan for a cycle (per outlet), or null for "let's talk". */
export function cyclePrice(p: Pick<Plan, "monthly" | "yearly">, c: Cycle): number | null {
  if (!p.monthly) return null;
  return c === "monthly" ? p.monthly : c === "half" ? p.monthly * 5 : p.yearly ?? p.monthly * 10;
}

/** GST on Restropi plan payments. 0 until Restropi is GST-registered; set to 0.18 then
 *  (the plan sheet, website prices and help text all follow this). */
export const PLAN_GST_RATE = 0;
