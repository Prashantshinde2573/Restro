"use client";

// Hero: edge-to-edge background photo (or video, see HERO_VIDEO),
// big white headline bottom-left, small white cards stacked on the right.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconArrow, IconKitchen, IconOffline } from "./icons";
import { KotTicket, UpiCard } from "./mockups";
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


// Background: a video if you set one, otherwise the photo.
// To use a video later: put the file in public/ (e.g. public/hero.mp4) and set
// HERO_VIDEO below to "/hero.mp4" (or NEXT_PUBLIC_HERO_VIDEO in .env.local).
export const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO || "";
// Photo by Roman (@rm_reins) on Unsplash — free under the Unsplash License.
export const HERO_IMAGE =
  process.env.NEXT_PUBLIC_HERO_IMAGE ||
  "https://images.unsplash.com/photo-1762806883627-4bcbfad98a2c?auto=format&fit=crop&q=70&w=2400";

function BackgroundVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reducedMotion()) v.pause();
    if (v.readyState >= 2) setReady(true);
  }, []);
  return (
    <video
      ref={ref}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1.6s] ${ready ? "opacity-100" : "opacity-0"}`}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={HERO_IMAGE || undefined}
      onLoadedData={() => setReady(true)}
      aria-hidden
    >
      <source src={src} />
    </video>
  );
}

function BackgroundImage({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) setReady(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      aria-hidden
      fetchPriority="high"
      decoding="async"
      onLoad={() => setReady(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1.2s] ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
}

/** Warm, dim backdrop shown while the photo loads (or if it can't). */
function Backdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#1d1712]">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_30%,#6b4a2c_0%,#3a2a1c_38%,#17120e_75%)]" />
      <div className="hero-bokeh">
        {[
          ["8%", "14%", 220, "rgb(255 190 110 / .5)"],
          ["58%", "10%", 180, "rgb(255 170 90 / .4)"],
          ["80%", "22%", 260, "rgb(255 200 130 / .35)"],
          ["40%", "70%", 300, "rgb(14 122 95 / .3)"],
        ].map(([l, t, size, c], i) => (
          <span key={i} style={{ left: l as string, top: t as string, width: size as number, height: size as number, background: c as string, animationDelay: `${-i * 3}s` }} />
        ))}
      </div>
    </div>
  );
}

/** Pill button whose label rolls up on hover. */
function RollButton({ href, children, className }: { href: string; children: string; className?: string }) {
  return (
    <a href={href} className={`btn-roll group relative inline-flex h-[52px] items-center overflow-hidden rounded-full px-7 text-[15.5px] font-semibold ${className ?? ""}`}>
      <span className="relative block overflow-hidden">
        <span className="block transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-full">{children}</span>
        <span aria-hidden className="absolute inset-0 block translate-y-full transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-y-0">{children}</span>
      </span>
    </a>
  );
}

/** Round arrow button: the arrow slips out to the top-right and a new one slides in. */
function ArrowButton({ href, label, className }: { href: string; label: string; className?: string }) {
  const arrow = "transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]";
  return (
    <a href={href} aria-label={label} className={`group relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full ${className ?? ""}`}>
      <span className={`-rotate-45 ${arrow} group-hover:translate-x-[150%] group-hover:-translate-y-[150%]`}>
        <IconArrow size={18} />
      </span>
      <span aria-hidden className={`absolute -rotate-45 -translate-x-[150%] translate-y-[150%] ${arrow} group-hover:translate-x-0 group-hover:translate-y-0`}>
        <IconArrow size={18} />
      </span>
    </a>
  );
}

export function Hero() {
  const section = useRef<HTMLElement>(null);

  useIsoLayoutEffect(() => {
    if (reducedMotion() || !section.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-hero-fade]", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, delay: 0.5 });
      gsap.fromTo("[data-hero-card]", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.3, ease: "expo.out", stagger: 0.1, delay: 0.8 });
      gsap.fromTo("[data-hero-media]", { scale: 1.08 }, { scale: 1, duration: 2.4, ease: "expo.out" });
      // scroll: the background drifts slower than the page, the copy fades out
      gsap.to("[data-hero-media]", { yPercent: 12, ease: "none", scrollTrigger: { trigger: section.current, start: "top top", end: "bottom top", scrub: true } });
      gsap.to("[data-hero-copy]", { y: -50, opacity: 0.2, ease: "none", scrollTrigger: { trigger: section.current, start: "center center", end: "bottom top", scrub: true } });
    }, section);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={section} className="relative isolate flex min-h-[max(100svh,640px)] flex-col overflow-hidden text-white">
      <div data-hero-media className="absolute inset-0 -z-10 will-change-transform">
        <Backdrop />
        {HERO_IMAGE && <BackgroundImage src={HERO_IMAGE} />}
        {HERO_VIDEO && <BackgroundVideo src={HERO_VIDEO} />}
      </div>
      {/* darken for the white type: top for the nav, bottom-left for the headline */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_0_0/.5)_0%,rgb(0_0_0/.12)_26%,rgb(0_0_0/.2)_55%,rgb(0_0_0/.75)_100%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_0%_100%,rgb(0_0_0/.5),transparent_65%)]" />

      <div className="mx-auto mt-auto grid w-full max-w-[1400px] gap-8 px-5 pb-8 pt-32 sm:px-8 sm:pb-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:px-14 lg:pb-16">
        <div data-hero-copy className="max-w-[680px]">
          <div data-hero-fade className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white/90 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7be0c0]" />
            For cafés, restaurants and cloud kitchens
          </div>
          <RiseText
            text="Run the whole restaurant from one calm screen."
            className="text-balance mt-5 text-[40px] font-medium leading-[1.02] tracking-[-0.04em] sm:text-[56px] lg:text-[66px] xl:text-[74px]"
          />
          <p data-hero-fade className="mt-5 max-w-[520px] text-[16.5px] leading-relaxed text-white/80 lg:text-[18px]">
            Billing, kitchen, tables, stock, staff and guests in one app. Every morning Restro tells you what to fix, in plain words.
          </p>
          <div data-hero-fade className="mt-8 flex items-center gap-2">
            <RollButton href="#contact" className="bg-white text-ink shadow-[0_16px_32px_-18px_rgb(0_0_0/.7)] transition-[background-color,transform] duration-300 hover:bg-jade-soft active:scale-[.97]">
              Get Restro
            </RollButton>
            <ArrowButton href="#features" label="See features" className="bg-white text-ink transition-[background-color,transform] duration-300 hover:bg-jade-soft active:scale-[.94]" />
            <Link href="/login" className="group ml-3 hidden h-[52px] items-center text-[15px] font-semibold text-white/90 sm:flex">
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:bg-[length:100%_1px]">
                Sign in
              </span>
            </Link>
          </div>
        </div>
          {/* white cards, bottom-right */}
          <div className="grid w-full grid-cols-2 gap-2.5 text-ink sm:max-w-[440px] lg:w-[440px]">
            <a data-hero-card href="#features" className="group relative col-span-2 flex min-h-[200px] overflow-hidden rounded-[22px] bg-white p-5 shadow-[0_30px_60px_-30px_rgb(0_0_0/.6)]">
              <div className="relative z-10 flex max-w-[56%] flex-col">
                <div className="text-[19px] font-semibold leading-[1.1] tracking-[-0.02em]">Every bill, a UPI QR</div>
                <p className="mt-2 text-[13px] leading-snug text-muted">With the exact amount filled in. Guests scan, you get paid.</p>
                <span className="mt-auto flex items-center gap-2 pt-4">
                  <span className="rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-white transition group-hover:bg-jade">Learn more</span>
                  <span className="flex h-8 w-8 -rotate-45 items-center justify-center rounded-full ring-1 ring-line transition-transform duration-500 group-hover:rotate-0"><IconArrow size={14} /></span>
                </span>
              </div>
              <div className="absolute -right-3 top-4 rotate-[8deg] transition-transform duration-700 group-hover:rotate-[2deg] group-hover:scale-105">
                <UpiCard className="!w-[150px] !shadow-[0_24px_40px_-18px_rgb(16_24_20/.45)]" />
              </div>
              <div aria-hidden className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-jade-soft blur-2xl" />
            </a>
            <div data-hero-card className="relative flex min-h-[150px] flex-col overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/.6)]">
              <div aria-hidden className="absolute -right-6 -top-4 origin-top-right rotate-[-6deg] scale-[.62] opacity-90">
                <KotTicket className="!shadow-[0_14px_28px_-14px_rgb(16_24_20/.4)]" />
              </div>
              <span className="text-jade"><IconKitchen /></span>
              <div className="mt-auto text-[24px] font-semibold leading-none tracking-[-0.03em]">KOT</div>
              <div className="mt-1.5 text-[12px] leading-snug text-muted">Straight to the kitchen the moment you bill</div>
            </div>
            <div data-hero-card className="flex min-h-[150px] flex-col rounded-[22px] bg-white p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/.6)]">
              <div className="flex items-center justify-between">
                <span className="text-jade"><IconOffline /></span>
                <span className="flex items-center gap-1.5 rounded-full bg-jade-soft px-2 py-0.5 text-[10.5px] font-semibold text-jade-deep">
                  <span className="h-1.5 w-1.5 rounded-full bg-jade" /> Live
                </span>
              </div>
              <div className="mt-auto border-t border-line pt-3 text-[24px] font-semibold leading-none tracking-[-0.03em]">Offline</div>
              <div className="mt-1.5 text-[12px] leading-snug text-muted">Billing keeps going when the Wi-Fi drops</div>
            </div>
          </div>
      </div>
    </section>
  );
}


const outletKinds = ["Cafés", "Restaurants", "Cloud kitchens", "Bakeries", "Quick service", "Bars & lounges"];

/** The white strip under the hero (where the reference has "As seen in"). */
export function MadeFor() {
  return (
    <section className="relative bg-canvas pb-16 pt-14 lg:pb-20 lg:pt-20">
      <p data-reveal className="text-center text-[17px] font-medium tracking-[-0.01em] text-ink/80">Made for every kind of kitchen</p>
      <div data-reveal-group className="mx-auto mt-8 flex max-w-[1400px] flex-wrap items-center justify-center gap-x-9 gap-y-3 px-5 sm:gap-x-12">
        {outletKinds.map((k) => (
          <span key={k} className="whitespace-nowrap text-[21px] font-semibold tracking-[-0.03em] text-ink/30 transition-colors hover:text-jade sm:text-[24px] xl:text-[27px]">
            {k}
          </span>
        ))}
      </div>
    </section>
  );
}
