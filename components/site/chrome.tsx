"use client";

// Website navigation and footer (home, pricing).
import { openCookieSettings } from "@/components/cookie-consent";
import { DEFAULT_CONTACT_EMAIL, DEFAULT_CONTACT_WHATSAPP } from "@/lib/config";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconArrow, IconMenu } from "./icons";
import { Brand } from "./mockups";
import { SectionHead } from "./head";
import { CallBack, LeadForm } from "./lead";
import { SCROLL_LOCK_EVENT, gsap, lockScroll, pageScrollY, reducedMotion, scrollLocked, useLenis } from "./motion";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#story", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#contact", label: "Contact" },
];

/** onVideo: home page — white, see-through nav sitting on the hero video until you scroll. */
export function SiteNav({ onVideo = false }: { onVideo?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const path = usePathname();

  // condense after the hero; slide away while scrolling down, back when scrolling up
  useEffect(() => {
    // pageScrollY: a pinned page (menu / chat open) keeps its real position, so the nav doesn't jump
    let last = pageScrollY();
    const on = () => {
      if (scrollLocked()) return;
      const y = pageScrollY();
      setScrolled(y > 24);
      setHidden(y > 400 && y > last + 2);
      if (y < last - 2) setHidden(false);
      last = y;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // full-screen mobile menu: stop the page scrolling behind it
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll(lenis);
    if (menu.current && !reducedMotion()) {
      gsap.fromTo(menu.current.querySelectorAll("[data-m]"), { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.05 });
    }
    return unlock;
  }, [open, lenis]);

  useEffect(() => setOpen(false), [path]);
  const light = onVideo && !scrolled && !open; // white on the video

  return (
    <>
      <header
        className={clsx(
          "fixed inset-x-0 top-0 z-50 transition-[transform,padding] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]",
          hidden && !open && "-translate-y-[130%]",
          light && "text-white",
        )}
      >
        <div
          className={clsx(
            "mx-3 mt-3 flex items-center gap-2 rounded-full px-3 py-2 transition-all duration-500 sm:mx-6 sm:px-4",
            light ? "max-w-[1400px] border border-transparent sm:mx-8 sm:px-6 lg:mx-auto lg:px-10" : "max-w-6xl lg:mx-auto",
            !light && (scrolled || open ? "nav-solid" : "glass"),
          )}
        >
          <Link href="/" className="rounded-full px-2 py-1" aria-label="Restropi home">
            <Brand light={light} className={clsx("transition-all duration-500", light ? "h-[34px]" : "h-[28px]")} />
          </Link>
          <nav className={clsx("hidden items-center gap-1 whitespace-nowrap lg:flex", light ? "mx-auto" : "ml-6")} aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={clsx("group relative rounded-full px-3.5 py-2 text-[14.5px] transition", light ? "text-white/85 hover:bg-white/15 hover:text-white" : "text-ink/65 hover:bg-white/60 hover:text-ink")}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className={clsx("flex items-center gap-1.5", !light && "ml-auto", light && "max-lg:ml-auto")}>
            <Link href="/login" className={clsx("hidden whitespace-nowrap rounded-full px-4 py-2 text-[14.5px] font-semibold transition sm:block", light ? "hover:bg-white/15" : "hover:bg-white/60")}>Sign in</Link>
            <Magnetic>
              <Link href="/#contact" className={clsx(
                  "group hidden items-center gap-2 whitespace-nowrap rounded-full py-2 pl-4 pr-3 text-[14.5px] font-semibold text-white transition sm:flex",
                  light ? "border border-white/40 bg-white/10 backdrop-blur-md hover:bg-white hover:text-ink" : "bg-jade hover:bg-jade-deep",
                )}>
                Book a demo
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-rotate-45"><IconArrow size={14} /></span>
              </Link>
            </Magnetic>
            <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} className={clsx("flex h-10 w-10 items-center justify-center rounded-full lg:hidden", light ? "hover:bg-white/15" : "hover:bg-sunken")}>
              <IconMenu open={open} />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div ref={menu} data-lenis-prevent className="fixed inset-0 z-40 flex flex-col overflow-y-auto overscroll-contain bg-canvas/80 px-6 pb-10 pt-28 backdrop-blur-2xl lg:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {links.map((l, i) => (
              <div key={l.href} className="overflow-hidden border-b border-line">
                <Link data-m href={l.href} onClick={() => setOpen(false)} className="flex items-baseline justify-between py-4">
                  <span className="text-[34px] font-semibold leading-none tracking-[-0.03em]">{l.label}</span>
                  <span className="text-[13px] text-faint tnum">0{i + 1}</span>
                </Link>
              </div>
            ))}
          </nav>
          <div className="mt-auto grid gap-3">
            <div className="overflow-hidden"><Link data-m href="/login" className="glass flex h-14 items-center justify-center rounded-full text-[16px] font-semibold">Sign in</Link></div>
            <div className="overflow-hidden"><Link data-m href="/#contact" onClick={() => setOpen(false)} className="flex h-14 items-center justify-center rounded-full bg-jade text-[16px] font-semibold text-white">Book a free demo</Link></div>
          </div>
        </div>
      )}
    </>
  );
}

