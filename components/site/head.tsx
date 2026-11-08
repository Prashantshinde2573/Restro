"use client";

// One look for every section heading on the website: a small pill on top, then the title.
import clsx from "clsx";
import type { ReactNode } from "react";
import { RiseText } from "./motion";

export function Eyebrow({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div
      data-reveal
      className={clsx(
        "inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 ring-1",
        dark ? "bg-white/[.06] ring-white/10" : "bg-white ring-black/[.06]",
        className,
      )}
    >
      <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full", dark ? "bg-white/10" : "bg-jade-soft")}>
        <span className={clsx("h-1.5 w-1.5 rounded-full", dark ? "bg-saffron" : "bg-jade")} />
      </span>
      <span className={clsx("text-[12px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/75" : "text-ink/65")}>{children}</span>
    </div>
  );
}

/** Same size, weight and spacing everywhere. `*word*` is coloured. */
export function SectionHead({
  eyebrow,
  title,
  sub,
  dark = false,
  align = "center",
  className,
  as = "h2",
}: {
  eyebrow: string;
  title: string;
  sub?: ReactNode;
  dark?: boolean;
  align?: "center" | "left";
  className?: string;
  /** "h1" for the main heading of a page that has no hero */
  as?: "h1" | "h2";
}) {
  return (
    <div className={clsx(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className)}>
      <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
      <RiseText
        as={as}
        onScroll
        text={title}
        className={clsx(
          "mt-4 text-[32px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[44px] lg:text-[56px]",
          align === "center" && "mx-auto",
          dark && "text-white [&_.text-jade]:text-saffron",
        )}
      />
      {sub && <p data-reveal className={clsx("mt-4 text-[16px] leading-relaxed lg:text-[17px]", align === "center" && "mx-auto max-w-xl", dark ? "text-white/65" : "text-ink/60")}>{sub}</p>}
    </div>
  );
}
