"use client";

// Staff attendance and salary (Growth plan and up).
//
//   attendance   staff ask for a day (full or half, with overtime hours); the owner,
//                or someone with the "Staff attendance and salary" permission, approves it.
//   staff_pay    how each person is paid. Private: not in `members`, which all staff read.
//   pay_entries  advance, bonus, fine and "salary paid" lines.
//
// The database rules (supabase/payroll.sql) decide who sees what: staff only get their
// own rows, and nobody but the owner can change their own pay or approve their own days.
// Amounts never go into the activity log, because more people can read that.
import { createStore } from "./store";
import { currentMember, currentOutletId, logActivity } from "./live";
import { attendanceId, todayIN, type Attendance, type PayEntry, type PayEntryType, type StaffPay } from "./payroll-math";

export * from "./payroll-math";
const KIND_TEXT: Record<Attendance["kind"], string> = { full: "full day", half: "half day", leave: "leave" };

const attendanceStore = createStore<Attendance[]>([], "attendance", { kind: "collection", coll: "attendance" });
const staffPayStore = createStore<StaffPay[]>([], "staffPay", { kind: "collection", coll: "staff_pay" });
const payEntryStore = createStore<PayEntry[]>([], "payEntries", { kind: "collection", coll: "pay_entries" });
export const useAttendance = () => attendanceStore.use();
export const useStaffPay = () => staffPayStore.use();
export const usePayEntries = () => payEntryStore.use();

const byName = () => {
  const m = currentMember();
  return m ? (m.role === "owner" ? `${m.name} (Owner)` : m.name) : "Staff";
};
const nameOf = (memberId: string, names: Record<string, string>) => names[memberId] ?? "a team member";

export const attendanceActions = {
  /** A staff member asks for a day (or changes their request while it is still waiting). */
  request(input: { date: string; kind: Attendance["kind"]; otHours?: number; note?: string }) {
    const me = currentMember();
    if (!me) return;
    const id = attendanceId(me.id, input.date);
    const list = attendanceStore.get();
    const old = list.find((a) => a.id === id);
    if (old && old.status !== "pending") return;
    const row: Attendance = {
      id,
      memberId: me.id,
      date: input.date,
      kind: input.kind,
      ...(input.otHours ? { otHours: Math.min(16, Math.max(0, input.otHours)) } : {}),
      ...(input.note?.trim() ? { note: input.note.trim().slice(0, 200) } : {}),
      status: "pending",
      requestedAt: new Date().toISOString(),
      outletId: currentOutletId(),
    };
    attendanceStore.set(old ? list.map((a) => (a.id === id ? row : a)) : [row, ...list]);
  },
  /** Take back a request that is still waiting. */
  cancel(id: string) {
    const a = attendanceStore.get().find((x) => x.id === id);
    if (!a || a.status !== "pending") return;
    attendanceStore.set(attendanceStore.get().filter((x) => x.id !== id));
  },
  /** Owner / manager: approve or reject, optionally changing full ↔ half or the overtime first. */
  decide(id: string, status: "approved" | "rejected", names: Record<string, string>, patch?: { kind?: Attendance["kind"]; otHours?: number }) {
    const list = attendanceStore.get();
    const a = list.find((x) => x.id === id);
    if (!a) return;
    const next: Attendance = { ...a, ...(patch?.kind ? { kind: patch.kind } : {}), ...(patch?.otHours !== undefined ? { otHours: Math.min(16, Math.max(0, patch.otHours)) } : {}), status, decidedBy: byName(), decidedAt: new Date().toISOString() };
    attendanceStore.set(list.map((x) => (x.id === id ? next : x)));
    logActivity("team", `${status === "approved" ? "Approved" : "Rejected"} attendance of ${nameOf(a.memberId, names)} for ${a.date}${status === "approved" ? ` (${KIND_TEXT[next.kind]})` : ""}`, a.outletId);
  },
  /** Owner / manager marks a day directly (already approved). Replaces that day if it exists. */
  mark(memberId: string, date: string, kind: Attendance["kind"], otHours: number, names: Record<string, string>, note?: string) {
    const id = attendanceId(memberId, date);
    const now = new Date().toISOString();
    const row: Attendance = { id, memberId, date, kind, ...(otHours ? { otHours: Math.min(16, Math.max(0, otHours)) } : {}), ...(note?.trim() ? { note: note.trim().slice(0, 200) } : {}), status: "approved", requestedAt: now, decidedBy: byName(), decidedAt: now, byManager: true, outletId: currentOutletId() };
    const list = attendanceStore.get();
    attendanceStore.set(list.some((a) => a.id === id) ? list.map((a) => (a.id === id ? row : a)) : [row, ...list]);
    logActivity("team", `Marked attendance of ${nameOf(memberId, names)} for ${date} (${KIND_TEXT[kind]})`);
  },
  /** The manager marks a day absent (shows A; not paid). */
  markAbsent(memberId: string, date: string, names: Record<string, string>) {
    const id = attendanceId(memberId, date);
    const now = new Date().toISOString();
    const old = attendanceStore.get().find((x) => x.id === id);
    const row: Attendance = { id, memberId, date, kind: "full", status: "rejected", requestedAt: old?.requestedAt ?? now, decidedBy: byName(), decidedAt: now, byManager: true, outletId: old?.outletId ?? currentOutletId() };
    attendanceStore.set(old ? attendanceStore.get().map((x) => (x.id === id ? row : x)) : [...attendanceStore.get(), row]);
    logActivity("team", `Marked ${nameOf(memberId, names)} absent for ${date}`);
  },
  remove(id: string, names: Record<string, string>) {
    const a = attendanceStore.get().find((x) => x.id === id);
    attendanceStore.set(attendanceStore.get().filter((x) => x.id !== id));
    if (a) logActivity("team", `Removed attendance of ${nameOf(a.memberId, names)} for ${a.date}`);
  },
};

export const payActions = {
  setPay(p: StaffPay, names: Record<string, string>) {
    const list = staffPayStore.get();
    const row: StaffPay = { ...p, amount: Math.max(0, Math.round(p.amount)), otRate: p.otRate ? Math.max(0, Math.round(p.otRate)) : undefined, updatedAt: new Date().toISOString() };
    staffPayStore.set(list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? row : x)) : [...list, row]);
    logActivity("team", `Changed salary settings of ${nameOf(p.id, names)}`);
  },
  addEntry(e: { memberId: string; month: string; type: PayEntryType; amount: number; note?: string; method?: PayEntry["method"]; date?: string }) {
    const row: PayEntry = {
      id: `pe${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      memberId: e.memberId,
      month: e.month,
      type: e.type,
      amount: Math.max(0, Math.round(e.amount)),
      date: e.date ?? todayIN(),
      ...(e.note?.trim() ? { note: e.note.trim().slice(0, 200) } : {}),
      ...(e.method ? { method: e.method } : {}),
      by: byName(),
    };
    payEntryStore.set([row, ...payEntryStore.get()]);
  },
  removeEntry(id: string) {
    payEntryStore.set(payEntryStore.get().filter((x) => x.id !== id));
  },
};
