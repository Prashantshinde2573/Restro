// Super admin renewed / changed the plan or gave a grace period: tell the owner by email.
import { emailReady, siteOrigin } from "@/lib/server/env";
import { json, sameSite } from "@/lib/server/http";
import { sendPlanUpdate } from "@/lib/server/plans";
import { caller, isPlatformAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!emailReady()) return json({ error: "not_configured" }, 503);
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const me = await caller(req);
  if (!me) return json({ error: "Sign in first" }, 401);
  if (!(await isPlatformAdmin(me.id))) return json({ error: "Only the super admin can do this" }, 403);
  const b = (await req.json().catch(() => ({}))) as { rid?: unknown; event?: unknown };
  const rid = String(b.rid ?? "").slice(0, 80);
  const event = b.event === "grace" || b.event === "plan" ? b.event : "renewed";
  const r = await sendPlanUpdate(rid, event, siteOrigin(req));
  return json(r, r.ok ? 200 : 502);
}
