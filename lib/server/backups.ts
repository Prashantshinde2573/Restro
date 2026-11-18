// Restaurant-wise backups (Supabase Free plan has none of its own).
// Every night each restaurant's data goes to its own file in the private "backups" bucket:
//   backups/<restaurant id>/<YYYY-MM-DD>.json   — kept 30 days.
// On Sundays the super admin also gets the files by email, so a copy lives outside Supabase.
import { admin } from "./supabase-admin";
import { env, FROM_SUPPORT, log } from "./env";
import { sendEmail } from "./resend";

const BUCKET = "backups";
const KEEP_DAYS = 30;
const TABLES = ["outlets", "members", "categories", "menu_items", "dining_tables", "orders", "guests", "feedback", "stock_items", "coupons", "activity", "waiter_calls", "attendance", "staff_pay", "pay_entries"] as const;

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // India date

async function rowsOf(table: string, rid: string) {
  const db = admin();
  const out: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").eq("rid", rid).order("id").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function backupRestaurant(rid: string) {
  const db = admin();
  const { data: restaurant, error } = await db.from("restaurants").select("*").eq("id", rid).maybeSingle();
  if (error || !restaurant) throw new Error(`restaurant ${rid}: ${error?.message ?? "not found"}`);
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await rowsOf(t, rid);
  const body = JSON.stringify({ kind: "restropi-backup", version: 1, rid, at: new Date().toISOString(), restaurant, tables });
  const path = `${rid}/${today()}.json`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, new Blob([body], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (upErr) throw new Error(`upload ${path}: ${upErr.message}`);
  return { rid, name: String((restaurant as { name?: string }).name ?? rid), path, bytes: body.length, rows: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), body };
}

async function prune(rid: string) {
  const db = admin();
  const { data } = await db.storage.from(BUCKET).list(rid, { limit: 1000 });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  const old = (data ?? []).filter((f) => f.name.replace(".json", "") < cutoff).map((f) => `${rid}/${f.name}`);
  if (old.length) await db.storage.from(BUCKET).remove(old);
  return old.length;
}

/** Back up every restaurant. Returns what was saved; never throws for one bad restaurant. */
export async function runBackups({ email }: { email: boolean }) {
  const db = admin();
  const { data: list, error } = await db.from("restaurants").select("id").order("id");
  if (error) throw new Error(error.message);
  const done: { rid: string; name: string; bytes: number; rows: Record<string, number>; body: string }[] = [];
  const failed: { rid: string; reason: string }[] = [];
  for (const r of list ?? []) {
    try {
      done.push(await backupRestaurant(r.id));
      await prune(r.id);
    } catch (e) {
      failed.push({ rid: r.id, reason: (e as Error).message.slice(0, 200) });
    }
  }
  let emailed = false;
  if (email && done.length && env.resendKey) {
    const res = await sendEmail({
      from: FROM_SUPPORT,
      to: env.notifyEmail,
      subject: `Restropi backups · ${today()} · ${done.length} restaurants`,
      text: `Weekly copy of every restaurant's data (${done.length} files attached).${failed.length ? `\nFailed: ${failed.map((f) => f.rid).join(", ")}` : ""}`,
      html: `<p>Weekly copy of every restaurant's data: ${done.length} files attached. Keep this email.</p>${failed.length ? `<p><b>Failed:</b> ${failed.map((f) => f.rid).join(", ")}</p>` : ""}`,
      tag: "backup",
      attachments: done.map((d) => ({ filename: `${d.rid}-${today()}.json`, content: Buffer.from(d.body).toString("base64") })),
    });
    emailed = res.ok;
  }
  const summary = { saved: done.map(({ rid, bytes }) => ({ rid, bytes })), failed, emailed };
  log("backup.done", { saved: done.length, failed: failed.length, emailed });
  return summary;
}

/** Super admin: the backup files of every restaurant, newest first, with short-lived download links. */
export async function listBackups() {
  const db = admin();
  const { data: rests } = await db.from("restaurants").select("id, name").order("name");
  const out: { rid: string; name: string; files: { date: string; size: number; url: string | null }[] }[] = [];
  for (const r of rests ?? []) {
    const { data } = await db.storage.from(BUCKET).list(r.id, { limit: 100, sortBy: { column: "name", order: "desc" } });
    const files = [];
    for (const f of (data ?? []).filter((x) => x.name.endsWith(".json")).slice(0, KEEP_DAYS)) {
      const { data: s } = await db.storage.from(BUCKET).createSignedUrl(`${r.id}/${f.name}`, 600, { download: `${r.id}-${f.name}` });
      files.push({ date: f.name.replace(".json", ""), size: Number((f.metadata as { size?: number } | null)?.size ?? 0), url: s?.signedUrl ?? null });
    }
    out.push({ rid: r.id, name: r.name, files });
  }
  return out;
}
