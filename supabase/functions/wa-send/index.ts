// Send WhatsApp messages from the restaurant's own number (Pro plan and up).
// The app never says WHAT to send to WHOM for bills and tokens: the server reads the order and
// sends only to the number on it, once per order. Offers go only to guests of that outlet who
// said yes to offers, never after STOP, and at most one offer a day to each guest.
//  bill      { orderIds }      the e-bill template, after the bill is paid
//  ready     { orderId }       "your order is ready" for a counter token
//  campaign  { outletId, template, lang, extra[], phones[] }   approved template to chosen guests
import { admin, cors, json } from "../_shared/common.ts";
import { anyCaller, callerIn, can, cleanParam, inOutlet, listTemplates, loadWa, logOnce, logResult, phone10, planOk, sendTemplate } from "../_shared/whatsapp.ts";

const DAILY_OFFERS = 1000; // per restaurant
const PER_CALL = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const first = (n: unknown) => cleanParam(String(n ?? "").trim().split(/\s+/)[0] || "there");
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const user = await anyCaller(req);
    if (!user || user.is_anonymous) return json({ error: "Sign in again" }, 401);
    const b = await req.json();
    const rid = String(b?.rid ?? "");
    const kind = String(b?.kind ?? "");
    const who = rid ? await callerIn(rid, user.id) : null;
    if (!who) return json({ error: "Not allowed" }, 403);
    if (!(await planOk(rid))) return json({ skipped: "plan" });
    const wa = await loadWa(rid);
    if (!wa?.active) return json({ skipped: "off" });
    const db = admin();
    const { data: rest } = await db.from("restaurants").select("name").eq("id", rid).maybeSingle();

    if (kind === "bill" || kind === "ready") {
      const auto = kind === "bill" ? wa.settings?.bill : wa.settings?.ready;
      if (!auto?.template) return json({ skipped: "not set" });
      const ids = (kind === "bill" ? (Array.isArray(b?.orderIds) ? b.orderIds : []) : [b?.orderId]).map(String).filter(Boolean).slice(0, 30);
      if (!ids.length) return json({ error: "No order" }, 400);
      const { data: orders } = await db.from("orders").select("id,number,data").eq("rid", rid).in("id", ids);
      const list = (orders ?? []) as { id: string; number: number; data: Record<string, unknown> }[];
      if (!list.length) return json({ error: "No order" }, 400);
      const o = list.sort((x, y) => x.id.localeCompare(y.id))[0];
      const outletId = (o.data.outletId as string) ?? null;
      if (!inOutlet(who, outletId)) return json({ error: "Not your outlet" }, 403);
      const to = phone10(list.find((x) => x.data.guestPhone)?.data.guestPhone);
      if (to.length !== 10) return json({ skipped: "no number" });
      const { data: outlet } = outletId ? await db.from("outlets").select("data").eq("rid", rid).eq("id", outletId).maybeSingle() : { data: null };
      const place = cleanParam([rest?.name, (outlet?.data as { name?: string } | null)?.name].filter(Boolean).join(" · "));
      let params: string[];
      if (kind === "bill") {
        if (list.some((x) => x.data.status !== "paid")) return json({ skipped: "not paid" });
        const amount = list.reduce((s, x) => s + ((x.data.payments as { amount: number }[] | undefined) ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0), 0);
        params = [first(o.data.customer), rupees(amount), place, `#${o.data.number ?? o.number ?? ""}`];
      } else {
        if (o.data.status !== "ready") return json({ skipped: "not ready" });
        params = [`#${o.data.number ?? o.number ?? ""}`, place];
      }
      const t = (await listTemplates(wa)).find((x) => x.name === auto.template && x.language === auto.lang);
      if (!t?.ok) return json({ skipped: "template gone" });
      // one message per bill: the orders paid together share the moment they were paid
      const log = (o.data.paymentLog as { at?: string; text?: string }[] | undefined) ?? [];
      const paidAt = [...log].reverse().find((e) => /^Paid/i.test(e.text ?? ""))?.at ?? log[log.length - 1]?.at ?? "";
      const ref = kind === "bill" ? `${to}|${paidAt || o.id}` : o.id;
      const rowId = await logOnce({ rid, outlet_id: outletId, kind, ref, to_phone: to, template: t.name, created_by: user.id });
      if (!rowId) return json({ skipped: "already sent" });
      const res = await sendTemplate(wa, to, t.name, t.language, params.slice(0, t.params));
      await logResult(rowId, res);
      return json(res.id ? { ok: true } : { error: res.error });
    }

    if (kind === "campaign") {
      const outletId = String(b?.outletId ?? "");
      if (!can(who, "campaigns") || !inOutlet(who, outletId)) return json({ error: "Not allowed" }, 403);
      const t = (await listTemplates(wa)).find((x) => x.name === String(b?.template ?? "") && x.language === String(b?.lang ?? ""));
      if (!t?.ok) return json({ error: "Pick an approved template" }, 400);
      const extra = (Array.isArray(b?.extra) ? b.extra : []).slice(0, 9).map(cleanParam);
      if (t.params > 1 + extra.length) return json({ error: `Fill all ${t.params} blanks` }, 400);
      const wanted = [...new Set((Array.isArray(b?.phones) ? b.phones : []).map(phone10).filter((p: string) => p.length === 10))] as string[];
      if (!wanted.length) return json({ error: "No guests" }, 400);
      if (wanted.length > PER_CALL) return json({ error: `Up to ${PER_CALL} guests at a time` }, 400);

      // the outlet's guest book decides: said yes to offers (older records with no outlet belong to the first outlet)
      const { data: outs } = await db.from("outlets").select("id,data").eq("rid", rid);
      const mainId = [...(outs ?? [])].sort((a, b) => (Number(a.data?.sort) || 0) - (Number(b.data?.sort) || 0) || a.id.localeCompare(b.id))[0]?.id;
      const keys = wanted.flatMap((p) => [`${p}@${outletId}`, ...(outletId === mainId ? [p] : [])]);
      const { data: gs } = await db.from("guests").select("id,data").eq("rid", rid).in("id", keys);
      const okGuests = new Map<string, string>();
      for (const g of gs ?? []) if (g.data?.optIn === true) okGuests.set(phone10(g.id.split("@")[0]), String(g.data?.name ?? ""));
      const { data: stops } = await db.from("wa_optouts").select("phone").eq("rid", rid).in("phone", wanted);
      const stopped = new Set((stops ?? []).map((s) => s.phone));
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { data: recent } = await db.from("wa_messages").select("to_phone").eq("rid", rid).eq("kind", "campaign").neq("status", "failed").gte("created_at", since).in("to_phone", wanted);
      const recentSet = new Set((recent ?? []).map((r) => r.to_phone));
      const { count: today } = await db.from("wa_messages").select("id", { count: "exact", head: true }).eq("rid", rid).eq("kind", "campaign").gte("created_at", since);
      let room = Math.max(0, DAILY_OFFERS - (today ?? 0));

      const out = { sent: 0, failed: 0, noOptIn: 0, stopped: 0, recent: 0, limit: 0, errors: [] as string[] };
      for (const p of wanted) {
        if (!okGuests.has(p)) { out.noOptIn++; continue; }
        if (stopped.has(p)) { out.stopped++; continue; }
        if (recentSet.has(p)) { out.recent++; continue; }
        if (room <= 0) { out.limit++; continue; }
        room--;
        const { data: row } = await db.from("wa_messages").insert({ rid, outlet_id: outletId, kind: "campaign", to_phone: p, template: t.name, created_by: user.id }).select("id").single();
        const res = await sendTemplate(wa, p, t.name, t.language, [first(okGuests.get(p)), ...extra].slice(0, t.params));
        if (row) await logResult(row.id, res);
        if (res.id) out.sent++;
        else {
          out.failed++;
          if (res.error && !out.errors.includes(res.error)) out.errors.push(res.error);
          if (/limiting|token/i.test(res.error ?? "")) break; // stop at once: protect the number
        }
        await sleep(80);
      }
      const aid = `a${Date.now().toString(36)}wc`;
      await db.from("activity").insert({ rid, id: aid, data: { id: aid, by: who.owner ? "Owner" : who.name ?? "Team", kind: "guest", text: `WhatsApp offer "${t.name}" sent to ${out.sent} guest${out.sent === 1 ? "" : "s"}`, outletId, source: "team", at: new Date().toISOString() } });
      return json(out);
    }

    return json({ error: "Unknown kind" }, 400);
  } catch (e) {
    console.error("wa-send", (e as Error).message);
    return json({ error: "Something went wrong" }, 500);
  }
});
