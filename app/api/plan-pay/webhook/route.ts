// Razorpay webhook for plan payments (set it in the Razorpay dashboard with RAZORPAY_WEBHOOK_SECRET).
// It only says "look again": the plan is renewed after the server asks Razorpay itself.
import { log, siteOrigin } from "@/lib/server/env";
import { json } from "@/lib/server/http";
import { afterPaid, settlePlanOrder, webhookOk } from "@/lib/server/razorpay";
import { admin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!webhookOk(raw, req.headers.get("x-razorpay-signature") ?? "")) return json({ error: "Bad signature" }, 401);
  let ev: { event?: string; payload?: { payment?: { entity?: { order_id?: string } }; order?: { entity?: { id?: string } } } };
  try {
    ev = JSON.parse(raw);
  } catch {
    return json({ ok: true });
  }
  if (ev.event !== "payment.captured" && ev.event !== "order.paid" && ev.event !== "payment.authorized") return json({ ok: true });
  const rpOrder = ev.payload?.payment?.entity?.order_id ?? ev.payload?.order?.entity?.id;
  if (!rpOrder) return json({ ok: true });
  const { data: o } = await admin().from("plan_orders").select("id").eq("rp_order_id", rpOrder).maybeSingle();
  if (!o) return json({ ok: true }); // not a plan payment
  try {
    const res = await settlePlanOrder(o.id);
    await afterPaid(res, siteOrigin(req));
    log("planpay.webhook", { order: o.id, status: res.status });
  } catch (e) {
    log("planpay.webhook_failed", { order: o.id, reason: (e as Error).message.slice(0, 120) });
    return json({ error: "retry" }, 500); // Razorpay retries
  }
  return json({ ok: true });
}
