"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { CONTACT_EMAIL, CONTACT_WA, Magnetic } from "./chrome";
import {
  IconArrow,
  IconBill,
  IconChat,
  IconForecast,
  IconGuests,
  IconKitchen,
  IconOffline,
  IconPulse,
  IconReports,
  IconShield,
  IconSplit,
  IconStar,
  IconStock,
  IconTable,
  IconTeam,
  IconVoice,
} from "./icons";
import { KotTicket, PhoneMenu, PhoneOwner, PulseNote, Receipt, TabletPOS, UpiCard } from "./mockups";
import { RiseText, ScrollTrigger, gsap, reducedMotion, useIsoLayoutEffect, useTilt } from "./motion";

type Icon = ComponentType<{ size?: number; className?: string }>;

/* ================= what Restro covers: icon strip ================= */
const modules: { icon: Icon; t: string }[] = [
  { icon: IconBill, t: "Billing" },
  { icon: IconKitchen, t: "Kitchen" },
  { icon: IconTable, t: "Tables" },
  { icon: IconStock, t: "Stock" },
  { icon: IconTeam, t: "Team" },
  { icon: IconGuests, t: "Guests" },
  { icon: IconReports, t: "Reports" },
  { icon: IconSplit, t: "UPI QR" },
  { icon: IconChat, t: "WhatsApp" },
];
export function Modules() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8 lg:py-12">
        <p data-reveal className="text-center text-[13px] font-semibold uppercase tracking-[0.18em] text-muted">One login for every part of service</p>
        <div data-reveal-group className="mt-8 grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-5 lg:grid-cols-9">
          {modules.map((m) => (
            <div key={m.t} className="group flex flex-col items-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-jade-soft text-jade transition-all duration-500 group-hover:-translate-y-1 group-hover:bg-jade group-hover:text-white group-hover:shadow-[0_14px_30px_-14px_rgb(var(--jade))]">
                <m.icon size={30} />
              </span>
              <span className="text-[14.5px] font-medium">{m.t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= one app instead of five (sticky index) ================= */
const included: { icon: Icon; t: string; d: string; art: ReactNode }[] = [
  { icon: IconBill, t: "Billing", d: "GST bills, UPI QR for the exact amount, cash, card, discounts, KOTs.", art: <ArtBilling /> },
  { icon: IconTable, t: "Tables and QR", d: "Live floor, waitlist, bookings, and guests ordering from their phone.", art: <ArtTables /> },
  { icon: IconKitchen, t: "Kitchen screen", d: "Tickets by station, timers, and a ‘to cook’ count for the chef.", art: <ArtKitchen /> },
  { icon: IconStock, t: "Stock", d: "Recipes deduct stock as you sell. Purchase orders go out on WhatsApp.", art: <ArtStock /> },
  { icon: IconTeam, t: "Team", d: "PIN clock-in, rota, payroll from real hours, and tip sharing.", art: <ArtTeam /> },
  { icon: IconGuests, t: "Guests", d: "Who comes back, what they order, birthdays, loyalty points.", art: <ArtGuests /> },
  { icon: IconReports, t: "Reports and GST", d: "Profit and loss, day close, GSTR-1 and 3B files for your CA.", art: <ArtReports /> },
];

export function Features() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    if (!list.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-feature]").forEach((el, i) => {
        ScrollTrigger.create({ trigger: el, start: "top 55%", end: "bottom 55%", onToggle: (st) => st.isActive && setActive(i) });
      });
    }, list);
    return () => ctx.revert();
  }, []);

  return (
    <section id="features" className="relative scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <div data-reveal className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jade">Everything in one place</div>
            <RiseText as="h2" onScroll text="One app instead of *five.*" className="mt-4 text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[60px] lg:text-[76px]" />
          </div>
          <p data-reveal className="max-w-lg text-[17.5px] leading-relaxed text-muted lg:justify-self-end">
            Everything your billing software, kitchen printer, stock register, attendance book and WhatsApp groups do today — in one place, talking to each other.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          {/* sticky picture that changes with the list */}
          <div className="hidden lg:block">
            <div className="sticky top-28 h-[540px] overflow-hidden rounded-[36px] bg-surface ring-1 ring-line">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(var(--jade-soft))_0,transparent_60%)]" />
              {included.map((f, i) => (
                <div
                  key={f.t}
                  className={clsx(
                    "absolute inset-0 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)]",
                    i === active ? "opacity-100 [transform:none]" : i < active ? "-translate-y-8 scale-95 opacity-0" : "translate-y-8 scale-95 opacity-0",
                  )}
                  aria-hidden={i !== active}
                >
                  {f.art}
                </div>
              ))}
              <div className="absolute bottom-6 left-6 flex gap-1.5">
                {included.map((f, i) => (
                  <span key={f.t} className={clsx("h-1.5 rounded-full transition-all duration-500", i === active ? "w-8 bg-jade" : "w-1.5 bg-line")} />
                ))}
              </div>
            </div>
          </div>

          <div ref={list}>
            {included.map((f, i) => (
              <div
                key={f.t}
                data-feature
                className={clsx("group border-t border-line py-7 transition-colors duration-500 lg:py-10", i === included.length - 1 && "border-b")}
              >
                <div className="flex items-start gap-3 sm:gap-5">
                  <span className={clsx("mt-1 text-[13px] font-semibold tnum transition-colors duration-500", i === active ? "text-jade" : "text-faint")}>0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-4">
                      <span className={clsx("flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-500", i === active ? "bg-jade text-white" : "bg-surface text-ink ring-1 ring-line")}>
                        <f.icon size={28} />
                      </span>
                      <h3 className={clsx("text-[26px] font-semibold leading-tight tracking-[-0.03em] transition-colors duration-500 sm:text-[32px]", i === active ? "text-ink" : "text-ink/45 lg:text-ink/35")}>{f.t}</h3>
                    </div>
                    <p className="mt-4 max-w-md text-[16.5px] leading-relaxed text-muted">{f.d}</p>
                    <div className="relative mt-6 flex h-[300px] items-center justify-center overflow-hidden rounded-[28px] bg-surface ring-1 ring-line lg:hidden">
                      <div className="absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 scale-[.66] sm:scale-[.8]">{f.art}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div data-reveal className="mt-8 rounded-[24px] bg-jade-soft px-6 py-5 text-[15.5px] font-medium text-jade-deep">
              Plus Swiggy and Zomato orders on the same screen, multiple outlets, and English, मराठी, हिंदी.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* little scenes for each feature */
function ArtBilling() {
  return (
    <div className="relative h-[380px] w-[400px]">
      <Receipt className="absolute left-6 top-4 -rotate-6" />
      <UpiCard className="absolute right-4 top-24 rotate-3" />
      <div className="absolute bottom-6 left-24 flex gap-2">
        {["UPI", "Cash", "Card", "UPI + Cash"].map((m, i) => (
          <span key={m} className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-semibold shadow-float", i === 0 ? "bg-jade text-white" : "bg-surface ring-1 ring-line")}>{m}</span>
        ))}
      </div>
    </div>
  );
}
const TILE: Record<string, string> = { "bg-jade": "bg-jade/15", "bg-saffron": "bg-saffron/15", "bg-sky": "bg-sky/15", "bg-surface": "bg-canvas" };
function ArtTables() {
  const states = ["bg-jade", "bg-surface", "bg-saffron", "bg-surface", "bg-sky", "bg-jade", "bg-surface", "bg-surface", "bg-jade"];
  return (
    <div className="relative flex items-center gap-8">
      <div className="grid grid-cols-3 gap-3">
        {states.map((c, i) => (
          <div key={i} className={clsx("flex h-[74px] w-[74px] flex-col justify-between rounded-2xl p-2.5 ring-1 ring-line", TILE[c])}>
            <span className="text-[14px] font-semibold">T{i + 1}</span>
            <span className={clsx("h-2 w-2 rounded-full", c === "bg-surface" ? "bg-line" : c)} />
          </div>
        ))}
      </div>
      <PhoneMenu className="scale-[.82]" />
    </div>
  );
}
function ArtKitchen() {
  return (
    <div className="flex gap-3">
      {[["T4", "7 min", "saffron"], ["T7", "3 min", "jade"], ["Takeaway", "12 min", "rose"]].map(([t, m, tone], i) => (
        <div key={t} className={clsx("w-[150px] rounded-[18px] bg-canvas p-3 ring-1 ring-line", i === 0 && "-translate-y-4")}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold">{t}</span>
            <span className={clsx("rounded-full px-1.5 py-0.5 text-[10px] font-bold", tone === "saffron" ? "bg-saffron-soft text-saffron" : tone === "rose" ? "bg-rose-soft text-rose" : "bg-jade-soft text-jade-deep")}>{m}</span>
          </div>
          <div className="mt-2 space-y-1 text-[11.5px]">
            <div><b>2×</b> Paneer Tikka</div>
            <div><b>1×</b> Dal Makhani</div>
            <div><b>3×</b> Butter Naan</div>
          </div>
          <div className={clsx("mt-3 rounded-lg py-1.5 text-center text-[11px] font-semibold", i === 1 ? "bg-jade text-white" : "bg-surface ring-1 ring-line")}>{i === 1 ? "Ready" : "Cooking"}</div>
        </div>
      ))}
    </div>
  );
}
function ArtStock() {
  const rows: [string, number, string][] = [["Paneer", 0.35, "rose"], ["Basmati rice", 0.62, "saffron"], ["Cooking oil", 0.9, "jade"], ["Milk", 0.75, "jade"]];
  return (
    <div className="w-[360px] space-y-3">
      {rows.map(([n, v, tone]) => (
        <div key={n} className="rounded-2xl bg-canvas p-4 ring-1 ring-line">
          <div className="flex justify-between text-[14px] font-medium"><span>{n}</span><span className={tone === "rose" ? "text-rose" : tone === "saffron" ? "text-saffron" : "text-jade"}>{tone === "rose" ? "Low" : tone === "saffron" ? "Order soon" : "OK"}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken"><div className={clsx("h-full rounded-full", tone === "rose" ? "bg-rose" : tone === "saffron" ? "bg-saffron" : "bg-jade")} style={{ width: `${v * 100}%` }} /></div>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-[13.5px] font-semibold text-white"><IconChat size={20} /> Send order to supplier</div>
    </div>
  );
}
function ArtTeam() {
  return (
    <div className="flex items-center gap-8">
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <span key={k} className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas text-[20px] font-medium ring-1 ring-line">{k}</span>
        ))}
      </div>
      <div className="space-y-2">
        {[["Kavya", "Manager", 200], ["Rohit", "Captain", 30], ["Sneha", "Captain", 330], ["Imran", "Chef", 100]].map(([n, r, h]) => (
          <div key={n as string} className="flex w-[170px] items-center gap-2.5 rounded-2xl bg-canvas p-2.5 ring-1 ring-line">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold" style={{ background: `hsl(${h} 50% 90%)`, color: `hsl(${h} 45% 30%)` }}>{(n as string)[0]}</span>
            <span><span className="block text-[13px] font-semibold">{n}</span><span className="block text-[11px] text-muted">{r}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
function ArtGuests() {
  return (
    <div className="w-[360px] space-y-3">
      {[["Neha", "6 visits · Paneer Tikka", "Regular"], ["Arjun", "Birthday on Friday", "Birthday"], ["Meera", "Not seen in 34 days", "Win back"]].map(([n, d, tag], i) => (
        <div key={n} className={clsx("flex items-center gap-3 rounded-2xl bg-canvas p-3.5 ring-1 ring-line", i === 1 && "translate-x-6")}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-jade-soft text-[14px] font-semibold text-jade-deep">{n[0]}</span>
          <span className="flex-1"><span className="block text-[14.5px] font-semibold">{n}</span><span className="block text-[12px] text-muted">{d}</span></span>
          <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-semibold text-saffron">{tag}</span>
        </div>
      ))}
    </div>
  );
}
function ArtReports() {
  const bars = [42, 58, 51, 66, 72, 88, 96];
  return (
    <div className="w-[380px] rounded-[24px] bg-canvas p-5 ring-1 ring-line">
      <div className="text-[13px] text-muted">7-day sales</div>
      <div className="text-[30px] font-semibold tracking-tight tnum">₹2,41,380</div>
      <div className="mt-4 flex h-36 items-stretch gap-2">
        {bars.map((b, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className={clsx("w-full rounded-t-lg", i === bars.length - 1 ? "bg-jade" : "bg-jade/25")} style={{ height: `${b}%` }} />
            <span className="text-[10px] text-faint">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
        <span className="rounded-xl bg-surface px-3 py-2 ring-1 ring-line">GSTR-1 ready</span>
        <span className="rounded-xl bg-surface px-3 py-2 ring-1 ring-line">Day close ✓</span>
      </div>
    </div>
  );
}

/* ================= scan to thank-you (pinned horizontal story) ================= */
const steps: { n: string; t: string; d: string; art: ReactNode }[] = [
  { n: "01", t: "Guests order from the table", d: "They scan the table QR, browse a menu with photos and filters, and send the order from their phone.", art: <PhoneMenu /> },
  { n: "02", t: "The kitchen sees it at once", d: "Tickets by station, timers, and a ‘to cook’ count for the chef.", art: <KotTicket className="scale-[1.6]" /> },
  { n: "03", t: "Captains run the floor", d: "Live floor, running bills per party, and orders by tap or by voice.", art: <TabletPOS className="scale-[.82]" /> },
  { n: "04", t: "Every guest pays their own share", d: "A UPI QR for the exact amount — or cash, card, or both. No calculator, no arguments at the counter.", art: <UpiCard className="scale-[1.5]" /> },
  { n: "05", t: "Next morning, a note", d: "Restro Pulse tells you in two sentences what happened yesterday and the three things to do today.", art: <PhoneOwner /> },
];

export function Story() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    if (reducedMotion() || !section.current || !track.current) return;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px)", () => {
      const distance = () => track.current!.scrollWidth - window.innerWidth;
      const tween = gsap.to(track.current, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: { trigger: section.current, start: "top top", end: () => `+=${distance()}`, scrub: 0.6, pin: true, invalidateOnRefresh: true, anticipatePin: 1 },
      });
      // each picture turns toward you as it passes the middle
      gsap.utils.toArray<HTMLElement>("[data-step-art]").forEach((el) => {
        gsap.fromTo(el, { rotateY: -28, rotateX: 8, scale: 0.9 }, {
          rotateY: 0, rotateX: 0, scale: 1, ease: "none",
          scrollTrigger: { trigger: el, containerAnimation: tween, start: "left right", end: "center center", scrub: true },
        });
      });
      gsap.to("[data-story-bar]", { scaleX: 1, ease: "none", scrollTrigger: { trigger: section.current, start: "top top", end: () => `+=${distance()}`, scrub: true } });
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="story" ref={section} className="relative scroll-mt-0 overflow-hidden bg-surface lg:h-[100svh]">
      <div className="mx-auto max-w-[1240px] px-5 pt-20 lg:absolute lg:inset-x-0 lg:top-0 lg:px-8 lg:pt-24">
        <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jade">How it works</div>
        <RiseText as="h2" onScroll text="From scan to *thank-you.*" className="mt-3 text-[40px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[56px] lg:text-[64px]" />
        <div className="mt-6 hidden h-px w-full max-w-md bg-line lg:block"><div data-story-bar className="h-px origin-left scale-x-0 bg-jade" /></div>
      </div>
      <div ref={track} className="flex flex-col gap-6 px-5 pb-20 pt-12 lg:h-full lg:flex-row lg:items-end lg:gap-0 lg:px-0 lg:pb-16 lg:pl-[max(32px,calc((100vw-1240px)/2+32px))] lg:pt-0">
        {steps.map((s) => (
          <article key={s.n} className="relative flex shrink-0 flex-col rounded-[32px] bg-canvas p-6 ring-1 ring-line lg:mr-8 lg:h-[64svh] lg:w-[min(560px,42vw)] lg:flex-row lg:items-stretch lg:gap-6 lg:p-8">
            <div className="flex flex-col lg:w-[44%]">
              <span className="text-[15px] font-semibold tnum text-jade">{s.n}</span>
              <h3 className="mt-auto pt-6 text-[26px] font-semibold leading-tight tracking-tight">{s.t}</h3>
              <p className="mt-3 text-[15.5px] leading-relaxed text-muted">{s.d}</p>
            </div>
            <div className="mt-6 flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-surface lg:mt-0" style={{ perspective: "1000px" }}>
              <div data-step-art className="origin-center">{s.art}</div>
            </div>
          </article>
        ))}
        <div className="hidden w-[10vw] shrink-0 lg:block" />
      </div>
    </section>
  );
}

/* ================= things your current software doesn't do ================= */
const only: { icon: Icon; t: string; d: string }[] = [
  { icon: IconPulse, t: "A morning note, not a dashboard", d: "Restro Pulse tells you in two sentences what happened yesterday and the three things to do today." },
  { icon: IconVoice, t: "Take orders by voice", d: "Captains say the order in Marathi, Hindi or English. Restro turns it into a KOT." },
  { icon: IconSplit, t: "Every guest pays their own share", d: "Split-by-guest UPI from the table QR. No calculator, no arguments at the counter." },
  { icon: IconForecast, t: "Know tomorrow's rush today", d: "A prep list and supplier orders based on your sales, the day, festivals and weather." },
  { icon: IconShield, t: "Leak guard", d: "Flags voids after KOT, cash shortfalls, discount spikes and stock used beyond the recipe." },
  { icon: IconStar, t: "More Google reviews, fewer bad ones", d: "Happy guests get a review link. Unhappy ones reach you privately first." },
  { icon: IconChat, t: "WhatsApp everything", d: "E-bills, waitlist alerts, supplier orders, payslips and win-back offers." },
  { icon: IconOffline, t: "Keeps billing when the internet drops", d: "Orders and bills keep working offline and sync when you are back." },
];

function TiltCard({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useTilt(ref, 6);
  return (
    <div style={{ perspective: "900px" }} className={className}>
      <div ref={ref} className="group h-full rounded-[28px] bg-white/[.05] p-6 ring-1 ring-white/10 transition-colors duration-500 hover:bg-white/[.08] lg:p-7" style={{ transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </div>
  );
}

export function Only() {
  const [first, second, ...rest] = only;
  return (
    <section className="py-20 lg:py-28">
    <div className="relative overflow-hidden bg-ink py-16 text-canvas lg:rounded-[40px] lg:py-24" style={{ marginInline: "clamp(0px, 1.5vw, 24px)" }}>
      <div aria-hidden className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-saffron/[0.12] blur-[120px]" />
      <div aria-hidden className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-jade/[0.18] blur-[120px]" />
      <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-saffron">Only in Restro</div>
        <RiseText as="h2" onScroll text="Things your current software *doesn't* do." className="mt-4 max-w-4xl text-[42px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[58px] lg:text-[72px] [&_.text-jade]:text-saffron" />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-6" data-reveal-group>
          <TiltCard className="sm:col-span-2 lg:col-span-4">
            <div className="grid h-full gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div style={{ transform: "translateZ(30px)" }}>
                <first.icon size={40} className="text-saffron" />
                <h3 className="mt-5 text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] lg:text-[36px]">{first.t}</h3>
                <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-canvas/65">{first.d}</p>
              </div>
              <div style={{ transform: "translateZ(60px)" }} className="justify-self-center">
                <PulseNote className="!w-[270px] rotate-2 !bg-white/[.06] ring-1 ring-white/10" />
              </div>
            </div>
          </TiltCard>
          <TiltCard className="sm:col-span-2 lg:col-span-2">
            <div className="flex h-full flex-col" style={{ transform: "translateZ(30px)" }}>
              <second.icon size={36} className="text-saffron" />
              <h3 className="mt-5 text-[22px] font-semibold leading-tight">{second.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-canvas/65">{second.d}</p>
              <Wave />
            </div>
          </TiltCard>
          {rest.map((f, i) => (
            <TiltCard key={f.t} className="lg:col-span-2">
              <div style={{ transform: "translateZ(24px)" }}>
                <f.icon size={32} className="text-saffron" />
                <h3 className="mt-5 text-[20px] font-semibold leading-tight">{f.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-canvas/65">{f.d}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </div>
    </section>
  );
}

/** Voice bars that breathe. */
function Wave() {
  const bars = [6, 14, 24, 34, 22, 40, 28, 16, 30, 20, 10, 26, 36, 18, 8];
  return (
    <div className="mt-auto flex h-16 items-center gap-1 pt-8" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} className="w-1.5 rounded-full bg-saffron/80 motion-safe:animate-[wave_1.4s_ease-in-out_infinite]" style={{ height: h, animationDelay: `${-i * 0.11}s` }} />
      ))}
    </div>
  );
}

/* ================= contact ================= */
export function Contact() {
  return (
    <section id="contact" className="relative scroll-mt-20 overflow-hidden pb-20 pt-4 lg:pb-28">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="relative overflow-hidden rounded-[40px] bg-jade px-6 py-14 text-white sm:px-12 lg:px-16 lg:py-20">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgb(var(--jade-deep))_0,transparent_55%)]" />
          <div aria-hidden className="grain absolute inset-0 opacity-[0.08] mix-blend-overlay" />
          <div aria-hidden className="pointer-events-none absolute -right-10 top-10 hidden rotate-6 opacity-95 lg:block" data-parallax="-25">
            <Receipt />
          </div>
          <div aria-hidden className="pointer-events-none absolute bottom-10 right-56 hidden -rotate-6 lg:block" data-parallax="-45">
            <UpiCard />
          </div>
          <div className="relative max-w-2xl">
            <RiseText as="h2" onScroll text="Want Restro for your *restaurant?*" className="text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[60px] lg:text-[76px] [&_.text-jade]:text-saffron-soft" />
            <p data-reveal className="mt-6 max-w-xl text-[17.5px] leading-relaxed text-white/80">
              Talk to us. We create your account, and help you add your menu, tables and staff. You get your login the same day.
            </p>
            <div data-reveal className="mt-9 flex flex-wrap gap-3">
              {CONTACT_WA && (
                <Magnetic>
                  <a href={`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent("Hi, I'd like Restro for my restaurant.")}`} target="_blank" rel="noreferrer" className="group flex h-14 items-center gap-3 rounded-full bg-white pl-6 pr-2 text-[16.5px] font-semibold text-jade-deep">
                    Message us on WhatsApp
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-jade text-white transition-transform duration-500 group-hover:-rotate-45"><IconArrow /></span>
                  </a>
                </Magnetic>
              )}
              {CONTACT_EMAIL && (
                <a href={`mailto:${CONTACT_EMAIL}`} className="flex h-14 items-center rounded-full px-6 text-[16.5px] font-semibold ring-1 ring-white/40 transition hover:bg-white/10">{CONTACT_EMAIL}</a>
              )}
              <Link href="/login" className="flex h-14 items-center rounded-full px-6 text-[16.5px] font-semibold ring-1 ring-white/40 transition hover:bg-white/10">Already with us? Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
