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
  return error ? null : data.user;
}

export async function isPlatformAdmin(uid: string) {
  const { data } = await admin().from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle();
  return !!data;
}
