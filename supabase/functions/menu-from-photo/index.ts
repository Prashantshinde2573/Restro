// Read a photo of a printed or handwritten menu with Gemini and return the
// categories and dishes on it. Nothing is saved here: the owner checks the
// list in the app and saves what they want.
//
// Needs the secret GEMINI_API_KEY (Supabase → Edge Functions → Secrets).
// Optional GEMINI_MODEL picks the model; otherwise the first one that works below.
import { createClient } from "npm:@supabase/supabase-js@2";

// (standalone: the few helpers it needs, same as _shared/common.ts)
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const pick = (jsonVar: string, legacy: string) => {
  try {
    const v = JSON.parse(Deno.env.get(jsonVar) ?? "{}");
    if (v?.default) return v.default as string;
  } catch { /* fall back */ }
  return Deno.env.get(legacy) ?? "";
};
const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, pick("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
type MemberData = { id: string; role?: string; active?: boolean; perms?: string[] };

const DAILY_PHOTOS = 20; // per restaurant per day
const MAX_PHOTOS = 6; // per request
const MAX_B64 = 6_000_000; // ~4.5 MB per photo after base64
const MODELS = [Deno.env.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean) as string[];
const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const PROMPT = `You are reading photos of one restaurant or café menu in India.
List every dish exactly as the menu shows it, grouped under the menu's own section headings.
Rules:
- "categories" follow the order on the menu. Use the heading text (e.g. "Starters", "Main Course", "Beverages"). If a dish has no heading, put it under "Other".
- Write names in English letters as printed. If a name is only in Marathi or Hindi, keep it in that script.
- "price" is a number in rupees with no symbol. If a dish has two sizes or half/full prices, make one dish per size with the size in the name ("Biryani (Half)", "Biryani (Full)"). If no price is readable, use 0.
- "diet": "veg", "nonveg" or "egg". Use the menu's green/red marks or the dish itself (chicken, mutton, fish, prawns = nonveg; egg/omelette = egg; otherwise veg).
- "desc": the short description printed under the dish, or "".
- Do not invent dishes. Skip taxes, phone numbers, addresses and notes.
- If the same dish appears on two photos, list it once.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    categories: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                price: { type: "NUMBER" },
                diet: { type: "STRING", enum: ["veg", "nonveg", "egg"] },
                desc: { type: "STRING" },
              },
              required: ["name", "price", "diet"],
            },
          },
        },
        required: ["name", "items"],
      },
    },
  },
  required: ["categories"],
};

type Photo = { mime: string; data: string };

async function gemini(photos: Photo[]) {
  let last = "";
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT }, ...photos.map((p) => ({ inline_data: { mime_type: p.mime, data: p.data } }))] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
      }),
    });
    if (r.status === 404) {
      last = `model ${model} not found`;
      continue; // try the next model name
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j?.error?.message ?? `Gemini error ${r.status}`;
      if (r.status === 429) throw new Error("The menu reader is busy (Gemini limit reached). Try again in a minute.");
      if (r.status === 400 && /API key/i.test(msg)) throw new Error("The Gemini key isn't working. Check GEMINI_API_KEY in Supabase.");
      throw new Error(msg);
    }
    const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    try {
      return { model, data: JSON.parse(text) };
    } catch {
      throw new Error("Couldn't read this photo. Try a clearer, straight photo in good light.");
    }
  }
  throw new Error(`No Gemini model available (${last})`);
}

const clean = (s: unknown, max = 80) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === "ping") return json({ configured: !!KEY });
    if (!KEY) return json({ error: "Menu reading isn't set up yet (GEMINI_API_KEY missing)." }, 503);

    const { rid, photos } = body as { rid?: string; photos?: Photo[] };
    if (typeof rid !== "string" || !Array.isArray(photos) || !photos.length) return json({ error: "Add a photo of the menu" }, 400);
    if (photos.length > MAX_PHOTOS) return json({ error: `Up to ${MAX_PHOTOS} photos at a time` }, 400);
    for (const p of photos) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(p?.mime ?? "") || typeof p.data !== "string" || !p.data || p.data.length > MAX_B64)
        return json({ error: "One of the photos couldn't be used. Use JPG or PNG under 4 MB." }, 400);
    }

    // who: the owner, or a team member allowed to edit the menu
    const db = admin();
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: who, error: whoErr } = await db.auth.getUser(token);
    if (whoErr || !who.user || who.user.is_anonymous) return json({ error: "Sign in first" }, 401);
    const { data: rest } = await db.from("restaurants").select("id, owner_uid, status").eq("id", rid).maybeSingle();
    if (!rest) return json({ error: "Restaurant not found" }, 404);
    if (rest.status === "suspended") return json({ error: "This restaurant is paused" }, 403);
    let allowed = rest.owner_uid === who.user.id;
    if (!allowed && who.user.app_metadata?.rid === rid) {
      const { data: meRow } = await db.from("members").select("data").eq("rid", rid).eq("id", String(who.user.app_metadata?.member_id ?? "")).maybeSingle();
      const me = meRow?.data as MemberData | undefined;
      allowed = !!me && me.active !== false && (me.role === "owner" || (me.perms ?? []).includes("menu"));
    }
    if (!allowed) return json({ error: "You can't edit this menu" }, 403);

    // daily limit (India date)
    const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    // (needs supabase/menu_scans.sql; until that's run there is no daily limit)
    const { data: used, error: limErr } = await db.rpc("menu_scan_take", { p_rid: rid, p_day: day, p_n: photos.length, p_max: DAILY_PHOTOS });
    const limited = !limErr;
    if (limited && used === -1) return json({ error: `You can read up to ${DAILY_PHOTOS} menu photos a day. Try again tomorrow.` }, 429);

    let read: Awaited<ReturnType<typeof gemini>>;
    try {
      read = await gemini(photos);
    } catch (e) {
      // give the photos back: nothing was read
      if (limited) await db.rpc("menu_scan_take", { p_rid: rid, p_day: day, p_n: -photos.length, p_max: DAILY_PHOTOS });
      throw e;
    }
    const { model, data } = read;
    const categories = (Array.isArray(data?.categories) ? data.categories : [])
      .map((c: { name?: unknown; items?: unknown[] }) => ({
        name: clean(c.name, 40) || "Other",
        items: (Array.isArray(c.items) ? c.items : [])
          .map((i) => {
            const it = i as { name?: unknown; price?: unknown; diet?: unknown; desc?: unknown };
            const price = Math.max(0, Math.round(Number(it.price) || 0));
            const diet = it.diet === "nonveg" || it.diet === "egg" ? it.diet : "veg";
            return { name: clean(it.name), price, diet, desc: clean(it.desc, 160) };
          })
          .filter((i) => i.name),
      }))
      .filter((c: { items: unknown[] }) => c.items.length);

    return json({ categories, model, left: limited ? Math.max(0, DAILY_PHOTOS - Number(used)) : null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
