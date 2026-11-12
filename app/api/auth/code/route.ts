// Email sign-in code (OTP) for owners: Supabase makes a one-time 6-digit code; Resend delivers it.
// The browser checks the code with Supabase directly (verifyOtp) — the code never passes back through here.
import { emailReady, FROM_SUPPORT, log, mask } from "@/lib/server/env";
import { cleanEmail, json, sameSite } from "@/lib/server/http";
import { allow, clientIp } from "@/lib/server/limit";
import { sendEmail } from "@/lib/server/resend";
import { admin } from "@/lib/server/supabase-admin";
import { otpEmail } from "@/lib/server/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAME = { ok: true, message: "If this email has a Restropi login, a 6-digit code is on its way." };

export async function POST(req: Request) {
  if (!emailReady()) return json({ error: "Email sign-in isn't available right now. Use your password." }, 503);
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const email = cleanEmail((body as { email?: unknown }).email);
  if (!email) return json({ error: "Type a valid email" }, 400);

  if (!(await allow("code:ip", clientIp(req), 10, 60))) return json({ error: "Too many requests. Try again in a while." }, 429);
  if (!(await allow("code:email", email, 3, 10))) return json({ error: "A code was sent just now. Check your inbox, or try again in a few minutes." }, 429);

  const db = admin();
  const { data: exists } = await db.rpc("auth_email_exists", { e: email });
  if (!exists) {
    log("code.no_account", { to: mask(email) });
    return json(SAME); // no account: send nothing, never create one
  }
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const code = data?.properties?.email_otp;
  if (error || !code) {
    log("code.failed", { to: mask(email), reason: error?.message?.slice(0, 120) });
    return json({ error: "Could not send the code right now. Try again in a minute." }, 502);
  }
  const sent = await sendEmail({ from: FROM_SUPPORT, to: email, tag: "signin_code", ...otpEmail({ code }) });
  if (!sent.ok) return json({ error: "Could not send the code right now. Try again in a minute." }, 502);
  return json(SAME);
}
