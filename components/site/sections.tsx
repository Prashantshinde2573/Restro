"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
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
import { Eyebrow, SectionHead } from "./head";
import { Swipe } from "./swipe";
import { sb } from "@/lib/cloud";
import { RiseText, ScrollTrigger, gsap, reducedMotion, useIsoLayoutEffect, useTilt } from "./motion";

type Icon = ComponentType<{ size?: number; className?: string }>;


/* ================= statement: words light up as you scroll, on a dark photo ================= */
// Photo from Unsplash (free under the Unsplash License).
const STATEMENT_IMG = "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?auto=format&fit=crop&q=70&w=2000";

export function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  const text = "Everything your billing software, kitchen printer, stock register, attendance book and WhatsApp groups do today — in one place, talking to each other.";
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll<HTMLElement>(".lit-word");
    if (reducedMotion()) {
      words.forEach((w) => (w.style.color = "#fff"));
      return;
    }
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 80%",
      end: "bottom 45%",
      scrub: true,
      onUpdate: (self) => {
        const n = Math.round(self.progress * words.length);
        words.forEach((w, i) => (w.style.color = i < n ? "#fff" : ""));
      },
    });
    return () => st.kill();
  }, []);
  return (
    <section className="px-2 py-2 sm:px-3">
      <div className="relative isolate overflow-hidden rounded-[30px] bg-ink sm:rounded-[40px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={STATEMENT_IMG} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover text-transparent opacity-45" data-parallax="-6" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(16_22_20/.92)_0%,rgb(16_22_20/.75)_55%,rgb(16_22_20/.55)_100%)]" />
        <div className="mx-auto max-w-[1100px] px-6 py-14 lg:px-8 lg:py-32">
          <Eyebrow dark>One app instead of five</Eyebrow>
          <p ref={ref} className="mt-5 text-[30px] font-semibold leading-[1.12] tracking-[-0.035em] sm:text-[46px] lg:text-[58px] [&_.lit-word]:text-white/20">
            {text.split(" ").map((w, i) => (
              <span key={i} className="lit-word">{w} </span>
            ))}
          </p>
          <div data-reveal className="mt-10">
            <a href="#contact" className="group inline-flex h-[52px] items-center gap-3 rounded-full bg-white pl-6 pr-2 text-[15.5px] font-semibold text-ink transition hover:bg-jade-soft">
              Book a free demo
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-jade text-white transition-transform duration-500 group-hover:-rotate-45"><IconArrow size={16} /></span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================= features: white bento cards with live little scenes ================= */
function Card({ className, t, d, art, artFirst = false }: { className?: string; t: string; d: string; art: ReactNode; artFirst?: boolean }) {
  const text = (
    <div className={clsx("relative z-10 px-7 lg:px-9", artFirst ? "pb-8 pt-2 lg:pb-10" : "pt-8 lg:pt-10")}>
      <h3 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] lg:text-[30px]">{t}</h3>
      <p className="mt-2.5 max-w-[34ch] text-[15.5px] leading-relaxed text-ink/55 lg:text-[17px]">{d}</p>
    </div>
  );
  return (
    <div className={clsx("bento-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_1px_0_rgb(255_255_255),0_30px_60px_-40px_rgb(16_24_20/.25)] ring-1 ring-black/[.04]", className)}>
      {!artFirst && text}
      <div className="relative min-h-[290px] flex-1 overflow-hidden lg:min-h-[340px]">{art}</div>
      {artFirst && text}
    </div>
  );
}

export function Features() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const cards = root.current?.querySelectorAll<HTMLElement>(".bento-card");
    if (!cards) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))),
      { threshold: 0.35 },
    );
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  return (
    <section ref={root} id="features" className="relative isolate scroll-mt-20 overflow-hidden bg-[#f4f5f3] py-14 lg:py-28">
      <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
        <SectionHead eyebrow="Everything in one place" title="Built for the *whole* service." />
        <Swipe
          className="mt-8 lg:mt-12"
          item="w-[86%] sm:w-[60%]"
          grid="lg:grid lg:grid-cols-12 lg:gap-4"
          spans={["lg:col-span-4", "lg:col-span-4", "lg:col-span-4", "lg:col-span-5", "lg:col-span-7"]}
        >
          <Card t="Tables and QR orders" d="See every table at a glance. Guests scan, order and pay from their phone." art={<ArtTables />} />
          <Card t="Sales, reports, GST." d="Today’s numbers the moment you close, and files ready for your CA." art={<ArtInsights />} />
          <Card t="Your whole team" d="A PIN for every captain, chef and cashier. Each sees only their part." art={<ArtTeam />} />
          <Card artFirst t="Get paid by UPI" d="Every bill carries a QR with the exact amount. No typing, no mistakes." art={<ArtUpi />} />
          <Card artFirst t="Stock that counts itself" d="Recipes deduct stock as you sell. A buy list is ready every morning." art={<ArtStock />} />
        </Swipe>
      </div>
    </section>
  );
}

