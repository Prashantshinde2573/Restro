"use client";

// Closing a bill, from any screen (Tables, New order, Orders, the guest's phone).
//
// The owner, or a member the owner ticked "Confirm payments" for, closes a bill
// straight away. Anyone else's "paid" waits for their OK: the table stays busy and
// the bill shows under "Payments to confirm" until someone confirms it.
import { billOf, getOrders, orderActions, stampsForGuestPayment } from "./live";
import { getTable, tableActions } from "./tables";
import type { Order, Payment } from "./types";
import { gstRate } from "./format";

/** Unpaid orders of one party at a table. */
export const partyOpenOrders = (tableId: string, partyId: string) =>
  getOrders().filter((o) => o.tableId === tableId && (o.partyId ?? "A") === partyId && o.status !== "paid" && o.status !== "cancelled");

export function closeBill(opts: {
  ids: string[];
  payments: Payment[];
  by: string;
  tableId?: string;
  partyId?: string;
  discount?: number;
  coupon?: string;
}): "paid" | "waiting" {
  const r = opts.ids.length ? orderActions.settle(opts.ids, opts.payments, opts.by, { discount: opts.discount, coupon: opts.coupon }) : "paid";
  if (opts.tableId && opts.partyId) {
    if (r === "paid") tableActions.close(opts.tableId, opts.partyId, "bill paid");
    else tableActions.update(opts.tableId, opts.partyId, { status: "billing", paymentPending: true });
  }
  return r;
}

/** Free the party when none of its orders is left unpaid. */
function freeIfSettled(o: Order | undefined) {
  if (!o?.tableId) return;
  const pid = o.partyId ?? "A";
  const t = getTable(o.tableId);
  if (!t?.parties.some((p) => p.id === pid)) return;
  if (partyOpenOrders(o.tableId, pid).length === 0) tableActions.close(o.tableId, pid, "payment confirmed");
}

export function confirmPayment(claimId: string) {
  const claim = getOrders().find((o) => o.payClaim?.id === claimId)?.payClaim;
  const list = orderActions.confirm(claimId);
  if (claim && list.length) stampsForGuestPayment(list, claim); // QR payments get their stamp (or use the reward) too
  freeIfSettled(list[0]);
  return list;
}

export function rejectPayment(claimId: string) {
  const list = orderActions.rejectClaim(claimId);
  const o = list[0];
  if (o?.tableId) {
    const t = getTable(o.tableId);
    const pid = o.partyId ?? "A";
    if (t?.parties.some((p) => p.id === pid)) tableActions.update(o.tableId, pid, { paymentPending: false, status: "billing" });
  }
  return list;
}

/** Owner only, after the password: a bill paid by mistake opens again (and its table, if it had one). */
export function markUnpaid(ids: string[]) {
  const list = orderActions.unpay(ids);
  const o = list[0];
  if (!o?.tableId) return list;
  const t = getTable(o.tableId);
  if (!t) return list;
  const pid = o.partyId ?? "A";
  const sub = list.reduce((s, x) => s + x.lines.reduce((a, l) => a + l.qty * l.price, 0), 0);
  const party = t.parties.find((p) => p.id === pid);
  if (party) {
    tableActions.update(t.id, pid, { status: "billing", total: (party.total ?? 0) + sub, paymentPending: false });
  } else {
    const p = tableActions.seat(t.id, 1, { status: "billing", total: sub, server: o.staff });
    if (p.id !== pid) orderActions.moveParty(t.id, pid, { tableId: t.id, tableName: t.name, partyId: p.id });
  }
  return list;
}

/**
 * For the "Money received" check: what the bill comes to, and what the claim says was paid.
 * A guest's phone sends the amount, discount and reward of its own claim, so staff compare
 * them with the bill before they confirm.
 */
export function claimSummary(claimId: string) {
  const list = getOrders().filter((o) => o.payClaim?.id === claimId && o.status !== "paid" && o.status !== "cancelled");
  const claim = list[0]?.payClaim;
  if (!claim) return null;
  const bill = list.reduce((s, o) => s + billOf(o), 0);
  const paid = claim.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const discount = Math.max(0, Number(claim.discount) || 0);
  // the same sum as the checkout: discount off the items, then GST, rounded to the rupee
  const subtotal = list.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty * l.price, 0), 0);
  const taxable = Math.max(0, subtotal - discount);
  const due = Math.round(taxable + Math.round(taxable * gstRate() * 100) / 100);
  const short = Math.round(due - paid);
  return { bill, paid, discount, reward: claim.reward?.name, coupon: claim.coupon, short: short > 1 ? short : 0, guest: claim.source === "guest" };
}
