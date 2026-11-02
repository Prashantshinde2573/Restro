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
// Fast settings first: reading a menu doesn't need long "thinking", and the
// function has to answer within Supabase's 150 s limit. Google retires model
// names often; when one is gone, the model Google suggests in its reply is tried next.
type Model = { name: string; thinking?: Record<string, unknown> };
const MODELS: Model[] = [
  ...(Deno.env.get("GEMINI_MODEL") ? [{ name: Deno.env.get("GEMINI_MODEL")! }] : []),
  { name: "gemini-3.8-flash", thinking: { thinkingLevel: "low" } },
  { name: "gemini-3.5-flash-lite", thinking: { thinkingLevel: "low" } },
  { name: "gemini-flash-latest", thinking: { thinkingLevel: "low" } },
  { name: "gemini-flash-lite-latest", thinking: { thinkingLevel: "low" } },
];
const DEADLINE_MS = 140_000; // stop trying before Supabase's 150 s limit
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
  const started = Date.now();
  const parts = [{ text: PROMPT }, ...photos.map((p) => ({ inline_data: { mime_type: p.mime, data: p.data } }))];
  let last = "";
  const queue = [...MODELS];
  const tried = new Set<string>();
  while (queue.length) {
    const m = queue.shift()!;
    if (tried.has(m.name)) continue;
    tried.add(m.name);
    for (const thinking of m.thinking ? [m.thinking, undefined] : [undefined]) {
      const left = DEADLINE_MS - (Date.now() - started);
      if (left < 15_000) throw new Error("Reading took too long. Try fewer photos at a time (1–2 pages).");
      const t0 = Date.now();
      let r: Response;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m.name}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": KEY },
          signal: AbortSignal.timeout(Math.min(left - 5_000, 75_000)),
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0, maxOutputTokens: 16_000, ...(thinking ? { thinkingConfig: thinking } : {}) },
          }),
        });
      } catch (e) {
        console.log(`gemini ${m.name}: no answer after ${Date.now() - t0} ms`, String(e));
        last = `${m.name} timed out`;
        break; // next model
      }
      const j = await r.json().catch(() => ({}));
      console.log(`gemini ${m.name}${thinking ? " (fast)" : ""}: ${r.status} in ${Date.now() - t0} ms`, r.ok ? "" : JSON.stringify(j?.error ?? {}).slice(0, 300));
      if (r.status === 404) {
        last = `model ${m.name} not found`;
        // "...no longer available... use models/gemini-x.y-flash" → try that one next
        const hint = /models\/(gemini-[\w.-]+)/g;
        const named = [...String(j?.error?.message ?? "").matchAll(hint)].map((x) => x[1]).filter((n) => n !== m.name && !tried.has(n));
        if (named.length) queue.unshift(...named.map((name) => ({ name, thinking: { thinkingLevel: "low" } })));
        break; // next model
      }
      if (r.status === 400 && thinking && /think/i.test(j?.error?.message ?? "")) continue; // same model, without the setting
      if (!r.ok) {
        const msg = j?.error?.message ?? `Gemini error ${r.status}`;
        if (r.status === 429) throw new Error("The menu reader is busy (Gemini limit reached). Try again in a minute.");
        if ((r.status === 400 || r.status === 403) && /API key|permission|PERMISSION/i.test(msg)) throw new Error("The Gemini key isn't working. Check GEMINI_API_KEY in Supabase.");
        if (r.status >= 500) {
          last = `${m.name}: ${msg}`;
          break; // next model
        }
        throw new Error(msg);
      }
      const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : p.text ?? "")).join("") ?? "";
      try {
        return { model: m.name, data: JSON.parse(text) };
      } catch {
        console.log(`gemini ${m.name}: not JSON`, j?.candidates?.[0]?.finishReason, text.slice(0, 200));
        throw new Error("Couldn't read this photo. Try a clearer, straight photo in good light, or fewer pages at a time.");
      }
    }
  }
  console.log("no model answered:", last);
  throw new Error("The menu reader isn't answering right now. Try again in a minute, with one clear photo.");
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
    console.log(`read ${photos.length} photo(s), ${Math.round(photos.reduce((n, p) => n + p.data.length, 0) / 1024)} KB, rid ${rid}`);

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
