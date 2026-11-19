// The owner starts paying for their plan: the server works out the price (and coupon), keeps a plan
// order, and makes the Razorpay order the checkout opens. Owner of the restaurant only.
import { env, log } from "@/lib/server/env";
import { json, sameSite } from "@/lib/server/http";
import { allow } from "@/lib/server/limit";
import { createOrder, planPayReady, quote, rz, settlePlanOrder, afterPaid } from "@/lib/server/razorpay";
import { admin, caller } from "@/lib/server/supabase-admin";
import { siteOrigin } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!planPayReady() || !env.serviceKey) return json({ error: "Online payment isn't set up yet" }, 503);
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const me = await caller(req);
  if (!me) return json({ error: "Sign in first" }, 401);
  const b = (await req.json().catch(() => ({}))) as { rid?: unknown; plan?: unknown; cycle?: unknown; coupon?: unknown };
  const rid = String(b.rid ?? "").slice(0, 80);
  const db = admin();
  const { data: r } = await db.from("restaurants").select("id, name, owner, owner_email, phone, owner_uid, status").eq("id", rid).maybeSingle();
  if (!r || r.owner_uid !== me.id) return json({ error: "Only the owner can pay for the plan" }, 403);
  if (r.status === "suspended") return json({ error: "This restaurant is paused by the Restropi team. Please contact them." }, 403);
  if (!(await allow("planpay", me.id, 12, 60))) return json({ error: "Too many tries. Please wait a bit." }, 429);
  let q;
  try {
    q = await quote(String(b.plan ?? ""), String(b.cycle ?? ""), b.coupon ? String(b.coupon).slice(0, 40) : null);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const { data: o, error } = await db
    .from("plan_orders")
    .insert({ rid, plan: q.plan, months: q.months, list_price: q.list, coupon: q.coupon, off: q.off, gst: q.gst, amount: q.amount, created_by: me.id })
    .select("id")
    .single();
  if (error || !o) return json({ error: "Could not start the payment. Try again." }, 500);
  // a coupon that makes it free: no payment page, the plan is renewed now
  if (q.amount <= 0) {
    const res = await settlePlanOrder(o.id);
    await afterPaid(res, siteOrigin(req));
    return json({ free: true, ...res });
  }
  try {
    const rzo = await createOrder(o.id, q.amount, { rid, plan: q.plan, months: String(q.months) });
    await db.from("plan_orders").update({ rp_order_id: rzo.id }).eq("id", o.id);
    log("planpay.start", { rid, order: o.id, amount: q.amount });
    return json({
      id: o.id,
      keyId: rz.keyId,
      rpOrderId: rzo.id,
      amount: q.amount,
      quote: q,
      name: r.name,
      prefill: { name: r.owner ?? "", email: r.owner_email ?? "", contact: r.phone ?? "" },
    });
  } catch (e) {
    await db.from("plan_orders").update({ status: "failed", error: (e as Error).message.slice(0, 200) }).eq("id", o.id);
    log("planpay.start_failed", { rid, reason: (e as Error).message.slice(0, 120) });
    return json({ error: "Razorpay didn't accept the payment right now. Try again in a minute." }, 502);
  }
}
