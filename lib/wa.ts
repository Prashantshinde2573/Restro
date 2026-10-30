import type { Customer } from "./types";

const digits = (p: string) => p.replace(/\D/g, "").slice(-10);
/** Opens WhatsApp to an Indian number, optionally with a message typed in. */
export const waLink = (phone: string, text = "") => `https://wa.me/91${digits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export type GuestSeg = "all" | "regular" | "lapsed" | "optin";
const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
export const guestMatch = (c: Customer, s: GuestSeg) =>
  s === "all" ? true : s === "regular" ? c.visits >= 3 : s === "lapsed" ? daysSince(c.lastVisit) > 30 : c.optIn === true;
