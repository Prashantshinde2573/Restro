// A QR guest pays their bill online. The amount comes from the server (svc_bill_for), never
// from the phone; the payment opens on the outlet's own gateway.
import { admin, cors, json } from "../_shared/common.ts";
import { anyCaller, createPayment, loadGateway } from "../_shared/gateways.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const user = await anyCaller(req);
    if (!user) return json({ error: "Open the menu again" }, 401);
    const b = await req.json();
    const rid = String(b?.rid ?? "");
    const ids = Array.isArray(b?.orderIds) ? (b.orderIds as unknown[]).map(String).slice(0, 30) : [];
    if (!rid || !ids.length) return json({ error: "Nothing to pay" }, 400);
    const db = admin();
    // a guest pays only their own orders (staff use the counter)
    if (!user.is_anonymous) return json({ error: "Online payment is for guests' phones" }, 403);
    const { data: bill, error: bErr } = await db.rpc("svc_bill_for", { r: rid, ids, caller: user.id });
    if (bErr || !bill) return json({ error: bErr?.message?.includes("settled") ? "This bill is already settled" : "Could not open this bill" }, 400);
    const total = Number(bill.total);
    if (!(total > 0)) return json({ error: "Nothing to pay" }, 400);
    const gw = await loadGateway(rid, bill.outletId);
    if (!gw || !gw.active) return json({ error: "Online payment is off here", off: true }, 400);
    const amountPaise = Math.round(total * 100);

    // same bill, same amount, opened a moment ago: reuse it (no double payments)
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: open } = await db.from("pay_intents").select("*").eq("rid", rid).eq("created_by", user.id).eq("status", "created").gte("created_at", since).order("created_at", { ascending: false }).limit(5);
    const same = (open ?? []).find((i) => i.amount_paise === amountPaise && i.provider === gw.provider && [...i.order_ids].sort().join() === [...ids].sort().join());
    if (same?.provider_order_id && gw.provider === "razorpay") {
      return json({ intentId: same.id, provider: gw.provider, mode: gw.mode, keyId: gw.keyId, orderId: same.provider_order_id, amount: total, bill });
    }

    const { data: rest } = await db.from("restaurants").select("name").eq("id", rid).maybeSingle();
    const { data: intent, error: iErr } = await db
      .from("pay_intents")
      .insert({ rid, outlet_id: bill.outletId, provider: gw.provider, mode: gw.mode, kind: bill.kind, amount_paise: amountPaise, order_ids: ids, bill, created_by: user.id })
      .select("id")
      .single();
    if (iErr || !intent) return json({ error: "Could not start the payment" }, 500);
    const p = await createPayment(gw, intent.id, amountPaise, { rid, phone: bill.phone, name: rest?.name ?? "Restaurant bill" });
    await db.from("pay_intents").update({ provider_order_id: p.providerOrderId }).eq("id", intent.id);
    return json({ intentId: intent.id, provider: gw.provider, mode: gw.mode, keyId: gw.keyId, orderId: p.providerOrderId, sessionId: p.sessionId, amount: total, bill });
  } catch (e) {
    console.error("pay-create", (e as Error).message);
    return json({ error: "Could not start the payment. Try UPI instead." }, 500);
  }
});
