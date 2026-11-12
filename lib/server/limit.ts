// Simple rate limits stored in Supabase (works across Vercel's many server instances).
import { createHash } from "node:crypto";
import { admin } from "./supabase-admin";

export const hash = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * True when this key may send another email of this kind: fewer than `max` in the last `minutes`.
 * Counts the attempt when allowed. Fails open only if the database is unreachable (the email would fail then anyway).
 */
export async function allow(kind: string, raw: string, max: number, minutes: number): Promise<boolean> {
  const key = hash(raw);
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const db = admin();
  const { count, error } = await db.from("email_log").select("id", { count: "exact", head: true }).eq("kind", kind).eq("key", key).gte("at", since);
  if (error) return true;
  if ((count ?? 0) >= max) return false;
  await db.from("email_log").insert({ kind, key });
  return true;
}
