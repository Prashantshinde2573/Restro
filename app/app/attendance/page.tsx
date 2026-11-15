"use client";

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

const lastWeek = (today: string) => {
  const out: string[] = [];
  const t = new Date(today + "T00:00:00Z").getTime();
  for (let i = 0; i <= 7; i++) out.push(new Date(t - i * 86_400_000).toISOString().slice(0, 10));
  return out;
};

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
  const [kind, setKind] = useState<"full" | "half">("full");
  const [ot, setOt] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  const pick = (d: string) => {
    setDate(d);
    setEditing(false);
    const a = all.find((x) => x.id === attendanceId(me?.id ?? "", d));
    setKind(a?.kind ?? "full");
    setOt(a?.otHours ? String(a.otHours) : "");
    setNote(a?.note ?? "");
  };

  const send = () => {
    const hours = Number(ot || 0);
    if (!Number.isFinite(hours) || hours < 0 || hours > 16) return toast("Overtime: 0 to 16 hours");
    attendanceActions.request({ date, kind, otHours: hours, note });
    setEditing(false);
    toast(current ? "Request changed" : "Sent for approval");
  };

  const mine = all.filter((a) => monthOf(a.date) === month);
  const slip = payslip(month, pay, all, entries, today);
  const showForm = !current || (current.status === "pending" && editing);

  if (!me) return null;
  return (
    <>
      <PageHeader title="My attendance" subtitle={`${me.name} · ${monthLabel(month)}`} />
      <Page className="space-y-6">
        <Group title="Ask for a day">
          <div className="space-y-4">
            <Field label="Day">
              <select className={inputCls} value={date} onChange={(e) => pick(e.target.value)}>
                {lastWeek(today).map((d) => (
                  <option key={d} value={d}>
                    {d === today ? `Today · ${dayLabel(d)}` : dayLabel(d)}
                  </option>
                ))}
              </select>
            </Field>

            {current && !showForm ? (
              <div className="flex flex-wrap items-center gap-3 rounded-ctl bg-sunken/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-semibold">
                    {current.kind === "half" ? "Half day" : "Full day"}
                    <StatusPill a={current} />
                  </div>
                  <div className="text-[13px] text-muted">
                    {current.otHours ? `Overtime ${current.otHours} h · ` : ""}
                    {current.status === "pending" ? "Your manager will approve it." : current.status === "approved" ? `Approved by ${current.decidedBy ?? "your manager"}` : "Talk to your manager about this day."}
                  </div>
                </div>
                {current.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="tinted" onClick={() => setEditing(true)}>Change</Button>
                    <Button size="sm" variant="tinted" onClick={() => { attendanceActions.cancel(current.id); toast("Request taken back"); }} aria-label="Take back"><Trash2 size={15} /></Button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Segmented value={kind} onChange={setKind} options={[{ value: "full", label: "Full day" }, { value: "half", label: "Half day" }]} className="w-full" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Overtime (hours)" hint="Leave empty if none">
                    <input className={inputCls} inputMode="decimal" type="number" min={0} max={16} step={0.5} value={ot} onChange={(e) => setOt(e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Note (optional)">
                    <input className={inputCls} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. came late" />
                  </Field>
                </div>
                <Button className="w-full" onClick={send}><CalendarCheck size={17} /> {current ? "Save change" : "Send for approval"}</Button>
              </>
            )}
          </div>
        </Group>

        {pay && (
          <Group title="This month so far">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-[22px] font-semibold tnum">{+slip.workedDays.toFixed(1)}</div><div className="text-[12.5px] text-muted">days approved</div></div>
              <div><div className="text-[22px] font-semibold tnum">{+slip.otHours.toFixed(1)} h</div><div className="text-[12.5px] text-muted">overtime</div></div>
              <div><div className="text-[22px] font-semibold tnum">{inr(slip.net)}</div><div className="text-[12.5px] text-muted">salary till today</div></div>
            </div>
            {slip.pending > 0 && <p className="mt-3 text-center text-[13px] text-muted">{slip.pending} day{slip.pending === 1 ? "" : "s"} still waiting for approval.</p>}
          </Group>
        )}

        <Group title={monthLabel(month)} flush>
          {!ready ? (
            <p className="px-5 py-6 text-[14px] text-muted">Loading…</p>
          ) : !mine.length ? (
            <Empty icon={<Clock size={22} />} title="No days yet" body="Ask for today above. Your manager approves it." />
          ) : (
            mine.map((a) => (
              <button key={a.id} onClick={() => pick(a.date)} className={clsx("flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40 lg:px-5", a.date === date && "bg-sunken/40")}>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{dayLabel(a.date)}</div>
                  <div className="text-[13px] text-muted">{a.kind === "half" ? "Half day" : "Full day"}{a.otHours ? ` · OT ${a.otHours} h` : ""}{a.note ? ` · ${a.note}` : ""}</div>
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
