"use client";

import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { useCurrentOutlet, useMembers, useOrders } from "@/lib/live";
import { Avatar, Button, Group, Page, PageHeader, Pill, Segmented } from "@/components/ui";
import { DAY_MS, between, inOutlet, paid, paidAmount, startOfDay } from "@/lib/stats";
import { inr } from "@/lib/format";

export default function TeamPage() {
  const [period, setPeriod] = useState<"today" | "7d">("today");
  const outlet = useCurrentOutlet();
  const members = useMembers().filter((m) => m.role === "owner" || m.outletIds.includes(outlet.id));
  const now = Date.now();
  const from = period === "today" ? startOfDay(now) : startOfDay(now) - 6 * DAY_MS;
  const orders = between(inOutlet(useOrders(), outlet.id), from, now + 1).filter((o) => o.status !== "cancelled");

  const rows = members
    .map((m) => {
      const mine = orders.filter((o) => o.staff === m.name);
      return { m, count: mine.length, sales: paid(mine).reduce((s, o) => s + paidAmount(o), 0) };
    })
    .sort((a, b) => Number(b.m.active) - Number(a.m.active) || b.sales - a.sales || a.m.name.localeCompare(b.m.name));
  const fromQr = orders.filter((o) => o.staff === "QR");

  return (
    <>
      <PageHeader
        title="Team"
        subtitle={`${outlet.name} · ${members.filter((m) => m.active).length} people`}
        actions={<Link href="/app/access"><Button size="sm" variant="tinted"><Plus size={16} /> Add person</Button></Link>}
      >
        <Segmented value={period} onChange={setPeriod} options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }]} />
      </PageHeader>
      <Page className="space-y-6">
        {members.length <= 1 ? (
          <div className="flex flex-col items-center rounded-group bg-surface px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade"><Users size={26} /></span>
            <h2 className="mt-4 text-[18px] font-semibold">Add your team</h2>
            <p className="mt-1 max-w-sm text-[14.5px] text-muted">Captains, chefs and cashiers sign in with a 4-digit PIN. You choose what each person can see.</p>
            <Link href="/app/access" className="mt-5"><Button><Plus size={17} /> Add person</Button></Link>
          </div>
        ) : (
          <Group title={period === "today" ? "Orders taken today" : "Orders taken · 7 days"} flush>
            {rows.map(({ m, count, sales }) => (
              <Link key={m.id} href="/app/access" className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 hover:bg-sunken/40 lg:px-5">
                <Avatar name={m.name} hue={m.hue} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-medium">
                    {m.name}
                    {!m.active && <Pill>Off</Pill>}
                  </div>
                  <div className="text-[13px] text-muted">{m.role === "owner" ? "Owner" : m.role === "subadmin" ? `Sub admin · ${m.title}` : m.title}</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold tnum">{inr(sales)}</div>
                  <div className="text-[12.5px] text-muted tnum">{count} order{count === 1 ? "" : "s"}</div>
                </div>
              </Link>
            ))}
            {fromQr.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 lg:px-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-soft text-[12px] font-semibold text-sky">QR</span>
                <div className="flex-1 text-[15px] font-medium">Guests&apos; phones (QR)</div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold tnum">{inr(paid(fromQr).reduce((s, o) => s + paidAmount(o), 0))}</div>
                  <div className="text-[12.5px] text-muted tnum">{fromQr.length} orders</div>
                </div>
              </div>
            )}
          </Group>
        )}
      </Page>
    </>
  );
}
