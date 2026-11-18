// Plan emails to owners: reminders (daily job) and updates (super admin actions).
import { emailReminderDue, planStatus, remindersOf } from "@/lib/plan-status";
import { plans } from "@/lib/plans";
import { env, FROM_SUPPORT, log, mask } from "./env";
import { sendEmail } from "./resend";
import { admin } from "./supabase-admin";
import { graceEmail, planEndingEmail, planUpdatedEmail, teamPlanSummary } from "./templates";

type Row = { id: string; name: string; owner: string | null; owner_email: string | null; plan: string; renews_at: string; grace_until: string | null; status: string };
const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

/** One grace email per grace period (same key for the daily job and the super admin's action). */
const graceKey = (until: string) => `grace:${until.slice(0, 10)}`;

/** Claim a reminder key; false when it was already sent (so a second run sends nothing). */
async function claim(rid: string, key: string) {
  const { error } = await admin().from("plan_reminders").insert({ rid, key });
  return !error; // a duplicate key fails the insert
}
async function unclaim(rid: string, key: string) {
  await admin().from("plan_reminders").delete().eq("rid", rid).eq("key", key);
}

export async function runPlanReminders(origin: string, now = new Date()) {
  const db = admin();
  const { data: ps } = await db.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  const rem = remindersOf(ps);
  const { data: rows, error } = await db.from("restaurants").select("id, name, owner, owner_email, plan, renews_at, grace_until, status").eq("status", "active");
  if (error) throw new Error(error.message);
  const sent: { restaurant: string; what: string }[] = [];
  let failed = 0;
  for (const r of (rows ?? []) as Row[]) {
    if (!r.owner_email) continue;
    const st = planStatus({ renewsAt: r.renews_at, graceUntil: r.grace_until, status: r.status }, now.getTime());
    const info = { restaurant: r.name, owner: r.owner ?? "", plan: planName(r.plan), renewUrl: `${origin}/app/settings#plan` };
    let key = "";
    let mail = null as ReturnType<typeof planEndingEmail> | null;
    let what = "";
    if (st.inGrace) {
      // one email when the grace period starts (the super admin's "grace given" email counts as it)
      key = graceKey(r.grace_until!);
      mail = graceEmail({ ...info, graceUntil: r.grace_until!, daysLeft: st.daysLeft });
      what = `plan ended · grace period till ${r.grace_until!.slice(0, 10)}`;
    } else if (!st.ended) {
      if (!emailReminderDue(rem, st.daysLeft)) continue; // only on the chosen days (e.g. 10, 3, 1 days before)
      key = `before:${r.renews_at.slice(0, 10)}:${st.daysLeft}`;
      mail = planEndingEmail({ ...info, endsAt: r.renews_at, daysLeft: st.daysLeft });
      what = `plan ends ${st.daysLeft <= 0 ? "today" : `in ${st.daysLeft}d`}`;
    } else continue; // ended without grace: the app shows it; no more emails
    if (!(await claim(r.id, key))) continue;
    const res = await sendEmail({ from: FROM_SUPPORT, to: r.owner_email, replyTo: FROM_SUPPORT, tag: "plan_reminder", ...mail });
    if (res.ok) {
      sent.push({ restaurant: r.name, what });
      log("plan.reminder", { rid: r.id, key, to: mask(r.owner_email) });
    } else {
      failed++;
      await unclaim(r.id, key); // try again on the next run
    }
  }
  if (sent.length) await sendEmail({ from: FROM_SUPPORT, to: env.notifyEmail, tag: "plan_summary", ...teamPlanSummary(sent) });
  return { checked: rows?.length ?? 0, sent: sent.length, failed };
}

/** Right after the super admin renews, changes the plan or gives a grace period. */
export async function sendPlanUpdate(rid: string, event: "renewed" | "grace" | "plan", origin: string) {
  const { data: r } = await admin().from("restaurants").select("id, name, owner, owner_email, plan, renews_at, grace_until, status").eq("id", rid).maybeSingle();
  const row = r as Row | null;
  if (!row?.owner_email) return { ok: false, error: "No owner email" };
  const info = { restaurant: row.name, owner: row.owner ?? "", plan: planName(row.plan), renewUrl: `${origin}/app/settings#plan` };
  const st = planStatus({ renewsAt: row.renews_at, graceUntil: row.grace_until, status: row.status });
  const mail =
    event === "grace"
      ? row.grace_until && st.inGrace
        ? graceEmail({ ...info, graceUntil: row.grace_until, daysLeft: st.daysLeft, given: true })
        : row.grace_until
          ? graceEmail({ ...info, graceUntil: row.grace_until, daysLeft: Math.ceil((new Date(row.grace_until).getTime() - Date.now()) / 86_400_000), given: true })
          : null
      : planUpdatedEmail({ ...info, until: row.renews_at, changed: event === "plan" });
  if (!mail) return { ok: false, error: "Nothing to send" };
  // grace: a single email per grace period, whoever sends it first
  const gk = event === "grace" && row.grace_until ? graceKey(row.grace_until) : "";
  if (gk && !(await claim(row.id, gk))) return { ok: true, already: true };
  const res = await sendEmail({ from: FROM_SUPPORT, to: row.owner_email, replyTo: FROM_SUPPORT, tag: `plan_${event}`, ...mail });
  if (!res.ok && gk) await unclaim(row.id, gk);
  if (res.ok) log("plan.update_sent", { rid, event, to: mask(row.owner_email) });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
