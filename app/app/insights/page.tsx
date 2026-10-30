"use client";

import Link from "next/link";
import { Banknote, Boxes, Clock, PenLine, Percent, ShieldCheck, Trash2, TrendingDown, TrendingUp, Turtle } from "lucide-react";
import type { ReactNode } from "react";
import { Group, Page, PageHeader, Pill } from "@/components/ui";
import { billOf, useCurrentOutlet, useMenu, useOrders, useStock } from "@/lib/live";
import { DAY_MS, between, byDay, change, inOutlet, live, paid, paidAmount, startOfDay, topDishes, totals } from "@/lib/stats";
import { clock, inr, timeAgo } from "@/lib/format";

type Alert = { key: string; icon: ReactNode; tone: "rose" | "saffron" | "sky"; title: string; detail: string; amount?: number; href?: string };

export default function InsightsPage() {
  const outlet = useCurrentOutlet();
  const orders = inOutlet(useOrders(), outlet.id);
  const menu = useMenu();
  const stock = useStock().filter((s) => !s.outletId || s.outletId === outlet.id);
  const now = Date.now();
  const week0 = startOfDay(now) - 6 * DAY_MS;
  const week = between(orders, week0, now + 1);
  const lastWeek = between(orders, week0 - 7 * DAY_MS, week0);

  /* ---------- money leaks, last 7 days ---------- */
  const alerts: Alert[] = [];
  const cancelled = week.filter((o) => o.status === "cancelled");
  if (cancelled.length) {
    const byStaff = new Map<string, number>();
    cancelled.forEach((o) => byStaff.set(o.staff, (byStaff.get(o.staff) ?? 0) + 1));
    const top = [...byStaff.entries()].sort((a, b) => b[1] - a[1])[0];
    alerts.push({
      key: "void", icon: <Trash2 size={18} />, tone: cancelled.length >= 3 ? "rose" : "saffron",
      title: `${cancelled.length} order${cancelled.length === 1 ? "" : "s"} cancelled`,
      detail: `Most by ${top[0]} (${top[1]}). Check each one was a real mistake.`,
      amount: cancelled.reduce((s, o) => s + billOf(o), 0), href: "/app/orders",
    });
  }
  const discounted = paid(week).map((o) => ({ o, off: billOf(o) - paidAmount(o) })).filter((x) => x.off > 0);
  if (discounted.length)
    alerts.push({
      key: "disc", icon: <Percent size={18} />, tone: "saffron",
      title: `${discounted.length} bill${discounted.length === 1 ? "" : "s"} paid less than the total`,
      detail: "Discounts or short payments. Make sure each one was approved.",
      amount: discounted.reduce((s, x) => s + x.off, 0), href: "/app/orders",
    });
  const edited = week.filter((o) => (o.paymentLog?.length ?? 0) > 1);
  if (edited.length)
    alerts.push({
      key: "edit", icon: <PenLine size={18} />, tone: "saffron",
      title: `Payment changed on ${edited.length} bill${edited.length === 1 ? "" : "s"} after billing`,
      detail: `Latest: #${edited[0].number} by ${edited[0].paymentLog![0]?.by ?? "staff"}. Every change is kept on the order.`,
      href: "/app/orders",
    });
  const stale = live(orders).filter((o) => o.status !== "paid" && now - new Date(o.createdAt).getTime() > 4 * 3_600_000);
  if (stale.length)
    alerts.push({
      key: "open", icon: <Clock size={18} />, tone: "rose",
      title: `${stale.length} bill${stale.length === 1 ? "" : "s"} open for over 4 hours`,
      detail: `Oldest: #${stale[stale.length - 1].number} from ${clock(stale[stale.length - 1].createdAt)}. Close them or find out if they were paid.`,
      amount: stale.reduce((s, o) => s + billOf(o), 0), href: "/app/orders",
    });
  const wasted = stock.reduce((s, i) => s + (i.log ?? []).filter((l) => l.kind === "waste" && new Date(l.at).getTime() > week0).reduce((a, l) => a + l.qty * i.costPerUnit, 0), 0);
  if (wasted > 0)
    alerts.push({ key: "waste", icon: <Boxes size={18} />, tone: "saffron", title: "Stock wasted this week", detail: "From waste logged on the Stock screen.", amount: Math.round(wasted), href: "/app/inventory" });
  const out = stock.filter((i) => i.stock <= 0);
  if (out.length)
    alerts.push({ key: "out", icon: <Boxes size={18} />, tone: "rose", title: `${out.length} stock item${out.length === 1 ? "" : "s"} finished`, detail: out.slice(0, 4).map((i) => i.name).join(", "), href: "/app/inventory" });

  /* ---------- trends ---------- */
  const t = totals(week);
  const tl = totals(lastWeek);
  const salesChange = change(t.sales, tl.sales);
  const days = byDay(orders, 7, now);
  const best = days.reduce((a, b) => (b.value > a.value ? b : a), days[0]);
  const hours = new Array(24).fill(0);
  live(week).forEach((o) => hours[new Date(o.createdAt).getHours()]++);
  const peak = hours.indexOf(Math.max(...hours));
  const sold14 = new Set(topDishes(between(orders, now - 14 * DAY_MS, now + 1), 10_000).map((d) => d.id));
  const slow = orders.length ? menu.filter((m) => m.available !== false && !sold14.has(m.id)) : [];

  return (
    <>
      <PageHeader title="Insights" subtitle={`${outlet.name} · last 7 days, from your own orders`} />
      <Page className="space-y-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          <Stat label="Sales · 7 days" value={inr(t.sales)} note={salesChange === null ? "no data for the week before" : `${salesChange >= 0 ? "+" : ""}${salesChange}% vs the week before`} up={(salesChange ?? 0) >= 0} />
          <Stat label="Average bill" value={t.avgBill ? inr(t.avgBill) : "—"} note={tl.avgBill ? `${inr(tl.avgBill)} the week before` : ""} up={t.avgBill >= tl.avgBill} />
          <Stat label="Best day" value={best && best.value ? best.label : "—"} note={best && best.value ? inr(best.value) : ""} up />
          <Stat label="Busiest hour" value={t.orders ? `${peak % 12 || 12}${peak < 12 ? " am" : " pm"}` : "—"} note={t.orders ? `${hours[peak]} order${hours[peak] === 1 ? "" : "s"} this week` : ""} up />
        </div>

        <Group title="Money to check" flush>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-5 lg:px-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-jade-soft text-jade"><ShieldCheck size={19} /></span>
              <div>
                <div className="text-[15px] font-medium">Nothing unusual</div>
                <div className="text-[13px] text-muted">No cancellations, short payments, changed bills or old open bills this week.</div>
              </div>
            </div>
          ) : (
            alerts.map((a) => {
              const body = (
                <>
                  <span className={a.tone === "rose" ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-soft text-rose" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron"}>{a.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{a.title}</div>
                    <div className="text-[13px] text-muted">{a.detail}</div>
                  </div>
                  {a.amount !== undefined && <Pill tone={a.tone}>{inr(a.amount)}</Pill>}
                </>
              );
              return a.href ? (
                <Link key={a.key} href={a.href} className="flex items-center gap-3 border-b border-line/80 px-4 py-3.5 last:border-0 hover:bg-sunken/40 lg:px-5">{body}</Link>
              ) : (
                <div key={a.key} className="flex items-center gap-3 border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">{body}</div>
              );
            })
          )}
        </Group>

        <div className="grid gap-6 lg:grid-cols-2">
          <Group title="Selling well · 7 days" flush>
            {topDishes(week, 5).map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-2.5 last:border-0 lg:px-5">
                <TrendingUp size={16} className="text-jade" />
                <span className="flex-1 text-[14.5px]">{i + 1}. {d.name}</span>
                <span className="text-[13.5px] text-muted tnum">{d.qty} sold</span>
              </div>
            ))}
            {topDishes(week, 1).length === 0 && <p className="px-4 py-6 text-center text-[14px] text-muted">No sales this week yet.</p>}
          </Group>
          <Group title="Not sold in 14 days" flush>
            {slow.length === 0 ? (
              <p className="px-4 py-6 text-center text-[14px] text-muted">{orders.length ? "Every dish sold at least once." : "Shows up after your first orders."}</p>
            ) : (
              slow.slice(0, 8).map((m) => (
                <Link key={m.id} href="/app/menu" className="flex items-center gap-3 border-b border-line/80 px-4 py-2.5 last:border-0 hover:bg-sunken/40 lg:px-5">
                  <Turtle size={16} className="text-saffron" />
                  <span className="flex-1 text-[14.5px]">{m.name}</span>
                  <span className="text-[13px] text-muted tnum">{inr(m.price)}</span>
                </Link>
              ))
            )}
            {slow.length > 8 && <p className="px-4 py-2.5 text-[13px] text-muted lg:px-5">and {slow.length - 8} more. Consider removing or reworking them.</p>}
          </Group>
        </div>

        {orders.length > 0 && (
          <p className="text-center text-[12.5px] text-faint">
            Last order {timeAgo(orders[0].createdAt)} · <Banknote size={12} className="inline" /> {inr(totals(between(orders, startOfDay(now), now + 1)).sales)} today
            {salesChange !== null && salesChange < 0 && <> · <TrendingDown size={12} className="inline text-rose" /> sales down this week</>}
          </p>
        )}
      </Page>
    </>
  );
}

function Stat({ label, value, note, up }: { label: string; value: string; note: string; up: boolean }) {
  return (
    <div className="bg-surface p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight tnum">{value}</div>
      <div className={up ? "text-[12.5px] text-muted" : "text-[12.5px] text-rose"}>{note}</div>
    </div>
  );
}
