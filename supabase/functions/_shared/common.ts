// Shared bits for the staff PIN functions.
import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const pick = (jsonVar: string, legacy: string) => {
  try {
    const v = JSON.parse(Deno.env.get(jsonVar) ?? "{}");
    if (v?.default) return v.default as string;
  } catch { /* fall back */ }
  return Deno.env.get(legacy) ?? "";
};
export const URL_ = Deno.env.get("SUPABASE_URL")!;
export const SECRET = pick("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
export const PUBLISHABLE = pick("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
export const admin = () => createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
export const publicClient = () => createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });

export const staffEmail = (rid: string, memberId: string) =>
  `s-${rid}-${memberId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-") + "@staff.restropi.app";

export const randomPassword = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b));
};

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function derive(pin: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256));
}
export async function hashPin(pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const it = 100_000;
  return `pbkdf2$${it}$${salt}$${await derive(pin, salt, it)}`;
}
export async function checkPin(pin: string, stored: string) {
  const [, it, salt, h] = stored.split("$");
  const got = await derive(pin, salt, Number(it));
  let diff = got.length ^ h.length;
  for (let i = 0; i < Math.min(got.length, h.length); i++) diff |= got.charCodeAt(i) ^ h.charCodeAt(i);
  return diff === 0;
}

export type MemberData = { id: string; name?: string; role?: string; active?: boolean; perms?: string[]; outletIds?: string[] };

/** Easy-to-type temporary password, e.g. "Kp7m-Xq4t-Rz9w". The person changes it on first sign-in. */
export const tempPassword = () => {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(12));
  const s = [...b].map((x) => abc[x % abc.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
};

/** The signed-in user behind a request, or null. */
export async function caller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error || !data.user || data.user.is_anonymous ? null : data.user;
}
