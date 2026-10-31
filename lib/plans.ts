// The plans Restropi sells. Prices in ₹ per outlet per month.
import type { Plan } from "./types";

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 999,
    yearly: 9990,
    blurb: "For a café or a single small outlet.",
    outlets: "1 outlet · 3 staff logins",
    features: ["Billing with UPI QR and GST", "Menu and tables", "Kitchen orders (KOT) on phone or tablet", "WhatsApp e-bills", "Daily sales report"],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 2499,
    yearly: 24990,
    blurb: "For a busy restaurant that wants fewer leaks.",
    outlets: "1 outlet · unlimited staff",
    features: ["Everything in Starter", "QR ordering with split-by-guest pay", "Stock and dish costing", "Restropi Pulse daily briefing", "Guest book and feedback", "WhatsApp campaigns", "Discount coupons for guests"],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 4999,
    yearly: 49990,
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
