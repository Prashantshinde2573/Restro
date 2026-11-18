// WhatsApp Business API on the restaurant's own number (Pro plan and up).
//  connect   owner: check the ids and token with Meta, store the token and app secret in Vault
//  off       owner: stop sending (the wa.me buttons keep working)
//  templates owner or Campaigns permission: the approved templates the app can send
//  settings  owner: which template goes out by itself (e-bill, "your order is ready")
//  test      owner: one template to one number
// Nothing secret is ever sent back.
import { admin, cors, json } from "../_shared/common.ts";
import { anyCaller, callerIn, can, checkCreds, listTemplates, loadWa, logResult, phone10, planOk, sendTemplate, type WaSettings } from "../_shared/whatsapp.ts";

const ID = /^\d{6,25}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const user = await anyCaller(req);
    if (!user || user.is_anonymous) return json({ error: "Sign in again" }, 401);
    const b = await req.json();
    const rid = String(b?.rid ?? "");
    const action = String(b?.action ?? "");
    const who = rid ? await callerIn(rid, user.id) : null;
    if (!who) return json({ error: "Not allowed" }, 403);
    if (action === "templates" ? !can(who, "campaigns") : !who.owner) return json({ error: "Only the owner can do this" }, 403);
    if (!(await planOk(rid))) return json({ error: "WhatsApp API is on the Pro plan", plan: true }, 403);
    const db = admin();

    if (action === "connect") {
      const phoneId = String(b?.phoneId ?? "").trim();
      const wabaId = String(b?.wabaId ?? "").trim();
      const token = String(b?.token ?? "").trim();
      const appSecret = String(b?.appSecret ?? "").trim();
      if (!ID.test(phoneId) || !ID.test(wabaId)) return json({ error: "Phone number ID and Business Account ID are numbers from Meta" }, 400);
      if (token.length < 50 || token.length > 1000) return json({ error: "Paste the full access token" }, 400);
      if (appSecret && !/^[a-f0-9]{32}$/i.test(appSecret)) return json({ error: "The app secret is 32 letters and numbers" }, 400);
      const check = await checkCreds(phoneId, wabaId, token);
      if (!check.ok) return json({ error: check.error }, 400);
      const { data: had } = await db.from("wa_accounts").select("rid").eq("rid", rid).maybeSingle();
      if (!had && !appSecret) return json({ error: "Add the app secret (for checking WhatsApp's messages to us)" }, 400);
      const { data: vt, error } = await db.rpc("svc_save_wa", { r: rid, p_phone_id: phoneId, p_waba_id: wabaId, p_display: check.display, p_name: check.name, p_token: token, p_app_secret: appSecret || null, p_by: user.id });
      if (error) return json({ error: "Could not save. Try again." }, 500);
      const aid = `a${Date.now().toString(36)}wa`;
      await db.from("activity").insert({ rid, id: aid, data: { id: aid, by: "Owner", kind: "settings", text: `WhatsApp API connected · ${check.display}`, source: "team", at: new Date().toISOString() } });
      return json({ ok: true, display: check.display, name: check.name, verifyToken: vt });
    }

    if (action === "off") {
      await db.rpc("svc_wa_off", { r: rid });
      return json({ ok: true });
    }

    const wa = await loadWa(rid);
    if (!wa || !wa.active) return json({ error: "WhatsApp API is not connected" }, 400);

    if (action === "templates") {
      return json({ templates: await listTemplates(wa) });
    }

    if (action === "settings") {
      const list = await listTemplates(wa);
      const pick = (v: unknown, max: number) => {
        // deno-lint-ignore no-explicit-any
        const x = v as any;
        if (!x?.template) return null;
        const t = list.find((t) => t.name === x.template && t.language === x.lang);
        if (!t || !t.ok) throw new Error(`Template ${x.template} is not approved or can't be filled`);
        if (t.params > max) throw new Error(`Template ${x.template} has ${t.params} blanks; this message fills up to ${max}`);
        return { template: t.name, lang: t.language };
      };
      let s: WaSettings;
      try {
        s = { bill: pick(b?.settings?.bill, 4), ready: pick(b?.settings?.ready, 2) };
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
      await db.rpc("svc_wa_settings", { r: rid, p_settings: s });
      return json({ ok: true, settings: s });
    }

    if (action === "test") {
      const to = phone10(b?.to);
      if (to.length !== 10) return json({ error: "Enter a 10-digit mobile number" }, 400);
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await db.from("wa_messages").select("id", { count: "exact", head: true }).eq("rid", rid).eq("kind", "test").gte("created_at", since);
      if ((count ?? 0) >= 10) return json({ error: "10 test messages a day. Try tomorrow." }, 429);
      const name = String(b?.template ?? "hello_world");
      const lang = String(b?.lang ?? "en_US");
      const t = (await listTemplates(wa)).find((x) => x.name === name && x.language === lang);
      if (!t || !t.ok) return json({ error: "Pick an approved template" }, 400);
      const { data: row } = await db.from("wa_messages").insert({ rid, kind: "test", to_phone: to, template: name, created_by: user.id }).select("id").single();
      const params = Array.from({ length: t.params }, (_, i) => (i === 0 ? "Test" : `Test ${i + 1}`));
      const res = await sendTemplate(wa, to, name, lang, params);
      if (row) await logResult(row.id, res);
      return res.id ? json({ ok: true }) : json({ error: res.error }, 400);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("wa-setup", (e as Error).message);
    return json({ error: "Something went wrong" }, 500);
  }
});
