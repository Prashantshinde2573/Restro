// After the gateway's checkout closes, or while waiting: has this payment gone through?
// The answer always comes from the gateway itself (and Razorpay's signed callback), never the phone.
import { admin, cors, json } from "../_shared/common.ts";
import { anyCaller, fetchStatus, loadGateway, razorpayCheckoutOk, settle } from "../_shared/gateways.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const user = await anyCaller(req);
    if (!user) return json({ error: "Sign in again" }, 401);
    const b = await req.json();
    const db = admin();
    const { data: intent } = await db.from("pay_intents").select("*").eq("id", String(b?.intentId ?? "")).maybeSingle();
    if (!intent) return json({ error: "Payment not found" }, 404);
    // the guest who started it, or the outlet's team
    if (intent.created_by !== user.id) {
      const { data: ok } = await db.rpc("svc_is_outlet_team", { r: intent.rid, p_outlet: intent.outlet_id, p_uid: user.id });
      if (!ok) return json({ error: "Not allowed" }, 403);
    }
    if (intent.status !== "created") return json({ status: intent.status, note: intent.note ?? undefined });
    const gw = await loadGateway(intent.rid, intent.outlet_id);
    if (!gw || gw.provider !== intent.provider || !intent.provider_order_id) return json({ status: "created" });
    // Razorpay's checkout callback is signed with the secret: a quick, safe "yes"
    const r = b?.razorpay;
    if (gw.provider === "razorpay" && r?.paymentId && r?.signature && r?.orderId === intent.provider_order_id) {
      if (!(await razorpayCheckoutOk(gw, intent.provider_order_id, String(r.paymentId), String(r.signature)))) return json({ error: "Payment could not be verified" }, 400);
    }
    const res = await fetchStatus(gw, intent.provider_order_id, intent.amount_paise);
    if (res.paid) {
      const out = await settle(intent, res);
      return json({ status: out === "paid" || out === "already" ? "paid" : out === "already settled" ? "paid" : "failed", note: out === "already settled" ? "already settled" : undefined });
    }
    return json({ status: res.failed ? "failed" : "created" });
  } catch (e) {
    console.error("pay-status", (e as Error).message);
    return json({ error: "Could not check the payment" }, 500);
  }
});
