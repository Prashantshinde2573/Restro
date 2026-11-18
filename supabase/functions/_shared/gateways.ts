// The restaurant's own payment gateway (Razorpay or Cashfree): the few calls Restropi needs.
// Every function here runs on the server only. Secrets come from Supabase Vault (svc_gateway_secrets)
// and are never sent to a browser or written to a log.
import { admin } from "./common.ts";

export type Provider = "razorpay" | "cashfree";
export type Gateway = { provider: Provider; mode: "test" | "live"; keyId: string; secret: string; webhook?: string | null; active?: boolean };
export type PayResult = { paid: boolean; paymentId?: string; amountPaise?: number; method?: "upi" | "card"; failed?: boolean };

const enc = new TextEncoder();
const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(text));
}
/** Compare without leaking where they differ. */
export function same(a: string, b: string) {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const methodOf = (m?: string): "upi" | "card" => (m && /card|credit|debit|emi/i.test(m) ? "card" : "upi");
const withTimeout = (ms: number) => AbortSignal.timeout(ms);

/** The signed-in user (staff, owner, or a QR guest's anonymous account), or null. */
export async function anyCaller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error || !data.user ? null : data.user;
}

/** The outlet's gateway with its secrets (server only). */
export async function loadGateway(rid: string, outletId: string): Promise<Gateway | null> {
  const { data, error } = await admin().rpc("svc_gateway_secrets", { r: rid, p_outlet: outletId });
  if (error || !data?.secret) return null;
  return data as Gateway;
}

/* ---------------- Razorpay ---------------- */
const RZP = "https://api.razorpay.com/v1";
const rzpAuth = (g: Gateway) => ({ authorization: `Basic ${btoa(`${g.keyId}:${g.secret}`)}`, "content-type": "application/json" });