/** Buttons lean toward the pointer a little (desktop only). */
export function Magnetic({ children, strength = 0.25, block = false }: { children: React.ReactNode; strength?: number; block?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, .4)" });
    const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, .4)" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * strength);
      y((e.clientY - r.top - r.height / 2) * strength);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);
  return <span ref={ref} className={`${block ? "block sm:inline-block" : "inline-block"} will-change-transform`}>{children}</span>;
}

/** Phones: a "Book a free demo" bar at the bottom once the hero is gone, hidden again at the form. */
export function MobileCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => {
      // hidden while the chat, menu or demo form covers the page
      if (scrollLocked()) return setShow(false);
      const form = document.getElementById("contact");
      const atForm = form ? form.getBoundingClientRect().top < window.innerHeight * 0.9 : false;
      setShow(pageScrollY() > window.innerHeight * 0.85 && !atForm);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    window.addEventListener(SCROLL_LOCK_EVENT, on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      window.removeEventListener(SCROLL_LOCK_EVENT, on);
    };
  }, []);
  return (
    <div
      className={clsx(
        "pb-safe fixed inset-x-0 bottom-0 z-40 px-3 [--safe-pb:12px] transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] md:hidden",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
    >
      <div className="glass-strong flex items-center gap-2 rounded-full p-1.5 pl-4 shadow-[0_20px_40px_-20px_rgb(16_24_20/.5)]">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink/70">Free demo · live the same day</span>
        <Link href="/#contact" className="flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-jade pl-4 pr-2 text-[14.5px] font-semibold text-white">
          Book demo
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15"><IconArrow size={14} /></span>
        </Link>
      </div>
    </div>
  );
}

// Set these in .env.local to show your contact details on the home page.
export const CONTACT_WA = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || DEFAULT_CONTACT_WHATSAPP).replace(/\D/g, "");
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL;

/** "Book a free demo" dialog. Any link to #contact opens it. */
function DemoDialog() {
  const [open, setOpen] = useState(false);
  const lenis = useLenis();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href") ?? "";
      if (href === "#contact" || href === "/#contact" || href === "#demo") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    };
    document.addEventListener("click", onClick, true);
    if (location.hash === "#contact") setOpen(true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll(lenis);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => {
      unlock();
      window.removeEventListener("keydown", esc);
    };
  }, [open, lenis]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Book a free demo" className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-2 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(false)}>
      <div className="relative w-full max-w-[460px] animate-[sheet-in_.45s_cubic-bezier(.2,.8,.2,1)]" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f5f3] text-ink/60 hover:text-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <LeadForm />
      </div>
    </div>
  );
}

