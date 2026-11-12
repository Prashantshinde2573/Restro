// Sending and reading email through Resend's REST API (no extra package needed).
import { env, log } from "./env";

type Mail = { from: string; to: string | string[]; subject: string; html: string; text: string; replyTo?: string; tag?: string };

export async function sendEmail(m: Mail): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!env.resendKey) return { ok: false, error: "RESEND_API_KEY is not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: m.from,
        to: Array.isArray(m.to) ? m.to : [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        ...(m.tag ? { tags: [{ name: "kind", value: m.tag }] } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok || !body.id) {
      log("email.failed", { kind: m.tag, status: res.status, reason: body.name ?? body.message?.slice(0, 120) });
      return { ok: false, error: body.message ?? `Resend ${res.status}` };
    }
    log("email.sent", { kind: m.tag, id: body.id });
    return { ok: true, id: body.id };
  } catch (e) {
    log("email.failed", { kind: m.tag, reason: (e as Error).message.slice(0, 120) });
    return { ok: false, error: "Network error" };
  }
}

export type ReceivedEmail = { id: string; from: string; to: string[]; cc?: string[]; subject: string; html: string | null; text: string | null; created_at: string; attachments?: { filename?: string; size?: number }[] };

export async function getReceived(id: string): Promise<ReceivedEmail | null> {
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${env.resendKey}` } });
  if (!res.ok) {
    log("inbound.fetch_failed", { status: res.status });
    return null;
  }
  return (await res.json()) as ReceivedEmail;
}
