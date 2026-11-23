// Super admin: list the restaurant backups (with download links), or take one now.
import { env } from "@/lib/server/env";
import { json, sameSite } from "@/lib/server/http";
import { listBackups, runBackups } from "@/lib/server/backups";
import { caller, isPlatformAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function allowed(req: Request) {
  const me = await caller(req);
  if (!me) return json({ error: "Sign in first" }, 401);
  if (!(await isPlatformAdmin(me))) return json({ error: "Only the super admin can do this" }, 403);
  return null;
}

export async function GET(req: Request) {
  if (!env.serviceKey) return json({ error: "not_configured" }, 503);
  const no = await allowed(req);
  if (no) return no;
  return json({ restaurants: await listBackups() });
}

export async function POST(req: Request) {
  if (!env.serviceKey) return json({ error: "not_configured" }, 503);
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const no = await allowed(req);
  if (no) return no;
  const r = await runBackups({ email: false });
  return json({ ok: true, saved: r.saved.length, failed: r.failed });
}
