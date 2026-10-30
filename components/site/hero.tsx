"use client";

// Hero: big headline + a 3D table-top of Restro screens (tablet, guest phone,
// bill, UPI QR, kitchen ticket). It follows the pointer and unfolds on scroll.
import Link from "next/link";
import { useRef } from "react";
import { Magnetic } from "./chrome";
import { IconArrow } from "./icons";
import { KotTicket, PhoneMenu, Receipt, TabletPOS, UpiCard } from "./mockups";
import { RiseText, gsap, reducedMotion, useIsoLayoutEffect, useTilt } from "./motion";

export function Hero() {
  const section = useRef<HTMLElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useTilt(tilt, 7);

  useIsoLayoutEffect(() => {
    if (reducedMotion() || !section.current) return;
    const ctx = gsap.context(() => {
      gsap.set(stage.current, { rotateX: 24, rotateZ: -10 });
      // entrance: pieces drop onto the table one by one
      gsap.fromTo("[data-piece]", { opacity: 0, y: 90, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 1.6, ease: "expo.out", stagger: 0.09, delay: 0.25 });
      gsap.fromTo("[data-hero-fade]", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, delay: 0.55 });
      // scroll: the table tips up toward the viewer and the pieces spread out
      const tl = gsap.timeline({ scrollTrigger: { trigger: section.current, start: "top top", end: "bottom top", scrub: 0.8 } });
      tl.to(stage.current, { rotateX: 6, rotateZ: 0, scale: 1.08, yPercent: -8, ease: "none" }, 0)
        .to("[data-spread='left']", { xPercent: -35, ease: "none" }, 0)
        .to("[data-spread='right']", { xPercent: 30, ease: "none" }, 0)
        .to("[data-spread='up']", { yPercent: -60, ease: "none" }, 0)
        .to("[data-hero-copy]", { yPercent: -18, opacity: 0.2, ease: "none" }, 0);
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={section} className="relative isolate overflow-hidden pb-10 pt-28 sm:pt-32 lg:min-h-[100svh] lg:pb-0 lg:pt-36">
      {/* soft brand light + grain, no images to load */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-jade/[0.10] blur-[110px]" />
        <div className="absolute -right-20 top-48 h-[420px] w-[420px] rounded-full bg-saffron/[0.10] blur-[110px]" />
        <div className="grain absolute inset-0 opacity-[0.05] mix-blend-multiply" />
      </div>

      <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 lg:grid-cols-[1.02fr_1fr] lg:px-8">
        <div data-hero-copy className="relative z-10">
          <div data-hero-fade className="inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1.5 text-[13px] font-medium text-muted ring-1 ring-line backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-jade" />
              <span className="relative h-2 w-2 rounded-full bg-jade" />
            </span>
            For cafés, restaurants and cloud kitchens
          </div>
          <RiseText
            text="Run the whole restaurant from one *calm* screen."
            className="text-balance mt-6 text-[46px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[64px] lg:text-[72px] xl:text-[84px]"
          />
          <p data-hero-fade className="mt-6 max-w-xl text-[17.5px] leading-relaxed text-muted lg:text-[19px]">
            Billing, kitchen, tables, stock, staff and guests — for cafés, restaurants and cloud kitchens. Every morning Restro tells you what to fix, in plain words.
          </p>
          <div data-hero-fade className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <a href="#contact" className="group flex h-14 items-center gap-3 rounded-full bg-jade pl-6 pr-2 text-[16.5px] font-semibold text-white shadow-[0_18px_40px_-18px_rgb(var(--jade))] transition hover:bg-jade-deep">
                Get Restro for your restaurant
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:-rotate-45"><IconArrow /></span>
              </a>
            </Magnetic>
            <Link href="/login" className="flex h-14 items-center rounded-full px-6 text-[16.5px] font-semibold ring-1 ring-line transition hover:bg-surface">Sign in</Link>
          </div>
          <p data-hero-fade className="mt-5 text-[13.5px] text-muted">We set it up with you. Works on the phone, tablet and laptop you already have.</p>
        </div>

        {/* the 3D table-top */}
        <div className="relative h-[420px] sm:h-[520px] lg:h-[640px]" style={{ perspective: "1600px" }}>
          <div ref={tilt} className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
            <div className="absolute left-1/2 top-1/2 h-[520px] w-[620px] -translate-x-1/2 -translate-y-1/2 scale-[.58] [transform-style:preserve-3d] sm:scale-[.78] lg:left-[62%] lg:scale-[.9] xl:left-[58%] xl:scale-100">
            <div
              ref={stage}
              className="absolute inset-0 origin-center"
              style={{ transformStyle: "preserve-3d", transform: "rotateX(24deg) rotateZ(-10deg)" }}
            >
              <Piece at="left-[30px] top-[110px]" z={0}><TabletPOS /></Piece>
              <Piece at="right-[-30px] top-[40px]" z={150} spread="right" delay={-2}><PhoneMenu /></Piece>
              <Piece at="left-[-10px] top-[270px]" z={210} rot={-8} spread="left" delay={-4}><Receipt /></Piece>
              <Piece at="left-[200px] top-[-30px]" z={260} rot={6} spread="up" delay={0}><UpiCard /></Piece>
              <Piece at="bottom-[-40px] left-[230px] hidden sm:block" z={180} rot={4} spread="left" delay={-1}><KotTicket /></Piece>
              {/* soft contact shadow on the "table" */}
              <div className="absolute inset-x-10 bottom-0 h-24 rounded-[50%] bg-ink/20 blur-3xl" style={{ transform: "translateZ(-40px)" }} />
            </div>
            </div>
          </div>
        </div>
      </div>

      <a href="#features" aria-label="Scroll to features" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[12px] font-medium uppercase tracking-[0.2em] text-faint lg:flex">
        Scroll
        <span className="relative h-10 w-px overflow-hidden bg-line">
          <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_1.8s_ease-in-out_infinite] bg-jade" />
        </span>
      </a>
    </section>
  );
}

/** One object on the table. Position/depth, scroll spread, entrance and float
 *  each live on their own wrapper so the animations never overwrite each other. */
function Piece({ at, z, rot = 0, spread, delay, children }: { at: string; z: number; rot?: number; spread?: "left" | "right" | "up"; delay?: number; children: React.ReactNode }) {
  return (
    <div className={`absolute ${at}`} style={{ transform: `translateZ(${z}px) rotateZ(${rot}deg)`, transformStyle: "preserve-3d" }}>
      <div data-spread={spread}>
        <div data-piece>
          <div className={delay === undefined ? undefined : "animate-float"} style={delay === undefined ? undefined : { animationDelay: `${delay}s` }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
