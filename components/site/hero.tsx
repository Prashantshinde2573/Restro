"use client";

// Hero: edge-to-edge background photo (or video, see HERO_VIDEO),
// big white headline bottom-left, small white cards stacked on the right.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconArrow, IconKitchen, IconPulse } from "./icons";
import { KotTicket, UpiCard } from "./mockups";
import { SectionHead } from "./head";
import { Swipe } from "./swipe";
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


// Background video: public/video/hero.(mp4|webm) on desktop, hero-mobile.mp4 on phones,
// hero-poster.jpg while it loads. Built from free stock clips by video/hero/build.sh.
// Set NEXT_PUBLIC_HERO_VIDEO="" to turn the video off and show only the photo.
export const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO ?? "/video/hero";
export const HERO_IMAGE = process.env.NEXT_PUBLIC_HERO_IMAGE || "/video/hero-poster.jpg";

function BackgroundVideo({ base }: { base: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => setPhone(window.matchMedia("(max-width: 767px)").matches), []);
  useEffect(() => {
    const v = ref.current;
    if (!v || phone === null) return;
    if (reducedMotion()) return; // still frame only
    v.play().catch(() => {});
  }, [phone]);
  // pick the file only on the client, so phones never download the big one
  if (phone === null) return null;
  return (
    <video
      ref={ref}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1.2s] ${ready ? "opacity-100" : "opacity-0"}`}
      muted
      loop
      playsInline
      autoPlay={!reducedMotion()}
      preload="auto"
      poster={HERO_IMAGE || undefined}
      onPlaying={() => setReady(true)}
      onLoadedData={(e) => reducedMotion() && setReady(!!e.currentTarget)}
      aria-hidden
    >
      {phone ? (
        <source src={`${base}-mobile.mp4`} type="video/mp4" />
      ) : (
        <>
          <source src={`${base}.webm`} type="video/webm" />
          <source src={`${base}.mp4`} type="video/mp4" />
        </>
      )}
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
    <section ref={section} className="relative isolate flex min-h-[max(78svh,560px)] flex-col overflow-hidden text-white md:min-h-[max(100svh,640px)]">
      <div data-hero-media className="absolute inset-0 -z-10 will-change-transform">
        <Backdrop />
        {HERO_IMAGE && <BackgroundImage src={HERO_IMAGE} />}
        {HERO_VIDEO && <BackgroundVideo base={HERO_VIDEO} />}
      </div>
      {/* darken for the white type: top for the nav, bottom-left for the headline */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_0_0/.72)_0%,rgb(0_0_0/.35)_16%,rgb(0_0_0/.08)_34%,rgb(0_0_0/.18)_60%,rgb(0_0_0/.72)_100%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_0_0/.78)_0%,rgb(0_0_0/.5)_28%,rgb(0_0_0/.15)_55%,transparent_75%)]" />

      <div className="mx-auto mt-auto grid w-full max-w-[1400px] gap-8 px-5 pb-8 pt-32 sm:px-8 sm:pb-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:px-14 lg:pb-16">
        <div data-hero-copy className="max-w-[680px]">
          <div data-hero-fade className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white/90 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7be0c0]" />
            For cafés, restaurants and cloud kitchens
          </div>
          <RiseText
            text="Run the whole restaurant from one calm screen."
            className="text-balance mt-5 text-[36px] font-medium leading-[1.04] tracking-[-0.04em] sm:text-[48px] lg:text-[56px] xl:text-[62px]"
          />
          <p data-hero-fade className="mt-5 max-w-[520px] text-[16.5px] leading-relaxed text-white/80 lg:text-[18px]">
            Billing, kitchen, tables, stock, staff and guests in one app. Every morning Restropi tells you what to fix, in plain words.
          </p>
          <div data-hero-fade className="mt-8 flex items-center gap-2">
            <a href="#contact" className="group inline-flex h-[52px] items-center gap-3 rounded-full bg-white pl-6 pr-2 text-[15.5px] font-semibold text-ink shadow-[0_16px_32px_-18px_rgb(0_0_0/.7)] transition hover:bg-jade-soft">
              Book a free demo
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-jade text-white transition-transform duration-500 group-hover:-rotate-45"><IconArrow size={16} /></span>
            </a>
            <Link href="/login" className="group ml-3 hidden h-[52px] items-center text-[15px] font-semibold text-white/90 sm:flex">
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:bg-[length:100%_1px]">
                Sign in
              </span>
            </Link>
          </div>
        </div>
          {/* white cards, bottom-right */}
          <Swipe from="md" dark item="w-[80%]" grid="md:grid md:grid-cols-2 md:gap-2.5" spans={["md:col-span-2", "", ""]} className="hidden w-full text-ink md:block md:max-w-[380px] lg:w-[380px]">
            <a data-hero-card href="#features" className="group relative flex min-h-[150px] overflow-hidden rounded-[20px] bg-white p-4 sm:min-h-[170px] shadow-[0_30px_60px_-30px_rgb(0_0_0/.6)]">
              <div className="relative z-10 flex max-w-[56%] flex-col">
                <div className="text-[16.5px] font-semibold leading-[1.1] tracking-[-0.02em]">Every bill, a UPI QR</div>
                <p className="mt-1.5 text-[12px] leading-snug text-muted">With the exact amount filled in. Guests scan, you get paid.</p>
                <span className="mt-auto flex items-center gap-2 pt-4">
                  <span className="rounded-full bg-ink px-3.5 py-2 text-[12px] font-semibold text-white transition group-hover:bg-jade">Learn more</span>
                  <span className="flex h-8 w-8 -rotate-45 items-center justify-center rounded-full ring-1 ring-line transition-transform duration-500 group-hover:rotate-0"><IconArrow size={14} /></span>
                </span>
              </div>
              <div className="absolute -right-3 top-4 rotate-[8deg] transition-transform duration-700 group-hover:rotate-[2deg] group-hover:scale-105">
                <UpiCard className="!w-[128px] !shadow-[0_24px_40px_-18px_rgb(16_24_20/.45)]" />
              </div>
              <div aria-hidden className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-jade-soft blur-2xl" />
            </a>
            <div data-hero-card className="relative flex min-h-[124px] flex-col overflow-hidden rounded-[20px] bg-white p-3.5 shadow-[0_30px_60px_-30px_rgb(0_0_0/.6)]">
              <div aria-hidden className="absolute -right-6 -top-4 origin-top-right rotate-[-6deg] scale-[.62] opacity-90">
                <KotTicket className="!shadow-[0_14px_28px_-14px_rgb(16_24_20/.4)]" />
              </div>
              <span className="text-jade"><IconKitchen /></span>
              <div className="mt-auto text-[20px] font-semibold leading-none tracking-[-0.03em]">KOT</div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted">Straight to the kitchen the moment you bill</div>
            </div>
            <div data-hero-card className="flex min-h-[124px] flex-col rounded-[20px] bg-white p-3.5 shadow-[0_30px_60px_-30px_rgb(0_0_0/.6)]">
              <div className="flex items-center justify-between">
                <span className="text-jade"><IconPulse /></span>
                <span className="flex items-center gap-1.5 rounded-full bg-jade-soft px-2 py-0.5 text-[10.5px] font-semibold text-jade-deep">
                  <span className="h-1.5 w-1.5 rounded-full bg-jade" /> Daily
                </span>
              </div>
              <div className="mt-auto border-t border-line pt-2.5 text-[20px] font-semibold leading-none tracking-[-0.03em]">Pulse</div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted">A note each morning on what to fix</div>
            </div>
          </Swipe>
      </div>
    </section>
  );
}


const u = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&q=70&w=720&h=880`;
// Photos from Unsplash (free under the Unsplash License).
const kinds = [
  { t: "Cafés", d: "Quick bills, tokens and a QR menu", img: u("photo-1759593914906-4ea0b1261ba4") },
  { t: "Restaurants", d: "Tables, captains, KOTs and split bills", img: u("photo-1742281257707-0c7f7e5ca9c6") },
  { t: "Cloud kitchens", d: "Takeaway and delivery orders on one screen", img: u("photo-1622021142947-da7dedc7c39a") },
  { t: "Bakeries", d: "Counter billing and what to bake tomorrow", img: u("photo-1687722157890-9f58d5cd26d4") },
  { t: "Quick service", d: "Fast counter billing in a few taps", img: u("photo-1758578484459-677bfbbd00f7") },
  { t: "Bars & lounges", d: "Running tabs per table, split at the end", img: u("photo-1756522074787-c750cae5e6aa") },
];

function KindCard({ k, i }: { k: (typeof kinds)[number]; i: number }) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // an image that failed before the page woke up never fires onError
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setBroken(true);
  }, []);
  return (
    <div className={`kind-card group w-[250px] shrink-0 sm:w-[290px] ${i % 2 ? "translate-y-8" : ""}`}>
      <div className="glass glass-shine rounded-[30px] p-2.5 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-2 group-hover:shadow-[0_40px_70px_-35px_rgb(16_24_20/.45)]">
        <div className="relative h-[300px] overflow-hidden rounded-[22px] bg-gradient-to-br from-jade-soft to-saffron/30 sm:h-[340px]">
          {!broken && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={img}
              src={k.img}
              alt={k.t}
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
              className="h-full w-full object-cover text-transparent transition-transform duration-[1.2s] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.07]"
            />
          )}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
          <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-white/25 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md">0{(i % kinds.length) + 1}</span>
        </div>
        <div className="flex items-end justify-between gap-3 px-3 pb-2 pt-4">
          <div className="min-w-0">
            <div className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">{k.t}</div>
            <div className="mt-1 text-[13.5px] leading-snug text-ink/55">{k.d}</div>
          </div>
          <span className="flex h-9 w-9 shrink-0 -rotate-45 items-center justify-center rounded-full bg-white/70 ring-1 ring-line transition-[transform,background-color,color] duration-500 group-hover:rotate-0 group-hover:bg-jade group-hover:text-white">
            <IconArrow size={15} />
          </span>
        </div>
      </div>
    </div>
  );
}

