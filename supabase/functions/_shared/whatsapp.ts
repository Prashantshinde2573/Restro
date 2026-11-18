// The restaurant's own WhatsApp Business number (Meta WhatsApp Cloud API).
// Server only. The token and app secret come from Supabase Vault (svc_wa_secrets) and are never
// sent to a browser or written to a log. Only approved templates are sent (Meta's rule for
// messages the business starts); a guest's reply opens a 24-hour window for plain text.
import { admin } from "./common.ts";

export const GRAPH = "https://graph.facebook.com/v26.0";
export const PRO_PLANS = ["pro", "chain"];

export type WaAccount = {
  provider: "meta";
  phoneId: string;
  wabaId: string;
  active: boolean;
  settings: WaSettings;
  verifyToken: string;
  display?: string;
  token: string;
  appSecret: string;
};
export type AutoPick = { template: string; lang: string } | null;
export type WaSettings = { bill?: AutoPick; ready?: AutoPick };
export type Template = { name: string; language: string; category: string; body: string; params: number; ok: boolean; why?: string };

const timeout = (ms: number) => AbortSignal.timeout(ms);
const enc = new TextEncoder();

/** The signed-in user behind a request (staff or owner), or null. */
export async function anyCaller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function loadWa(rid: string): Promise<WaAccount | null> {
  const { data, error } = await admin().rpc("svc_wa_secrets", { r: rid });
  if (error || !data?.token) return null;
  return data as WaAccount;
}

/** Pro plan and up, and the restaurant's plan is running. */
export async function planOk(rid: string) {
  const { data } = await admin().from("restaurants").select("plan,status,renews_at,grace_until").eq("id", rid).maybeSingle();
  if (!data || data.status !== "active" || !PRO_PLANS.includes(data.plan)) return false;
  const now = Date.now();
  return new Date(data.renews_at).getTime() > now || (!!data.grace_until && new Date(data.grace_until).getTime() > now);
}

/** Who is calling: owner, or an active member (role, perms, outlets). */
export async function callerIn(rid: string, uid: string): Promise<{ owner: boolean; role?: string; perms?: string[]; outletIds?: string[]; name?: string } | null> {
  const { data } = await admin().rpc("svc_caller", { r: rid, p_uid: uid });
  return (data as never) ?? null;
}
export const can = (c: { owner: boolean; role?: string; perms?: string[] }, perm: string) => c.owner || c.role === "subadmin" || (c.perms ?? []).includes(perm);
export const inOutlet = (c: { owner: boolean; outletIds?: string[] }, outletId?: string | null) => c.owner || !outletId || (c.outletIds ?? []).includes(outletId);

const auth = (token: string) => ({ authorization: `Bearer ${token}`, "content-type": "application/json" });
const metaError = (j: unknown) => {
  // deno-lint-ignore no-explicit-any
  const e = (j as any)?.error;
  if (!e) return "WhatsApp did not answer";
  if (e.code === 190) return "The access token is wrong or has expired";
  if (e.code === 131030) return "This number is not on the allowed list of your test number";
  if (e.code === 132001) return "This template is not approved for this language";
  if (e.code === 131047) return "More than 24 hours since the guest wrote: only templates can be sent";
  if (e.code === 131026) return "This number is not on WhatsApp";
  if (e.code === 130429 || e.code === 131048 || e.code === 131056) return "WhatsApp is limiting messages right now. Try later.";
  return String(e.error_user_msg ?? e.message ?? "WhatsApp error").slice(0, 160);
};

