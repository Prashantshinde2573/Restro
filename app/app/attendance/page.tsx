"use client";

import { L } from "@/lib/i18n";
// Staff: ask for today's attendance (full or half day, overtime), or a day missed in the
// last week. The owner or a manager approves it on Attendance & salary.
import clsx from "clsx";
import { CalendarCheck, Clock, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Empty, Field, Group, Page, PageHeader, Segmented, inputCls } from "@/components/ui";
import { StatusPill } from "@/components/attendance-bits";
import { useToast } from "@/components/toast";
import { useMe } from "@/lib/live";
import { useReady } from "@/lib/store";
import { onPayroll } from "@/lib/access";
import { inr } from "@/lib/format";
import {
  attendanceActions,
  attendanceId,
  dayLabel,
  monthLabel,
  monthOf,
  payslip,
  todayIN,
  useAttendance,
  usePayEntries,
  useStaffPay,
} from "@/lib/payroll";

// the last week (a day worked or a missed request), and the next 30 days (leave asked ahead)
const lastWeek = (today: string) => {
  const out: string[] = [];
  const t = new Date(today + "T00:00:00Z").getTime();
  for (let i = -30; i <= 7; i++) out.push(new Date(t - i * 86_400_000).toISOString().slice(0, 10));
  return out.sort().reverse();
};
const KIND_LABEL = { full: "Full day", half: "Half day", leave: "Leave" } as const;

