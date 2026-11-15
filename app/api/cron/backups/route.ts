// Nightly restaurant-wise backup (Vercel Cron, see vercel.json). On Sundays (India time)
// the files also go by email to the super admin, so a copy lives outside Supabase.
import { env, log } from "@/lib/server/env";
import { json } from "@/lib/server/http";
import { runBackups } from "@/lib/server/backups";
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
  if (!env.serviceKey) return json({ error: "not_configured" }, 503);
  try {
    const sunday = new Date(Date.now() + 5.5 * 3600_000).getUTCDay() === 0;
    return json({ ok: true, ...(await runBackups({ email: sunday })) });
  } catch (e) {
    log("backup.cron_failed", { reason: (e as Error).message.slice(0, 160) });
    return json({ error: "failed" }, 500);
  }
}
