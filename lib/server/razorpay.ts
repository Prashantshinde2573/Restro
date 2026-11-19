// Restropi's own Razorpay account, for owners paying their Restropi plan. Server only: the keys come
// from Vercel environment variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, optional
// RAZORPAY_WEBHOOK_SECRET) and never reach the browser — except the key id, which Razorpay's
// checkout needs and which is public by design.
//
// The phone never decides a plan is paid. The server makes the order (price and coupon worked out
// here), then asks Razorpay for that order's payments, and only a captured payment of the exact
// amount renews the plan (svc_apply_plan_order, once per order).
import { createHmac, timingSafeEqual } from "node:crypto";
import { CYCLES, cyclePrice, plans, PLAN_GST_RATE, type Cycle } from "@/lib/plans";
import { emailReady, log } from "./env";
import { sendPlanUpdate } from "./plans";
import { admin } from "./supabase-admin";

export const rz = {
  keyId: (process.env.RAZORPAY_KEY_ID ?? "").trim(),
  secret: (process.env.RAZORPAY_KEY_SECRET ?? "").trim(),
  webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim(),
};
export const planPayReady = () => !!rz.keyId && !!rz.secret;
export const planPayTest = () => rz.keyId.startsWith("rzp_test_");

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`${rz.keyId}:${rz.secret}`).toString("base64")}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(data.error?.description || `Razorpay said ${res.status}`);
  return data;
}

export type PlanQuote = { plan: string; months: number; list: number; coupon: string | null; off: number; gst: number; amount: number };

/** The price of a plan for a cycle with an optional coupon, worked out on the server. */
export async function quote(planId: string, cycle: string, code?: string | null): Promise<PlanQuote> {
  const p = plans.find((x) => x.id === planId);
  const c = CYCLES.find((x) => x.id === cycle);
  if (!p || !c) throw new Error("Choose a plan and how long");
  const list = cyclePrice(p, c.id as Cycle);
  if (!p.monthly || list == null) throw new Error("This plan is priced by the Restropi team. Please send a request.");
  let off = 0;
  let coupon: string | null = null;
  const want = String(code ?? "").trim().toUpperCase();
  if (want) {
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const { data: k } = await admin().from("plan_coupons").select("*").eq("code", want).maybeSingle();
    const ok =
      k && k.active && (!k.valid_to || k.valid_to >= today) && (k.max_uses == null || k.uses < k.max_uses) &&
      (!(k.plans ?? []).length || (k.plans as string[]).includes(p.id));
    if (!ok) throw new Error("This coupon can't be used (off, expired, used up or not for this plan)");
    off = k.kind === "percent" ? Math.round((list * Math.min(100, Math.max(0, Number(k.value)))) / 100) : Math.min(list, Math.max(0, Number(k.value)));
    coupon = k.code;
  }
  const gst = Math.round((list - off) * PLAN_GST_RATE);
  return { plan: p.id, months: c.months, list, coupon, off, gst, amount: list - off + gst };
}

/** A Razorpay order for this plan payment (amount in rupees). */
export async function createOrder(planOrderId: string, amount: number, notes: Record<string, string>) {
  return api<{ id: string; amount: number; currency: string; status: string }>("/orders", {
    method: "POST",
    body: { amount: Math.round(amount * 100), currency: "INR", receipt: `plan_${planOrderId.slice(0, 30)}`, notes: { kind: "restropi_plan", ...notes } },
  });
}

type RzPayment = { id: string; order_id: string; status: string; amount: number; currency: string };

/**
 * Ask Razorpay whether this plan order was paid; if so, renew the plan (once).
 * Returns the order's state as the app should show it.
 */
export async function settlePlanOrder(planOrderId: string): Promise<{ status: "paid" | "pending" | "failed"; renewsTo?: string; rid?: string; already?: boolean; message?: string }> {
  const db = admin();
  const { data: o } = await db.from("plan_orders").select("*").eq("id", planOrderId).maybeSingle();
  if (!o) return { status: "failed", message: "Payment not found" };
  if (o.status === "paid") return { status: "paid", renewsTo: o.renews_to, rid: o.rid, already: true };
  if (Number(o.amount) === 0) {
    const { data, error } = await db.rpc("svc_apply_plan_order", { p_order: o.id, p_payment: "coupon", p_paid_paise: 0 });
    if (error) return { status: "failed", message: error.message };
    return { status: "paid", renewsTo: (data as { renewsTo: string }).renewsTo, rid: o.rid };
  }
  if (!o.rp_order_id) return { status: "failed", message: "Payment was not started" };
  const { items } = await api<{ items: RzPayment[] }>(`/orders/${o.rp_order_id}/payments`);
  let hit = items.find((x) => x.status === "captured");
  if (!hit) {
    // paid but not captured yet (account set to manual capture): capture it now, for the exact amount
    const auth = items.find((x) => x.status === "authorized" && x.amount === Math.round(Number(o.amount) * 100));
    if (auth) hit = await api<RzPayment>(`/payments/${auth.id}/capture`, { method: "POST", body: { amount: auth.amount, currency: "INR" } });
  }
  if (!hit) {
    const failed = items.length > 0 && items.every((x) => x.status === "failed");
    return { status: failed ? "failed" : "pending", message: failed ? "The payment failed. No money was taken." : undefined };
  }
  if (hit.currency !== "INR") return { status: "failed", message: "Wrong currency" };
  const { data, error } = await db.rpc("svc_apply_plan_order", { p_order: o.id, p_payment: hit.id, p_paid_paise: hit.amount });
  if (error) {
    log("planpay.apply_failed", { order: o.id, reason: error.message.slice(0, 120) });
    return { status: "failed", message: "Paid, but the plan could not be updated. The Restropi team will fix it." };
  }
  const d = data as { renewsTo: string; already?: boolean };
  log("planpay.paid", { order: o.id, rid: o.rid, payment: hit.id });
  return { status: "paid", renewsTo: d.renewsTo, rid: o.rid, already: d.already };
}

/** Razorpay webhook signature (raw body, RAZORPAY_WEBHOOK_SECRET). */
export function webhookOk(raw: string, signature: string) {
  if (!rz.webhookSecret || !signature) return false;
  const want = createHmac("sha256", rz.webhookSecret).update(raw).digest("hex");
  const a = Buffer.from(want), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** After a plan is paid: the owner gets the "plan renewed" email (once per order). */
export async function afterPaid(r: { status: string; rid?: string; already?: boolean }, origin: string) {
  if (r.status !== "paid" || r.already || !r.rid || !emailReady()) return;
  await sendPlanUpdate(r.rid, "renewed", origin).catch(() => {});
}

/** Orders still waiting (a phone closed before it came back): check them with Razorpay. */
export async function settleOpenOrders(origin: string, days = 3) {
  if (!planPayReady()) return { checked: 0, paid: 0 };
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await admin().from("plan_orders").select("id").eq("status", "created").gte("created_at", since).limit(200);
  let paid = 0;
  for (const o of data ?? []) {
    try {
      const r = await settlePlanOrder(o.id);
      if (r.status === "paid" && !r.already) {
        paid++;
        await afterPaid(r, origin);
      }
    } catch {}
  }
  return { checked: data?.length ?? 0, paid };
}
