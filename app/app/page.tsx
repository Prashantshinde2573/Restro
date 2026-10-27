"use client";

import Link from "next/link";
import { ArrowUpRight, ChefHat, ShoppingBasket, Sparkles, Star, UserX, LayoutGrid, Globe2 } from "lucide-react";
import { Bars, Group, Page, PageHeader, Pill, Ring, Row } from "@/components/ui";
import { UserChip } from "@/components/shell";
import { repo } from "@/lib/repo";
import { inr, orderTotal } from "@/lib/format";

export default function PulsePage() {
  const r = repo.restaurant();
  const tables = repo.tables();
  const orders = repo.orders();
  const hourly = repo.hourly();
  const week = repo.weekSales();
  const menu = repo.menu();

  const busy = tables.filter((t) => t.status !== "free" && t.status !== "reserved").length;
  const kitchenQueue = orders.filter((o) => o.status === "new" || o.status === "preparing");
  const online = orders.filter((o) => ["whatsapp", "swiggy", "zomato", "qr"].includes(o.channel) && o.status !== "paid");
  const today = week[week.length - 1].v;
  const lastTue = 33_900;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const top = [...menu].sort((a, b) => b.soldThisWeek - a.soldThisWeek).slice(0, 5);

  const channels = [
    { label: "Counter & captains", value: 52, tone: "bg-jade" },
    { label: "Table QR", value: 21, tone: "bg-sky" },
    { label: "WhatsApp", value: 11, tone: "bg-[#25D366]" },
    { label: "Swiggy + Zomato", value: 16, tone: "bg-saffron" },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting}, ${r.owner}`}
        subtitle={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${r.outlet}`}
        actions={<UserChip />}
      />
      <Page className="space-y-6">
        {/* Restro Pulse — the briefing */}
        <section className="relative overflow-hidden rounded-[24px] bg-ink p-5 text-canvas lg:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-saffron/25 blur-3xl" />
          <div className="relative flex items-center gap-2 text-[13px] font-semibold text-saffron">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-saffron" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-saffron" />
            </span>
            Restro Pulse · updated 2 min ago
          </div>
          <p className="relative mt-3 max-w-3xl text-[19px] font-medium leading-[1.35] tracking-tight lg:text-[28px] lg:leading-[1.3]">
            Lunch beat a normal Tuesday by 14%. Dinner should be busy: two large bookings at 8 pm and Diwali week starts Thursday.
            <span className="text-canvas/55"> You will run out of paneer around 8:30 pm unless you order before 5.</span>
          </p>
          <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
            {[
              { icon: ShoppingBasket, text: "Order 4 kg paneer from Chitale", href: "/app/inventory" },
              { icon: UserX, text: "Check 3 voids on Aman's shift", href: "/app/insights" },
              { icon: Star, text: "Reply to Rahul's 2-star review", href: "/app/guests" },
            ].map((a) => (
              <Link
                key={a.text}
                href={a.href}
                className="group flex items-center gap-3 rounded-[14px] bg-white/[.07] px-3.5 py-3 text-[14px] font-medium transition hover:bg-white/[.12]"
              >
                <a.icon size={17} className="shrink-0 text-saffron" />
                <span className="flex-1">{a.text}</span>
                <ArrowUpRight size={15} className="text-canvas/40 transition group-hover:text-canvas" />
              </Link>
            ))}
          </div>
        </section>

        {/* Today's numbers */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            { label: "Sales so far", value: inr(today), note: `+${Math.round(((today - lastTue) / lastTue) * 100)}% vs last Tue`, up: true },
            { label: "Orders", value: "64", note: "+9 vs last Tue", up: true },
            { label: "Average bill", value: inr(604), note: "−₹22 vs last Tue", up: false },
            { label: "Guests served", value: "108", note: "+12 vs last Tue", up: true },
          ].map((s) => (
            <div key={s.label} className="bg-surface p-4 lg:p-5">
              <div className="text-[13px] text-muted">{s.label}</div>
              <div className="mt-1 text-[26px] font-semibold tracking-tight tnum lg:text-[30px]">{s.value}</div>
              <div className={s.up ? "text-[12.5px] font-medium text-jade" : "text-[12.5px] font-medium text-rose"}>{s.note}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Group
            title="Guests by hour"
            action={
              <span className="flex items-center gap-3 text-[12px] text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-jade" />Today</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sunken ring-1 ring-line" />Usual Tuesday</span>
              </span>
            }
          >
            <Bars data={hourly.map((h) => ({ label: h.h, value: h.today, ghost: h.usual }))} height={170} />
            <p className="mt-4 text-[13.5px] text-muted">
              Expect around <b className="text-ink">180 guests</b> between 7 and 10 pm. Keep 2 captains on the rooftop from 8.
            </p>
          </Group>

          <Group title="Right now" flush>
            <Row
              href="/app/tables"
              leading={<div className="relative"><Ring value={busy / tables.length} size={44} stroke={5} /><LayoutGrid size={16} className="absolute inset-0 m-auto text-jade" /></div>}
              title={`${busy} of ${tables.length} tables busy`}
              subtitle="T4 has asked for the bill"
              trailing={<Pill tone="saffron">1 bill</Pill>}
            />
            <Row
              href="/app/kitchen"
              leading={<div className="flex h-11 w-11 items-center justify-center rounded-full bg-jade-soft"><ChefHat size={19} className="text-jade" /></div>}
              title={`${kitchenQueue.length} tickets in the kitchen`}
              subtitle="Average 12 min · R1 is waiting longest"
              trailing={<Pill tone="rose">1 late</Pill>}
            />
            <Row
              href="/app/orders"
              leading={<div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-soft"><Globe2 size={19} className="text-sky" /></div>}
              title={`${online.length} online orders open`}
              subtitle="WhatsApp, Swiggy and table QR"
              trailing={<Pill tone="sky">2 new</Pill>}
            />
          </Group>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Group title="This week" className="lg:col-span-1">
            <Bars data={week.map((w) => ({ label: w.d, value: w.v }))} height={130} highlightLast format={(n) => inr(n)} />
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[13px] text-muted">7-day sales</span>
              <span className="text-[17px] font-semibold tnum">{inr(week.reduce((s, w) => s + w.v, 0))}</span>
            </div>
          </Group>

          <Group title="Bestsellers this week" flush>
            {top.map((m, i) => (
              <Row
                key={m.id}
                leading={<span className="w-5 text-center text-[13px] font-semibold text-faint tnum">{i + 1}</span>}
                title={m.name}
                subtitle={`${inr(m.price)} · ${Math.round(((m.price - m.cost) / m.price) * 100)}% margin`}
                trailing={<span className="text-[14px] font-semibold tnum">{m.soldThisWeek}</span>}
              />
            ))}
          </Group>

          <Group title="Where orders came from">
            <div className="flex h-3 overflow-hidden rounded-full">
              {channels.map((c) => (
                <div key={c.label} className={c.tone} style={{ width: `${c.value}%` }} />
              ))}
            </div>
            <div className="mt-4 space-y-2.5">
              {channels.map((c) => (
                <div key={c.label} className="flex items-center gap-2.5 text-[14px]">
                  <span className={`h-2.5 w-2.5 rounded-full ${c.tone}`} />
                  <span className="flex-1">{c.label}</span>
                  <span className="font-semibold tnum">{c.value}%</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-ctl bg-saffron-soft/70 p-3 text-[13px] text-ink">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-saffron" />
              Aggregator orders pay ~22% commission. 31 of today&apos;s Swiggy guests are on your list — a WhatsApp offer could bring them direct.
            </div>
          </Group>
        </div>

        <p className="text-center text-[12px] text-faint">Open bills total {inr(orders.filter((o) => o.status !== "paid").reduce((s, o) => s + orderTotal(o.lines), 0))}</p>
      </Page>
    </>
  );
}