function KindTile({ k }: { k: (typeof kinds)[number] }) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setBroken(true);
  }, []);
  return (
    <div className="glass rounded-[22px] p-1.5">
      <div className="relative aspect-[4/3.4] overflow-hidden rounded-[17px] bg-gradient-to-br from-jade-soft to-saffron/30">
        {!broken && (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={img} src={k.img} alt={k.t} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover text-transparent" />
        )}
      </div>
      <div className="px-2 pb-2 pt-2.5">
        <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">{k.t}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-ink/55">{k.d}</div>
      </div>
    </div>
  );
}

/**
 * "Made for every kind of kitchen": glass cards drifting by on their own, forever.
 * Scrolling the page pushes them faster (and leans them a little); hovering slows them down.
 */
export function MadeFor() {
  const track = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    const box = wrap.current;
    if (!el || !box || reducedMotion()) return;
    let x = 0;
    let boost = 0;
    let slow = 1;
    let slowTo = 1;
    let lastY = window.scrollY;
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      boost = Math.min(boost + dy * 0.08, 14);
    };
    const enter = () => (slowTo = 0.15);
    const leave = () => (slowTo = 1);
    window.addEventListener("scroll", onScroll, { passive: true });
    box.addEventListener("pointerenter", enter);
    box.addEventListener("pointerleave", leave);
    const tick = (_t: number, dt: number) => {
      const f = Math.min(dt, 50) / 16.67;
      slow += (slowTo - slow) * 0.08 * f;
      boost *= Math.pow(0.92, f);
      x -= (0.7 + boost) * slow * f;
      const half = el.scrollWidth / 2;
      if (half > 0 && -x >= half) x += half;
      gsap.set(el, { x, skewX: -Math.min(boost, 10) * 0.35 });
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("scroll", onScroll);
      box.removeEventListener("pointerenter", enter);
      box.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <section id="kinds" className="relative isolate scroll-mt-20 overflow-hidden bg-canvas py-14 lg:pb-4 lg:pt-28">
      <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
        <SectionHead eyebrow="Who it’s for" title="Made for every kind of *kitchen.*" />
        {/* phones and tablets: a simple grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:hidden" data-reveal-group>
          {kinds.map((k) => (
            <KindTile key={k.t} k={k} />
          ))}
        </div>
      </div>
      <div
        ref={wrap}
        className="kinds-mask relative mt-2 hidden overflow-x-auto lg:block overflow-y-hidden pb-24 pt-10 [scrollbar-width:none] motion-safe:overflow-x-hidden lg:mt-4 [&::-webkit-scrollbar]:hidden"
      >
        <div ref={track} className="flex w-max gap-5 px-5 will-change-transform">
          {[...kinds, ...kinds].map((k, i) => (
            <KindCard key={i} k={k} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
