// The gateway tells us a payment happened. Signature checked with the outlet's own secret,
// then the status is fetched from the gateway again before anything is marked paid.
// URL: /functions/v1/pay-webhook?p=razorpay|cashfree&r=<restaurant>&o=<outlet>
import { admin, json } from "../_shared/common.ts";
import { fetchStatus, loadGateway, settle, webhookOk, webhookOrderId } from "../_shared/gateways.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const u = new URL(req.url);
    const provider = u.searchParams.get("p");
    const rid = u.searchParams.get("r") ?? "";
    const outletId = u.searchParams.get("o") ?? "";
    if ((provider !== "razorpay" && provider !== "cashfree") || !rid || !outletId) return json({ error: "Bad webhook URL" }, 400);
    const raw = await req.text();
    if (raw.length > 200_000) return json({ error: "Too large" }, 413);
    const gw = await loadGateway(rid, outletId);
    if (!gw || gw.provider !== provider) return json({ error: "Not set up" }, 404);
    if (!(await webhookOk(gw, raw, req.headers))) return json({ error: "Bad signature" }, 401);
    const orderId = webhookOrderId(provider, JSON.parse(raw));
    if (!orderId) return json({ ok: true, ignored: true });
    const { data: intent } = await admin().from("pay_intents").select("*").eq("provider_order_id", orderId).eq("rid", rid).eq("outlet_id", outletId).maybeSingle();
    if (!intent || intent.status !== "created") return json({ ok: true });
    const res = await fetchStatus(gw, orderId, intent.amount_paise);
    const out = await settle(intent, res);
    return json({ ok: true, status: out });
  } catch (e) {
    console.error("pay-webhook", (e as Error).message);
    return json({ error: "Could not handle" }, 500);
  }
});
