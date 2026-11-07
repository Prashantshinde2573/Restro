"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, ChefHat, History, ShoppingBasket, LayoutGrid, Globe2, SquarePlus, ReceiptText, CalendarDays, MapPin } from "lucide-react";
import { hasTables, isOwner } from "@/lib/access";
import { useCan, useCurrentOutlet, useFeature, useMe, useMembers, useMenu, useOrders } from "@/lib/live";
import { Group, Page, PageHeader, Pill, Ring, Row } from "@/components/ui";
import { BarChart, TrendChart } from "@/components/charts";
import { UserChip } from "@/components/shell";
import { DAY_MS, between, byChannel, byDay, byHour, change, inOutlet, startOfDay, topDishes, totals } from "@/lib/stats";
import { isShared, useTables } from "@/lib/tables";
import { inr, minutesSince } from "@/lib/format";
import { NeedsYou } from "@/components/notifications";

/** Staff without reports see a simple start screen with only their own tools. */
function StaffHome() {
  const me = useMe();
  const outlet = useCurrentOutlet();
  const links = [
    { href: "/app/pos", label: "New order", perm: "pos" as const, icon: SquarePlus },
    { href: "/app/orders", label: "Orders", perm: "orders" as const, icon: ReceiptText },
    { href: "/app/tables", label: "Tables", perm: "tables" as const, icon: LayoutGrid, restaurantOnly: true },
    { href: "/app/kitchen", label: "Kitchen", perm: "kitchen" as const, icon: ChefHat },
    { href: "/app/inventory", label: "Stock", perm: "stock" as const, icon: ShoppingBasket },
    { href: "/app/activity", label: "Activity", perm: "activity" as const, icon: History },
  ].filter((l) => me?.perms.includes(l.perm) && !(l.restaurantOnly && !hasTables(outlet)));
  return (
    <>
      <PageHeader title={`Hi, ${me?.name.split(" ")[0] ?? ""}`} subtitle={outlet.name} actions={<UserChip />} />
      <Page className="space-y-4">
        <NeedsYou />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="flex flex-col gap-3 rounded-group bg-surface p-5 hover:shadow-float">
              <l.icon size={24} className="text-jade" />
              <span className="text-[16px] font-semibold">{l.label}</span>
            </Link>
          ))}
        </div>
      </Page>
    </>
  );
}

export default function PulsePage() {
  const me = useMe();
  const canReports = useCan("reports");
  if (!isOwner(me) && !canReports) return <StaffHome />;
  return <OwnerHome />;
}

