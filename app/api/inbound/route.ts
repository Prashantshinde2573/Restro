// Resend inbound webhook: an email arrived at a restropi.com inbox → forward sender, subject and message
// to the owner's personal inbox. Signed by Resend (Svix); each event is handled once.
import { env, FROM_SUPPORT, log } from "@/lib/server/env";
import { json } from "@/lib/server/http";
import { getReceived, sendEmail } from "@/lib/server/resend";
import { admin } from "@/lib/server/supabase-admin";
import { inboundForward } from "@/lib/server/templates";
import { verifyWebhook } from "@/lib/server/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Event = { type?: string; created_at?: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string } };
const addr = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();

export async function POST(req: Request) {
  if (!env.webhookSecret || !env.resendKey || !env.serviceKey) {
    log("inbound.not_configured");
    return json({ error: "not_configured" }, 503);
  }
  const raw = await req.text(); // the signature covers the exact bytes, so read before parsing
  if (raw.length > 1_000_000) return json({ error: "Too large" }, 413);
  if (!verifyWebhook(raw, req.headers, env.webhookSecret)) {
    log("inbound.bad_signature");
    return json({ error: "Invalid signature" }, 401);
  }
  let ev: Event;
  try {
    ev = JSON.parse(raw) as Event;
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }
  if (ev.type !== "email.received") return json({ ok: true, ignored: ev.type ?? "unknown" });
  const emailId = ev.data?.email_id;
  if (!emailId || typeof emailId !== "string") return json({ error: "Missing email_id" }, 400);

  // never forward our own forwards (stops loops if the personal inbox ever auto-replies or forwards back)
  const from = addr(ev.data?.from ?? "");
  if (from === addr(env.notifyEmail) || from === addr(env.supportEmail)) return json({ ok: true, ignored: "own" });

  const db = admin();
  const eventId = req.headers.get("svix-id") ?? emailId;
  // claim the event; a retry of something already forwarded is skipped
  const { data: prev } = await db.from("inbound_events").select("status, at").eq("email_id", emailId).maybeSingle();
  if (prev?.status === "forwarded") return json({ ok: true, duplicate: true });
  if (prev?.status === "processing" && Date.now() - Date.parse(prev.at) < 60_000) return json({ ok: true, duplicate: true, inProgress: true });
  const { error: claimErr } = await db.from("inbound_events").upsert({ id: emailId, email_id: emailId, status: "processing", at: new Date().toISOString() });
  if (claimErr) {
    log("inbound.claim_failed", { event: eventId, reason: claimErr.message.slice(0, 120) });
    return json({ error: "Try again" }, 500); // Resend retries
  }

  const full = await getReceived(emailId);
  const mail = inboundForward({
    from: full?.from ?? ev.data?.from ?? "(unknown sender)",
    to: full?.to ?? ev.data?.to ?? [],
    cc: full?.cc,
    subject: full?.subject ?? ev.data?.subject ?? "",
    text: full?.text ?? null,
    html: full?.html ?? null,
    at: full?.created_at ?? ev.created_at ?? new Date().toISOString(),
    attachments: full?.attachments,
  });
  const sent = await sendEmail({ from: FROM_SUPPORT, to: env.notifyEmail, replyTo: full?.from ?? ev.data?.from, tag: "inbound_forward", ...mail });
  await db.from("inbound_events").update({ status: sent.ok ? "forwarded" : "failed", at: new Date().toISOString() }).eq("id", emailId);
  if (!sent.ok) {
    log("inbound.forward_failed", { event: eventId });
    return json({ error: "Forward failed" }, 500); // Resend retries the webhook later
  }
  log("inbound.forwarded", { event: eventId, body: full ? "full" : "metadata" });
  return json({ ok: true });
}
