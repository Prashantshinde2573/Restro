"use client";

// Website help chat: a button on the right that opens a small chat with fixed questions and answers.
// No AI and nothing sent anywhere: tap a question, Restropi "types" the answer.
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { plans } from "@/lib/plans";
import { CONTACT_WA } from "./chrome";
import { IconArrow } from "./icons";
import { Logo } from "./mockups";
import { lockScroll, useLenis } from "./motion";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const priced = plans.filter((p) => p.monthly);
const chain = plans.find((p) => !p.monthly);

type QA = { q: string; a: ReactNode };

const faqs: QA[] = [
  {
    q: "What is Restropi?",
    a: "One app to run your café or restaurant: billing with GST and UPI QR, orders sent to the kitchen on a phone or tablet, tables and QR ordering, stock, staff and reports. It works on the phone, tablet or laptop you already have.",
  },
  {
    q: "How much does it cost?",
    a: (
      <>
        Prices are per outlet, per month, plus GST:
        <span className="mt-2 block space-y-1">
          {priced.map((p) => (
            <span key={p.id} className="flex justify-between gap-4">
              <span>{p.name}</span>
              <span className="font-semibold tnum">{inr(p.monthly!)}</span>
            </span>
          ))}
          {chain && (
            <span className="flex justify-between gap-4">
              <span>{chain.name} ({chain.outlets})</span>
              <span className="font-semibold">Let’s talk</span>
            </span>
          )}
        </span>
        <span className="mt-2 block">Pay yearly and get 2 months free. <Link href="/pricing" className="font-semibold text-jade underline-offset-2 hover:underline">Compare plans</Link></span>
      </>
    ),
  },
  {
    q: "Do I need to buy new hardware?",
    a: "No. Restropi runs in the browser on any phone, tablet or laptop you already have. Bills print from the browser to your printer.",
  },
  {
    q: "How long does setup take?",
    a: "Usually the same day. We create your account on a call and help you add your menu, tables and staff. Then you can start billing.",
  },
  {
    q: "Can guests order and pay from the table?",
    a: "Yes. Each table gets a QR code. Guests see your menu with photos, send the order to the kitchen, and pay by UPI for the exact amount — even split by guest.",
  },
  {
    q: "Which languages does it support?",
    a: "English, मराठी and हिंदी. Each person can pick their own language, and support is available in all three.",
  },
  {
    q: "Is my data safe?",
    a: "Each restaurant only ever sees its own data, and staff only see the parts you allow. You can download your data any time.",
  },
];