/* ---- the little scenes ---- */
function ArtTables() {
  const rows: [string, string, string, string][] = [
    ["T1", "Table 1", "4 guests · 32 min", "Bill ready"],
    ["T4", "Table 4", "2 guests · 18 min", "Ordering"],
    ["T6", "Table 6", "Just seated", "Open"],
    ["T9", "Table 9", "Free", "Seat"],
  ];
  return (
    <div className="absolute inset-x-6 top-10 lg:inset-x-8">
      <div className="absolute -top-6 left-[26%] z-10 flex items-center gap-2 rounded-full bg-jade px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_18px_30px_-12px_rgb(var(--jade)/.7)] transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-1 group-hover:translate-x-2">
        <IconTable size={20} /> Seat guests
      </div>
      <div className="space-y-2.5">
        {rows.map(([n, t, d, s], i) => (
          <div key={n} className="flex items-center gap-3 rounded-[18px] bg-white p-3 ring-1 ring-black/[.06]" style={{ opacity: 1 - i * 0.24 }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#f2f3f1] text-[13px] font-bold">{n}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{t}</span>
              <span className="block text-[12.5px] text-ink/50">{d}</span>
            </span>
            <span className="text-[14px] font-medium text-jade">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtInsights() {
  const bars = [30, 52, 44, 70, 88];
  return (
    <div className="absolute inset-0">
      <div aria-hidden className="absolute -left-10 top-16 h-56 w-56 rounded-full bg-jade/20 blur-3xl" />
      <div className="absolute left-8 top-6 w-[150%] origin-top-left transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] [transform:perspective(1200px)_rotateY(-18deg)_rotateX(8deg)_rotateZ(-4deg)] group-hover:[transform:perspective(1200px)_rotateY(-12deg)_rotateX(6deg)_rotateZ(-3deg)]">
        <div className="rounded-[26px] bg-[#f6f7f5] p-3 shadow-[0_40px_60px_-30px_rgb(16_24_20/.35)] ring-1 ring-black/[.05]">
          <div className="flex items-center gap-3 rounded-[16px] bg-white/80 px-4 py-3 ring-1 ring-black/[.04]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className="text-[18px] font-semibold tracking-tight">Reports</span>
          </div>
          <div className="mt-3 rounded-[18px] bg-white p-5 ring-1 ring-black/[.04]">
            <div className="text-[19px] font-semibold tracking-tight">Today so far</div>
            <div className="mt-8 flex items-end justify-between gap-6 pr-[38%]">
              <div>
                <div className="text-[14px] text-ink/45">Sales</div>
                <div className="text-[30px] font-semibold tracking-tight text-jade tnum">₹18,420</div>
                <div className="mt-1 text-[12.5px] text-ink/40">Average bill ₹642 · GST ready</div>
              </div>
              <div className="flex h-28 items-end gap-2">
                {bars.map((b, i) => (
                  <span key={i} className="bento-bar w-4 rounded-full bg-gradient-to-t from-jade/10 to-jade/70" style={{ height: `${b}%`, animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

function ArtTeam() {
  const people: [string, number, string][] = [["K", 200, "left-1/2 top-[6%] -translate-x-1/2"], ["R", 30, "left-[10%] top-[34%]"], ["I", 330, "right-[10%] top-[34%]"]];
  return (
    <div className="absolute inset-0">
      <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2">
        {[380, 280, 180].map((r) => (
          <span key={r} aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[.05]" style={{ width: r, height: r }} />
        ))}
        <span className="relative flex h-[118px] w-[118px] items-center justify-center rounded-full bg-gradient-to-b from-[#3fbf8f] to-jade text-[22px] font-semibold tracking-tight text-white shadow-[0_24px_40px_-14px_rgb(var(--jade)/.7),inset_0_2px_0_rgb(255_255_255/.35)] ring-4 ring-white">
          Restro
        </span>
      </div>
      {people.map(([n, h, pos], i) => (
        <span key={n} className={clsx("absolute", pos)}>
          <span
            className="bento-bob flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold ring-4 ring-white shadow-[0_12px_24px_-10px_rgb(16_24_20/.35)]"
            style={{ background: `hsl(${h} 55% 86%)`, color: `hsl(${h} 45% 28%)`, animationDelay: `${-i * 1.3}s` }}
          >
            {n}
          </span>
        </span>
      ))}
      <div className="absolute inset-x-6 bottom-6 flex items-center gap-3 rounded-[18px] bg-white p-3 shadow-[0_20px_40px_-24px_rgb(16_24_20/.4)] ring-1 ring-black/[.05] transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-1 lg:inset-x-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-saffron/15 text-[14px] font-semibold text-saffron">S</span>
        <span className="text-[15px] font-medium tracking-tight">Table 6 bill is ready to print</span>
      </div>
    </div>
  );
}

function ArtUpi() {
  return (
    <div className="absolute inset-0 p-6 lg:p-8">
      <div className="relative h-full overflow-hidden rounded-[24px] bg-gradient-to-br from-[#e6f6ee] via-[#eaf8f0] to-[#d6f1e3] p-7 shadow-[0_30px_50px_-34px_rgb(var(--jade)/.6)] ring-1 ring-jade/10 transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.015]">
        <div className="text-[19px] font-semibold tracking-tight">Paid by UPI today</div>
        <div className="mt-5 flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-jade/15 text-jade">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
          </span>
          <span className="text-[52px] font-semibold leading-none tracking-[-0.04em] text-jade-deep tnum lg:text-[64px]">₹48,250</span>
        </div>
        <div className="mt-8 h-2.5 overflow-hidden rounded-full bg-jade/10"><div className="bento-fill h-full w-[78%] rounded-full bg-jade/40" /></div>
        <div className="mt-3 h-2.5 w-[60%] overflow-hidden rounded-full bg-jade/10"><div className="bento-fill h-full w-[55%] rounded-full bg-jade/25" style={{ animationDelay: ".15s" }} /></div>
        <div className="absolute right-6 top-6 rounded-full bg-white/70 px-3 py-1 text-[12px] font-semibold text-jade-deep">42 bills</div>
      </div>
    </div>
  );
}

function ArtStock() {
  const rows: [string, string, number, string][] = [
    ["P", "Paneer", 35, "3 kg left"],
    ["R", "Basmati rice", 62, "18 kg left"],
    ["M", "Milk", 80, "24 L left"],
  ];
  return (
    <div className="absolute inset-0">
      <div aria-hidden className="absolute -right-24 -top-40 h-[520px] w-[520px] rounded-full border border-black/[.04]" />
      {/* phone, cut off by the card */}
      <div className="absolute left-1/2 top-8 w-[340px] -translate-x-[30%] rounded-t-[44px] border-[7px] border-b-0 border-[#0f4a3c] bg-white px-4 pb-0 pt-5 transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-2 sm:w-[380px]">
        <div className="flex gap-1.5 px-2">{[0, 1, 2].map((i) => <span key={i} className="h-3 w-3 rounded-full border-2 border-ink/60" />)}</div>
        <div className="mt-4 overflow-hidden rounded-t-[20px] bg-[#f7f1ea]">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[16px] font-semibold">Stock</span>
            <span className="flex gap-1.5">
              <span className="rounded-full bg-white px-3 py-1 text-[11.5px] text-ink/60 ring-1 ring-black/[.06]">Main kitchen</span>
              <span className="rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-jade ring-1 ring-black/[.06]">Today</span>
            </span>
          </div>
          <div className="bg-white">
            {rows.map(([i, n, v, d]) => (
              <div key={n} className="flex items-center gap-3 border-b border-black/[.05] px-4 py-3.5">
                <span className={clsx("flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-semibold", v < 40 ? "bg-rose/15 text-rose" : v < 70 ? "bg-saffron/20 text-saffron" : "bg-jade/15 text-jade")}>{i}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{n}</span>
                  <span className="block text-[12.5px] text-ink/50">{d}</span>
                </span>
                <Ring v={v} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* floating sales card */}
      <div className="absolute left-4 top-[50%] w-[230px] -rotate-[4deg] rounded-[18px] bg-white p-4 shadow-[0_30px_50px_-24px_rgb(16_24_20/.4)] ring-1 ring-black/[.05] transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-rotate-[2deg] sm:left-8 lg:w-[270px]">
        <div className="text-[11.5px] text-ink/50">Sold today</div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[22px] font-semibold tracking-tight tnum">142 dishes</div>
            <div className="mt-1 text-[11px] font-semibold text-jade">↑ 12% vs last Friday</div>
          </div>
          <svg viewBox="0 0 120 50" className="h-12 w-28 text-jade" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path className="bento-line" pathLength={1} d="M2 40 C12 40 14 22 24 26 S36 44 46 30 S58 8 68 18 S80 40 90 28 S104 6 118 14" />
          </svg>
        </div>
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

function Ring({ v }: { v: number }) {
  const c = 2 * Math.PI * 16;
  return (
    <span className="relative flex h-12 w-12 items-center justify-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(0 0 0 / .06)" strokeWidth="3.5" />
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(var(--jade))" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <span className="text-[11.5px] font-semibold tnum">{v}%</span>
    </span>
  );
}


/* ================= how it works: four steps ================= */
const steps: { n: string; t: string; d: string; tag: string; art: ReactNode }[] = [
  { n: "Step one", t: "Talk to us", d: "We create your account and logins.", tag: "Takes 5 minutes", art: <StepAccount /> },
  { n: "Step two", t: "Add menu and tables", d: "Dishes, prices, photos and table QRs.", tag: "We help you", art: <StepMenu /> },
  { n: "Step three", t: "Start billing", d: "Phone, tablet or the laptop you have.", tag: "Same day", art: <StepBill /> },
  { n: "Step four", t: "Get paid, see it all", d: "UPI on every bill, a note each morning.", tag: "Every day", art: <StepPaid /> },
];

export function Story() {
  return (
    <section id="story" className="scroll-mt-20 bg-white py-14 lg:py-28">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <SectionHead eyebrow="How it works" title="Start in four steps. *Live the same day.*" />
        <div className="mt-8 grid grid-cols-2 gap-2.5 lg:mt-12 lg:grid-cols-4 lg:gap-3" data-reveal-group>
          {steps.map((s, i) => (
            <article key={s.n} className="group relative flex h-full min-h-[250px] flex-col rounded-[22px] bg-[#f4f5f3] p-4 sm:min-h-[340px] sm:p-6 lg:min-h-[420px] lg:rounded-[28px] lg:p-7">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink/45 sm:text-[12.5px]">{s.n}</div>
              <h3 className="mt-1 text-[16px] font-semibold leading-tight tracking-[-0.02em] sm:text-[22px]">{s.t}</h3>
              <p className="mt-1 hidden text-[14px] leading-snug text-ink/50 sm:block">{s.d}</p>
              <div className="relative -mx-2 flex max-h-[130px] flex-1 items-center justify-center overflow-hidden py-3 sm:mx-0 sm:max-h-none sm:overflow-visible sm:py-6">
                <div className="origin-center scale-[.6] sm:scale-100">{s.art}</div>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[12px] font-medium shadow-[0_6px_16px_-10px_rgb(16_24_20/.3)] sm:px-4 sm:py-2 sm:text-[14px]">{s.tag}</span>
              {i < steps.length - 1 && (
                <span aria-hidden className="absolute -right-[22px] top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#f4f5f3] ring-[5px] ring-white lg:flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-jade text-white"><IconArrow size={13} /></span>
                </span>
              )}
            </article>
          ))}
        </div>
        <div data-reveal className="mt-6 flex justify-center lg:mt-10">
          <a href="#contact" className="group inline-flex h-[52px] items-center gap-3 rounded-full bg-ink pl-6 pr-2 text-[15.5px] font-semibold text-white transition hover:bg-jade-deep">
            Start with step one
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:-rotate-45"><IconArrow size={16} /></span>
          </a>
        </div>
      </div>
    </section>
  );
}

const ease = "transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)]";
function StepAccount() {
  return (
    <div className="relative h-[170px] w-[210px]">
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[20px] bg-white shadow-[0_20px_40px_-26px_rgb(16_24_20/.35)]">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-jade-soft text-[15px] font-semibold text-jade-deep">SL</span>
        <span className="mt-3 h-2.5 w-24 rounded-full bg-ink/10" />
        <span className="mt-2 h-2 w-32 rounded-full bg-ink/[.06]" />
        <span className="mt-1.5 h-2 w-28 rounded-full bg-ink/[.06]" />
      </div>
      <div className={`absolute inset-y-[-10px] left-[52%] right-[-14px] rounded-r-[20px] border-l border-white/80 bg-gradient-to-r from-white/30 to-[#e9ebe7]/90 backdrop-blur-[3px] ${ease} group-hover:translate-x-4`} />
    </div>
  );
}
function StepMenu() {
  return (
    <div className="relative w-[220px]">
      <div className={`relative z-10 flex items-center gap-3 rounded-[16px] bg-white p-3 shadow-[0_20px_40px_-24px_rgb(16_24_20/.4)] ${ease} group-hover:-translate-y-1`}>
        <span className="h-11 w-11 shrink-0 rounded-[11px] bg-gradient-to-br from-saffron/50 to-jade/30" />
        <span className="flex-1 space-y-1.5"><span className="block h-2.5 w-20 rounded-full bg-ink/15" /><span className="block h-2 w-28 rounded-full bg-ink/[.07]" /></span>
        <span className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-jade text-white ring-4 ring-[#f4f5f3]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </span>
      </div>
      <div className="mx-4 -mt-2 h-10 rounded-b-[14px] bg-white/70" />
      <div className="mx-8 -mt-2 h-8 rounded-b-[12px] bg-white/40" />
    </div>
  );
}
function StepBill() {
  return (
    <div className="relative h-[170px] w-[150px]">
      <div className={`absolute inset-0 -rotate-[10deg] rounded-[18px] bg-white/60 ${ease} group-hover:-rotate-[14deg]`} />
      <div className={`absolute inset-0 -rotate-[4deg] rounded-[18px] bg-white/80 ${ease} group-hover:-rotate-[7deg]`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[18px] bg-white shadow-[0_20px_40px_-24px_rgb(16_24_20/.4)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-jade-soft text-jade">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>
        </span>
        <span className="mt-4 h-2.5 w-16 rounded-full bg-ink/12 bg-ink/10" />
        <span className="mt-2 h-2 w-24 rounded-full bg-ink/[.06]" />
      </div>
    </div>
  );
}
function StepPaid() {
  return (
    <div className="relative h-[150px] w-[230px]">
      <span className={`absolute left-6 top-3 -rotate-[8deg] rounded-[8px] bg-white px-3 py-1.5 text-[13px] font-medium shadow-[0_8px_20px_-12px_rgb(16_24_20/.4)] ${ease} group-hover:-rotate-[12deg]`}>Paid by UPI ✓</span>
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[10px] bg-ink px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_14px_30px_-12px_rgb(16_24_20/.6)]">₹18,420 today</span>
      <span className={`absolute bottom-3 right-2 rotate-[7deg] rounded-[8px] bg-white px-3 py-1.5 text-[13px] font-medium shadow-[0_8px_20px_-12px_rgb(16_24_20/.4)] ${ease} group-hover:rotate-[11deg]`}>Day closed</span>
    </div>
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
    <section className="px-2 py-2 sm:px-3">
      <div className="relative isolate overflow-hidden rounded-[30px] bg-[#0a0a0a] py-14 text-canvas sm:rounded-[40px] lg:py-24">
        <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
          <SectionHead dark eyebrow="Only in Restro" title="Things your current software *doesn't* do." />
          <Swipe dark className="mt-8 lg:mt-12" item="w-[84%] sm:w-[46%]" grid="lg:grid lg:grid-cols-6 lg:gap-4" spans={["lg:col-span-4", ...only.slice(1).map(() => "lg:col-span-2")]}>
            <TiltCard className="h-full">
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
            <TiltCard className="h-full">
              <div className="flex h-full flex-col" style={{ transform: "translateZ(30px)" }}>
                <second.icon size={36} className="text-saffron" />
                <h3 className="mt-5 text-[22px] font-semibold leading-tight">{second.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-canvas/65">{second.d}</p>
                <Wave />
              </div>
            </TiltCard>
            {rest.map((f) => (
              <TiltCard key={f.t} className="h-full">
                <div style={{ transform: "translateZ(24px)" }}>
                  <f.icon size={32} className="text-saffron" />
                  <h3 className="mt-5 text-[20px] font-semibold leading-tight">{f.t}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-canvas/65">{f.d}</p>
                </div>
              </TiltCard>
            ))}
          </Swipe>
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