function OwnerHome() {
  const me = useMe();
  const outlet = useCurrentOutlet();
  const cafe = !hasTables(outlet); // counter only
  const pulseOn = useFeature("pulse") === "ok";
  const tables = useTables();
  const menu = useMenu();
  const members = useMembers();
  const orders = inOutlet(useOrders(), outlet.id);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const today0 = startOfDay(now);
  const lastWeek0 = today0 - 7 * DAY_MS;
  const today = totals(between(orders, today0, now + 1));
  // same weekday last week, up to the same time of day
  const before = totals(between(orders, lastWeek0, lastWeek0 + (now - today0)));
  const dayName = new Date(lastWeek0).toLocaleDateString("en-IN", { weekday: "short" });
  const hourly = byHour(orders, today0, lastWeek0);
  const week = byDay(orders, 7, now);
  const top = topDishes(between(orders, today0 - 6 * DAY_MS, now + 1));
  const channels = byChannel(between(orders, today0 - 6 * DAY_MS, now + 1));

  const busy = tables.filter((t) => t.parties.length > 0).length;
  const billing = tables.filter((t) => t.parties.some((p) => p.status === "billing")).length;
  const shared = tables.filter(isShared).length;
  const kitchenQueue = orders.filter((o) => ["new", "accepted", "preparing"].includes(o.status));
  const oldest = kitchenQueue.reduce((m, o) => Math.max(m, minutesSince(o.createdAt)), 0);
  const waiting = orders.filter((o) => o.status === "new").length;
  const qrOpen = orders.filter((o) => o.channel !== "pos" && o.status !== "paid" && o.status !== "cancelled");
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const steps = [
    { id: "upi", done: !!outlet.upi, text: "Add your UPI ID for payment QRs", href: "/app/settings" },
    { id: "menu", done: menu.length > 0, text: "Add your menu", href: "/app/menu" },
    ...(cafe ? [] : [{ id: "tables", done: tables.length > 0, text: "Set up your tables", href: "/app/tables" }]),
    { id: "staff", done: members.some((m) => m.role !== "owner"), text: "Add your staff and their PINs", href: "/app/access" },
    { id: "order", done: orders.length > 0, text: "Take your first order", href: "/app/pos" },
  ];
  const doneSteps = steps.filter((s) => s.done).length;
  // steps the owner chose to skip for now (kept on this device, per outlet)
  const skipKey = `restropi.setupSkip.${outlet.id || "main"}`;
  const [skipped, setSkipped] = useState<string[]>([]);
  useEffect(() => {
    try { setSkipped(JSON.parse(localStorage.getItem(skipKey) || "[]")); } catch { setSkipped([]); }
  }, [skipKey]);
  const setSkip = (ids: string[]) => {
    setSkipped(ids);
    try { localStorage.setItem(skipKey, JSON.stringify(ids)); } catch {}
  };
  const pending = steps.filter((s) => !s.done && !skipped.includes(s.id));
  const vs = (a: number, b: number) => {
    const c = change(a, b);
    return c === null ? { note: `vs ${dayName} last week: —`, up: true } : { note: `${c >= 0 ? "+" : ""}${c}% vs last ${dayName}`, up: c >= 0 };
  };
  const pulse =
    today.orders === 0
      ? `No orders yet today.${before.orders ? ` Last ${dayName} had ${before.orders} by this time.` : ""}`
      : `${inr(today.sales)} collected from ${today.paidOrders} paid bill${today.paidOrders === 1 ? "" : "s"} so far` +
        (change(today.sales, before.sales) !== null ? `, ${Math.abs(change(today.sales, before.sales)!)}% ${today.sales >= before.sales ? "more" : "less"} than last ${dayName}.` : ".") +
        (kitchenQueue.length ? ` ${kitchenQueue.length} ticket${kitchenQueue.length === 1 ? "" : "s"} in the kitchen.` : "") +
        (today.open ? ` ${inr(today.open)} still to be paid.` : "");

  return (
    <>
      <PageHeader
        title={`${greeting}, ${me?.name.split(" ")[0] ?? ""}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={16} strokeWidth={1.8} className="text-faint" />{new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
            {outlet.name && (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-faint" />
                <span className="inline-flex items-center gap-1.5"><MapPin size={16} strokeWidth={1.8} className="text-faint" />{outlet.name}</span>
              </>
            )}
          </span>
        }
        actions={<UserChip />}
      />
      <Page className="space-y-6">
        <NeedsYou />
        {pending.length > 0 && (
          <section className="rounded-[24px] bg-surface p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[19px] font-semibold tracking-tight">Get your restaurant ready</h2>
                <p className="text-[14px] text-muted">
                  {doneSteps} of {steps.length} done
                  <button onClick={() => setSkip(steps.filter((x) => !x.done).map((x) => x.id))} className="ml-2 font-semibold text-ink/60 underline-offset-4 hover:text-ink hover:underline">Skip all for now</button>
                </p>
              </div>
              <Ring value={doneSteps / steps.length} size={48} stroke={6} />
            </div>
            <div className="mt-4 space-y-2">
              {steps.map((s) => {
                const skip = !s.done && skipped.includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-[14px] bg-canvas pr-2 hover:bg-sunken">
                    <Link href={s.href} className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-[15px]">
                      <span className={s.done ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jade text-white" : skip ? "h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-line" : "h-6 w-6 shrink-0 rounded-full ring-2 ring-line"}>
                        {s.done && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className={s.done ? "min-w-0 flex-1 text-muted line-through" : skip ? "min-w-0 flex-1 text-muted" : "min-w-0 flex-1 font-medium"}>
                        {s.text}
                        {skip && <span className="ml-2 rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-semibold text-muted">Skipped</span>}
                      </span>
                      {!s.done && !skip && <ArrowUpRight size={16} className="shrink-0 text-faint" />}
                    </Link>
                    {!s.done && (
                      <button
                        onClick={() => setSkip(skip ? skipped.filter((x) => x !== s.id) : [...skipped, s.id])}
                        className="h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold text-muted ring-1 ring-line hover:text-ink"
                      >
                        {skip ? "Undo" : "Skip"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {pulseOn && orders.length > 0 && (
          <section className="relative overflow-hidden rounded-[24px] bg-ink p-5 text-canvas lg:p-8">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-saffron/25 blur-3xl" />
            <div className="relative flex items-center gap-2 text-[13px] font-semibold text-saffron">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-saffron" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-saffron" />
              </span>
              Restropi Pulse · live
            </div>
            <p className="relative mt-3 max-w-3xl text-[19px] font-medium leading-[1.35] tracking-tight lg:text-[26px] lg:leading-[1.3]">{pulse}</p>
          </section>
        )}

        {/* Today's numbers */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            { label: "Sales today", value: inr(today.sales), ...vs(today.sales, before.sales) },
            { label: "Orders", value: String(today.orders), ...vs(today.orders, before.orders) },
            { label: "Average bill", value: today.avgBill ? inr(today.avgBill) : "—", ...vs(today.avgBill, before.avgBill) },
            { label: "Not paid yet", value: inr(today.open), note: "open bills today", up: true },
          ].map((s) => (
            <div key={s.label} className="bg-surface p-4 lg:p-5">
              <div className="text-[13px] text-muted">{s.label}</div>
              <div className="mt-1 text-[26px] font-semibold tracking-tight tnum lg:text-[30px]">{s.value}</div>
              <div className={s.up ? "text-[12.5px] font-medium text-muted" : "text-[12.5px] font-medium text-rose"}>{s.note}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Group
            title="Orders by hour"
            action={
              <span className="flex items-center gap-3 text-[12px] text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-jade" />Today</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sunken ring-1 ring-line" />Last {dayName}</span>
              </span>
            }
          >
            <BarChart data={hourly} height={190} format={(n) => `${n} order${n === 1 ? "" : "s"}`} />
          </Group>

          <Group title="Right now" flush>
            {!cafe && (
              <Row
                href="/app/tables"
                leading={<div className="relative"><Ring value={tables.length ? busy / tables.length : 0} size={44} stroke={5} /><LayoutGrid size={16} className="absolute inset-0 m-auto text-jade" /></div>}
                title={tables.length ? `${busy} of ${tables.length} tables busy` : "No tables yet"}
                subtitle={[billing ? `${billing} asked for the bill` : "", shared ? `${shared} shared` : ""].filter(Boolean).join(" · ") || (tables.length ? "All calm" : "Add tables to start")}
                trailing={billing ? <Pill tone="saffron">{billing} bill</Pill> : undefined}
              />
            )}
            <Row
              href="/app/kitchen"
              leading={<div className="flex h-11 w-11 items-center justify-center rounded-full bg-jade-soft"><ChefHat size={19} className="text-jade" /></div>}
              title={`${kitchenQueue.length} ticket${kitchenQueue.length === 1 ? "" : "s"} in the kitchen`}
              subtitle={kitchenQueue.length ? `Oldest waiting ${oldest} min` : "Nothing cooking"}
              trailing={oldest >= 20 ? <Pill tone="rose">Late</Pill> : undefined}
            />
            <Row
              href="/app/orders"
              leading={<div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-soft"><Globe2 size={19} className="text-sky" /></div>}
              title={`${qrOpen.length} QR order${qrOpen.length === 1 ? "" : "s"} open`}
              subtitle={waiting ? `${waiting} waiting to be accepted` : "From guests' phones"}
              trailing={waiting ? <Pill tone="sky">{waiting} new</Pill> : undefined}
            />
          </Group>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Group title="Last 7 days">
            <TrendChart data={week} height={170} format={(n) => inr(n)} />
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[13px] text-muted">7-day sales</span>
              <span className="text-[17px] font-semibold tnum">{inr(week.reduce((s, w) => s + w.value, 0))}</span>
            </div>
          </Group>

          <Group title="Bestsellers · 7 days" flush>
            {top.length ? (
              top.map((m, i) => (
                <Row
                  key={m.id}
                  leading={<span className="w-5 text-center text-[13px] font-semibold text-faint tnum">{i + 1}</span>}
                  title={m.name}
                  subtitle={inr(m.sales)}
                  trailing={<span className="text-[14px] font-semibold tnum">{m.qty}</span>}
                />
              ))
            ) : (
              <p className="px-4 py-6 text-center text-[14px] text-muted">Your top dishes show up after the first orders.</p>
            )}
          </Group>

          <Group title="Where orders came from · 7 days">
            {channels.length ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-sunken">
                  {channels.map((c, i) => (
                    <div key={c.key} className={TONES[i % TONES.length]} style={{ width: `${c.pct}%` }} />
                  ))}
                </div>
                <div className="mt-4 space-y-2.5">
                  {channels.map((c, i) => (
                    <div key={c.key} className="flex items-center gap-2.5 text-[14px]">
                      <span className={`h-2.5 w-2.5 rounded-full ${TONES[i % TONES.length]}`} />
                      <span className="flex-1">{c.label}</span>
                      <span className="font-semibold tnum">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-[14px] text-muted">No orders in the last 7 days.</p>
            )}
          </Group>
        </div>
      </Page>
    </>
  );
}

const TONES = ["bg-jade", "bg-sky", "bg-saffron", "bg-[#25D366]", "bg-rose", "bg-ink"];
