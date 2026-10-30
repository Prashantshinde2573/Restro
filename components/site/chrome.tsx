"use client";

// Website navigation and footer (home, pricing).
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconArrow, IconMenu } from "./icons";
import { Brand } from "./mockups";
import { gsap, reducedMotion, useLenis } from "./motion";

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
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
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
    if (open) lenis?.stop();
    else lenis?.start();
    document.body.style.overflow = open ? "hidden" : "";
    if (open && menu.current && !reducedMotion()) {
      gsap.fromTo(menu.current.querySelectorAll("[data-m]"), { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.05 });
    }
    return () => {
      document.body.style.overflow = "";
    };
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
            !light && (scrolled || open ? "glass-strong" : "glass"),
          )}
        >
          <Link href="/" className="rounded-full px-2 py-1" aria-label="Restro home">
            <Brand className={clsx("transition-all duration-500", light ? "text-[21px]" : "text-[18px]")} />
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
                Get Restro
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
        <div ref={menu} className="fixed inset-0 z-40 flex flex-col bg-canvas/80 px-6 pb-10 pt-28 backdrop-blur-2xl lg:hidden">
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
            <div className="overflow-hidden"><Link data-m href="/#contact" onClick={() => setOpen(false)} className="flex h-14 items-center justify-center rounded-full bg-jade text-[16px] font-semibold text-white">Get Restro for your restaurant</Link></div>
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

// Set these in .env.local to show your contact details on the home page.
export const CONTACT_WA = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "").replace(/\D/g, "");
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-canvas">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-16 lg:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Brand className="text-[20px]" />
            <p className="mt-3 max-w-xs text-[15px] text-muted">Bills, kitchen, tables, stock, staff and guests — for cafés and restaurants.</p>
          </div>
          <div>
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-faint">Product</div>
            <ul className="mt-3 space-y-2 text-[15px]">
              {links.slice(0, 3).map((l) => <li key={l.href}><Link href={l.href} className="hover:text-jade">{l.label}</Link></li>)}
              <li><Link href="/pricing" className="hover:text-jade">All plans</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-faint">Restro</div>
            <ul className="mt-3 space-y-2 text-[15px]">
              <li><Link href="/login" className="hover:text-jade">Sign in</Link></li>
              <li><Link href="/#contact" className="hover:text-jade">Contact</Link></li>
              {CONTACT_EMAIL && <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-jade">{CONTACT_EMAIL}</a></li>}
            </ul>
          </div>
        </div>
      </div>
      {/* oversized wordmark, cut by the page edge */}
      <div aria-hidden className="pointer-events-none select-none px-3 text-center font-semibold leading-[0.8] tracking-[-0.06em] text-jade/[0.08]" style={{ fontSize: "clamp(120px, 28vw, 420px)" }} data-parallax="-8">
        Restro
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-line px-5 py-5 text-[13px] text-muted sm:flex-row lg:px-6">
        <span>© {new Date().getFullYear()} Restro</span>
        <span className="sm:ml-auto">Made in Pune for Indian restaurants.</span>
      </div>
    </footer>
  );
}
