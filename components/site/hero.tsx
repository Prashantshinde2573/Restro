"use client";

// Hero, Apple-style: centred headline, then the product shown big on a glass
// stage that tilts up into view as you scroll, with glass cards floating around it.
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Magnetic } from "./chrome";
import { IconArrow } from "./icons";
import { KotTicket, PhoneMenu, PulseNote, TabletPOS, UpiCard } from "./mockups";
import { RiseText, gsap, reducedMotion, useIsoLayoutEffect } from "./motion";

export function Mesh({ tone = "light", solid = tone !== "light", top = false }: { tone?: "light" | "dark" | "jade"; solid?: boolean; top?: boolean }) {
  const c =
    tone === "dark"
      ? ["rgb(var(--jade) / .55)", "rgb(var(--saffron) / .35)", "rgb(var(--jade-deep) / .6)"]
      : tone === "jade"
        ? ["rgb(var(--jade-deep) / .9)", "rgb(var(--saffron) / .45)", "rgb(120 220 190 / .45)"]
        : ["rgb(var(--jade) / .30)", "rgb(var(--saffron) / .28)", "rgb(var(--jade-soft) / 1)"];
  return (
    <div aria-hidden className={solid ? "mesh mesh-solid" : top ? "mesh mesh-top" : "mesh"}>
      <span style={{ background: c[0], width: "48vw", height: "48vw", left: "-12vw", top: "-6vw" }} />
      <span style={{ background: c[1], width: "40vw", height: "40vw", right: "-10vw", top: "8vw" }} />
      <span style={{ background: c[2], width: "54vw", height: "40vw", left: "22vw", bottom: "-18vw" }} />
    </div>
  );
}

function Float({ className, depth, children }: { className: string; depth: number; children: ReactNode }) {
  return (
    <div className={`absolute ${className}`} data-depth={depth}>
      <div className="animate-float" style={{ animationDelay: `${-depth * 2}s` }}>{children}</div>
    </div>
  );
}

export function Hero() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    if (reducedMotion() || !section.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-hero-fade]", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, delay: 0.5 });
      gsap.fromTo(stage.current, { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 1.8, ease: "expo.out", delay: 0.7 });
      // scroll: the screen tips up to face you, the floating cards drift apart
      gsap.fromTo(
        "[data-tilt]",
        { rotateX: 32, scale: 0.86 },
        { rotateX: 0, scale: 1, ease: "none", scrollTrigger: { trigger: stage.current, start: "top 95%", end: "top 15%", scrub: 0.6 } },
      );
      gsap.utils.toArray<HTMLElement>("[data-depth]").forEach((el) => {
        const d = Number(el.dataset.depth);
        gsap.to(el, { yPercent: -d * 40, ease: "none", scrollTrigger: { trigger: stage.current, start: "top bottom", end: "bottom top", scrub: true } });
      });
      // pointer: the whole stage leans a little toward the mouse
      if (window.matchMedia("(pointer: fine)").matches && stage.current) {
        const ry = gsap.quickTo(stage.current, "rotationY", { duration: 1, ease: "power3.out" });
        const rx = gsap.quickTo(stage.current, "rotationX", { duration: 1, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          ry((e.clientX / window.innerWidth - 0.5) * 6);
          rx(-(e.clientY / window.innerHeight - 0.5) * 4);
        };
        window.addEventListener("pointermove", move);
        return () => window.removeEventListener("pointermove", move);
      }
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={section} className="relative isolate overflow-hidden pb-20 pt-32 sm:pt-40 lg:pb-28">
      <Mesh top />
      <div className="relative mx-auto max-w-[1240px] px-5 text-center lg:px-8">
        <div data-hero-fade className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium text-ink/80">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-jade" />
            <span className="relative h-2 w-2 rounded-full bg-jade" />
          </span>
          For cafés, restaurants and cloud kitchens
        </div>
        <RiseText
          text="Run the whole restaurant from one *calm* screen."
          className="text-balance mx-auto mt-7 max-w-[15ch] text-[48px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[72px] lg:text-[96px]"
        />
        <p data-hero-fade className="mx-auto mt-7 max-w-2xl text-[18px] leading-relaxed text-ink/60 lg:text-[20px]">
          Billing, kitchen, tables, stock, staff and guests — for cafés, restaurants and cloud kitchens. Every morning Restro tells you what to fix, in plain words.
        </p>
        <div data-hero-fade className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Magnetic block>
            <a href="#contact" className="group flex h-14 w-full items-center justify-between gap-3 rounded-full bg-jade pl-7 pr-2 text-[16.5px] font-semibold text-white shadow-[0_20px_40px_-16px_rgb(var(--jade)),inset_0_1px_0_rgb(255_255_255/.25)] transition hover:bg-jade-deep sm:w-auto">
              Get Restro for your restaurant
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:-rotate-45"><IconArrow /></span>
            </a>
          </Magnetic>
          <Link href="/login" className="glass flex h-14 w-full items-center justify-center rounded-full px-8 text-[16.5px] font-semibold transition hover:bg-white/70 sm:w-auto">Sign in</Link>
        </div>
        <p data-hero-fade className="mt-5 text-[13.5px] text-ink/50">We set it up with you. Works on the phone, tablet and laptop you already have.</p>
      </div>

      {/* the product, big, on glass */}
      <div className="relative mx-auto mt-16 max-w-[1240px] px-5 lg:mt-20 lg:px-8" style={{ perspective: "2000px" }}>
        <div ref={stage} data-piece className="relative mx-auto" style={{ transformStyle: "preserve-3d" }}>
          <div data-tilt className="glass-strong relative mx-auto origin-bottom overflow-hidden rounded-[28px] p-2 sm:rounded-[40px] sm:p-3 lg:w-[980px]">
            <div className="flex h-[260px] items-center justify-center overflow-hidden rounded-[20px] bg-canvas/70 sm:h-[420px] sm:rounded-[30px] lg:h-[560px]">
              <div className="origin-center scale-[.55] sm:scale-[1.05] lg:scale-[1.55]">
                <TabletPOS className="!shadow-none" />
              </div>
            </div>
          </div>
          <Float className="-right-2 top-[18%] hidden sm:block lg:right-[-10px]" depth={0.9}>
            <div className="glass rounded-[48px] p-2.5"><PhoneMenu className="!shadow-[0_30px_60px_-30px_rgb(16_24_20/.5)]" /></div>
          </Float>
          <Float className="-left-2 top-[-6%] hidden sm:block lg:left-[10px]" depth={1.3}>
            <div className="glass rounded-[30px] p-2.5"><UpiCard className="!shadow-none" /></div>
          </Float>
          <Float className="bottom-[8%] left-[2%] hidden md:block" depth={0.6}>
            <div className="glass rounded-[26px] p-2.5"><KotTicket className="!shadow-none" /></div>
          </Float>
          <Float className="-bottom-[8%] right-[18%] hidden lg:block" depth={1.1}>
            <PulseNote className="!w-[280px]" />
          </Float>
        </div>
      </div>
    </section>
  );
}