export default function MyAttendancePage() {
  const me = useMe();
  const toast = useToast();
  const ready = useReady("attendance");
  const today = todayIN();
  const month = monthOf(today);
  const all = useAttendance().filter((a) => a.memberId === me?.id);
  const pay = useStaffPay().find((p) => p.id === me?.id);
  const entries = usePayEntries().filter((e) => e.memberId === me?.id);

  const [date, setDate] = useState(today);
  const current = all.find((a) => a.id === attendanceId(me?.id ?? "", date));
  const [kind, setKind] = useState<"full" | "half" | "leave">("full");
  const [ot, setOt] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  const pick = (d: string) => {
    setDate(d);
    setEditing(false);
    const a = all.find((x) => x.id === attendanceId(me?.id ?? "", d));
    setKind(a?.kind ?? (d > today ? "leave" : "full"));
    setOt(a?.otHours ? String(a.otHours) : "");
    setNote(a?.note ?? "");
  };

  const send = () => {
    const hours = Number(ot || 0);
    if (!Number.isFinite(hours) || hours < 0 || hours > 16) return toast(L("Overtime: 0 to 16 hours"));
    if (date > today && kind !== "leave") return toast(L("Days ahead can only be asked as leave"));
    attendanceActions.request({ date, kind, otHours: kind === "leave" ? 0 : hours, note });
    setEditing(false);
    toast(current ? "Request changed" : "Sent for approval");
  };

  const mine = all.filter((a) => monthOf(a.date) === month);
  const slip = payslip(month, pay, all, entries, today);
  const showForm = !current || (current.status === "pending" && editing);

  if (!me) return null;
  if (!onPayroll(me))
    return (
      <>
        <PageHeader title={L("My attendance")} />
        <Page>
          <Empty icon={<CalendarCheck size={22} />} title={L("Attendance is off for you")} body={L("The owner keeps attendance and salary for staff. They can turn it on for you in Members & access.")} />
        </Page>
      </>
    );
  return (
    <>
      <PageHeader title={L("My attendance")} subtitle={`${me.name} · ${monthLabel(month)}`} />
      <Page className="space-y-6">
        <Group title={L("Ask for a day")}>
          <div className="space-y-4">
            <Field label={L("Day")}>
              <select className={inputCls} value={date} onChange={(e) => pick(e.target.value)}>
                {lastWeek(today).map((d) => (
                  <option key={d} value={d}>
                    {d === today ? L("Today · {0}", dayLabel(d)) : d > today ? L("{0} · leave", dayLabel(d)) : dayLabel(d)}
                  </option>
                ))}
              </select>
            </Field>

            {current && !showForm ? (
              <div className="flex flex-wrap items-center gap-3 rounded-ctl bg-sunken/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-semibold">
                    {KIND_LABEL[current.kind]}
                    <StatusPill a={current} />
                  </div>
                  <div className="text-[13px] text-muted">
                    {current.otHours ? L("Overtime {0} h · ", current.otHours) : ""}
                    {current.status === "pending" ? L("Your manager will approve it.") : current.status === "approved" ? L("Approved by {0}", current.decidedBy ?? "your manager") : L("Talk to your manager about this day.")}
                  </div>
                </div>
                {current.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="tinted" onClick={() => setEditing(true)}>{L("Change")}</Button>
                    <Button size="sm" variant="tinted" onClick={() => { attendanceActions.cancel(current.id); toast(L("Request taken back")); }} aria-label={L("Take back")}><Trash2 size={15} /></Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Segmented
                  value={kind}
                  onChange={setKind}
                  options={date > today ? [{ value: "leave", label: "Leave" }] : [{ value: "full", label: "Full day" }, { value: "half", label: "Half day" }, { value: "leave", label: "Leave" }]}
                  className="w-full"
                />
                <div className={clsx("grid gap-3", kind === "leave" ? "grid-cols-1" : "grid-cols-2")}>
                  {kind !== "leave" && (
                    <Field label={L("Overtime (hours)")} hint={L("Empty if none")}>
                      <input className={inputCls} inputMode="decimal" type="number" min={0} max={16} step={0.5} value={ot} onChange={(e) => setOt(e.target.value)} placeholder="0" />
                    </Field>
                  )}
                  <Field label={L("Note (optional)")}>
                    <input className={inputCls} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={kind === "leave" ? L("e.g. family function") : L("e.g. came late")} />
                  </Field>
                </div>
                {kind === "leave" && pay && <p className="text-[12.5px] text-muted">{pay.paidLeaves ? L("{0} paid leave a month{1}. More is unpaid.", pay.paidLeaves, slip.leaveDays ? ` · ${slip.leaveDays} taken this month` : "") : L("Leave is unpaid for you.")}</p>}
                <Button className="w-full" onClick={send}><CalendarCheck size={17} /> {current ? L("Save change") : L("Send for approval")}</Button>
              </>
            )}
          </div>
        </Group>

        {pay && (
          <Group title={L("This month so far")}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-[22px] font-semibold tnum">{+slip.workedDays.toFixed(1)}</div><div className="text-[12.5px] text-muted">{L("days approved")}</div></div>
              <div><div className="text-[22px] font-semibold tnum">{slip.leaveDays ? slip.leaveDays : `${+slip.otHours.toFixed(1)} h`}</div><div className="text-[12.5px] text-muted">{slip.leaveDays ? "leave" : "overtime"}</div></div>
              <div><div className="text-[22px] font-semibold tnum">{inr(slip.net)}</div><div className="text-[12.5px] text-muted">{L("salary till today")}</div></div>
            </div>
            {slip.pending > 0 && <p className="mt-3 text-center text-[13px] text-muted">{slip.pending} {L("day")}{slip.pending === 1 ? "" : "s"} {L("still waiting for approval.")}</p>}
          </Group>
        )}

        <Group title={monthLabel(month)} flush>
          {!ready ? (
            <p className="px-5 py-6 text-[14px] text-muted">{L("Loading…")}</p>
          ) : !mine.length ? (
            <Empty icon={<Clock size={22} />} title={L("No days yet")} body={L("Ask for today above. Your manager approves it.")} />
          ) : (
            mine.map((a) => (
              <button key={a.id} onClick={() => pick(a.date)} className={clsx("flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40 lg:px-5", a.date === date && "bg-sunken/40")}>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{dayLabel(a.date)}</div>
                  <div className="text-[13px] text-muted">{KIND_LABEL[a.kind]}{a.otHours ? L(" · OT {0} h", a.otHours) : ""}{a.note ? ` · ${a.note}` : ""}</div>
                </div>
                <StatusPill a={a} />
              </button>
            ))
          )}
        </Group>
      </Page>
    </>
  );
}
