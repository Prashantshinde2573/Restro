"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { CONTACT_EMAIL, CONTACT_WA, Magnetic } from "./chrome";
import { Mesh } from "./hero";
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

const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div data-reveal className={clsx("text-[13px] font-semibold uppercase tracking-[0.18em] text-jade", className)}>{children}</div>
);

/* ================= the dock: every part of service ================= */
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

/** A glass dock like the Mac's: icons grow as the pointer passes over them. */
export function Modules() {
  const dock = useRef<HTMLDivElement>(null);
  const [mx, setMx] = useState<number | null>(null);
  return (
    <section className="relative pb-6">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <p data-reveal className="text-center text-[13px] font-semibold uppercase tracking-[0.18em] text-ink/50">One login for every part of service</p>
        <div data-reveal className="mt-7 flex justify-center">
          <div
            ref={dock}
            onPointerMove={(e) => setMx(e.clientX)}
            onPointerLeave={() => setMx(null)}
            className="glass grid grid-cols-3 gap-4 rounded-[32px] p-4 sm:flex sm:items-end sm:gap-3 sm:rounded-[28px] sm:px-4 sm:py-3"
          >
            {modules.map((m, i) => (
              <DockItem key={m.t} m={m} mx={mx} i={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function DockItem({ m, mx }: { m: (typeof modules)[number]; mx: number | null; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  let s = 1;
  if (mx !== null && ref.current) {
    const r = ref.current.getBoundingClientRect();
    const d = Math.abs(mx - (r.left + r.width / 2));
    s = 1 + Math.max(0, 1 - d / 160) * 0.38;
  }
  return (
    <div ref={ref} className="group flex flex-col items-center gap-2">
      <span
        className="flex h-[60px] w-[60px] origin-bottom items-center justify-center rounded-[18px] bg-gradient-to-b from-jade to-jade-deep text-white shadow-[0_12px_24px_-12px_rgb(var(--jade)),inset_0_1px_0_rgb(255_255_255/.35)] transition-transform duration-200 ease-out"
        style={{ transform: `scale(${s})`, marginInline: `${(s - 1) * 14}px` }}
      >
        <m.icon size={28} />
      </span>
      <span className="text-[13px] font-medium text-ink/70">{m.t}</span>
    </div>
  );
}

/* ================= statement: words light up as you scroll ================= */
export function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const text = "Everything your billing software, kitchen printer, stock register, attendance book and WhatsApp groups do today — in one place, talking to each other.";
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll<HTMLElement>(".lit-word");
    if (reducedMotion()) {
      words.forEach((w) => (w.style.color = "rgb(var(--ink))"));
      return;
    }
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "bottom 45%",
      scrub: true,
      onUpdate: (self) => {
        const n = Math.round(self.progress * words.length);
        words.forEach((w, i) => (w.style.color = i < n ? "rgb(var(--ink))" : ""));
      },
    });
    return () => st.kill();
  }, []);
  return (
    <section className="py-24 lg:py-36">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-8">
        <Eyebrow>One app instead of five</Eyebrow>
        <p ref={ref} className="mt-6 text-[34px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[48px] lg:text-[60px]">
          {text.split(" ").map((w, i) => (
            <span key={i} className="lit-word">{w} </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ================= features: glass bento ================= */
function Tile({ className, icon: I, t, d, children, art = "bottom" }: { className?: string; icon: Icon; t: string; d: string; children: ReactNode; art?: "bottom" | "side" }) {
  return (
    <div className={clsx("glass glass-shine group relative flex overflow-hidden rounded-[32px]", art === "side" ? "flex-col lg:flex-row" : "flex-col", className)}>
      <div className={clsx("relative z-10 p-7 lg:p-8", art === "side" && "lg:w-[42%] lg:self-center")}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jade text-white shadow-[inset_0_1px_0_rgb(255_255_255/.3)]"><I size={26} /></span>
        <h3 className="mt-5 text-[24px] font-semibold leading-tight tracking-[-0.03em] lg:text-[28px]">{t}</h3>
        <p className="mt-2 max-w-sm text-[15.5px] leading-relaxed text-ink/60">{d}</p>
      </div>
      <div className="relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden">
        <div className="origin-center scale-[.62] transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[.66] sm:scale-[.78] sm:group-hover:scale-[.82]">{children}</div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="relative isolate scroll-mt-20 overflow-hidden py-24 lg:py-32">
      <Mesh />
      <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Everything in one place</Eyebrow>
          <RiseText as="h2" onScroll text="Built for the *whole* service." className="mt-4 text-[42px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[60px] lg:text-[72px]" />
        </div>
        <div className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-6 lg:grid-rows-[auto_auto_auto]" data-reveal-group>
          <Tile className="lg:col-span-4" art="side" icon={IconBill} t="Billing" d="GST bills, UPI QR for the exact amount, cash, card, discounts, KOTs."><ArtBilling /></Tile>
          <Tile className="lg:col-span-2 lg:row-span-2" icon={IconTable} t="Tables and QR" d="Live floor, waitlist, bookings, and guests ordering from their phone."><PhoneMenu /></Tile>
          <Tile className="lg:col-span-2" icon={IconKitchen} t="Kitchen screen" d="Tickets by station, timers, and a ‘to cook’ count for the chef."><KotTicket className="scale-[1.35]" /></Tile>
          <Tile className="lg:col-span-2" icon={IconStock} t="Stock" d="Recipes deduct stock as you sell. Purchase orders go out on WhatsApp."><ArtStock /></Tile>
          <Tile className="lg:col-span-2" icon={IconTeam} t="Team" d="PIN clock-in, rota, payroll from real hours, and tip sharing."><ArtTeam /></Tile>
          <Tile className="lg:col-span-2" icon={IconGuests} t="Guests" d="Who comes back, what they order, birthdays, loyalty points."><ArtGuests /></Tile>
          <Tile className="lg:col-span-2" icon={IconReports} t="Reports and GST" d="Profit and loss, day close, GSTR-1 and 3B files for your CA."><ArtReports /></Tile>
        </div>
        <div data-reveal className="glass mt-4 rounded-[24px] px-7 py-5 text-center text-[15.5px] font-medium text-jade-deep">
          Plus Swiggy and Zomato orders on the same screen, multiple outlets, and English, मराठी, हिंदी.
        </div>
      </div>
    </section>
  );
}

/* little scenes for the tiles */
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
    <section id="story" ref={section} className="relative isolate overflow-hidden lg:h-[100svh]">
      <Mesh />
      <div className="relative mx-auto max-w-[1240px] px-5 pt-24 lg:absolute lg:inset-x-0 lg:top-0 lg:px-8 lg:pt-24">
        <Eyebrow>How it works</Eyebrow>
        <RiseText as="h2" onScroll text="From scan to *thank-you.*" className="mt-3 text-[40px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[56px] lg:text-[64px]" />
        <div className="mt-6 hidden h-[3px] w-full max-w-md overflow-hidden rounded-full bg-ink/10 lg:block"><div data-story-bar className="h-full origin-left scale-x-0 rounded-full bg-jade" /></div>
      </div>
      <div ref={track} className="relative flex flex-col gap-5 px-5 pb-24 pt-12 lg:h-full lg:flex-row lg:items-end lg:gap-0 lg:px-0 lg:pb-14 lg:pl-[max(32px,calc((100vw-1240px)/2+32px))] lg:pt-0">
        {steps.map((s) => (
          <article key={s.n} className="glass relative flex shrink-0 flex-col rounded-[32px] p-6 lg:mr-6 lg:h-[62svh] lg:w-[min(580px,44vw)] lg:flex-row lg:items-stretch lg:gap-6 lg:p-7">
            <div className="flex flex-col lg:w-[44%]">
              <span className="w-fit rounded-full bg-jade/10 px-3 py-1 text-[13px] font-semibold tnum text-jade">Step {s.n}</span>
              <h3 className="mt-auto pt-6 text-[26px] font-semibold leading-tight tracking-[-0.03em]">{s.t}</h3>
              <p className="mt-3 text-[15.5px] leading-relaxed text-ink/60">{s.d}</p>
            </div>
            <div className="mt-6 flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-[24px] bg-white/50 lg:mt-0" style={{ perspective: "1000px" }}>
              <div data-step-art className="origin-center">{s.art}</div>
            </div>
          </article>
        ))}
        <div className="hidden w-[10vw] shrink-0 lg:block" />
      </div>
    </section>
  );
}

/* ================= things your current software doesn't do (dark glass) ================= */
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
      <div ref={ref} className="glass-dark glass-shine group h-full rounded-[28px] p-6 lg:p-7" style={{ transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </div>
  );
}

export function Only() {
  const [first, second, ...rest] = only;
  return (
    <section className="py-6 lg:py-10">
      <div className="relative isolate overflow-hidden bg-ink py-20 text-canvas lg:rounded-[44px] lg:py-28" style={{ marginInline: "clamp(0px, 1.5vw, 24px)" }}>
        <Mesh tone="dark" />
        <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="!text-saffron">Only in Restro</Eyebrow>
            <RiseText as="h2" onScroll text="Things your current software *doesn't* do." className="mt-4 text-[40px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[56px] lg:text-[68px] [&_.text-jade]:text-saffron" />
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-20 lg:grid-cols-6" data-reveal-group>
            <TiltCard className="sm:col-span-2 lg:col-span-4">
              <div className="grid h-full gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
                <div style={{ transform: "translateZ(30px)" }}>
                  <first.icon size={40} className="text-saffron" />
                  <h3 className="mt-5 text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] lg:text-[36px]">{first.t}</h3>
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
            {rest.map((f) => (
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
    <section id="contact" className="relative scroll-mt-20 pb-20 pt-4 lg:pb-28">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-[44px] bg-jade px-6 py-16 text-white sm:px-12 lg:px-16 lg:py-24">
          <Mesh tone="jade" />
          <div aria-hidden className="pointer-events-none absolute right-10 top-24 hidden rotate-6 lg:block" data-parallax="-25">
            <div className="glass-dark rounded-[22px] p-2.5"><Receipt /></div>
          </div>
          <div aria-hidden className="pointer-events-none absolute bottom-10 right-64 hidden -rotate-6 xl:block" data-parallax="-45">
            <div className="glass-dark rounded-[30px] p-2.5"><UpiCard className="!shadow-none" /></div>
          </div>
          <div className="relative max-w-2xl">
            <RiseText as="h2" onScroll text="Want Restro for your *restaurant?*" className="text-[42px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[60px] lg:text-[72px] [&_.text-jade]:text-saffron-soft" />
            <p data-reveal className="mt-6 max-w-xl text-[17.5px] leading-relaxed text-white/80">
              Talk to us. We create your account, and help you add your menu, tables and staff. You get your login the same day.
            </p>
            <div data-reveal className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {CONTACT_WA && (
                <Magnetic block>
                  <a href={`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent("Hi, I'd like Restro for my restaurant.")}`} target="_blank" rel="noreferrer" className="group flex h-14 items-center justify-between gap-3 rounded-full bg-white pl-6 pr-2 text-[16.5px] font-semibold text-jade-deep">
                    Message us on WhatsApp
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-jade text-white transition-transform duration-500 group-hover:-rotate-45"><IconArrow /></span>
                  </a>
                </Magnetic>
              )}
              {CONTACT_EMAIL && (
                <a href={`mailto:${CONTACT_EMAIL}`} className="glass-dark flex h-14 items-center justify-center rounded-full px-6 text-[16.5px] font-semibold transition hover:bg-white/10">{CONTACT_EMAIL}</a>
              )}
              <Link href="/login" className="glass-dark flex h-14 items-center justify-center rounded-full px-7 text-[16.5px] font-semibold transition hover:bg-white/10">Already with us? Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
