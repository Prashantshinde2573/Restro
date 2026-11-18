// Staff sign-in with a 4-digit PIN. Returns a normal Supabase session.
// Two ways in:
//   * { phone, pin }          their 10-digit mobile + PIN, works on any phone or tablet
//   * { rid, memberId, pin }  older screens that picked a face first
// 5 wrong tries lock that person for 15 minutes. Each try takes its slot in the
// database (staff_pin_try) BEFORE the PIN is checked, so many tries sent at once
// can't get past the limit.
import { admin, checkPin, cors, json, publicClient, randomPassword, staffEmail, type MemberData } from "../_shared/common.ts";

type Who = { rid: string; memberId: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const body = await req.json();
    const pin = String(body?.pin ?? "");
    if (!/^\d{4}$/.test(pin)) return json({ error: "Enter your 4-digit PIN" }, 400);
    const db = admin();

    // who could this be?
    let people: Who[] = [];
    const byPhone = typeof body?.phone === "string";
    if (byPhone) {
      const digits = body.phone.replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) return json({ error: "Enter your 10-digit mobile number" }, 400);
      const { data, error } = await db.rpc("staff_by_phone", { p_digits: digits });
      if (error) return json({ error: "Could not sign in. Try again." }, 500);
      people = ((data ?? []) as { rid: string; member_id: string }[]).map((r) => ({ rid: r.rid, memberId: r.member_id }));
      // the same number works in more than one restaurant: the one they picked
      if (typeof body?.rid === "string" && body.rid) people = people.filter((p) => p.rid === body.rid);
      if (!people.length) return json({ error: "Wrong mobile number or PIN" }, 401);
    } else {
      if (typeof body?.rid !== "string" || typeof body?.memberId !== "string") return json({ error: "Wrong PIN" }, 400);
      people = [{ rid: body.rid, memberId: body.memberId }];
    }

    // take a try slot for each, then check the PIN
    let missing = 0;
    let locked = 0;
    const hits: (Who & { userId: string })[] = [];
    for (const p of people) {
      const { data: slot, error: tryErr } = await db.rpc("staff_pin_try", { p_rid: p.rid, p_member: p.memberId });
      if (tryErr) return json({ error: "Could not sign in. Try again." }, 500);
      if (slot === "missing") { missing++; continue; }
      if (slot === "locked") { locked++; continue; }
      const { data: row } = await db.from("staff_pins").select("*").eq("rid", p.rid).eq("member_id", p.memberId).maybeSingle();
      if (!row) { missing++; continue; }
      if (await checkPin(pin, row.pin_hash)) hits.push({ ...p, userId: row.user_id });
    }
    if (hits.length > 1) {
      // only restaurants where this person can still sign in
      const { data: ms } = await db.from("members").select("rid,id,data").in("rid", hits.map((h) => h.rid));
      const ok = (h: Who) => {
        const d = ms?.find((x) => x.rid === h.rid && x.id === h.memberId)?.data as MemberData | undefined;
        return !!d && d.active !== false && d.role !== "owner";
      };
      const usable = hits.filter(ok);
      if (usable.length === 1) hits.splice(0, hits.length, usable[0]);
    }
    if (hits.length > 1) {
      // same number and PIN in two or more restaurants: ask which one (never guess)
      for (const h of hits) await db.from("staff_pins").update({ fails: 0, locked_until: null }).eq("rid", h.rid).eq("member_id", h.memberId);
      const { data: rs } = await db.from("restaurants").select("id,name,status").in("id", hits.map((h) => h.rid));
      const choose = hits
        .map((h) => ({ rid: h.rid, name: rs?.find((x) => x.id === h.rid)?.name ?? "Restaurant", paused: rs?.find((x) => x.id === h.rid)?.status === "suspended" }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return json({ choose });
    }
    const hit = hits[0] ?? null;
    if (!hit) {
      if (locked && locked + missing === people.length) return json({ error: "Too many tries. Wait 15 minutes." }, 429);
      if (missing === people.length) return json({ error: "No PIN set yet. Ask your manager to set one." }, 404);
      return json({ error: byPhone ? "Wrong mobile number or PIN" : "Wrong PIN" }, 401);
    }
    const { rid, memberId } = hit;

    const { data: mRow } = await db.from("members").select("data").eq("rid", rid).eq("id", memberId).maybeSingle();
    const m = mRow?.data as MemberData | undefined;
    if (!m || m.active === false || m.role === "owner") return json({ error: "This person can't sign in" }, 403);
    await db.from("staff_pins").update({ fails: 0, locked_until: null }).eq("rid", rid).eq("member_id", memberId);

    // fresh one-time password each sign-in, then a normal session for the phone
    const password = randomPassword();
    // also moves older staff accounts (@staff.restro.app, @staff.rastropi.app) to the current address
    const { error: uErr } = await db.auth.admin.updateUserById(hit.userId, {
      email: staffEmail(rid, memberId), email_confirm: true, password, app_metadata: { rid, member_id: memberId },
    });
    if (uErr) return json({ error: uErr.message }, 500);
    const { data: s, error: sErr } = await publicClient().auth.signInWithPassword({ email: staffEmail(rid, memberId), password });
    if (sErr || !s.session) return json({ error: sErr?.message ?? "Could not sign in" }, 500);
    return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token, rid, memberId });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
