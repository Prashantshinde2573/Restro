// Where a restaurant's plan stands: running, ending soon, in a grace period, or ended (locked).
// Used by the app (banner, bell, lock screen), the guest menu, the super admin and the reminder emails.

const DAY = 86_400_000;
export const daysUntil = (iso: string, now = Date.now()) => Math.ceil((new Date(iso).getTime() - now) / DAY);

export type PlanStatus = {
  /** the paid period is over */
  ended: boolean;
  /** ended, but the super admin gave a grace period that is still running */
  inGrace: boolean;
  /** ended and no grace left (or suspended): billing and the QR menu are off */
  locked: boolean;
  /** the date that matters now: the plan's end, or the end of the grace period */
  deadline: string;
  /** days to that date (0 = today) */
  daysLeft: number;
};

export function planStatus(a: { renewsAt: string; graceUntil?: string | null; status?: string }, now = Date.now()): PlanStatus {
  const ended = new Date(a.renewsAt).getTime() <= now;
  const inGrace = ended && !!a.graceUntil && new Date(a.graceUntil).getTime() > now;
  const deadline = inGrace ? a.graceUntil! : a.renewsAt;
  return { ended, inGrace, locked: a.status === "suspended" || (ended && !inGrace), deadline, daysLeft: daysUntil(deadline, now) };
}

/** App (banner + bell): every day from `from` days before the end, until the last day. */
export const appReminderDue = (r: PlanReminders, daysLeft: number) => r.app && daysLeft >= 0 && daysLeft <= r.from;

/** Email: only on the chosen days before the end (e.g. 10, 3 and 1 days before). */
export const emailReminderDue = (r: PlanReminders, daysLeft: number) => r.email && daysLeft >= 0 && r.days.includes(daysLeft);

export const dateIN = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export interface PlanReminders {
  /** app banner + bell: every day from this many days before the plan ends */
  from: number;
  /** emails: on these days before the plan ends (0 = the last day) */
  days: number[];
  email: boolean;
  app: boolean;
}
export const DEFAULT_REMINDERS: PlanReminders = { from: 10, days: [10, 3, 1], email: true, app: true };

export function remindersOf(row: Record<string, unknown> | null | undefined): PlanReminders {
  if (!row) return DEFAULT_REMINDERS;
  const days = Array.isArray(row.remind_days) ? (row.remind_days as number[]).filter((n) => Number.isFinite(n) && n >= 0) : DEFAULT_REMINDERS.days;
  return {
    from: Number(row.remind_from) || DEFAULT_REMINDERS.from,
    days: [...new Set(days)].sort((a, b) => b - a),
    email: row.remind_email !== false,
    app: row.remind_app !== false,
  };
}
