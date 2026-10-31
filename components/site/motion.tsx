"use client";

// Motion for the public website only (home, pricing, sign-in).
// Lenis gives the smooth scroll; GSAP + ScrollTrigger run the reveals and
// scroll stories, driven by Lenis so the two never fight.
// Everything is skipped when the visitor prefers reduced motion.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { Fragment, createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Stop the page scrolling behind a menu or dialog. body overflow:hidden alone
   doesn't stop it on iPhones, so the body is pinned in place and put back after. */
let locks = 0;
let savedY = 0;
export function lockScroll(lenis?: Lenis | null) {
  if (locks++ === 0) {
    savedY = window.scrollY;
    const b = document.body.style;
    b.position = "fixed";
    b.top = `-${savedY}px`;
    b.left = "0";
    b.right = "0";
    b.width = "100%";
    b.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  lenis?.stop();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--locks > 0) return;
    const b = document.body.style;
    b.position = b.top = b.left = b.right = b.width = b.overflow = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, savedY);
    document.documentElement.style.scrollBehavior = "";
    lenis?.start();
  };
}

const LenisCtx = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisCtx);

/** Wrap a public page: smooth scroll + section reveals. */
export function SiteMotion({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("motion-ready");
    if (reducedMotion()) return;
    const l = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    l.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => l.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    setLenis(l);
    // in-page links (#pricing, #contact) glide instead of jumping
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a[href*='#']") as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href);
      if (url.pathname !== window.location.pathname || !url.hash) return;
      const el = document.querySelector(url.hash);
      if (!el) return;
      e.preventDefault();
      l.scrollTo(el as HTMLElement, { offset: -72 });
      history.replaceState(null, "", url.hash);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      l.destroy();
      setLenis(null);
    };
  }, []);

  // Generic reveals: [data-reveal] fades up, [data-reveal-group] staggers its children.
  useIsoLayoutEffect(() => {
    if (reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: Number(el.dataset.reveal) || 40 },
          { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } },
        );
      });
      gsap.utils.toArray<HTMLElement>("[data-reveal-group]").forEach((g) => {
        gsap.fromTo(
          g.children,
          { opacity: 0, y: 36 },
          { opacity: 1, y: 0, duration: 1, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: g, start: "top 85%", once: true } },
        );
      });
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        gsap.to(el, { yPercent: Number(el.dataset.parallax) || -12, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
    });
    // fonts and images change heights: re-measure once everything is in
    const r = () => ScrollTrigger.refresh();
    window.addEventListener("load", r);
    document.fonts?.ready.then(r).catch(() => {});
    return () => {
      window.removeEventListener("load", r);
      ctx.revert();
    };
  }, []);

  return <LenisCtx.Provider value={lenis}>{children}</LenisCtx.Provider>;
}

/** Headline that rises in word by word (on load, or when scrolled to). */
export function RiseText({ text, as: Tag = "h1", className, onScroll = false, delay = 0 }: { text: string; as?: "h1" | "h2" | "h3" | "p"; className?: string; onScroll?: boolean; delay?: number }) {
  const ref = useRef<HTMLElement>(null);
  useIsoLayoutEffect(() => {
    document.documentElement.classList.add("motion-ready");
    if (reducedMotion() || !ref.current) return;
    const words = ref.current.querySelectorAll<HTMLElement>("[data-w]");
    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { y: 0, yPercent: 110, rotate: 4 },
        {
          y: 0, yPercent: 0, rotate: 0, duration: 1.2, ease: "expo.out", stagger: 0.06, delay,
          ...(onScroll ? { scrollTrigger: { trigger: ref.current, start: "top 85%", once: true } } : {}),
        },
      );
    }, ref);
    return () => ctx.revert();
  }, [onScroll, delay]);
  // *word* renders in the brand colour
  // "*per outlet.*" may span several words: mark each word inside the stars
  let on = false;
  const marked = text.split(" ").map((w) => {
    const start = w.startsWith("*");
    const end = w.endsWith("*") && (w.length > 1 || on);
    const accent = on || start;
    if (start) on = true;
    if (end) on = false;
    return { w: w.replace(/^\*|\*$/g, ""), accent };
  });
  const parts = marked;
  return (
    <Tag ref={ref as RefObject<never>} className={`text-balance ${className ?? ""}`} aria-label={text.replace(/\*/g, "")}>
      {parts.map(({ w, accent }, i) => {
        return (
          <Fragment key={i}>
            <span aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom">
              <span data-w className={`inline-block will-change-transform ${accent ? "text-jade" : ""}`}>{w}</span>
            </span>
            {i < parts.length - 1 ? " " : ""}
          </Fragment>
        );
      })}
    </Tag>
  );
}

/** Pointer-driven 3D tilt for a stage or card (desktop pointers only). */
export function useTilt<T extends HTMLElement>(ref: RefObject<T | null>, strength = 8) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !window.matchMedia("(pointer: fine)").matches) return;
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      ry(x * strength);
      rx(-y * strength);
    };
    const leave = () => {
      rx(0);
      ry(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [ref, strength]);
}

export { gsap, ScrollTrigger };