type Msg = { from: "bot" | "me"; body: ReactNode; key: number };

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const [lifted, setLifted] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const n = useRef(0);
  const lenis = useLenis();

  // greet once on first open
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ from: "bot", key: n.current++, body: "Hi! 👋 I’m the Restropi helper. Pick a question below, or book a free demo and we’ll call you." }]);
    }
  }, [open, msgs.length]);

  // keep the newest message in view
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  // phones: sit above the "Book demo" bar when it shows
  useEffect(() => {
    const on = () => setLifted(window.scrollY > window.innerHeight * 0.85);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // the page should not scroll behind the full-screen chat on phones
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 639px)").matches;
    const unlock = open && phone ? lockScroll(lenis) : undefined;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => {
      unlock?.();
      window.removeEventListener("keydown", esc);
    };
  }, [open, lenis]);

  const ask = (f: QA) => {
    if (typing) return;
    setAsked((a) => [...a, f.q]);
    setMsgs((m) => [...m, { from: "me", body: f.q, key: n.current++ }]);
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { from: "bot", body: f.a, key: n.current++ }]);
    }, 700);
  };

  const left = faqs.filter((f) => !asked.includes(f.q));

  return (
    <>
      {/* the panel */}
      <div
        role="dialog"
        aria-label="Restropi help"
        aria-hidden={!open}
        className={clsx(
          "fixed z-[55] flex flex-col overflow-hidden bg-white text-ink shadow-[0_40px_80px_-30px_rgb(16_24_20/.45)] ring-1 ring-black/[.06] transition-[opacity,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
          "inset-x-2 bottom-2 top-16 rounded-[26px] sm:inset-x-auto sm:bottom-24 sm:right-5 sm:top-auto sm:h-[min(620px,calc(100dvh-140px))] sm:w-[380px]",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-center gap-3 bg-ink px-5 py-4 text-white">
          <span className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white"><Logo size={24} /></span>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#4ade80] ring-2 ring-ink" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-semibold">Restropi help</span>
            <span className="block text-[12.5px] text-white/60">Quick answers, any time</span>
          </span>
          <button onClick={() => setOpen(false)} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div ref={list} data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto bg-[#f4f5f3] px-4 py-5">
          {msgs.map((m) => (
            <div key={m.key} className={clsx("flex animate-[sheet-in_.35s_cubic-bezier(.2,.8,.2,1)]", m.from === "me" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[85%] px-4 py-2.5 text-[14.5px] leading-relaxed",
                  m.from === "me" ? "rounded-[18px] rounded-br-[6px] bg-jade text-white" : "rounded-[18px] rounded-bl-[6px] bg-white ring-1 ring-black/[.05]",
                )}
              >
                {m.body}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex">
              <div className="flex gap-1 rounded-[18px] rounded-bl-[6px] bg-white px-4 py-3.5 ring-1 ring-black/[.05]" aria-label="Typing">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink/30" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-black/[.06] bg-white p-3">
          {left.length > 0 && (
            <div data-lenis-prevent className="flex max-h-[132px] flex-wrap gap-2 overflow-y-auto pb-3">
              {left.map((f) => (
                <button
                  key={f.q}
                  onClick={() => ask(f)}
                  disabled={typing}
                  className="rounded-full bg-[#f4f5f3] px-3.5 py-2 text-left text-[13.5px] font-medium text-ink/80 ring-1 ring-black/[.05] transition hover:bg-jade-soft hover:text-jade-deep disabled:opacity-50"
                >
                  {f.q}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <a href="#contact" onClick={() => setOpen(false)} className="group flex h-11 flex-1 items-center justify-between rounded-full bg-jade pl-5 pr-1.5 text-[14.5px] font-semibold text-white transition hover:bg-jade-deep">
              Book a free demo
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:-rotate-45"><IconArrow size={14} /></span>
            </a>
            {CONTACT_WA && (
              <a href={`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent("Hi, I have a question about Restropi.")}`} target="_blank" rel="noreferrer" className="flex h-11 items-center rounded-full bg-[#f4f5f3] px-4 text-[14px] font-semibold ring-1 ring-black/[.05] hover:bg-jade-soft">
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* the toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help chat" : "Open help chat"}
        aria-expanded={open}
        className={clsx(
          "group fixed right-4 z-[56] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1fae84] to-jade-deep text-white shadow-[0_18px_36px_-14px_rgb(var(--jade)/.8),inset_0_1px_0_rgb(255_255_255/.35)] ring-2 ring-white/90 transition-[transform,bottom] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:scale-105 md:bottom-5 md:right-5",
          lifted ? "bottom-[84px]" : "bottom-4",
          open && "max-sm:hidden",
        )}
      >
        <span className={clsx("absolute transition-all duration-300 group-hover:-rotate-6", open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")}>
          {/* a smiling chat bubble with a little sparkle */}
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden>
            <path d="M5 8.5A4.5 4.5 0 0 1 9.5 4h9A4.5 4.5 0 0 1 23 8.5v6a4.5 4.5 0 0 1-4.5 4.5H13l-4.6 3.7c-.5.4-1.2 0-1.2-.6V19A4.5 4.5 0 0 1 5 14.5z" fill="white" />
            <circle cx="11" cy="10.6" r="1.25" fill="rgb(var(--jade-deep))" />
            <circle cx="17" cy="10.6" r="1.25" fill="rgb(var(--jade-deep))" />
            <path d="M10.6 13.6c1.9 1.9 4.9 1.9 6.8 0" stroke="rgb(var(--jade-deep))" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M23.5 1.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="rgb(var(--saffron))" />
          </svg>
        </span>
        <span className={clsx("absolute transition-all duration-300", open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </span>
        {!open && msgs.length === 0 && <span aria-hidden className="absolute inset-0 -z-10 rounded-full bg-jade/40 motion-safe:animate-ping" />}
      </button>
    </>
  );
}
