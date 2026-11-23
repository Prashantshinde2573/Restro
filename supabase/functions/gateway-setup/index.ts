// The owner connects their own Razorpay or Cashfree account to an outlet (or turns it off).
// Only the restaurant's owner. The keys are checked with the gateway first, then stored in
// Supabase Vault; nothing secret is ever sent back.
import { admin, cors, json, mfaOk } from "../_shared/common.ts";
import { anyCaller, testKeys, type Gateway } from "../_shared/gateways.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const user = await anyCaller(req);
    if (!user || user.is_anonymous) return json({ error: "Sign in again" }, 401);
    if (!mfaOk(req, user)) return json({ error: "Sign in again with your two-step code" }, 401);
    const b = await req.json();
    const rid = String(b?.rid ?? "");
    const outletId = String(b?.outletId ?? "");
    const db = admin();
    const { data: rest } = await db.from("restaurants").select("owner_uid").eq("id", rid).maybeSingle();
    if (!rest || rest.owner_uid !== user.id) return json({ error: "Only the owner can do this" }, 403);
    const { data: outlet } = await db.from("outlets").select("id").eq("rid", rid).eq("id", outletId).maybeSingle();
    if (!outlet) return json({ error: "No such outlet" }, 404);

    if (b?.action === "off") {
      const { error } = await db.rpc("svc_gateway_off", { r: rid, p_outlet: outletId });
      if (error) return json({ error: "Could not turn it off" }, 500);
      return json({ ok: true });
    }

    const provider = b?.provider === "cashfree" ? "cashfree" : b?.provider === "razorpay" ? "razorpay" : null;
    const mode = b?.mode === "live" ? "live" : "test";
    const keyId = String(b?.keyId ?? "").trim();
    const secret = String(b?.secret ?? "").trim();
    const webhook = String(b?.webhook ?? "").trim();
    if (!provider) return json({ error: "Pick Razorpay or Cashfree" }, 400);
    if (keyId.length < 6 || keyId.length > 100 || secret.length < 8 || secret.length > 200 || webhook.length > 200) return json({ error: "Check the keys" }, 400);
    if (provider === "razorpay" && !webhook) {
      // keep the saved webhook secret when only the keys change
      const { data: g } = await db.from("pay_gateways").select("webhook_ref,provider").eq("rid", rid).eq("outlet_id", outletId).maybeSingle();
      if (!g?.webhook_ref || g.provider !== "razorpay") return json({ error: "Add the Razorpay webhook secret" }, 400);
    }
    const gw: Gateway = { provider, mode, keyId, secret };
    const problem = await testKeys(gw);
    if (problem) return json({ error: problem }, 400);
    const { error } = await db.rpc("svc_save_gateway", { r: rid, p_outlet: outletId, p_provider: provider, p_mode: mode, p_key_id: keyId, p_secret: secret, p_webhook: webhook || null, p_by: user.id });
    if (error) return json({ error: "Could not save. Try again." }, 500);
    const aid = `a${Date.now().toString(36)}gw`;
    await db.from("activity").insert({ rid, id: aid, data: { id: aid, by: "Owner", kind: "settings", text: `Online payments connected · ${provider === "razorpay" ? "Razorpay" : "Cashfree"} (${mode === "live" ? "Live" : "Test"})`, outletId, source: "team", at: new Date().toISOString() } });
    return json({ ok: true, last4: secret.slice(-4) });
  } catch (e) {
    console.error("gateway-setup", (e as Error).message);
    return json({ error: "Something went wrong" }, 500);
  }
});
