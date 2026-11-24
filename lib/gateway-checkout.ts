"use client";

// Opens the restaurant's own gateway checkout (Razorpay or Cashfree) on the guest's phone and
// waits for the server to confirm the money. The phone never decides a bill is paid: the server
// asks the gateway (and the signed webhook does the same), then marks the orders.
import { payCreate, payStatus, type PayStart } from "./cloud";

const SDK = {
  razorpay: "https://checkout.razorpay.com/v1/checkout.js",
  cashfree: "https://sdk.cashfree.com/js/v3/cashfree.js",
} as const;

const loaded = new Map<string, Promise<void>>();
function loadScript(src: string) {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<void>((ok, fail) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => {
        loaded.delete(src);
        fail(new Error("Couldn't open the payment page. Check the internet and try again."));
      };
      document.head.appendChild(s);
    });
    loaded.set(src, p);
  }
  return p;
}

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayCtor = new (o: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: unknown) => void) => void };
type CashfreeFn = (o: { mode: "sandbox" | "production" }) => { checkout: (o: { paymentSessionId: string; redirectTarget: "_modal" }) => Promise<{ error?: { message?: string }; paymentDetails?: unknown }> };

export type OnlineResult = { status: "paid" | "cancelled" | "failed" | "pending"; amount: number; intentId?: string; message?: string };

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Ask the server a few times (the gateway can take a few seconds to settle a UPI payment). */
async function confirm(intentId: string, rzp?: { orderId: string; paymentId: string; signature: string }, tries = 8): Promise<"paid" | "failed" | "created"> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await payStatus(intentId, i === 0 ? rzp : undefined);
      if (r.status !== "created") return r.status;
    } catch {
      /* try again */
    }
    await sleep(i < 3 ? 2000 : 4000);
  }
  return "created";
}

/**
 * Pay these orders online. Resolves when the checkout closes:
 *  paid      the server confirmed it with the gateway
 *  pending   the money may still be on its way (the server keeps listening to the gateway)
 *  cancelled the guest closed the checkout
 *  failed    the gateway said no, or it couldn't start
 */
export async function payOnline(
  orderIds: string[],
  info: { name: string; phone?: string; guestName?: string },
  /** called once the payment exists on the gateway: the page saves it, so a reload (or coming back from the UPI app) can still pick it up */
  onStart?: (s: { intentId: string; amount: number }) => void,
): Promise<OnlineResult> {
  let start: PayStart;
  try {
    start = await payCreate(orderIds);
  } catch (e) {
    return { status: "failed", amount: 0, message: (e as Error).message };
  }
  const amount = start.amount;
  if (start.alreadyPaid) return { status: "paid", amount, intentId: start.intentId };
  onStart?.({ intentId: start.intentId, amount });
  try {
    await loadScript(SDK[start.provider]);
  } catch (e) {
    return { status: "failed", amount, intentId: start.intentId, message: (e as Error).message };
  }

  if (start.provider === "razorpay") {
    const Rzp = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
    if (!Rzp) return { status: "failed", amount, intentId: start.intentId, message: "Couldn't open the payment page" };
    const outcome = await new Promise<{ ok?: RazorpayResponse; closed?: boolean; failed?: string }>((done) => {
      const rzp = new Rzp({
        key: start.keyId,
        order_id: start.orderId,
        amount: Math.round(amount * 100),
        currency: "INR",
        name: info.name.slice(0, 60),
        description: "Bill",
        prefill: { ...(info.phone ? { contact: info.phone.replace(/\D/g, "").slice(-10) } : {}), ...(info.guestName ? { name: info.guestName } : {}) },
        theme: { color: "#0e7a5f" },
        retry: { enabled: true },
        handler: (r: RazorpayResponse) => done({ ok: r }),
        modal: { ondismiss: () => done({ closed: true }), confirm_close: true },
      });
      rzp.on("payment.failed", () => {
        /* Razorpay lets the guest retry inside the same window; we only learn the end result */
      });
      rzp.open();
    });
    if (outcome.ok) {
      const s = await confirm(start.intentId, { orderId: outcome.ok.razorpay_order_id, paymentId: outcome.ok.razorpay_payment_id, signature: outcome.ok.razorpay_signature });
      return { status: s === "paid" ? "paid" : s === "failed" ? "failed" : "pending", amount, intentId: start.intentId };
    }
    // closed the window: a UPI payment may still be settling, so ask a few times (the page keeps watching after this)
    const s = await confirm(start.intentId, undefined, 3);
    return { status: s === "paid" ? "paid" : "cancelled", amount, intentId: start.intentId };
  }

  const Cf = (window as unknown as { Cashfree?: CashfreeFn }).Cashfree;
  if (!Cf || !start.sessionId) return { status: "failed", amount, intentId: start.intentId, message: "Couldn't open the payment page" };
  const cf = Cf({ mode: start.mode === "live" ? "production" : "sandbox" });
  const r: { error?: { message?: string }; paymentDetails?: unknown } = await cf.checkout({ paymentSessionId: start.sessionId, redirectTarget: "_modal" }).catch(() => ({ error: { message: "closed" } }));
  const s = await confirm(start.intentId, undefined, r.paymentDetails ? 8 : 3);
  if (s === "paid") return { status: "paid", amount, intentId: start.intentId };
  if (r.paymentDetails) return { status: "pending", amount, intentId: start.intentId };
  return { status: s === "failed" ? "failed" : "cancelled", amount, intentId: start.intentId };
}
