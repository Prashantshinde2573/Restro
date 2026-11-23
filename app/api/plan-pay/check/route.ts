// After the checkout (or when the owner comes back): ask Razorpay whether the plan order was paid.
// The plan is renewed only when Razorpay says so. Owner of that restaurant or the super admin.
import { env, siteOrigin } from "@/lib/server/env";
import { json, sameSite } from "@/lib/server/http";
import { afterPaid, planPayReady, settlePlanOrder } from "@/lib/server/razorpay";
import { admin, caller, isPlatformAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!planPayReady() || !env.serviceKey) return json({ error: "Online payment isn't set up yet" }, 503);
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const me = await caller(req);
  if (!me) return json({ error: "Sign in first" }, 401);
  const b = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Bad request" }, 400);
  const db = admin();
  const { data: o } = await db.from("plan_orders").select("rid").eq("id", id).maybeSingle();
  if (!o) return json({ error: "Payment not found" }, 404);
  const { data: r } = await db.from("restaurants").select("owner_uid").eq("id", o.rid).maybeSingle();
  if ((r?.owner_uid !== me.id || !me.mfaOk) && !(await isPlatformAdmin(me))) return json({ error: "Forbidden" }, 403);
  try {
    const res = await settlePlanOrder(id);
    await afterPaid(res, siteOrigin(req));
    return json(res);
  } catch (e) {
    return json({ status: "pending", message: (e as Error).message.slice(0, 160) });
  }
}
