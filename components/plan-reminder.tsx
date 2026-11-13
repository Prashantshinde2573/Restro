"use client";

// Plan reminders in the app: a banner and a bell notice every day from N days before the plan
// ends (N set by the Restropi team in the super admin), and every day during a grace period.
import clsx from "clsx";
import { BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createStore } from "@/lib/store";
import { DEFAULT_REMINDERS, getPlatformSettings, type PlanReminders } from "@/lib/cloud";
import { useAccount, useMe } from "@/lib/live";
import { PLAN_NAME, isOwner } from "@/lib/access";
import { appReminderDue, dateIN, planStatus, type PlanStatus } from "@/lib/plan-status";
import { openPlanSheet } from "./plan-sheet";
import { pushNotice } from "./notifications";

const remindersStore = createStore<PlanReminders | null>(null);
let loading = false;
/** The Restropi team's reminder settings (loaded once per visit). */
export function usePlanReminders(): PlanReminders {
  const r = remindersStore.use();
  useEffect(() => {
    if (r || loading) return;
    loading = true;
    getPlatformSettings()
      .then((p) => remindersStore.set(p.reminders ?? DEFAULT_REMINDERS))
      .catch(() => remindersStore.set(DEFAULT_REMINDERS))
      .finally(() => (loading = false));
  }, [r]);
  return r ?? DEFAULT_REMINDERS;
}

export function usePlanStatus(): PlanStatus {
  const a = useAccount();
  return planStatus(a);
}

/** Should the owner be reminded today? null = no; otherwise what to say. */
export function usePlanReminder(): { st: PlanStatus; due: boolean } | null {
  const me = useMe();
  const r = usePlanReminders();
  const st = usePlanStatus();
  if (!isOwner(me) || st.locked) return null;
  if (st.inGrace) return { st, due: true }; // every day while the grace period runs
  return appReminderDue(r, st.daysLeft) ? { st, due: true } : null; // every day in the window
}

/** Days to show on the "renew" badge in the menu, or null. */
export function useRenewBadge(): number | null {
  const x = usePlanReminder();
  return x ? x.st.daysLeft : null;
}

export function RenewBanner() {
  const x = usePlanReminder();
  const { plan } = useAccount();
  const key = `restropi.renewHidden.${new Date().toDateString()}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (!x || hidden) return null;
  const { st } = x;
  const d = st.daysLeft;
  const when = d <= 0 ? "today" : `in ${d} ${d === 1 ? "day" : "days"}`;
  return (
    <div className={clsx("flex items-center gap-3 px-4 py-2.5 text-[13.5px] lg:rounded-t-[28px] lg:px-6", st.inGrace ? "bg-rose text-white" : "bg-rose-soft text-rose")} role="status">
      <BellRing size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {st.inGrace ? (
          <><b>Your {PLAN_NAME[plan]} plan has ended. Your store is running on a grace period until {dateIN(st.deadline)}</b> ({when}). Please renew to keep billing and the QR menu on.</>
        ) : (
          <><b>{PLAN_NAME[plan]} plan ends {when}</b> ({dateIN(st.deadline)}). Renew to avoid any break.</>
        )}
      </span>
      <button onClick={() => openPlanSheet()} className={clsx("shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold", st.inGrace ? "bg-white text-rose" : "bg-rose text-white")}>Renew</button>
      <button
        aria-label="Hide for today"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(key, "1");
          } catch {}
        }}
        className="shrink-0 p-1"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/** Once a day, on a reminder day, a notice in the bell too. */
export function PlanNotice() {
  const x = usePlanReminder();
  const { plan } = useAccount();
  const due = !!x;
  const inGrace = !!x?.st.inGrace;
  const deadline = x?.st.deadline ?? "";
  const d = x?.st.daysLeft ?? 0;
  useEffect(() => {
    if (!due) return;
    const key = `restropi.planNotice.${new Date().toDateString()}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    pushNotice({
      kind: "plan",
      title: inGrace ? "Grace period · please renew" : `Plan ends ${d <= 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`}`,
      body: inGrace
        ? `Your store runs until ${dateIN(deadline)}. Renew your ${PLAN_NAME[plan]} plan to keep it on.`
        : `${PLAN_NAME[plan]} plan · ${dateIN(deadline)}. Renew to avoid any break.`,
      href: "/app/settings#plan",
    });
  }, [due, inGrace, deadline, d, plan]);
  return null;
}
