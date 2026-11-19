"use client";

// Owner pays the Restropi plan online (Restropi's Razorpay). The server makes the order and is the
// only one that decides it was paid; this file opens Razorpay's checkout and asks the server after.
import { getCloud, sb } from "./cloud";

export type PlanPayConfig = { online: boolean; test: boolean; webhook: boolean };
let config: Promise<PlanPayConfig> | null = null;
export function planPayConfig(): Promise<PlanPayConfig> {
  config ??= fetch("/api/plan-pay", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { online: false, test: false, webhook: false }))
    .catch(() => {
      config = null;
      return { online: false, test: false, webhook: false };
    });
  return config;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = (await sb().auth.getSession()).data.session?.access_token;
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
  return d;
}

type Start = {
  id: string; keyId: string; rpOrderId: string; amount: number; name: string;
  prefill: { name: string; email: string; contact: string };
  free?: boolean; status?: string; renewsTo?: string; message?: string;
};
export type PlanPayResult = { status: "paid" | "pending" | "failed" | "cancelled"; renewsTo?: string; message?: string; id?: string };

const check = (id: string) => post<PlanPayResult>("/api/plan-pay/check", { id });

function loadCheckout() {
  return new Promise<void>((ok, fail) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return ok();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => fail(new Error("Couldn't open the payment page. Check the internet and try again."));
    document.head.appendChild(s);
  });
}
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Pay for a plan: opens Razorpay, then waits for the server to confirm with Razorpay. */
export async function payPlan(o: { plan: string; cycle: string; coupon?: string | null; description: string }): Promise<PlanPayResult> {
  const rid = getCloud().rid;
  if (!rid) throw new Error("Sign in again and retry.");
  const s = await post<Start>("/api/plan-pay/start", { rid, plan: o.plan, cycle: o.cycle, coupon: o.coupon ?? null });
  if (s.free) return { status: s.status === "paid" ? "paid" : "failed", renewsTo: s.renewsTo, message: s.message };
  await loadCheckout();
  const done = await new Promise<"done" | "cancelled">((resolve) => {
    const Rz = (window as unknown as { Razorpay: new (x: Record<string, unknown>) => { open: () => void; on: (e: string, f: () => void) => void } }).Razorpay;
    const rzp = new Rz({
      key: s.keyId,
      order_id: s.rpOrderId,
      amount: Math.round(s.amount * 100),
      currency: "INR",
      name: "Restropi",
      description: o.description,
      prefill: s.prefill,
      notes: { restaurant: s.name },
      theme: { color: "#1F6B52" },
      handler: () => resolve("done"),
      modal: { ondismiss: () => resolve("cancelled"), confirm_close: true },
    });
    rzp.on("payment.failed", () => {}); // Razorpay shows the reason and lets them try again
    rzp.open();
  });
  // ask the server (which asks Razorpay); a few tries while the bank confirms
  for (let i = 0; i < (done === "done" ? 8 : 1); i++) {
    const r = await check(s.id).catch(() => ({ status: "pending" as const }));
    if (r.status === "paid") return { ...r, id: s.id };
    if (r.status === "failed" && done === "done") return { ...r, id: s.id };
    if (done === "cancelled") break;
    await sleep(2500);
  }
  return done === "cancelled" ? { status: "cancelled", id: s.id } : { status: "pending", id: s.id, message: "We're waiting for the bank. Your plan updates by itself as soon as it's confirmed." };
}
