"use client";

// Activity log: who did what — orders taken, bills paid and confirmed, tables
// freed, prices changed, stock moved, settings and team changes.
import clsx from "clsx";
import { Boxes, Download, IndianRupee, LayoutGrid, ReceiptText, Search, Settings, Ticket, UserRound, UtensilsCrossed, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Chips, Page, PageHeader, Segmented, inputCls } from "@/components/ui";
import { CookingLoader } from "@/components/loader";
import { useActivity, useCurrentOutlet } from "@/lib/live";
import { useReady } from "@/lib/store";
import { clock } from "@/lib/format";
import type { ActivityEntry } from "@/lib/types";

type Kind = "all" | ActivityEntry["kind"];
type Range = "today" | "7d" | "30d" | "all";
const KIND: Record<ActivityEntry["kind"], { label: string; icon: typeof ReceiptText; tone: string }> = {
  order: { label: "Orders", icon: ReceiptText, tone: "bg-jade-soft text-jade" },
  payment: { label: "Payments", icon: IndianRupee, tone: "bg-saffron-soft text-saffron" },
  table: { label: "Tables", icon: LayoutGrid, tone: "bg-sky-soft text-sky" },
  menu: { label: "Menu & prices", icon: UtensilsCrossed, tone: "bg-rose-soft text-rose" },
  stock: { label: "Stock", icon: Boxes, tone: "bg-sunken text-ink" },
  settings: { label: "Settings", icon: Settings, tone: "bg-sunken text-ink" },
  team: { label: "Team", icon: UserRound, tone: "bg-sunken text-ink" },
  coupon: { label: "Coupons", icon: Ticket, tone: "bg-sunken text-ink" },
  guest: { label: "Guests", icon: Smartphone, tone: "bg-sky-soft text-sky" },
};
const DAY = 86_400_000;
const dayStart = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export default function ActivityPage() {
  const all = useActivity();
  const ready = useReady("activity");
  const outlet = useCurrentOutlet();
  const [kind, setKind] = useState<Kind>("all");
  const [range, setRange] = useState<Range>("today");
  const [who, setWho] = useState("all");
  const [q, setQ] = useState("");

  const inOutlet = useMemo(() => all.filter((e) => !e.outletId || !outlet.id || e.outletId === outlet.id), [all, outlet.id]);
  const people = useMemo(() => [...new Set(inOutlet.map((e) => e.by))].sort(), [inOutlet]);
  const since = range === "all" ? 0 : dayStart(Date.now()) - (range === "today" ? 0 : range === "7d" ? 6 : 29) * DAY;
  const shown = useMemo(
    () =>
      inOutlet
        .filter((e) => new Date(e.at).getTime() >= since)
        .filter((e) => kind === "all" || e.kind === kind)
        .filter((e) => who === "all" || e.by === who)
        .filter((e) => !q.trim() || `${e.text} ${e.by}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [inOutlet, since, kind, who, q],
  );
  const kinds = (Object.keys(KIND) as ActivityEntry["kind"][]).filter((k) => inOutlet.some((e) => e.kind === k));

  // grouped by day
  const days: { label: string; items: ActivityEntry[] }[] = [];
  for (const e of shown) {
    const d = dayStart(new Date(e.at).getTime());
    const label = d === dayStart(Date.now()) ? "Today" : d === dayStart(Date.now() - DAY) ? "Yesterday" : new Date(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(e);
    else days.push({ label, items: [e] });
  }

  const download = () => {
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = [["Date", "Time", "Who", "What", "Type"], ...shown.map((e) => [new Date(e.at).toLocaleDateString("en-IN"), clock(e.at), e.by, e.text.replace(/₹/g, "Rs "), KIND[e.kind].label])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle={`${outlet.name ? `${outlet.name} · ` : ""}who did what, as it happens`}
        actions={shown.length > 0 && <Button size="sm" variant="tinted" onClick={download}><Download size={16} /> Excel</Button>}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: "today", label: "Today" },
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
                { value: "all", label: "All" },
              ]}
            />
            <select aria-label="Person" value={who} onChange={(e) => setWho(e.target.value)} className={clsx(inputCls, "!h-10 !w-auto min-w-[150px] !text-[14px]")}>
              <option value="all">Everyone</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="relative min-w-[180px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: table, dish, name…" className={clsx(inputCls, "!h-10 pl-9 !text-[14px]")} />
            </div>
          </div>
          {kinds.length > 1 && <Chips value={kind} onChange={setKind} options={[{ value: "all" as Kind, label: "All" }, ...kinds.map((k) => ({ value: k as Kind, label: KIND[k].label }))]} />}
        </div>
      </PageHeader>
      <Page className="space-y-6">
        {!ready && all.length === 0 ? (
          <div className="flex justify-center py-20"><CookingLoader size={56} label="Loading activity" /></div>
        ) : shown.length === 0 ? (
          <div className="rounded-group bg-surface px-5 py-12 text-center">
            <p className="text-[16px] font-semibold">Nothing here yet</p>
            <p className="mt-1 text-[14px] text-muted">Orders, payments, tables freed, price and stock changes show up here as your team works.</p>
          </div>
        ) : (
          days.map((d) => (
            <section key={d.label}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{d.label}</h2>
              <div className="overflow-hidden rounded-group bg-surface">
                {d.items.map((e) => {
                  const k = KIND[e.kind];
                  return (
                    <div key={e.id} className="flex items-start gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                      <span className={clsx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", k.tone)}>
                        <k.icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] leading-snug">{e.text}</div>
                        <div className="mt-0.5 text-[12.5px] text-muted">{e.by}</div>
                      </div>
                      <span className="shrink-0 text-[12.5px] text-faint tnum">{clock(e.at)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </Page>
    </>
  );
}
