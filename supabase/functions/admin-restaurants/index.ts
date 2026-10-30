// Super admin only: add a restaurant with its owner login, reset an owner's
// password, or delete a restaurant with everything in it.
import { admin, caller, cors, json, tempPassword } from "../_shared/common.ts";

const PLANS = ["starter", "growth", "pro", "chain"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "restro";
const rand = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const me = await caller(req);
    if (!me) return json({ error: "Sign in first" }, 401);
    const db = admin();
    const { data: isAdmin } = await db.from("platform_admins").select("user_id").eq("user_id", me.id).maybeSingle();
    if (!isAdmin) return json({ error: "Only the super admin can do this" }, 403);

    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "create") {
      const name = String(body.name ?? "").trim();
      const ownerName = String(body.ownerName ?? "").trim();
      const email = String(body.ownerEmail ?? "").trim().toLowerCase();
      const plan = PLANS.includes(body.plan) ? body.plan : "growth";
      const months = Math.min(Math.max(Number(body.months ?? 1), 0), 36);
      const trialDays = Math.min(Math.max(Number(body.trialDays ?? 0), 0), 90);
      const o = body.outlet ?? {};
      const tables = Math.min(Math.max(Number(body.tables ?? 0), 0), 200);
      if (name.length < 2) return json({ error: "Restaurant name is needed" }, 400);
      if (ownerName.length < 2) return json({ error: "Owner name is needed" }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Owner email looks wrong" }, 400);

      const password = tempPassword();
      const { data: made, error: uErr } = await db.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name: ownerName, must_change_password: true },
      });
      if (uErr || !made.user) {
        const taken = /already|registered|exists/i.test(uErr?.message ?? "");
        return json({ error: taken ? "This email already has an account. Use another email." : uErr?.message ?? "Could not create the owner login" }, 400);
      }
      const uid = made.user.id;
      const rid = `${slug(name)}-${rand(5)}`;
      const renews = new Date(Date.now() + (months * 30 + trialDays) * 86_400_000).toISOString();
      const outletId = "main";
      const fail = async (msg: string) => {
        await db.from("restaurants").delete().eq("id", rid);
        await db.auth.admin.deleteUser(uid);
        return json({ error: msg }, 500);
      };

      const { error: rErr } = await db.from("restaurants").insert({
        id: rid, owner_uid: uid, name, owner: ownerName, owner_email: email, plan, renews_at: renews,
        phone: String(body.phone ?? "").slice(0, 20), city: String(body.city ?? "").slice(0, 60), notes: String(body.notes ?? "").slice(0, 500),
      });
      if (rErr) return fail(rErr.message);
      const outlet = {
        id: outletId, name: String(o.name ?? "").trim() || "Main", address: String(o.address ?? "").trim(),
        businessType: o.businessType === "cafe" ? "cafe" : "restaurant", upi: String(o.upi ?? "").trim(),
        payFirst: !!o.payFirst, sort: 0,
      };
      const rows: Promise<{ error: unknown }>[] = [
        db.from("outlets").insert({ rid, id: outletId, data: outlet }),
        db.from("members").insert({ rid, id: "owner", data: {
          id: "owner", name: ownerName, phone: String(body.phone ?? ""), role: "owner", title: "Owner",
          outletIds: [outletId], perms: [], active: true, hue: 160,
        } }),
      ];
      if (tables > 0) {
        const stamp = Date.now().toString(36);
        rows.push(db.from("dining_tables").insert(Array.from({ length: tables }, (_, i) => ({
          rid, id: `t${i + 1}`,
          data: { id: `t${i + 1}`, name: `T${i + 1}`, zone: "Indoor", seats: 4, outletId, parties: [], visitId: `t${i + 1}-${stamp}` },
        }))));
      }
      for (const r of await Promise.all(rows)) if (r.error) return fail(String((r.error as { message?: string }).message ?? r.error));
      return json({ rid, ownerEmail: email, tempPassword: password });
    }

    const rid = String(body.rid ?? "");
    const { data: rest } = await db.from("restaurants").select("id, owner_uid, name").eq("id", rid).maybeSingle();
    if (!rest) return json({ error: "Restaurant not found" }, 404);

    if (action === "reset_owner_password") {
      const password = tempPassword();
      const { data: u } = await db.auth.admin.getUserById(rest.owner_uid);
      const { error } = await db.auth.admin.updateUserById(rest.owner_uid, {
        password, user_metadata: { ...(u?.user?.user_metadata ?? {}), must_change_password: true },
      });
      if (error) return json({ error: error.message }, 500);
      return json({ tempPassword: password, ownerEmail: u?.user?.email ?? "" });
    }

    if (action === "delete") {
      if (String(body.confirmName ?? "").trim().toLowerCase() !== rest.name.trim().toLowerCase())
        return json({ error: "Type the restaurant name exactly to delete it" }, 400);
      const { data: pins } = await db.from("staff_pins").select("user_id").eq("rid", rid);
      const { error } = await db.from("restaurants").delete().eq("id", rid);
      if (error) return json({ error: error.message }, 500);
      for (const p of pins ?? []) if (p.user_id) await db.auth.admin.deleteUser(p.user_id);
      await db.auth.admin.deleteUser(rest.owner_uid);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
