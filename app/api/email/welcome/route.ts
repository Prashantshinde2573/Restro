// Welcome email for a new restaurant owner: sent by the super admin's app right after the restaurant is created.
// Contains a one-time "set your password" link — never a password.
import { emailReady, FROM_SUPPORT, log, mask, siteOrigin } from "@/lib/server/env";
import { json, sameSite } from "@/lib/server/http";
import { sendEmail } from "@/lib/server/resend";
import { admin, caller, isPlatformAdmin } from "@/lib/server/supabase-admin";
import { welcomeEmail } from "@/lib/server/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!emailReady()) return json({ error: "not_configured" }, 503);
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const me = await caller(req);
  if (!me) return json({ error: "Sign in first" }, 401);
  if (!(await isPlatformAdmin(me.id))) return json({ error: "Only the super admin can do this" }, 403);

  const body = (await req.json().catch(() => ({}))) as { rid?: unknown; resend?: unknown };
  const rid = String(body.rid ?? "").slice(0, 80);
  const db = admin();
  // the restaurant must already be saved — the email only goes out after the database write succeeded
  const { data: rest } = await db.from("restaurants").select("id, name, owner, owner_uid, owner_email").eq("id", rid).maybeSingle();
  if (!rest) return json({ error: "Restaurant not found" }, 404);
  const { data: u } = await db.auth.admin.getUserById(rest.owner_uid);
  const user = u?.user;
  const email = (user?.email ?? rest.owner_email ?? "").toLowerCase();
  if (!user || !email) return json({ error: "Owner login not found" }, 404);
  if (user.app_metadata?.welcome_sent_at && body.resend !== true) return json({ ok: true, already: true });

  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    log("welcome.link_failed", { rid, reason: error?.message?.slice(0, 120) });
    return json({ error: "Could not make the sign-in link" }, 502);
  }
  const origin = siteOrigin(req);
  const link = `${origin}/login?token_hash=${encodeURIComponent(token)}&type=recovery`;
  const sent = await sendEmail({
    from: FROM_SUPPORT,
    to: email,
    tag: "welcome",
    ...welcomeEmail({ name: rest.owner || (user.user_metadata?.name as string) || "", restaurant: rest.name, email, link, loginUrl: `${origin}/login` }),
  });
  if (!sent.ok) return json({ error: "The email could not be sent. Try again from the restaurant's page." }, 502);
  await db.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, welcome_sent_at: new Date().toISOString() } });
  log("welcome.sent", { rid, to: mask(email) });
  return json({ ok: true, to: email });
}
