// Supabase with the service role key — server only. Bypasses row level security, so keep every use narrow.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";
import { env } from "./env";

let client: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (!env.serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  client ??= createClient(SUPABASE_URL, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** The signed-in person who called this route (from their own access token), or null. */
export async function caller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  // two-step login: did this session pass the authenticator code? (the token was just checked above)
  let aal = "aal1";
  try {
    aal = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).aal ?? "aal1";
  } catch {}
  const hasFactor = (data.user.factors ?? []).some((f) => f.status === "verified");
  return Object.assign(data.user, { mfaOk: aal === "aal2" || !hasFactor });
}

/** Super admin, signed in with the two-step code when it's on. */
export async function isPlatformAdmin(me: { id: string; mfaOk: boolean }) {
  if (!me.mfaOk) return false;
  const { data } = await admin().from("platform_admins").select("user_id").eq("user_id", me.id).maybeSingle();
  return !!data;
}
