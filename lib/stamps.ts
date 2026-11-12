// Stamp card rules (no screen code). The owner sets the program per outlet in
// Settings → Stamp card; each guest's stamps live on their guest-book record.
import type { Customer, MenuItem, Stamp, StampProgram } from "./types";
import { hasPerm, type Member } from "./access";

export const DEFAULT_PROGRAM: StampProgram = {
  on: false,
  needed: 10,
  reward: "Free coffee",
  rewardKind: "flat",
  rewardValue: 100,
  minBill: 0,
  perDay: 1,
  expiryDays: 0,
  who: "everyone",
  auto: true,
  givers: "charge",
  redeemers: "charge",
};

export const programOf = (p?: StampProgram): StampProgram => ({ ...DEFAULT_PROGRAM, ...p });

/** Stamps that still count (expired ones drop off). Oldest first. */
export function liveStamps(c: Pick<Customer, "stamps"> | undefined, p: StampProgram, now = Date.now()): Stamp[] {
  const all = c?.stamps ?? [];
  if (!p.expiryDays) return all;
  const from = now - p.expiryDays * 86_400_000;
  return all.filter((s) => Date.parse(s.at) >= from);
}

export const rewardReady = (c: Pick<Customer, "stamps"> | undefined, p: StampProgram) => liveStamps(c, p).length >= p.needed;

/** How much the reward takes off this bill (never more than the bill). */
export function rewardOff(p: StampProgram, subtotal: number, menu: Pick<MenuItem, "id" | "price">[]): number {
  const v =
    p.rewardKind === "item"
      ? (menu.find((m) => m.id === p.rewardItemId)?.price ?? 0)
      : p.rewardKind === "flat"
        ? (p.rewardValue ?? 0)
        : Math.min(p.rewardCap || Infinity, Math.round((subtotal * Math.min(100, p.rewardValue ?? 0)) / 100));
  return Math.max(0, Math.min(subtotal, Math.round(v)));
}

/** In words, for screens and messages: "Free coffee" / "₹100 off" / "20% off (up to ₹150)". */
export function rewardText(p: StampProgram, menu: Pick<MenuItem, "id" | "name">[] = []): string {
  if (p.reward.trim()) return p.reward.trim();
  if (p.rewardKind === "item") return `Free ${menu.find((m) => m.id === p.rewardItemId)?.name ?? "dish"}`;
  if (p.rewardKind === "flat") return `₹${p.rewardValue ?? 0} off`;
  return `${p.rewardValue ?? 0}% off${p.rewardCap ? ` (up to ₹${p.rewardCap})` : ""}`;
}

/** Why this bill can't earn a stamp, or null when it can. */
export function stampProblem(p: StampProgram, c: Pick<Customer, "stamps" | "optIn"> | undefined, subtotal: number, now = Date.now()): string | null {
  if (p.who === "optin" && !c?.optIn) return "Only for guests who said yes to offers";
  if (subtotal < p.minBill) return `Bills of ₹${p.minBill} or more earn a stamp`;
  const day = new Date(now).toDateString();
  const today = (c?.stamps ?? []).filter((s) => new Date(s.at).toDateString() === day).length;
  if (p.perDay > 0 && today >= p.perDay) return p.perDay === 1 ? "Already got today's stamp" : `Already got ${p.perDay} stamps today`;
  return null;
}

/** Owner, staff who charge bills, or staff who can give discounts. */
export function mayAct(me: Member | null | undefined, who: StampProgram["givers"]): boolean {
  if (!me?.active) return false;
  if (me.role === "owner") return true;
  if (who === "owner") return false;
  return hasPerm(me, who === "discount" ? "discount" : "charge");
}

export const WHO_LABEL: Record<StampProgram["givers"], string> = {
  charge: "Anyone who charges bills",
  discount: "Only staff who can give discounts",
  owner: "Only the owner",
};
