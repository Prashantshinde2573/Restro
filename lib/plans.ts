// The plans Restro sells. Prices in ₹ per outlet per month.
import type { Plan } from "./types";

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 999,
    yearly: 9990,
    blurb: "For a café or a single small outlet.",
    outlets: "1 outlet · 3 staff logins",
    features: ["Billing with UPI QR and GST", "Menu and tables", "Kitchen display", "WhatsApp e-bills", "Daily sales report"],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 2499,
    yearly: 24990,
    blurb: "For a busy restaurant that wants fewer leaks.",
    outlets: "1 outlet · unlimited staff",
    features: ["Everything in Starter", "QR ordering with split-by-guest pay", "Inventory and recipe costing", "Restro Pulse daily briefing", "Review booster", "Staff attendance and payroll"],
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 4999,
    yearly: 49990,
    blurb: "For owners who want the numbers to run themselves.",
    outlets: "Up to 3 outlets",
    features: ["Everything in Growth", "Voice ordering", "Prep forecast", "Leak guard alerts", "Menu engineering", "Swiggy and Zomato orders in one place"],
  },
  {
    id: "chain",
    name: "Chain",
    monthly: null,
    yearly: null,
    blurb: "For brands with many outlets and a central kitchen.",
    outlets: "4+ outlets",
    features: ["Everything in Pro", "Central kitchen and stock transfers", "Brand-wide menu control", "Dedicated onboarding", "Priority support on WhatsApp"],
  },
];
