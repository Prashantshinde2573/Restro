"use client";

// Attendance tab of "Attendance & salary": the whole month at a glance and one-tap marking.
//
//   Month  every person × every day of the month (a register). Tap a box to change it.
//   Day    one day, everyone on it: Full / Half / Absent buttons and overtime.
//   Person one person's month as a calendar.
//
// A past day nobody marked shows – (not marked); A only when marked absent. A paid weekly holiday shows H. Requests the staff
// sent from their phone show in amber until someone approves them (tap the box).
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Segmented, Sheet } from "@/components/ui";
import { useToast } from "@/components/toast";
import { isOwner, type Member } from "@/lib/access";
import { useMe } from "@/lib/live";
import {
  WEEKDAYS,
  attendanceActions,
  attendanceId,
  daysInMonth,
  monthLabel,
  todayIN,
  useAttendance,
  useStaffPay,
  type Attendance,
  type StaffPay,
} from "@/lib/payroll";

type View = "month" | "day" | "person";
type Cell = "full" | "half" | "leave" | "pending" | "absent" | "holiday" | "rejected" | "unmarked" | "none";

const dayNum = (d: string) => Number(d.slice(8, 10));
const weekday = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();
const dateOf = (month: string, n: number) => `${month}-${String(n).padStart(2, "0")}`;
const SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const longDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** What one box shows. */
function cellOf(a: Attendance | undefined, date: string, today: string, pay?: StaffPay): Cell {
  if (date > today) return "none";
  if (pay?.joinedOn && date < pay.joinedOn) return "none";
  if (pay?.leftOn && date > pay.leftOn) return "none";
  if (a?.status === "approved") return a.kind;
  if (a?.status === "pending") return "pending";
  if (pay?.type === "monthly" && pay.weeklyOff !== undefined && pay.weeklyOff !== null && weekday(date) === pay.weeklyOff) return "holiday";
  if (a?.status === "rejected") return "rejected";
  // a past day nobody marked is "not marked" (–), not absent: only a day marked absent shows A
  return date === today ? "none" : "unmarked";
}

const CELL: Record<Cell, { label: string; cls: string }> = {
  full: { label: "P", cls: "bg-jade text-white" },
  half: { label: "½", cls: "bg-jade-soft text-jade-deep ring-1 ring-inset ring-jade/40" },
  leave: { label: "L", cls: "bg-[#efedff] text-[#5b4bc4]" },
  pending: { label: "?", cls: "bg-saffron-soft text-saffron ring-1 ring-inset ring-saffron/50" },
  absent: { label: "A", cls: "bg-rose-soft text-rose" },
  rejected: { label: "A", cls: "bg-rose-soft text-rose" },
  holiday: { label: "H", cls: "bg-sky-soft text-sky" },
  unmarked: { label: "–", cls: "bg-sunken text-faint" },
  none: { label: "", cls: "bg-sunken/60 text-faint" },
};

