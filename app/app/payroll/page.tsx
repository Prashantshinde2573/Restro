"use client";

// Owner (or a manager with "Staff attendance and salary"): approve attendance requests,
// set how each person is paid, add advance / bonus / fine / salary paid, and send the
// month's salary slip as a PDF or on WhatsApp.
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, FileText, MessageCircle, Plus, Trash2, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, Empty, Field, Group, Page, PageHeader, Pill, Segmented, Sheet, inputCls } from "@/components/ui";
import { StatusPill } from "@/components/attendance-bits";
import { AttendanceBoard } from "@/components/attendance-board";
import { useToast } from "@/components/toast";
import { openPayslipPdf } from "@/components/payslip";
import { isOwner, onPayroll, type Member } from "@/lib/access";
import { useAccount, useCurrentOutlet, useMe, useMembers } from "@/lib/live";
import { useReady } from "@/lib/store";
import { inr } from "@/lib/format";
import { waLink } from "@/lib/wa";
import {
  PAY_ENTRY_LABEL,
  WEEKDAYS,
  attendanceActions,
  dayLabel,
  daysText,
  explainSalary,
  daysInMonth,
  monthLabel,
  monthOf,
  payActions,
  payslip,
  payslipText,
  shiftMonth,
  todayIN,
  useAttendance,
  usePayEntries,
  useStaffPay,
  type PayEntryType,
  type StaffPay,
} from "@/lib/payroll";