/** Do these ids and token work, and does the number belong to this business account? */
export async function checkCreds(phoneId: string, wabaId: string, token: string): Promise<{ ok: true; display: string; name: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name`, { headers: auth(token), signal: timeout(10_000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: metaError(j) };
    const n = await fetch(`${GRAPH}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id&limit=50`, { headers: auth(token), signal: timeout(10_000) });
    const nj = await n.json().catch(() => ({}));
    if (!n.ok) return { ok: false, error: metaError(nj) };
    if (!((nj.data ?? []) as { id: string }[]).some((x) => x.id === phoneId)) return { ok: false, error: "This phone number id is not in this WhatsApp Business Account" };
    return { ok: true, display: String(j.display_phone_number ?? ""), name: String(j.verified_name ?? "") };
  } catch {
    return { ok: false, error: "Could not reach WhatsApp. Try again." };
  }
}

/** Approved templates the app can fill: body text with {{1}}, {{2}}… and no media or button variables. */
export async function listTemplates(a: Pick<WaAccount, "wabaId" | "token">): Promise<Template[]> {
  const r = await fetch(`${GRAPH}/${encodeURIComponent(a.wabaId)}/message_templates?fields=name,language,status,category,components&limit=200`, { headers: auth(a.token), signal: timeout(15_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(metaError(j));
  // deno-lint-ignore no-explicit-any
  return ((j.data ?? []) as any[])
    .filter((t) => t.status === "APPROVED")
    .map((t) => {
      // deno-lint-ignore no-explicit-any
      const comps = (t.components ?? []) as any[];
      const body = String(comps.find((c) => c.type === "BODY")?.text ?? "");
      const params = new Set(body.match(/\{\{\d+\}\}/g) ?? []).size;
      const head = comps.find((c) => c.type === "HEADER");
      const named = /\{\{[a-z_]+\}\}/i.test(body);
      const btnVars = comps.some((c) => c.type === "BUTTONS" && JSON.stringify(c).match(/\{\{\d+\}\}/));
      const why = named ? "uses named variables" : head && head.format !== "TEXT" ? "has a photo / file header" : head && /\{\{/.test(head.text ?? "") ? "has a variable in the header" : btnVars ? "has a variable in a button" : undefined;
      return { name: t.name, language: t.language, category: t.category, body, params, ok: !why, ...(why ? { why } : {}) };
    });
}

/** WhatsApp refuses new lines, tabs and long runs of spaces inside a variable. */
export const cleanParam = (s: unknown) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 200) || "-";
export const phone10 = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-10);

export async function sendTemplate(a: Pick<WaAccount, "phoneId" | "token">, to10: string, name: string, lang: string, params: string[]): Promise<{ id?: string; error?: string }> {
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(a.phoneId)}/messages`, {
      method: "POST",
      headers: auth(a.token),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `91${to10}`,
        type: "template",
        template: { name, language: { code: lang }, ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: cleanParam(text) })) }] } : {}) },
      }),
      signal: timeout(15_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.messages?.[0]?.id) return { error: metaError(j) };
    return { id: j.messages[0].id };
  } catch {
    return { error: "Could not reach WhatsApp" };
  }
}

/** Plain text, only inside the 24 hours after the guest wrote to us (e.g. the reply to STOP). */
export async function sendText(a: Pick<WaAccount, "phoneId" | "token">, toFull: string, text: string) {
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(a.phoneId)}/messages`, {
      method: "POST",
      headers: auth(a.token),
      body: JSON.stringify({ messaging_product: "whatsapp", to: toFull.replace(/\D/g, ""), type: "text", text: { body: text.slice(0, 1000) } }),
      signal: timeout(15_000),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? (j.messages?.[0]?.id as string | undefined) : undefined;
  } catch {
    return undefined;
  }
}

/** The webhook really came from Meta: HMAC-SHA256 of the raw body with the app secret. */
export async function signatureOk(appSecret: string, raw: string, header: string | null) {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const sig = header.slice(7);
  let d = mac.length ^ sig.length;
  for (let i = 0; i < Math.min(mac.length, sig.length); i++) d |= mac.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

/** Log a message once: false when this bill / token already has one (another phone sent it). */
export async function logOnce(row: { rid: string; outlet_id?: string | null; kind: string; ref?: string | null; to_phone: string; template?: string; created_by?: string | null }) {
  const { data, error } = await admin().from("wa_messages").insert(row).select("id").single();
  if (error) return null; // unique (rid, kind, ref): already sent
  return data.id as string;
}
export async function logResult(id: string, res: { id?: string; error?: string }) {
  await admin().from("wa_messages").update({ status: res.id ? "sent" : "failed", wa_id: res.id ?? null, error: res.error ?? null, updated_at: new Date().toISOString() }).eq("id", id);
}