export function AttendanceBoard({ people, month, names }: { people: Member[]; month: string; names: Record<string, string> }) {
  const me = useMe();
  const today = todayIN();
  const att = useAttendance();
  const pays = useStaffPay();
  const [view, setView] = useState<View>("month");
  const n = daysInMonth(month);
  const days = useMemo(() => Array.from({ length: n }, (_, i) => dateOf(month, i + 1)), [month, n]);
  const lastDay = days.filter((d) => d <= today).pop() ?? days[0];
  const [day, setDay] = useState(lastDay);
  const [personId, setPersonId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ m: Member; date: string } | null>(null);
  useEffect(() => setDay(lastDay), [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const byKey = useMemo(() => new Map(att.map((a) => [a.id, a])), [att]);
  // a sub admin marks their own days too (the owner sees each change in Activity); other staff never their own
  const canEdit = (m: Member) => isOwner(me) || me?.role === "subadmin" || m.id !== me?.id;
  const payOf = (id: string) => pays.find((p) => p.id === id);
  const pending = att.filter((a) => a.status === "pending" && a.date.startsWith(month) && people.some((m) => m.id === a.memberId));
  const person = people.find((m) => m.id === personId) ?? people[0];
  // the register opens on this week, not on the 1st (phones show only a few days)
  const regRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = regRef.current;
    const cell = el?.querySelector<HTMLElement>(`[data-col="${lastDay}"]`);
    if (el && cell) el.scrollLeft = Math.max(0, cell.offsetLeft - el.clientWidth + cell.offsetWidth * 4);
  }, [view, month, lastDay]);

  const counts = (m: Member) => {
    let p = 0, h = 0, a = 0, l = 0, ot = 0;
    for (const d of days) {
      const rec = byKey.get(attendanceId(m.id, d));
      const c = cellOf(rec, d, today, payOf(m.id));
      if (c === "full") p++;
      if (c === "half") h++;
      if (c === "absent" || c === "rejected") a++;
      if (c === "leave") l++;
      if (rec?.status === "approved" && rec.otHours) ot += rec.otHours;
    }
    return { p, h, a, l, ot };
  };
  const open = (m: Member, date: string) => {
    if (date > today) return;
    setEdit({ m, date });
  };

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-group bg-saffron-soft px-4 py-3">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-saffron px-2 text-[13px] font-bold text-white">{pending.length}</span>
          <span className="min-w-0 flex-1 text-[14px] font-medium text-ink">
            {pending.length === 1 ? "day waits" : "days wait"} for your OK
            <span className="block text-[12.5px] font-normal text-muted">Tap a <b>?</b> box to check one</span>
          </span>
          <Button
            size="sm"
            onClick={() => {
              pending.filter((a) => { const m = people.find((x) => x.id === a.memberId); return m && canEdit(m); }).forEach((a) => attendanceActions.decide(a.id, "approved", names));
            }}
          >
            <Check size={15} /> Approve all
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={view} onChange={setView} options={[{ value: "month", label: "Month" }, { value: "day", label: "Day" }, { value: "person", label: "Person" }]} />
        <Legend />
      </div>

      {view === "month" && (
        <div className="overflow-hidden rounded-group bg-surface">
          <div ref={regRef} className="overflow-x-auto [scrollbar-width:thin]">
            <table className="w-max border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[132px] bg-surface px-3 py-2 text-left text-[12px] font-semibold text-muted">{monthLabel(month)}</th>
                  {days.map((d) => (
                    <th key={d} data-col={d} className="px-[2px] py-1.5 font-normal">
                      <button
                        onClick={() => { if (d <= today) { setDay(d); setView("day"); } }}
                        disabled={d > today}
                        className={clsx("flex w-[30px] flex-col items-center rounded-[8px] py-0.5 leading-tight", d === today ? "bg-ink text-canvas" : "text-muted hover:bg-sunken", d > today && "opacity-40")}
                        aria-label={`Open ${longDay(d)}`}
                      >
                        <span className="text-[10px]">{SHORT[weekday(d)]}</span>
                        <span className="text-[12.5px] font-semibold tnum">{dayNum(d)}</span>
                      </button>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-[11.5px] font-semibold text-muted">P</th>
                  <th className="px-2 py-2 text-[11.5px] font-semibold text-muted">½</th>
                  <th className="px-2 py-2 pr-3 text-[11.5px] font-semibold text-muted">A</th>
                </tr>
              </thead>
              <tbody>
                {people.map((m) => {
                  const c = counts(m);
                  return (
                    <tr key={m.id}>
                      <th className="sticky left-0 z-10 border-t border-line/70 bg-surface px-3 py-1.5 text-left font-normal">
                        <button onClick={() => { setPersonId(m.id); setView("person"); }} className="flex max-w-[150px] items-center gap-2 text-left">
                          <Avatar name={m.name} hue={m.hue} photo={m.photo} size={26} />
                          <span className="truncate text-[13.5px] font-medium text-ink">{m.name.split(" ")[0]}</span>
                        </button>
                      </th>
                      {days.map((d) => {
                        const rec = byKey.get(attendanceId(m.id, d));
                        const k = cellOf(rec, d, today, payOf(m.id));
                        return (
                          <td key={d} className="border-t border-line/70 px-[2px] py-1.5">
                            <button
                              disabled={d > today || !canEdit(m)}
                              onClick={() => open(m, d)}
                              aria-label={`${m.name} ${longDay(d)}: ${k}`}
                              className={clsx("relative flex h-[36px] w-[34px] items-center justify-center rounded-[9px] text-[13px] font-bold transition active:scale-95", CELL[k].cls, d === today && k === "none" && "ring-1 ring-inset ring-ink/30")}
                            >
                              {CELL[k].label}
                              {rec?.otHours && rec.status !== "rejected" ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-saffron ring-2 ring-surface" /> : null}
                            </button>
                          </td>
                        );
                      })}
                      <td className="border-t border-line/70 px-2 text-center font-semibold tnum text-jade">{c.p}</td>
                      <td className="border-t border-line/70 px-2 text-center font-semibold tnum text-jade-deep">{c.h}</td>
                      <td className="border-t border-line/70 px-2 pr-3 text-center font-semibold tnum text-rose">{c.a}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line/70 px-4 py-2.5 text-[12.5px] text-muted"><span className="lg:hidden">Swipe sideways for the whole month · </span>Tap a box to mark that day · tap a date to mark everyone · tap a name for their calendar. Orange dot = overtime.</p>
        </div>
      )}

      {view === "day" && (
        <DayView
          days={days}
          day={day}
          setDay={setDay}
          today={today}
          people={people}
          byKey={byKey}
          payOf={payOf}
          canEdit={canEdit}
          names={names}
          onOpen={open}
        />
      )}

      {view === "person" && person && (
        <PersonView people={people} m={person} setPerson={setPersonId} month={month} days={days} today={today} byKey={byKey} pay={payOf(person.id)} count={counts(person)} onOpen={open} canEdit={canEdit(person)} />
      )}

      {edit && <DayEdit m={edit.m} date={edit.date} rec={byKey.get(attendanceId(edit.m.id, edit.date))} pay={payOf(edit.m.id)} names={names} onClose={() => setEdit(null)} />}
    </div>
  );
}

function Legend() {
  const items: [Cell, string][] = [["full", "Present"], ["half", "Half"], ["leave", "Leave"], ["absent", "Absent"], ["holiday", "Holiday"], ["pending", "Waiting"], ["unmarked", "Not marked"]];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted">
      {items.map(([k, l]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={clsx("flex h-5 w-5 items-center justify-center rounded-[6px] text-[10.5px] font-bold", CELL[k].cls)}>{CELL[k].label}</span>
          {l}
        </span>
      ))}
    </div>
  );
}

/** One day, everyone: tap Full / Half / Absent. */
function DayView({
  days, day, setDay, today, people, byKey, payOf, canEdit, names, onOpen,
}: {
  days: string[]; day: string; setDay: (d: string) => void; today: string; people: Member[];
  byKey: Map<string, Attendance>; payOf: (id: string) => StaffPay | undefined; canEdit: (m: Member) => boolean;
  names: Record<string, string>; onOpen: (m: Member, d: string) => void;
}) {
  const toast = useToast();
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [day]);
  const idx = days.indexOf(day);
  const marked = people.filter((m) => byKey.get(attendanceId(m.id, day))?.status === "approved").length;
  const set = (m: Member, kind: "full" | "half" | "leave" | "absent") => {
    const rec = byKey.get(attendanceId(m.id, day));
    if (kind === "absent") {
      if (rec?.status === "pending") attendanceActions.decide(rec.id, "rejected", names);
      else attendanceActions.markAbsent(m.id, day, names);
      return;
    }
    attendanceActions.mark(m.id, day, kind, kind === "leave" ? 0 : rec?.otHours ?? 0, names, rec?.note);
  };
  const allPresent = () => {
    people.filter(canEdit).forEach((m) => {
      const rec = byKey.get(attendanceId(m.id, day));
      const k = cellOf(rec, day, today, payOf(m.id));
      if (k === "none" && day !== today) return; // not working here that day
      if (!rec || rec.status !== "approved") attendanceActions.mark(m.id, day, rec?.kind === "half" ? "half" : "full", rec?.otHours ?? 0, names, rec?.note);
    });
    toast("Everyone marked present");
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="rounded-full bg-surface p-2 disabled:opacity-30" disabled={idx <= 0} onClick={() => setDay(days[idx - 1])} aria-label="Previous day"><ChevronLeft size={18} /></button>
        <div ref={strip} className="flex flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
          {days.map((d) => (
            <button
              key={d}
              data-day={d}
              disabled={d > today}
              onClick={() => setDay(d)}
              className={clsx("flex w-11 shrink-0 flex-col items-center rounded-[12px] py-1.5", d === day ? "bg-ink text-canvas" : "bg-surface", d > today && "opacity-35")}
            >
              <span className="text-[10.5px] opacity-75">{SHORT[weekday(d)]}</span>
              <span className="text-[15px] font-semibold tnum">{dayNum(d)}</span>
            </button>
          ))}
        </div>
        <button className="rounded-full bg-surface p-2 disabled:opacity-30" disabled={idx >= days.length - 1 || days[idx + 1] > today} onClick={() => setDay(days[idx + 1])} aria-label="Next day"><ChevronRight size={18} /></button>
      </div>

      <div className="overflow-hidden rounded-group bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{day === today ? "Today · " : ""}{longDay(day)}</div>
            <div className="text-[13px] text-muted">{marked} of {people.length} present</div>
          </div>
          <Button size="sm" variant="tinted" onClick={allPresent}><Check size={15} /> All present</Button>
        </div>
        {people.map((m) => {
          const rec = byKey.get(attendanceId(m.id, day));
          const k = cellOf(rec, day, today, payOf(m.id));
          const value = rec?.status === "approved" ? rec.kind : k === "absent" || k === "rejected" ? "absent" : null;
          const editable = canEdit(m);
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0">
              <button onClick={() => editable && onOpen(m, day)} className="flex min-w-[min(100%,220px)] flex-1 items-center gap-3 text-left">
                <Avatar name={m.name} hue={m.hue} photo={m.photo} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{m.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {rec?.status === "pending"
                      ? `Asked ${rec.kind === "leave" ? "leave" : rec.kind === "half" ? "half day" : "full day"}${rec.otHours ? ` + OT ${rec.otHours} h` : ""}${rec.note ? ` · “${rec.note}”` : ""}`
                      : k === "holiday" ? "Weekly holiday (paid)"
                      : k === "none" && day !== today ? "Not working here this day"
                      : rec?.otHours && rec.status === "approved" ? `Overtime ${rec.otHours} h` : (m.title || "Staff")}
                  </span>
                </span>
              </button>
              {!editable ? (
                <span className="text-[12.5px] text-muted">Owner marks yours</span>
              ) : (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  {rec?.status === "pending" && <span className="rounded-full bg-saffron-soft px-2 py-1 text-[11.5px] font-semibold text-saffron">Waiting</span>}
                  <div role="radiogroup" aria-label={`${m.name} attendance`} className="flex flex-1 rounded-[12px] bg-sunken p-[3px] sm:flex-none">
                    {([["full", "Full"], ["half", "Half"], ["leave", "Leave"], ["absent", "Absent"]] as const).map(([v, l]) => (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={value === v}
                        onClick={() => set(m, v)}
                        className={clsx(
                          "flex-1 rounded-[9px] px-3 py-2 text-[13.5px] font-semibold transition sm:flex-none sm:py-1.5",
                          value === v ? (v === "absent" ? "bg-rose text-white" : v === "half" ? "bg-jade-soft text-jade-deep shadow-sm" : v === "leave" ? "bg-[#5b4bc4] text-white" : "bg-jade text-white") : "text-muted",
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => onOpen(m, day)} className="rounded-[10px] px-2 py-1.5 text-[12.5px] font-semibold text-jade hover:bg-jade-soft" aria-label={`Overtime and note for ${m.name}`}>
                    {rec?.otHours ? `OT ${rec.otHours}h` : "+ OT"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One person's month as a calendar. */
function PersonView({
  people, m, setPerson, month, days, today, byKey, pay, count, onOpen, canEdit,
}: {
  people: Member[]; m: Member; setPerson: (id: string) => void; month: string; days: string[]; today: string;
  byKey: Map<string, Attendance>; pay?: StaffPay; count: { p: number; h: number; a: number; l: number; ot: number };
  onOpen: (m: Member, d: string) => void; canEdit: boolean;
}) {
  const lead = weekday(days[0]);
  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
        {people.map((p) => (
          <button key={p.id} onClick={() => setPerson(p.id)} className={clsx("flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13.5px] font-semibold ring-1", p.id === m.id ? "bg-ink text-canvas ring-ink" : "bg-surface ring-line")}>
            <Avatar name={p.name} hue={p.hue} photo={p.photo} size={26} /> {p.name.split(" ")[0]}
          </button>
        ))}
      </div>
      <div className="rounded-group bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div className="text-[16px] font-semibold">{m.name} · {monthLabel(month)}</div>
          {pay?.type === "monthly" && pay.weeklyOff !== undefined && pay.weeklyOff !== null && <div className="text-[12.5px] text-muted">Holiday: {WEEKDAYS[pay.weeklyOff]}</div>}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Mini n={count.p} l="Present" cls="text-jade" />
          <Mini n={count.h} l="Half days" cls="text-jade-deep" />
          {count.l ? <Mini n={count.l} l="Leave" cls="text-[#5b4bc4]" /> : <Mini n={count.a} l="Absent" cls="text-rose" />}
          <Mini n={+count.ot.toFixed(1)} l="OT hours" cls="text-saffron" />
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
          {SHORT.map((s, i) => <div key={i} className="pb-1 text-[11.5px] font-semibold text-muted">{s}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} />)}
          {days.map((d) => {
            const rec = byKey.get(attendanceId(m.id, d));
            const k = cellOf(rec, d, today, pay);
            return (
              <button
                key={d}
                disabled={d > today || !canEdit}
                onClick={() => onOpen(m, d)}
                className={clsx("relative flex aspect-square flex-col items-center justify-center rounded-[12px] transition active:scale-95", CELL[k].cls, d === today && "ring-2 ring-ink/60", d > today && "opacity-40")}
              >
                <span className="text-[14px] font-semibold tnum">{dayNum(d)}</span>
                <span className="text-[10.5px] font-bold leading-none opacity-80">{CELL[k].label || " "}</span>
                {rec?.otHours && rec.status !== "rejected" ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-saffron" /> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12.5px] text-muted">Tap a day to mark it.</p>
      </div>
    </div>
  );
}

const Mini = ({ n, l, cls }: { n: number; l: string; cls: string }) => (
  <div className="rounded-[12px] bg-sunken/70 py-2">
    <div className={clsx("text-[19px] font-semibold tnum", cls)}>{n}</div>
    <div className="text-[11.5px] text-muted">{l}</div>
  </div>
);

/** Change one person's one day: Full / Half / Absent, overtime, note. Approves a waiting request. */
function DayEdit({ m, date, rec, pay, names, onClose }: { m: Member; date: string; rec?: Attendance; pay?: StaffPay; names: Record<string, string>; onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<"full" | "half" | "leave" | "absent">(rec && rec.status !== "rejected" ? rec.kind : rec?.status === "rejected" ? "absent" : "full");
  const [ot, setOt] = useState(rec?.otHours ? String(rec.otHours) : "");
  const [note, setNote] = useState(rec?.note ?? "");
  const holiday = pay?.type === "monthly" && pay.weeklyOff !== undefined && pay.weeklyOff !== null && weekday(date) === pay.weeklyOff;
  const save = () => {
    const h = Number(ot || 0);
    if (!Number.isFinite(h) || h < 0 || h > 16) return toast("Overtime: 0 to 16 hours");
    if (kind === "absent") {
      if (rec?.status === "pending") attendanceActions.decide(rec.id, "rejected", names);
      else attendanceActions.markAbsent(m.id, date, names);
    } else {
      attendanceActions.mark(m.id, date, kind, kind === "leave" ? 0 : h, names, note);
    }
    toast(`${m.name.split(" ")[0]} · ${kind === "absent" ? "absent" : kind === "half" ? "half day" : kind === "leave" ? "on leave" : "present"}`);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={m.name}>
      <div className="space-y-4">
        <div className="text-[15px] text-muted">{longDay(date)}{holiday ? " · weekly holiday (paid even if absent)" : ""}</div>
        {rec?.status === "pending" && (
          <div className="rounded-group bg-saffron-soft px-4 py-3 text-[14px]">
            <b>{m.name.split(" ")[0]} asked:</b> {rec.kind === "leave" ? "leave" : rec.kind === "half" ? "half day" : "full day"}{rec.otHours ? ` + overtime ${rec.otHours} h` : ""}{rec.note ? ` · “${rec.note}”` : ""}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Attendance">
          {([["full", "Present", "P"], ["half", "Half day", "½"], ["leave", "Leave", "L"], ["absent", "Absent", "A"]] as const).map(([v, l, s]) => (
            <button
              key={v}
              role="radio"
              aria-checked={kind === v}
              onClick={() => setKind(v)}
              className={clsx("flex flex-col items-center gap-1 rounded-[16px] py-3.5 text-[14px] font-semibold ring-1", kind === v ? (v === "absent" ? "bg-rose text-white ring-rose" : v === "leave" ? "bg-[#5b4bc4] text-white ring-[#5b4bc4]" : "bg-jade text-white ring-jade") : "bg-surface ring-line")}
            >
              <span className="text-[20px] leading-none">{s}</span>
              {l}
            </button>
          ))}
        </div>
        {kind !== "absent" && kind !== "leave" && (
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <label>
              <span className="mb-1 block text-[13px] font-medium text-muted">Overtime (hours)</span>
              <input className="h-12 w-full rounded-ctl bg-surface px-3 text-[15px] outline-none ring-1 ring-line focus:ring-jade/40" inputMode="decimal" type="number" min={0} max={16} step={0.5} value={ot} onChange={(e) => setOt(e.target.value)} placeholder="0" />
            </label>
            <label>
              <span className="mb-1 block text-[13px] font-medium text-muted">Note (optional)</span>
              <input className="h-12 w-full rounded-ctl bg-surface px-3 text-[15px] outline-none ring-1 ring-line focus:ring-jade/40" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. came late" />
            </label>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="tinted" onClick={onClose}><X size={16} /> Cancel</Button>
          <Button className="flex-1" onClick={save}><Check size={16} /> {rec?.status === "pending" ? (kind === "absent" ? "Reject request" : "Approve") : "Save"}</Button>
        </div>
      </div>
    </Sheet>
  );
}