type Tab = "attendance" | "salary";
const fullDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function PayrollPage() {
  const today = todayIN();
  const [month, setMonth] = useState(monthOf(today));
  const [tab, setTab] = useState<Tab>("attendance");
  const [open, setOpen] = useState<string | null>(null);
  const members = useMembers();
  const outletNow = useCurrentOutlet();
  // only the people of the outlet on screen (a sub admin's own outlet; the owner switches outlets at the top)
  const people = members.filter((m) => onPayroll(m) && (!outletNow.id || m.outletIds.includes(outletNow.id)));
  const names = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const att = useAttendance();
  const pays = useStaffPay();
  const entries = usePayEntries();
  const ready = useReady("attendance");

  const pending = att.filter((a) => a.status === "pending" && people.some((m) => m.id === a.memberId)).sort((a, b) => a.date.localeCompare(b.date));
  const rows = people
    .filter((m) => (m.active && payslip(month, pays.find((p) => p.id === m.id), [], [], today).employed) || att.some((a) => a.memberId === m.id && monthOf(a.date) === month) || entries.some((e) => e.memberId === m.id && e.month === month))
    .map((m) => ({ m, pay: pays.find((p) => p.id === m.id), slip: payslip(month, pays.find((p) => p.id === m.id), att.filter((a) => a.memberId === m.id), entries.filter((e) => e.memberId === m.id), today) }));
  const total = rows.reduce((s, r) => ({ net: s.net + r.slip.net, paid: s.paid + r.slip.paid, due: s.due + Math.max(0, r.slip.due) }), { net: 0, paid: 0, due: 0 });
  const person = people.find((m) => m.id === open) ?? null;
  // the register: everyone still working, plus anyone with days this month
  const boardPeople = people.filter((m) => m.active || att.some((a) => a.memberId === m.id && monthOf(a.date) === month));

  return (
    <>
      <PageHeader title="Attendance & salary" subtitle={`${outletNow.name ? `${outletNow.name} · ` : ""}${people.filter((m) => m.active).length} people · ${monthLabel(month)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={tab} onChange={setTab} options={[{ value: "attendance", label: `Attendance${pending.length ? ` (${pending.length})` : ""}` }, { value: "salary", label: "Salary" }]} />
          <MonthSwitch month={month} onChange={setMonth} max={monthOf(today)} />
        </div>
      </PageHeader>
      <Page className="space-y-6">
        {!people.length ? (
          <Group>
            <Empty icon={<Users size={22} />} title="No staff yet" body="Add your team in Members & access. Then they can ask for their days here." />
          </Group>
        ) : tab === "attendance" ? (
          !ready ? <p className="px-1 py-6 text-[14px] text-muted">Loading…</p> : <AttendanceBoard people={boardPeople} month={month} names={names} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total salary" value={inr(total.net)} />
              <Stat label="Paid" value={inr(total.paid)} />
              <Stat label="Still to pay" value={inr(total.due)} tone={total.due > 0 ? "saffron" : undefined} />
            </div>
            <Group title={monthLabel(month)} flush>
              {rows.map(({ m, pay, slip }) => (
                <button key={m.id} onClick={() => setOpen(m.id)} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
                  <Avatar name={m.name} hue={m.hue} photo={m.photo} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-medium">{m.name}{pay?.leftOn && pay.leftOn <= today ? <Pill>Left</Pill> : !m.active && <Pill>Off</Pill>}</div>
                    <div className="truncate text-[13px] text-muted">
                      {pay ? `${daysText(slip.workedDays)} day${slip.workedDays === 1 ? "" : "s"} worked${slip.paidOffs ? ` + ${slip.paidOffs} holiday${slip.paidOffs === 1 ? "" : "s"}` : ""}${slip.otHours ? ` · OT ${+slip.otHours.toFixed(1)} h` : ""}${slip.pending ? ` · ${slip.pending} waiting` : ""}` : "Tap to set salary"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-semibold tnum">{pay ? inr(slip.net) : "—"}</div>
                    {pay && (slip.paid ? <div className={clsx("text-[12.5px] tnum", slip.due > 0 ? "text-saffron" : "text-jade")}>{slip.due > 0 ? `${inr(slip.due)} to pay` : "Paid"}</div> : <div className="text-[12.5px] text-muted">not paid yet</div>)}
                  </div>
                </button>
              ))}
            </Group>
            <p className="px-1 text-[13px] text-muted">Only approved days count. A half day counts as ½ day. Tap a name to see how the salary is worked out.</p>
          </>
        )}
      </Page>
      {person && <PersonSheet m={person} month={month} onClose={() => setOpen(null)} names={names} />}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "saffron" }) {
  return (
    <div className="rounded-group bg-surface px-4 py-3">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className={clsx("mt-0.5 text-[19px] font-semibold tnum", tone === "saffron" && "text-saffron")}>{value}</div>
    </div>
  );
}

function MonthSwitch({ month, onChange, max }: { month: string; onChange: (m: string) => void; max: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-ctl bg-sunken p-[3px]">
      <button className="rounded-[9px] p-1.5 hover:bg-surface" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
      <span className="min-w-[124px] text-center text-[13px] font-semibold">{monthLabel(month)}</span>
      <button className="rounded-[9px] p-1.5 hover:bg-surface disabled:opacity-30" disabled={month >= max} onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
    </div>
  );
}

/** Everything about one person for the month: pay settings, days, money lines, payslip. */
function PersonSheet({ m, month, onClose, names }: { m: Member; month: string; onClose: () => void; names: Record<string, string> }) {
  const me = useMe();
  const toast = useToast();
  const account = useAccount();
  const outlet = useCurrentOutlet();
  const today = todayIN();
  const canEdit = isOwner(me) || m.id !== me?.id;
  const pay = useStaffPay().find((p) => p.id === m.id);
  const days = useAttendance().filter((a) => a.memberId === m.id);
  const entries = usePayEntries().filter((e) => e.memberId === m.id);
  const slip = payslip(month, pay, days, entries, today);
  const monthDays = days.filter((d) => monthOf(d.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const monthEntries = entries.filter((e) => e.month === month).sort((a, b) => b.date.localeCompare(a.date));

  // salary settings
  const [type, setType] = useState<StaffPay["type"]>(pay?.type ?? "monthly");
  const [amount, setAmount] = useState(pay ? String(pay.amount) : "");
  const [otRate, setOtRate] = useState(pay?.otRate ? String(pay.otRate) : "");
  const [off, setOff] = useState(pay?.weeklyOff !== undefined && pay.weeklyOff !== null ? String(pay.weeklyOff) : "");
  const [joinedOn, setJoinedOn] = useState(pay?.joinedOn ?? "");
  const [leftOn, setLeftOn] = useState(pay?.leftOn ?? "");
  const [editPay, setEditPay] = useState(!pay);
  const savePay = () => {
    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return toast(type === "monthly" ? "Enter the monthly salary" : "Enter the pay per day");
    const r = Number(otRate || 0);
    if (!Number.isFinite(r) || r < 0) return toast("Overtime rate looks wrong");
    if (joinedOn && leftOn && leftOn < joinedOn) return toast("Last working day is before the joining date");
    payActions.setPay({ id: m.id, type, amount: a, ...(r ? { otRate: r } : {}), ...(off !== "" && type === "monthly" ? { weeklyOff: Number(off) } : {}), ...(joinedOn ? { joinedOn } : {}), ...(leftOn ? { leftOn } : {}) }, names);
    setEditPay(false);
    toast("Salary saved");
  };

  const lastDay = month === monthOf(today) ? today : `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

  // money lines
  const [eType, setEType] = useState<PayEntryType>("advance");
  const [eAmount, setEAmount] = useState("");
  const [eNote, setENote] = useState("");
  const [eMethod, setEMethod] = useState<"cash" | "upi" | "bank">("cash");
  const addEntry = () => {
    const a = Number(eAmount);
    if (!Number.isFinite(a) || a <= 0) return toast("Enter an amount");
    payActions.addEntry({ memberId: m.id, month, type: eType, amount: a, note: eNote, ...(eType === "paid" || eType === "advance" ? { method: eMethod } : {}), date: month === monthOf(today) ? today : lastDay });
    setEAmount("");
    setENote("");
    toast(`${PAY_ENTRY_LABEL[eType]} added`);
  };

  const pdf = () => {
    if (!openPayslipPdf({ slip, pay, who: { name: m.name, title: m.title, phone: m.phone }, restaurant: account.name, outlet: outlet.name, days, entries })) toast("Allow pop-ups to save the PDF");
  };
  const whatsapp = () => {
    const text = payslipText(slip, { name: m.name, title: m.title }, account.name, pay);
    window.open(m.phone ? waLink(m.phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const r = (n: number) => inr(Math.round(n));
  return (
    <Sheet open onClose={onClose} title={m.name} wide>
      <div className="space-y-6">
        <div className="text-[14px] text-muted">{m.title || "Staff"} · {monthLabel(month)}</div>

        {/* the month */}
        <section className="rounded-group bg-surface p-4">
          {!pay ? (
            <p className="text-[14px] text-muted">Set how {m.name} is paid below to see the salary.</p>
          ) : (
            <>
              <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-muted">How the salary is worked out</div>
              <ol className="space-y-2 text-[14.5px]">
                {explainSalary(slip, pay).map((x, i) =>
                  x.value ? (
                    <li key={i} className="flex items-baseline justify-between gap-3">
                      <span className="text-muted">{x.label}</span>
                      <span className="shrink-0 font-medium tnum">{x.value}</span>
                    </li>
                  ) : (
                    <li key={i} className="rounded-ctl bg-sunken/70 px-3 py-1.5 text-[13px] text-muted">{x.label}</li>
                  ),
                )}
              </ol>
              <div className="mt-3 flex justify-between border-t border-line pt-2.5 text-[17px] font-semibold"><span>Total salary</span><span className="tnum">{r(slip.net)}</span></div>
              {slip.paid > 0 && <div className="mt-1 flex justify-between text-[14.5px]"><span className="text-muted">Paid</span><span className="tnum">{r(slip.paid)}</span></div>}
              {slip.paid > 0 && <div className={clsx("mt-1 flex justify-between text-[14.5px] font-semibold", slip.due > 0 ? "text-saffron" : "text-jade")}><span>{slip.due > 0 ? "Still to pay" : slip.due < 0 ? "Paid extra" : "Fully paid"}</span><span className="tnum">{r(Math.abs(slip.due))}</span></div>}
              {slip.inProgress && (
                <p className="mt-3 rounded-ctl bg-sky-soft px-3 py-2 text-[13px] text-sky">
                  {monthLabel(month)} isn&apos;t over yet, so this is the salary <b>till today</b>.{pay.type === "monthly" ? ` A full month with no leave = ${r(pay.amount)}.` : ""}
                </p>
              )}
            </>
          )}
          {slip.pending > 0 && <p className="mt-2 text-[13px] text-saffron">{slip.pending} day{slip.pending === 1 ? "" : "s"} waiting for approval (not counted yet).</p>}
          {pay && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="tinted" onClick={pdf}><FileText size={15} /> Salary slip PDF</Button>
              <Button size="sm" variant="tinted" onClick={whatsapp}><MessageCircle size={15} /> Send on WhatsApp</Button>
            </div>
          )}
        </section>

        {/* how they are paid */}
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-[15px] font-semibold">Salary settings</h3>
            {pay && !editPay && canEdit && <button className="text-[14px] font-semibold text-jade" onClick={() => setEditPay(true)}>Change</button>}
          </div>
          {!canEdit ? (
            <p className="px-1 text-[14px] text-muted">Only the owner can change your own salary.</p>
          ) : pay && !editPay ? (
            <div className="rounded-group bg-surface px-4 py-3 text-[14.5px]">
              <div className="font-medium">{pay.type === "monthly" ? `${r(pay.amount)} a month` : `${r(pay.amount)} a day`}</div>
              <div className="mt-0.5 text-[13px] text-muted">
                {pay.otRate ? `Overtime ${r(pay.otRate)} an hour` : "No overtime pay"}
                {" · "}
                {pay.type === "monthly" ? (pay.weeklyOff !== undefined && pay.weeklyOff !== null ? `Holiday every ${WEEKDAYS[pay.weeklyOff]} (paid)` : "No weekly holiday") : "Paid only for days worked"}
              </div>
              <div className="mt-0.5 text-[13px] text-muted">
                {pay.joinedOn ? `Joined ${fullDate(pay.joinedOn)}` : "Joining date not set"}
                {pay.leftOn ? ` · Left ${fullDate(pay.leftOn)}` : ""}
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-group bg-surface p-4">
              <Segmented value={type} onChange={setType} options={[{ value: "monthly", label: "Monthly salary" }, { value: "daily", label: "Per day" }]} className="w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Field label={type === "monthly" ? "Salary per month (₹)" : "Pay per day (₹)"}>
                  <input className={inputCls} inputMode="numeric" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={type === "monthly" ? "12000" : "500"} />
                </Field>
                <Field label="Overtime per hour (₹)" hint="Empty = no OT pay">
                  <input className={inputCls} inputMode="numeric" type="number" min={0} value={otRate} onChange={(e) => setOtRate(e.target.value)} placeholder="60" />
                </Field>
              </div>
              {type === "monthly" && (
                <Field label="Weekly holiday" hint={off === "" ? "Paid only for the days they come." : `Every ${WEEKDAYS[Number(off)]} counts as a paid day, even without coming.`}>
                  <select className={inputCls} value={off} onChange={(e) => setOff(e.target.value)}>
                    <option value="">No weekly holiday</option>
                    {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d} (paid holiday)</option>)}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Joining date" hint="Holidays before it aren't paid">
                  <input type="date" className={inputCls} value={joinedOn} max={leftOn || undefined} onChange={(e) => setJoinedOn(e.target.value)} />
                </Field>
                <Field label="Last working day" hint="Only if they left the job">
                  <input type="date" className={inputCls} value={leftOn} min={joinedOn || undefined} onChange={(e) => setLeftOn(e.target.value)} />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button onClick={savePay}>Save salary</Button>
                {pay && <Button variant="tinted" onClick={() => setEditPay(false)}>Cancel</Button>}
              </div>
            </div>
          )}
        </section>

        {/* days */}
        <section>
          <h3 className="mb-2 px-1 text-[15px] font-semibold">Days in {monthLabel(month)}</h3>
          <p className="mb-2 px-1 text-[13px] text-muted">Mark or change days in the <b>Attendance</b> tab.</p>
          <div className="overflow-hidden rounded-group bg-surface">
            {!monthDays.length ? (
              <p className="px-4 py-4 text-[14px] text-muted">No days this month yet.</p>
            ) : (
              monthDays.map((a) => (
                <div key={a.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-medium">{dayLabel(a.date)}</div>
                    <div className="truncate text-[12.5px] text-muted">{a.kind === "half" ? "Half day" : "Full day"}{a.otHours ? ` · OT ${a.otHours} h` : ""}{a.note ? ` · ${a.note}` : ""}{a.byManager ? " · marked by manager" : ""}</div>
                  </div>
                  <StatusPill a={a} />
                  {canEdit && a.status === "pending" && <Button size="sm" onClick={() => attendanceActions.decide(a.id, "approved", names)} aria-label="Approve"><Check size={14} /></Button>}
                  {canEdit && <button className="rounded-full p-2 text-muted hover:bg-sunken" onClick={() => attendanceActions.remove(a.id, names)} aria-label="Remove day"><Trash2 size={15} /></button>}
                </div>
              ))
            )}
          </div>
        </section>

        {/* money lines */}
        <section>
          <h3 className="mb-2 px-1 text-[15px] font-semibold">Advance, bonus, fine, paid</h3>
          {canEdit && (
            <div className="mb-3 space-y-3 rounded-group bg-surface p-3">
              <Segmented value={eType} onChange={setEType} options={(["advance", "bonus", "fine", "paid"] as PayEntryType[]).map((t) => ({ value: t, label: PAY_ENTRY_LABEL[t] }))} className="w-full" />
              <div className="flex flex-wrap items-end gap-2">
                <input className={clsx(inputCls, "!w-32")} inputMode="numeric" type="number" min={0} value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="₹ amount" aria-label="Amount" />
                {(eType === "paid" || eType === "advance") && (
                  <Segmented value={eMethod} onChange={setEMethod} options={[{ value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "bank", label: "Bank" }]} />
                )}
                <input className={clsx(inputCls, "min-w-[140px] flex-1")} value={eNote} maxLength={200} onChange={(e) => setENote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
                <Button onClick={addEntry}><Plus size={16} /> Add</Button>
              </div>
            </div>
          )}
          <div className="overflow-hidden rounded-group bg-surface">
            {!monthEntries.length ? (
              <p className="px-4 py-4 text-[14px] text-muted">Nothing this month.</p>
            ) : (
              monthEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-2.5 last:border-0">
                  <Wallet size={16} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-medium">{PAY_ENTRY_LABEL[e.type]}{e.method ? ` · ${e.method.toUpperCase()}` : ""}</div>
                    <div className="truncate text-[12.5px] text-muted">{dayLabel(e.date)}{e.note ? ` · ${e.note}` : ""}{e.by ? ` · ${e.by}` : ""}</div>
                  </div>
                  <div className={clsx("text-[15px] font-semibold tnum", e.type === "fine" || e.type === "advance" ? "text-rose" : "")}>{e.type === "fine" || e.type === "advance" ? "− " : ""}{r(e.amount)}</div>
                  {canEdit && <button className="rounded-full p-2 text-muted hover:bg-sunken" onClick={() => payActions.removeEntry(e.id)} aria-label="Remove"><Trash2 size={15} /></button>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Sheet>
  );
}
