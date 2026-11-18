// Meta → Restropi: delivery receipts and guests' replies, for one restaurant (?r=<rid>).
//  GET   Meta's one-time check: hub.verify_token must match this restaurant's token.
//  POST  signed with the restaurant's Meta app secret (X-Hub-Signature-256), else ignored.
// A guest writing STOP stops offers in every outlet; START turns them on again.
import { admin, json } from "../_shared/common.ts";
import { loadWa, phone10, sendText, signatureOk } from "../_shared/whatsapp.ts";

const STOP = /^\s*(stop|unsubscribe|band|बंद|थांबवा|रोको|no more)\s*[.!]*\s*$/i;
const START = /^\s*(start|subscribe|सुरू)\s*[.!]*\s*$/i;
const ORDER: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const rid = url.searchParams.get("r") ?? "";
  if (!rid) return new Response("missing", { status: 400 });

  if (req.method === "GET") {
    const wa = await loadWa(rid);
    const ok = wa && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === wa.verifyToken;
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const raw = await req.text();
  try {
    const wa = await loadWa(rid);
    if (!wa || !(await signatureOk(wa.appSecret, raw, req.headers.get("x-hub-signature-256")))) return new Response("bad signature", { status: 401 });
    const db = admin();
    const body = JSON.parse(raw);
    // deno-lint-ignore no-explicit-any
    for (const entry of (body?.entry ?? []) as any[]) {
      // deno-lint-ignore no-explicit-any
      for (const ch of (entry?.changes ?? []) as any[]) {
        const v = ch?.value ?? {};
        if (v?.metadata?.phone_number_id && v.metadata.phone_number_id !== wa.phoneId) continue; // another number
        // delivery receipts: only move forward (sent → delivered → read), or to failed
        // deno-lint-ignore no-explicit-any
        for (const s of (v.statuses ?? []) as any[]) {
          const st = String(s.status ?? "");
          if (!(st in ORDER)) continue;
          const { data: row } = await db.from("wa_messages").select("id,status").eq("rid", rid).eq("wa_id", String(s.id ?? "")).maybeSingle();
          if (!row || (ORDER[st] <= (ORDER[row.status] ?? 0) && st !== "failed")) continue;
          await db.from("wa_messages").update({ status: st, error: st === "failed" ? String(s.errors?.[0]?.title ?? s.errors?.[0]?.message ?? "failed").slice(0, 160) : null, updated_at: new Date().toISOString() }).eq("id", row.id);
        }
        // guests' replies: STOP / START
        // deno-lint-ignore no-explicit-any
        for (const m of (v.messages ?? []) as any[]) {
          const text = String(m?.text?.body ?? m?.button?.text ?? "");
          const from = String(m?.from ?? "");
          const p = phone10(from);
          if (p.length !== 10) continue;
          if (STOP.test(text)) {
            await db.rpc("svc_wa_optout", { r: rid, p_phone: p, p_out: true });
            const id = await sendText(wa, from, "You won't get offers from us on WhatsApp any more. Your bills will still come. Reply START to get offers again.\nतुम्हाला यापुढे ऑफर्स येणार नाहीत. START लिहा पुन्हा सुरू करण्यासाठी.");
            await db.from("wa_messages").insert({ rid, kind: "reply", to_phone: p, status: id ? "sent" : "failed", wa_id: id ?? null, template: "stop-reply" });
          } else if (START.test(text)) {
            await db.rpc("svc_wa_optout", { r: rid, p_phone: p, p_out: false });
            const id = await sendText(wa, from, "Done! You'll get our offers again. Reply STOP any time.");
            await db.from("wa_messages").insert({ rid, kind: "reply", to_phone: p, status: id ? "sent" : "failed", wa_id: id ?? null, template: "start-reply" });
          }
        }
      }
    }
    return json({ ok: true });
  } catch (e) {
    console.error("wa-webhook", (e as Error).message);
    return json({ ok: true }); // never make Meta retry forever on our bug
  }
});
