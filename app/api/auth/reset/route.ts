// Forgot password: Supabase makes a one-time, expiring recovery token; Resend delivers it from support@.
// Always answers the same way, so nobody can use this to find out which emails have an account.
import { emailReady, FROM_SUPPORT, log, mask, siteOrigin } from "@/lib/server/env";
import { cleanEmail, json, sameSite } from "@/lib/server/http";
import { allow, clientIp } from "@/lib/server/limit";
import { sendEmail } from "@/lib/server/resend";
import { admin } from "@/lib/server/supabase-admin";
import { resetEmail } from "@/lib/server/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAME = { ok: true, message: "If this email has an account, a reset link is on its way." };

export async function POST(req: Request) {
  if (!emailReady()) return json({ error: "not_configured" }, 503); // the app falls back to Supabase's own email
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const email = cleanEmail((body as { email?: unknown }).email);
  if (!email) return json({ error: "Type a valid email" }, 400);

  if (!(await allow("reset:ip", clientIp(req), 10, 60))) return json({ error: "Too many requests. Try again in a while." }, 429);
  if (!(await allow("reset:email", email, 3, 15))) return json(SAME); // quietly cap per address

  const db = admin();
  const { data: exists } = await db.rpc("auth_email_exists", { e: email });
  if (!exists) {
    log("reset.no_account", { to: mask(email) });
    return json(SAME);
  }
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    log("reset.link_failed", { to: mask(email), reason: error?.message?.slice(0, 120) });
    return json({ error: "Could not send the email right now. Try again in a minute." }, 502);
  }
  const link = `${siteOrigin(req)}/login?token_hash=${encodeURIComponent(token)}&type=recovery`;
  const sent = await sendEmail({ from: FROM_SUPPORT, to: email, replyTo: FROM_SUPPORT, tag: "password_reset", ...resetEmail({ link }) });
  if (!sent.ok) return json({ error: "Could not send the email right now. Try again in a minute." }, 502);
  return json(SAME);
}
