"use client";

import clsx from "clsx";
import { Fingerprint, Plus, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCurrentOutlet, useFeature, useMembers } from "@/lib/live";
import type { StaffMember } from "@/lib/types";
import { Avatar, Button, Field, Group, Page, PageHeader, Pill, Segmented, Sheet, inputCls, LocalSegmented } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { clock, inr } from "@/lib/format";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const shifts: Record<string, (string | null)[]> = {
  s2: ["M", "M", "M", null, "M", "M", "M"],
  s3: ["E", "E", null, "E", "E", "E", "E"],
  s4: [null, "E", "E", "E", "E", "D", "D"],
  s5: ["M", null, "M", "M", "D", "D", null],
  s6: ["D", "D", "D", "D", null, "D", "D"],
  s7: ["E", "E", "E", null, "E", "E", "E"],
  s8: ["M", "M", null, "M", "M", "M", null],
};
const shiftLabel: Record<string, { t: string; cls: string }> = {
  M: { t: "9–5", cls: "bg-sky-soft text-sky" },
  E: { t: "4–12", cls: "bg-jade-soft text-jade-deep" },
  D: { t: "11–11", cls: "bg-saffron-soft text-saffron" },
};
const salary: Record<string, number> = { s2: 32000, s3: 18000, s4: 18000, s5: 16000, s6: 38000, s7: 26000, s8: 15000 };

export default function TeamPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"today" | "rota" | "pay">("today");
  const outlet = useCurrentOutlet();
  const members = useMembers();
  const payrollOn = useFeature("payroll") === "ok";
  // Team of the outlet on screen; attendance/shift numbers from sample data where we have them.
  const staff: StaffMember[] = members
    .filter((m) => m.active && m.role !== "owner" && m.outletIds.includes(outlet.id))
    .map((m) => {
      const s = repo.staff().find((x) => x.id === m.id);
      return { ...(s ?? { id: m.id, onShift: false, hoursThisWeek: 0, salesToday: 0, rating: 0, hue: m.hue }), name: m.name, role: m.title as StaffMember["role"] };
    });
  const team = staff.filter((s) => s.role !== "Owner");
  const tipsPool = 4860;
  const tipHours = team.reduce((s, m) => s + m.hoursThisWeek, 0);

  return (
    <>
      <PageHeader
        title="Team"
        subtitle={`${staff.filter((s) => s.onShift).length} on shift now · ${team.length} people`}
        actions={<Link href="/app/access"><Button size="sm" variant="tinted"><Plus size={16} /> Add person</Button></Link>}
      >
        <Segmented value={tab} onChange={setTab} options={[{ value: "today", label: "Today" }, ...(payrollOn ? [{ value: "rota" as const, label: "Rota" }, { value: "pay" as const, label: "Pay" }] : [])]} />
      </PageHeader>
      <Page>
        {tab === "today" && (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <Group title="Who's in" flush>
              {staff.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                  <div className="relative">
                    <Avatar name={s.name} hue={s.hue} size={40} />
                    <span className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface", s.onShift ? "bg-jade" : "bg-line")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{s.name}</div>
                    <div className="text-[13px] text-muted">{s.role} · {s.onShift && s.clockedIn ? `in since ${clock(s.clockedIn)}` : "off today"}</div>
                  </div>
                  {s.role !== "Owner" && (
                    <Button size="sm" variant={s.onShift ? "plain" : "tinted"} onClick={() => toast(s.onShift ? `${s.name} clocked out` : `${s.name} clocked in`)}>
                      {s.onShift ? "Clock out" : "Clock in"}
                    </Button>
                  )}
                </div>
              ))}
            </Group>
            <div className="space-y-6">
              <Group title="Captains today" flush>
                {team.filter((s) => s.role === "Captain").sort((a, b) => b.salesToday - a.salesToday).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                    <span className="w-4 text-[13px] font-semibold text-faint">{i + 1}</span>
                    <Avatar name={s.name} hue={s.hue} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium">{s.name}</div>
                      <div className="flex items-center gap-1 text-[12.5px] text-muted"><Star size={12} className="fill-saffron text-saffron" /> {s.rating} from guests</div>
                    </div>
                    <span className="text-[15px] font-semibold tnum">{inr(s.salesToday)}</span>
                  </div>
                ))}
              </Group>
              <Group>
                <div className="flex items-start gap-3">
                  <Fingerprint size={20} className="mt-0.5 shrink-0 text-jade" />
                  <p className="text-[14px] text-muted">Staff clock in with their PIN or a selfie.</p>
                </div>
              </Group>
            </div>
          </div>
        )}

        {tab === "rota" && (
          <Group flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12.5px] text-muted">
                    <th className="px-4 py-3 font-medium lg:px-5">This week</th>
                    {days.map((d, i) => (
                      <th key={d} className={clsx("px-2 py-3 text-center font-medium", i === 1 && "text-jade")}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {team.map((s) => (
                    <tr key={s.id} className="border-b border-line/70 last:border-0">
                      <td className="px-4 py-2.5 lg:px-5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.name} hue={s.hue} size={30} />
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-[12px] text-muted">{s.role}</div>
                          </div>
                        </div>
                      </td>
                      {(shifts[s.id] ?? []).map((sh, i) => (
                        <td key={i} className="px-1.5 py-2.5 text-center">
                          {sh ? (
                            <button onClick={() => toast("Swap or change shift")} className={clsx("w-full rounded-[8px] py-1.5 text-[12.5px] font-semibold", shiftLabel[sh].cls)}>{shiftLabel[sh].t}</button>
                          ) : (
                            <span className="text-[12px] text-faint">Off</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 lg:px-5">
              <span className="text-[13px] text-muted">Rota goes to everyone on WhatsApp when you publish.</span>
              <Button size="sm" onClick={() => toast("Rota published · 7 people notified")}>Publish rota</Button>
            </div>
          </Group>
        )}

        {tab === "pay" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
              {[
                ["October payroll", inr(Object.values(salary).reduce((a, b) => a + b, 0))],
                ["Overtime", inr(6200)],
                ["Advances to recover", inr(5000)],
                ["Tip pool this week", inr(tipsPool)],
              ].map(([l, v]) => (
                <div key={l} className="bg-surface p-4">
                  <div className="text-[13px] text-muted">{l}</div>
                  <div className="mt-1 text-[22px] font-semibold tracking-tight tnum">{v}</div>
                </div>
              ))}
            </div>
            <Group flush title="October · pays on 1 Nov" action={<button onClick={() => toast("Payslips sent on WhatsApp")} className="text-[14px] font-semibold text-jade">Send payslips</button>}>
              {team.map((s) => {
                const tip = Math.round((s.hoursThisWeek / tipHours) * tipsPool);
                return (
                  <div key={s.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                    <Avatar name={s.name} hue={s.hue} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium">{s.name}</div>
                      <div className="text-[12.5px] text-muted tnum">{s.hoursThisWeek * 4} h this month · tip share {inr(tip)}</div>
                    </div>
                    {s.id === "s5" && <Pill tone="saffron">−₹5,000 advance</Pill>}
                    <span className="w-24 text-right text-[15px] font-semibold tnum">{inr((salary[s.id] ?? 15000) + tip * 4 - (s.id === "s5" ? 5000 : 0))}</span>
                  </div>
                );
              })}
            </Group>
          </div>
        )}
      </Page>

    </>
  );
}
