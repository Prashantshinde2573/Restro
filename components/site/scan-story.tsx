"use client";

// "One app instead of six": a pinned scroll story.
//   1. A table QR card, a phone rises and scans it
//   2. The scan lands on the guest menu
//   3. The five things Restropi runs come in beside the phone, one by one
// All screens are real Restropi screenshots (public/site/app). On phones the
// five cards take turns under the phone instead of sitting beside it.
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { BellRing, Check, ClipboardList, House, LayoutGrid, Plus, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { gsap, ScrollTrigger, reducedMotion, useIsoLayoutEffect } from "./motion";
import { Eyebrow } from "./head";

// Photo from Unsplash (free under the Unsplash License): a dim restaurant, behind everything.
const BG_IMG = "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?auto=format&fit=crop&q=70&w=2000";

const FEATURES = [
  { n: "01", t: "QR menu & ordering", d: "Guests scan, order and pay from their phone. Nothing to install.", img: "" },
  { n: "02", t: "Kitchen screen", d: "Orders reach the right station the second they're placed. No paper KOTs.", img: "/site/app/kitchen.webp" },
  { n: "03", t: "Billing, GST & UPI", d: "Bills with GST, discounts and a UPI QR for the exact amount.", img: "/site/app/bill.webp" },
  { n: "04", t: "Tables & team", d: "Every table at a glance. A PIN for every captain, chef and cashier.", img: "/site/app/tables.webp" },
  { n: "05", t: "Sales & reports", d: "Today's sales, GST and best sellers the moment you close.", img: "/site/app/reports.webp" },
  { n: "06", t: "Guests & offers", d: "Know your regulars. Send offers on WhatsApp from your own number.", img: "/site/app/offers.webp" },
];

/* ---- the guest menu inside the phone: built like the real Restropi screen, with food photos ---- */
// Food photos from Unsplash (free under the Unsplash License).
const food = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=360&h=270&q=70`;
const DISHES = [
  { name: "Paneer Tikka", d: "Char-grilled, mint chutney", price: 240, veg: true, tag: "Bestseller", img: food("photo-1567188040759-fb8a883dc6d8"), tint: "#e9c9a3" },
  { name: "Chicken Biryani", d: "Dum cooked, raita", price: 320, veg: false, img: food("photo-1589302168068-964664d93dc0"), tint: "#e7c48f" },
  { name: "Masala Dosa", d: "Sambar, two chutneys", price: 140, veg: true, img: food("photo-1668236543090-82eba5ee5976"), tint: "#ecd3a0" },
  { name: "Butter Chicken", d: "Creamy tomato gravy", price: 360, veg: false, tag: "Chef's special", img: food("photo-1603894584373-5ac82b2ae398"), tint: "#e3a77c" },
  { name: "Cold Coffee", d: "With ice cream", price: 160, veg: true, img: food("photo-1461023058943-07fcbe16d735"), tint: "#d9c2a7" },
  { name: "Masala Chai", d: "Ginger, cardamom", price: 40, veg: true, img: food("photo-1761483281417-778013dc0177"), tint: "#d8b48a" },
];

function Diet({ veg }: { veg: boolean }) {
  return (
    <span className={clsx("inline-flex h-[13px] w-[13px] items-center justify-center rounded-[3px] border-[1.5px]", veg ? "border-[#0e7a5f]" : "border-[#c2413a]")}>
      <span className={clsx("h-[5px] w-[5px] rounded-full", veg ? "bg-[#0e7a5f]" : "bg-[#c2413a]")} />
    </span>
  );
}

/** 390 × 664 like the phone screenshots, scaled to fit the phone. */
function GuestScreen() {
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.7);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / 390);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} data-menu className="absolute inset-0 overflow-hidden bg-[#f3f4f1]" role="img" aria-label="Restropi guest menu on a phone">
      <div className="absolute left-0 top-0 h-[664px] w-[390px] origin-top-left text-[#14201b]" style={{ transform: `scale(${k})` }}>
        <div className="px-4 pt-[34px]">
          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/restropi-logo-dark.png" alt="" width={597} height={180} className="h-[24px] w-auto" />
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#14201b] px-2.5 py-1 text-[12px] font-semibold text-white">Table T1</span>
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M4 10h20M10 18h14" /></svg>
            </div>
          </div>
          <div className="mt-3 text-[23px] font-bold tracking-tight">MS Cafe</div>
          <div className="text-[13px] text-[#14201b]/65">Order from your phone. We&apos;ll bring it to your table.</div>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex h-9 w-[104px] items-center justify-between rounded-full border border-[#e2e4df] bg-white px-3.5 text-[13px] font-semibold">All <span className="text-[10px] opacity-50">▼</span></span>
            <span className="flex h-9 flex-1 items-center justify-between rounded-full border border-[#e2e4df] bg-white px-3.5 text-[13px] font-semibold">⭐ Chef&apos;s picks (6) <span className="text-[10px] opacity-50">▼</span></span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e4df] bg-white"><SlidersHorizontal size={15} /></span>
          </div>
          <div className="mb-2 mt-4 flex items-center gap-2">
            <span className="text-[17px]">⭐</span>
            <span className="flex-1 text-[17px] font-bold tracking-tight">Chef&apos;s picks</span>
            <span className="text-[12.5px] font-semibold text-[#14201b]/55">6 items</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {DISHES.map((m) => (
              <div key={m.name} className="overflow-hidden rounded-[16px] bg-white ring-1 ring-[#e2e4df]/70">
                <div className="relative aspect-[4/3]" style={{ background: m.tint }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.img} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} className="absolute inset-0 h-full w-full object-cover" />
                  {m.tag && <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-bold">{m.tag}</span>}
                </div>
                <div className="px-2.5 pb-2.5 pt-2">
                  <Diet veg={m.veg} />
                  <div className="mt-1 text-[14px] font-bold leading-snug tracking-tight">{m.name}</div>
                  <div className="truncate text-[12px] text-[#14201b]/55">{m.d}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[15px] font-bold text-[#0b6650]">₹{m.price}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dff2ea] text-[#0b6650]"><Plus size={17} strokeWidth={2.4} /></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* bottom tabs */}
        <div className="absolute inset-x-0 bottom-0 flex rounded-t-[20px] border-t border-[#e2e4df] bg-white px-2 pb-3 pt-2">
          {[
            { l: "Home", i: <House size={21} strokeWidth={2.4} fill="currentColor" />, on: true },
            { l: "Menu", i: <LayoutGrid size={21} strokeWidth={1.8} /> },
            { l: "Cart", i: <ShoppingCart size={21} strokeWidth={1.8} /> },
            { l: "Orders", i: <ClipboardList size={21} strokeWidth={1.8} /> },
            { l: "Waiter", i: <BellRing size={21} strokeWidth={1.8} /> },
          ].map((t) => (
            <span key={t.l} className={clsx("flex flex-1 flex-col items-center gap-0.5 text-[11.5px]", t.on ? "font-bold text-[#0b6650]" : "font-medium text-[#14201b]/80")}>
              {t.i}
              {t.l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ f, className }: { f: (typeof FEATURES)[number]; className?: string }) {
  return (
    <div className={clsx("flex items-center gap-4 rounded-[22px] bg-white/[.06] p-3 pr-5 ring-1 ring-white/10 backdrop-blur-md", className)}>
      {f.n === "01" ? (
        <div className="relative h-[118px] w-[70px] shrink-0 overflow-hidden rounded-[12px] ring-1 ring-white/10"><GuestScreen /></div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={f.img} alt="" loading="lazy" width={585} height={996} className="h-[118px] w-[70px] shrink-0 rounded-[12px] object-cover object-top ring-1 ring-white/10" />
      )}
      <div className="min-w-0">
        <div className="text-[12px] font-semibold tracking-[.14em] text-jade-soft/70">{f.n}</div>
        <div className="mt-0.5 text-[18px] font-semibold leading-tight tracking-[-0.02em] text-white">{f.t}</div>
        <p className="mt-1 text-[13.5px] leading-snug text-white/55">{f.d}</p>
      </div>
    </div>
  );
}

/** The table card with the QR on it (the QR is the real one Restropi prints). */
function QrCard({ className }: { className?: string }) {
  return (
    <div className={clsx("w-[210px] rounded-[26px] bg-white p-5 text-center text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/.6)]", className)}>
      <div className="text-[13px] font-medium text-ink/55">MS Cafe</div>
      <div className="text-[10.5px] font-semibold tracking-[.2em] text-ink/40">TABLE</div>
      <div className="text-[34px] font-bold leading-none tracking-tight">T1</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/site/app/qr.webp" alt="Restropi table QR code" width={480} height={480} className="mx-auto mt-3 w-[150px]" />
      <div className="mt-3 text-[13px] font-semibold leading-snug">Scan to see the menu and order</div>
    </div>
  );
}

/** A phone: camera scanning the QR, then the guest menu. */
function Phone({ className }: { className?: string }) {
  return (
    <div data-phone className={clsx("relative rounded-[42px] bg-[#0d1311] p-[9px] shadow-[0_50px_100px_-30px_rgb(0_0_0/.8)] ring-1 ring-white/15", className)}>
      <div className="relative aspect-[390/664] overflow-hidden rounded-[34px] bg-black">
        {/* the menu the scan opens */}
        <GuestScreen />
        {/* the camera */}
        <div data-camera className="absolute inset-0 flex items-center justify-center bg-[#101614]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/app/qr.webp" alt="" width={480} height={480} className="w-[58%] rounded-[6px] opacity-90" />
          <div data-frame className="absolute left-1/2 top-1/2 aspect-square w-[72%] -translate-x-1/2 -translate-y-1/2">
            {["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[14px]", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[14px]", "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-[14px]", "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-[14px]"].map((c) => (
              <span key={c} data-corner className={clsx("absolute h-7 w-7 border-white", c)} />
            ))}
            <span className="scanline absolute inset-x-2 h-[3px] rounded-full bg-jade shadow-[0_0_18px_4px_rgb(var(--jade)/.7)]" />
          </div>
          <div className="absolute inset-x-0 top-7 text-center text-[12px] font-medium text-white/70">Point at the QR on your table</div>
        </div>
        {/* found it */}
        <div data-found className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 items-center gap-2.5 rounded-[18px] bg-white px-4 py-3 text-ink opacity-0 shadow-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-jade text-white"><Check size={17} strokeWidth={3} /></span>
          <span className="text-[13.5px] font-semibold leading-tight">Table T1 · MS Cafe<span className="block text-[11.5px] font-medium text-ink/50">Opening the menu…</span></span>
        </div>
      </div>
      <span aria-hidden className="absolute left-1/2 top-[15px] h-[18px] w-[86px] -translate-x-1/2 rounded-full bg-[#0d1311]" />
    </div>
  );
}

export function ScanStory() {
  const root = useRef<HTMLElement>(null);

  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    if (reducedMotion()) {
      // the end state, no pinning
      gsap.set(q("[data-camera], [data-found], [data-qr], [data-title-a]"), { autoAlpha: 0 });
      gsap.set(q("[data-title-b], [data-card-desk]"), { autoAlpha: 1 });
      gsap.set(q("[data-card-mob]").slice(1), { autoAlpha: 0 }); // phones: just the first card
      return;
    }
    const mm = gsap.matchMedia();
    const build = (desk: boolean) => {
      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: { trigger: q("[data-stage]")[0], start: "top top", end: desk ? "+=2600" : "+=3000", pin: true, scrub: 0.8, anticipatePin: 1 },
      });
      const cards = q(desk ? "[data-card-desk]" : "[data-card-mob]");
      gsap.set(cards, { autoAlpha: 0, x: (i) => (desk ? (i < 3 ? -50 : 50) : 0), y: desk ? 0 : 30 });
      gsap.set(q("[data-title-b]"), { autoAlpha: 0, y: 20 });
      gsap.set(q("[data-phone-wrap]"), { yPercent: 70, autoAlpha: 0 });
      gsap.set(q("[data-qr]"), { xPercent: 0, rotate: -4 });
      gsap.set(q("[data-found]"), { autoAlpha: 0, y: 12 });
      // 1. the phone comes up and over the QR
      tl.to(q("[data-phone-wrap]"), { yPercent: 0, autoAlpha: 1, duration: 1.2 })
        .to(q("[data-qr]"), { x: desk ? -300 : -125, rotate: -10, scale: desk ? 0.85 : 0.62, duration: 1.2 }, "<")
        // 2. scan
        .to(q("[data-corner]"), { borderColor: "rgb(var(--jade))", duration: 0.25 })
        .to(q("[data-found]"), { autoAlpha: 1, y: 0, duration: 0.35 })
        .to({}, { duration: 0.3 })
        // 3. the menu opens, the QR card leaves
        .to(q("[data-camera], [data-found]"), { autoAlpha: 0, duration: 0.5 })
        .to(q("[data-qr]"), { autoAlpha: 0, x: desk ? -360 : -170, duration: 0.6 }, "<")
        .to(q("[data-title-a]"), { autoAlpha: 0, y: -20, duration: 0.4 }, "<")
        .to(q("[data-title-b]"), { autoAlpha: 1, y: 0, duration: 0.5 });
      // 4. the five features
      if (desk) {
        tl.to(cards, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.45 });
      } else {
        cards.forEach((c, i) => {
          tl.to(c, { autoAlpha: 1, y: 0, duration: 0.45 });
          tl.to(q("[data-dot]")[i], { backgroundColor: "rgb(var(--jade))", width: 18, duration: 0.3 }, "<");
          if (i < cards.length - 1) tl.to(c, { autoAlpha: 0, y: -24, duration: 0.4 }, "+=0.6");
        });
      }
      tl.to({}, { duration: 0.8 }); // hold the full picture a moment
      return () => tl.scrollTrigger?.kill();
    };
    mm.add("(min-width: 1024px)", () => build(true));
    mm.add("(max-width: 1023.98px)", () => build(false));
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="one-app" aria-label="One app instead of six" className="px-2 py-2 sm:px-3">
      <div className="relative isolate overflow-hidden rounded-[30px] bg-ink sm:rounded-[40px]">
        <div data-stage className="relative h-[100svh] min-h-[620px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BG_IMG} alt="" aria-hidden loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover text-transparent opacity-30" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_60%,rgb(16_22_20/.55)_0%,rgb(16_22_20/.92)_70%)]" />

          {/* headline: before and after the scan */}
          <div className="relative z-20 mx-auto max-w-[1100px] px-6 pt-12 text-center lg:pt-16">
            <Eyebrow dark>One app instead of six</Eyebrow>
            <div className="relative mt-3">
              <h2 data-title-a className="text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[44px] lg:text-[54px]">
                It starts with <span className="text-jade-soft">one scan.</span>
              </h2>
              <h2 data-title-b className="absolute inset-x-0 top-0 text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[44px] lg:text-[54px]">
                Then <span className="text-jade-soft">one app</span> runs the rest.
              </h2>
            </div>
          </div>

          {/* desktop: cards · phone · cards */}
          <div className="relative z-10 mx-auto mt-12 hidden h-[calc(100%-270px)] max-w-[1240px] grid-cols-[1fr_auto_1fr] items-center gap-10 px-8 lg:grid">
            <div className="flex flex-col gap-4">
              {FEATURES.slice(0, 3).map((f) => (
                <div key={f.n} data-card data-card-desk><FeatureCard f={f} /></div>
              ))}
            </div>
            <div className="relative flex items-center justify-center">
              <div data-qr className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><QrCard /></div>
              <div data-phone-wrap className="relative"><Phone className="w-[min(300px,calc((100svh-290px)*0.57))]" /></div>
            </div>
            <div className="flex flex-col gap-4">
              {FEATURES.slice(3).map((f) => (
                <div key={f.n} data-card data-card-desk><FeatureCard f={f} /></div>
              ))}
            </div>
          </div>
          {/* phone & tablet: phone in the middle, the cards take turns below it */}
          <div className="relative z-10 mt-8 flex h-[calc(100%-176px)] flex-col items-center px-5 pb-[92px] lg:hidden">
            <div className="relative flex flex-1 items-center justify-center">
              <div data-qr className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[.8]"><QrCard /></div>
              <div data-phone-wrap className="relative"><Phone className="w-[min(200px,40svh*.59)]" /></div>
            </div>
            <div className="relative h-[184px] w-full max-w-[420px]">
              {FEATURES.map((f) => (
                <div key={f.n} data-card data-card-mob className="absolute inset-x-0 top-0"><FeatureCard f={f} /></div>
              ))}
              <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-center gap-2">
                {FEATURES.map((f) => (
                  <span key={f.n} data-dot className="h-1.5 w-1.5 rounded-full bg-white/25" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
