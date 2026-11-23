"use client";

// Starts the little bento animations (bars grow, lines draw) when a card scrolls into view.
import { useEffect, useRef, type ReactNode } from "react";

export function BentoReveal({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cards = root.current?.querySelectorAll<HTMLElement>(".bento-card");
    if (!cards) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))), { threshold: 0.3 });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  return <div ref={root} className={className}>{children}</div>;
}
