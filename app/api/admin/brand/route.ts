// Super admin: the restaurant's logo (stored with the service role) and keeping the owner's
// team-list name in step with the owner name set in the super admin.
import { env, log } from "@/lib/server/env";
import { json, sameSite } from "@/lib/server/http";
import { admin, caller, isPlatformAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 700_000; // bytes, after the browser shrinks it to 400 px
const isPng = (b: Buffer) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

export async function POST(req: Request) {
  if (!env.serviceKey) return json({ error: "not_configured" }, 503);
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const me = await caller(req);
  if (!me) return json({ error: "Sign in first" }, 401);
  if (!(await isPlatformAdmin(me.id))) return json({ error: "Only the super admin can do this" }, 403);

  const b = (await req.json().catch(() => ({}))) as { rid?: unknown; action?: unknown; png?: unknown };
  const rid = String(b.rid ?? "").slice(0, 80);
  const db = admin();
  const { data: rest } = await db.from("restaurants").select("id, owner").eq("id", rid).maybeSingle();
  if (!rest) return json({ error: "Restaurant not found" }, 404);

  if (b.action === "logo") {
    const buf = Buffer.from(String(b.png ?? ""), "base64");
    if (!isPng(buf)) return json({ error: "That isn't a PNG image" }, 400);
    if (buf.length > MAX) return json({ error: "The logo is too large" }, 413);
    const path = `${rid}/logo-${Date.now().toString(36)}.png`;
    const up = await db.storage.from("menu-photos").upload(path, buf, { contentType: "image/png", cacheControl: "31536000", upsert: false });
    if (up.error) {
      log("brand.logo_upload_failed", { rid, reason: up.error.message.slice(0, 120) });
      return json({ error: "Could not upload the logo" }, 502);
    }
    const url = db.storage.from("menu-photos").getPublicUrl(path).data.publicUrl;
    const { error } = await db.from("restaurants").update({ logo: url }).eq("id", rid);
    if (error) return json({ error: "Could not save the logo" }, 500);
    log("brand.logo", { rid });
    return json({ ok: true, logo: url });
  }
  if (b.action === "removeLogo") {
    const { error } = await db.from("restaurants").update({ logo: null }).eq("id", rid);
    if (error) return json({ error: "Could not remove the logo" }, 500);
    return json({ ok: true, logo: null });
  }
  if (b.action === "syncOwner") {
    const name = String(rest.owner ?? "").trim();
    if (!name) return json({ ok: true });
    const { data: members } = await db.from("members").select("id, data").eq("rid", rid);
    const owner = (members ?? []).find((m) => (m.data as { role?: string })?.role === "owner");
    if (owner && (owner.data as { name?: string }).name !== name) {
      const { error } = await db.from("members").update({ data: { ...(owner.data as object), name } }).eq("rid", rid).eq("id", owner.id);
      if (error) return json({ error: "Could not update the team list" }, 500);
    }
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
}