/* ---------------- Cashfree ---------------- */
const cfBase = (g: Gateway) => (g.mode === "live" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");
const cfHeaders = (g: Gateway) => ({ "x-client-id": g.keyId, "x-client-secret": g.secret, "x-api-version": "2023-08-01", "content-type": "application/json" });

/** Do these keys work? (a harmless read on the gateway) */
export async function testKeys(g: Gateway): Promise<string | null> {
  try {
    if (g.provider === "razorpay") {
      if (!/^rzp_(test|live)_/.test(g.keyId)) return "The Razorpay Key ID starts with rzp_test_ or rzp_live_";
      if ((g.keyId.startsWith("rzp_live_") ? "live" : "test") !== g.mode) return g.mode === "live" ? "This is a test key. Use the rzp_live_ key for Live." : "This is a live key. Use the rzp_test_ key for Test.";
      const r = await fetch(`${RZP}/orders?count=1`, { headers: rzpAuth(g), signal: withTimeout(10_000) });
      if (r.status === 401) return "Razorpay did not accept these keys";
      return r.ok ? null : `Razorpay answered ${r.status}`;
    }
    const r = await fetch(`${cfBase(g)}/orders/restropi-key-check`, { headers: cfHeaders(g), signal: withTimeout(10_000) });
    if (r.status === 401 || r.status === 403) return `Cashfree did not accept these keys (${g.mode === "live" ? "Live" : "Test"})`;
    return r.status === 404 || r.ok ? null : `Cashfree answered ${r.status}`;
  } catch {
    return "Could not reach the gateway. Try again.";
  }
}

/** Open a payment on the gateway for this amount. */
export async function createPayment(
  g: Gateway,
  intentId: string,
  amountPaise: number,
  info: { rid: string; phone?: string; name: string },
): Promise<{ providerOrderId: string; sessionId?: string }> {
  if (g.provider === "razorpay") {
    const r = await fetch(`${RZP}/orders`, {
      method: "POST",
      headers: rzpAuth(g),
      body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: intentId.slice(0, 40), notes: { restropi_intent: intentId, rid: info.rid } }),
      signal: withTimeout(15_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw new Error("Razorpay could not start the payment");
    return { providerOrderId: j.id };
  }
  const phone = (info.phone ?? "").replace(/\D/g, "").slice(-10);
  const r = await fetch(`${cfBase(g)}/orders`, {
    method: "POST",
    headers: cfHeaders(g),
    body: JSON.stringify({
      order_id: `rp_${intentId.replace(/-/g, "")}`,
      order_amount: amountPaise / 100,
      order_currency: "INR",
      customer_details: { customer_id: `g_${intentId.slice(0, 18).replace(/-/g, "")}`, customer_phone: phone.length === 10 ? phone : "9999999999" },
      order_note: info.name.slice(0, 200),
      order_tags: { restropi_intent: intentId },
    }),
    signal: withTimeout(15_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.payment_session_id) throw new Error("Cashfree could not start the payment");
  return { providerOrderId: j.order_id, sessionId: j.payment_session_id };
}

/** Ask the gateway itself whether this payment went through (never trust the phone). */
export async function fetchStatus(g: Gateway, providerOrderId: string, expectedPaise: number): Promise<PayResult> {
  if (g.provider === "razorpay") {
    const r = await fetch(`${RZP}/orders/${encodeURIComponent(providerOrderId)}/payments`, { headers: rzpAuth(g), signal: withTimeout(15_000) });
    if (!r.ok) return { paid: false };
    const items = ((await r.json()).items ?? []) as { id: string; status: string; amount: number; method: string; order_id: string }[];
    let hit = items.find((p) => p.status === "captured" && p.order_id === providerOrderId);
    if (!hit) {
      // card / some UPI apps: authorised but not captured yet (manual capture accounts) → capture it now
      const auth = items.find((p) => p.status === "authorized" && p.order_id === providerOrderId && p.amount === expectedPaise);
      if (auth) {
        const c = await fetch(`${RZP}/payments/${auth.id}/capture`, { method: "POST", headers: rzpAuth(g), body: JSON.stringify({ amount: auth.amount, currency: "INR" }), signal: withTimeout(15_000) });
        if (c.ok) hit = { ...auth, status: "captured" };
      }
    }
    if (hit) return { paid: true, paymentId: hit.id, amountPaise: hit.amount, method: methodOf(hit.method) };
    return { paid: false, failed: items.length > 0 && items.every((p) => p.status === "failed") };
  }
  const r = await fetch(`${cfBase(g)}/orders/${encodeURIComponent(providerOrderId)}/payments`, { headers: cfHeaders(g), signal: withTimeout(15_000) });
  if (!r.ok) return { paid: false };
  const items = (await r.json()) as { cf_payment_id: string | number; payment_status: string; payment_amount: number; payment_group?: string; order_id: string }[];
  const hit = (Array.isArray(items) ? items : []).find((p) => p.payment_status === "SUCCESS" && (p.order_id ?? providerOrderId) === providerOrderId);
  if (hit) return { paid: true, paymentId: String(hit.cf_payment_id), amountPaise: Math.round(Number(hit.payment_amount) * 100), method: methodOf(hit.payment_group) };
  return { paid: false, failed: Array.isArray(items) && items.length > 0 && items.every((p) => p.payment_status === "FAILED") };
}

/** Razorpay Checkout's success callback: the signature proves Razorpay sent it. */
export async function razorpayCheckoutOk(g: Gateway, orderId: string, paymentId: string, signature: string) {
  return same(toHex(await hmac(g.secret, `${orderId}|${paymentId}`)), signature);
}

/** A webhook really came from the gateway (signed with the outlet's secret). */
export async function webhookOk(g: Gateway, raw: string, headers: Headers): Promise<boolean> {
  if (g.provider === "razorpay") {
    const sig = headers.get("x-razorpay-signature") ?? "";
    if (!g.webhook || !sig) return false;
    return same(toHex(await hmac(g.webhook, raw)), sig);
  }
  const sig = headers.get("x-webhook-signature") ?? "";
  const ts = headers.get("x-webhook-timestamp") ?? "";
  if (!sig || !ts) return false;
  // refuse old replays (5 minutes)
  const t = Number(ts);
  if (Number.isFinite(t) && Math.abs(Date.now() - (t > 1e12 ? t : t * 1000)) > 5 * 60_000) return false;
  return same(toB64(await hmac(g.secret, ts + raw)), sig);
}

/** The gateway's order id in a webhook. */
export function webhookOrderId(provider: Provider, body: Record<string, unknown>): string | null {
  // deno-lint-ignore no-explicit-any
  const b = body as any;
  if (provider === "razorpay") return b?.payload?.payment?.entity?.order_id ?? b?.payload?.order?.entity?.id ?? null;
  return b?.data?.order?.order_id ?? null;
}

/** Mark the intent paid once the gateway confirmed it (exact amount, once per payment). */
export async function settle(intent: { id: string; amount_paise: number }, res: PayResult) {
  if (!res.paid || !res.paymentId || res.amountPaise == null) return "pending";
  const { data, error } = await admin().rpc("svc_gateway_paid", { p_intent: intent.id, p_payment_id: res.paymentId, p_method: res.method ?? "upi", p_amount_paise: res.amountPaise });
  if (error) throw new Error("Could not record the payment");
  return String(data);
}