const footerCols: { t: string; links: { href: string; label: string }[] }[] = [
  { t: "Product", links: [{ href: "/#features", label: "Features" }, { href: "/#story", label: "How it works" }, { href: "/#pricing", label: "Pricing" }, { href: "/pricing", label: "Compare plans" }] },
  { t: "Made for", links: [{ href: "/#kinds", label: "Cafés" }, { href: "/#kinds", label: "Restaurants" }, { href: "/#kinds", label: "Cloud kitchens" }, { href: "/#kinds", label: "Bakeries" }] },
  { t: "Restropi", links: [{ href: "/#contact", label: "Book a demo" }, { href: "/login", label: "Sign in" }, { href: "/#contact", label: "Contact us" }] },
];

export function SiteFooter() {
  return (
    <footer className="px-2 pb-2 sm:px-3 sm:pb-3">
      <div className="rounded-[30px] bg-[#eff0ed] p-2 ring-1 ring-black/[.04] sm:rounded-[40px] sm:p-3">
        {/* closing call to action */}
        <div id="contact" className="scroll-mt-24 px-4 py-14 text-center lg:py-24">
          <SectionHead
            eyebrow="Get started"
            title="Ready to take the *work* out of running a restaurant?"
            sub="Bills, kitchen, tables, stock and staff in one app. We set it up with you, and you start billing the same day."
            className="[&_h2]:max-w-[20ch] [&_.text-jade]:rounded-[0.16em] [&_.text-jade]:bg-ink [&_.text-jade]:px-[0.16em] [&_.text-jade]:text-white"
          />
          <div data-reveal className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#contact" className="group flex h-14 w-full items-center justify-center gap-2.5 rounded-[16px] bg-ink px-7 text-[16px] font-semibold text-white shadow-[0_16px_30px_-16px_rgb(16_24_20/.8)] transition hover:bg-jade-deep sm:w-auto">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
              Book a free demo
            </a>
            <Link href="/#pricing" className="flex h-14 w-full items-center justify-center rounded-[16px] bg-white px-7 text-[16px] font-semibold ring-1 ring-black/[.06] transition hover:bg-jade-soft sm:w-auto">
              See plans (from ₹699/mo)
            </Link>
          </div>
        </div>

        {/* the footer itself */}
        <div className="rounded-[24px] bg-white px-6 py-10 ring-1 ring-black/[.04] sm:rounded-[30px] sm:px-10 lg:px-14 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1.6fr] lg:gap-16">
            <div>
              <Brand className="h-9" />
              <p className="mt-7 text-[16px] font-semibold">Want a call from us?</p>
              <div className="mt-3 max-w-[440px]"><CallBack /></div>
              <p className="mt-3 max-w-[440px] text-[12.5px] leading-relaxed text-ink/45">We only use your number to call you about Restropi. No spam, no sharing.</p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {footerCols.map((c) => (
                <div key={c.t}>
                  <div className="text-[15px] font-semibold">{c.t}</div>
                  <ul className="mt-4 space-y-3 text-[15px] text-ink/60">
                    {c.links.map((l) => (
                      <li key={l.label}><Link href={l.href} className="transition hover:text-jade">{l.label}</Link></li>
                    ))}
                    {c.t === "Restropi" && CONTACT_EMAIL && <li><a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-jade">{CONTACT_EMAIL}</a></li>}
                    {c.t === "Restropi" && CONTACT_WA && <li><a href={`https://wa.me/${CONTACT_WA}`} target="_blank" rel="noreferrer" className="transition hover:text-jade">WhatsApp</a></li>}
                    {c.t === "Restropi" && <li className="text-ink/45">Pune · Satara · Kolhapur</li>}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-black/[.06] pt-6 text-[13.5px] text-ink/45 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Restropi. All rights reserved. · UPI payments go straight to your bank.</span>
            <button type="button" onClick={openCookieSettings} className="text-left transition hover:text-jade sm:ml-auto">Cookie settings</button>
            <span>Made in Pune for Indian restaurants</span>
          </div>
        </div>
      </div>
      <DemoDialog />
    </footer>
  );
}
