// Owner (or a sub admin with "team" access) sets a staff member's 4-digit PIN.
// Creates the staff member's sign-in account the first time.
import { admin, cors, hashPin, json, randomPassword, staffEmail, type MemberData } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const { rid, memberId, pin } = await req.json();
    if (typeof rid !== "string" || typeof memberId !== "string" || !/^\d{4}$/.test(String(pin))) return json({ error: "PIN must be 4 digits" }, 400);

    const db = admin();
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: who, error: whoErr } = await db.auth.getUser(token);
    if (whoErr || !who.user || who.user.is_anonymous) return json({ error: "Sign in first" }, 401);
    const caller = who.user;

    const { data: rest } = await db.from("restaurants").select("id, owner_uid").eq("id", rid).maybeSingle();
    if (!rest) return json({ error: "Restaurant not found" }, 404);

    const { data: targetRow } = await db.from("members").select("data").eq("rid", rid).eq("id", memberId).maybeSingle();
    const target = targetRow?.data as MemberData | undefined;
    if (!target) return json({ error: "Save this person first, then set the PIN" }, 404);
    if (target.role === "owner") return json({ error: "The owner signs in with email" }, 400);

    // Who may do this: the owner, or an active sub admin with "team" over all of the person's outlets.
    let allowed = rest.owner_uid === caller.id;
    if (!allowed && caller.app_metadata?.rid === rid) {
      const { data: meRow } = await db.from("members").select("data").eq("rid", rid).eq("id", String(caller.app_metadata?.member_id ?? "")).maybeSingle();
      const me = meRow?.data as MemberData | undefined;
      allowed = !!me && me.active !== false && me.role === "subadmin" && (me.perms ?? []).includes("team") &&
        target.role !== "subadmin" && (target.outletIds ?? []).every((o) => (me.outletIds ?? []).includes(o));
    }
    if (!allowed) return json({ error: "You can't set a PIN for this person" }, 403);

    const { data: existing } = await db.from("staff_pins").select("user_id").eq("rid", rid).eq("member_id", memberId).maybeSingle();
    let userId: string | null = existing?.user_id ?? null;
    if (userId) {
      const { error } = await db.auth.admin.getUserById(userId);
      if (error) userId = null;
    }
    if (!userId) {
      const email = staffEmail(rid, memberId);
      const { data: made, error } = await db.auth.admin.createUser({
        email, password: randomPassword(), email_confirm: true,
        app_metadata: { rid, member_id: memberId }, user_metadata: { name: target.name ?? "" },
      });
      if (made?.user) userId = made.user.id;
      else {
        // account already there from before: find it
        for (let page = 1; page < 50 && !userId; page++) {
          const { data: list } = await db.auth.admin.listUsers({ page, perPage: 200 });
          const u = list?.users.find((x) => x.email === email);
          if (u) userId = u.id;
          if (!list || list.users.length < 200) break;
        }
        if (!userId) return json({ error: error?.message ?? "Could not create the sign-in" }, 500);
      }
    }
    const { error: upErr } = await db.from("staff_pins").upsert({
      rid, member_id: memberId, user_id: userId, pin_hash: await hashPin(String(pin)), fails: 0, locked_until: null,
    });
    if (upErr) return json({ error: upErr.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
