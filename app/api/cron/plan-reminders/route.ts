// Daily plan check (Vercel Cron, see vercel.json): emails owners whose plan is ending, in a grace
// period, or just ended — on the days set in the super admin. Safe to run twice: each email goes once.
import { emailReady, log, siteOrigin } from "@/lib/server/env";
import { json } from "@/lib/server/http";
import { runPlanReminders } from "@/lib/server/plans";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return json({ error: "CRON_SECRET is not set" }, 503);
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
  if (!emailReady()) return json({ error: "not_configured" }, 503);
  try {
    const r = await runPlanReminders(siteOrigin(req));
    log("plan.cron", r);
    return json({ ok: true, ...r });
  } catch (e) {
    log("plan.cron_failed", { reason: (e as Error).message.slice(0, 160) });
    return json({ error: "failed" }, 500);
  }
}
