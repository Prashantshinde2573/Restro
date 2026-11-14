// Staff sign-in with a 4-digit PIN. Returns a normal Supabase session.
// 5 wrong tries lock that person for 15 minutes. Each try takes its slot in the
// database (staff_pin_try) BEFORE the PIN is checked, so many tries sent at once
// can't get past the limit.
import { admin, checkPin, cors, json, publicClient, randomPassword, staffEmail, type MemberData } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { rid, memberId, pin } = await req.json();
    if (typeof rid !== "string" || typeof memberId !== "string" || !/^\d{4}$/.test(String(pin))) return json({ error: "Wrong PIN" }, 400);
    const db = admin();

    const { data: slot, error: tryErr } = await db.rpc("staff_pin_try", { p_rid: rid, p_member: memberId });
    if (tryErr) return json({ error: "Could not sign in. Try again." }, 500);
    if (slot === "missing") return json({ error: "No PIN set yet. Ask your manager to set one." }, 404);
    if (slot === "locked") return json({ error: "Too many tries. Wait 15 minutes." }, 429);

    const { data: row } = await db.from("staff_pins").select("*").eq("rid", rid).eq("member_id", memberId).maybeSingle();
    if (!row) return json({ error: "No PIN set yet. Ask your manager to set one." }, 404);

    const { data: mRow } = await db.from("members").select("data").eq("rid", rid).eq("id", memberId).maybeSingle();
    const m = mRow?.data as MemberData | undefined;
    if (!m || m.active === false || m.role === "owner") return json({ error: "This person can't sign in" }, 403);

    if (!(await checkPin(String(pin), row.pin_hash))) {
      const locked = row.locked_until && new Date(row.locked_until) > new Date();
      return json({ error: locked ? "Too many tries. Wait 15 minutes." : "Wrong PIN" }, 401);
    }
    await db.from("staff_pins").update({ fails: 0, locked_until: null }).eq("rid", rid).eq("member_id", memberId);

    // fresh one-time password each sign-in, then a normal session for the phone
    const password = randomPassword();
    // also moves older staff accounts (@staff.restro.app, @staff.rastropi.app) to the current address
    const { error: uErr } = await db.auth.admin.updateUserById(row.user_id, {
      email: staffEmail(rid, memberId), email_confirm: true, password, app_metadata: { rid, member_id: memberId },
    });
    if (uErr) return json({ error: uErr.message }, 500);
    const { data: s, error: sErr } = await publicClient().auth.signInWithPassword({ email: staffEmail(rid, memberId), password });
    if (sErr || !s.session) return json({ error: sErr?.message ?? "Could not sign in" }, 500);
    return json({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
