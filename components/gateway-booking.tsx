"use client";

// A bill paid on the restaurant's own gateway is closed by the server. The guest's book-keeping
// (the visit on their guest record, the stamp card, the coupon's use count) lives in stores only
// the team can write, so one staff device does it. The server hands each paid bill to exactly
// one device (claim_gateway_booking), so nothing is counted twice.
import { useEffect, useRef, useState } from "react";
import { claimGatewayBooking, useCloud } from "@/lib/cloud";
import { couponActions, getCoupons, guestActions, logActivity, normCode, paymentsText, stampsForGuestPayment, useOrders } from "@/lib/live";
import type { Order, PayClaim, Payment } from "@/lib/types";

const DAY = 24 * 3600_000;

function book(list: Order[], bill: Record<string, unknown>) {
  const first = list[0];
  const payments: Payment[] = list.flatMap((o) => (o.status === "paid" ? o.payments ?? [] : o.prepaid ?? []));
  const amount = Number(bill.total) || payments.reduce((s, p) => s + p.amount, 0);
  const reward = Number(bill.reward) || 0;
  const couponOff = Number(bill.couponOff) || 0;
  const code = typeof bill.coupon === "string" ? bill.coupon : undefined;
  if (first.guestPhone) guestActions.addBill(first.guestPhone, { orderNo: first.number, amount, method: `Online · ${paymentsText(payments)}` }, first.outletId);
  const claim: PayClaim = {
    id: `gw${first.gateway!.intent.slice(0, 8)}`,
    payments,
    by: "Online",
    at: new Date().toISOString(),
    source: "guest",
    ...(reward + couponOff > 0 ? { discount: reward + couponOff } : {}),
    ...(code ? { coupon: code } : {}),
    ...(reward > 0 ? { reward: { name: String(bill.rewardName ?? "Stamp card reward"), amount: reward } } : {}),
  };
  stampsForGuestPayment(list, claim);
  if (code) {
    const c = getCoupons().find((x) => x.code === normCode(code));
    if (c) couponActions.used(c.id, first.guestPhone);
  }
  logActivity("payment", `Paid online · #${first.number} · ₹${amount.toLocaleString("en-IN")} · ${first.gateway!.provider === "razorpay" ? "Razorpay" : "Cashfree"} ${first.gateway!.paymentId}`, first.outletId);
}

export function GatewayBooking() {
  const cloud = useCloud();
  const orders = useOrders();
  const tried = useRef(new Set<string>());
  // give the guest book and coupons a moment to load after opening the app
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 6000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!ready || cloud.status !== "ready" || !cloud.role || cloud.role === "guest") return;
    const since = Date.now() - DAY;
    const byIntent = new Map<string, Order[]>();
    for (const o of orders) {
      if (!o.gateway || o.status === "cancelled" || new Date(o.createdAt).getTime() < since) continue;
      byIntent.set(o.gateway.intent, [...(byIntent.get(o.gateway.intent) ?? []), o]);
    }
    for (const [intent, list] of byIntent) {
      if (tried.current.has(intent)) continue;
      tried.current.add(intent);
      claimGatewayBooking(intent)
        .then((r) => {
          if (r) book(list, r.bill);
        })
        .catch(() => {});
    }
  }, [orders, ready, cloud.status, cloud.role]);
  return null;
}
