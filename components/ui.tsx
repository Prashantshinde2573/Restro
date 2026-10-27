"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useState as useLocalState, type ReactNode, type ButtonHTMLAttributes } from "react";
import type { Diet } from "@/lib/types";
import { initials } from "@/lib/format";

/* ---------- Page header: iOS large title ---------- */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="px-4 pt-3 pb-4 lg:px-10 lg:pt-10 lg:pb-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="large-title text-balance">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("px-4 pb-28 lg:px-10 lg:pb-12", className)}>{children}</div>;
}

/* ---------- Grouped surfaces (inset list) ---------- */
export function Group({
  title,
  action,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={clsx("min-w-0", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-baseline justify-between px-1">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={clsx("overflow-hidden rounded-group bg-surface", !flush && "p-4 lg:p-5")}>{children}</div>
    </section>
  );
}

export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  href,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{title}</div>
        {subtitle && <div className="truncate text-[13px] text-muted">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </>
  );
  const cls =
    "flex w-full items-center gap-3 px-4 py-3 text-left lg:px-5 [&:not(:last-child)]:border-b border-line/80";
  if (href)
    return (
      <a href={href} className={clsx(cls, "active:bg-sunken")}>
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button onClick={onClick} className={clsx(cls, "active:bg-sunken hover:bg-sunken/50 transition-colors")}>
        {inner}
      </button>
    );
  return <div className={cls}>{inner}</div>;
}

/* ---------- Buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "plain" | "tinted" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 rounded-ctl font-semibold transition active:scale-[.98] disabled:opacity-40 disabled:active:scale-100",
        size === "sm" && "h-9 px-3 text-[14px]",
        size === "md" && "h-11 px-4 text-[15px]",
        size === "lg" && "h-14 px-6 text-[17px]",
        variant === "primary" && "bg-jade text-white hover:bg-jade-deep dark:text-canvas",
        variant === "tinted" && "bg-jade-soft text-jade-deep hover:brightness-95",
        variant === "plain" && "bg-surface text-ink hover:bg-sunken",
        variant === "ghost" && "text-jade hover:bg-jade-soft/60",
        variant === "danger" && "bg-rose-soft text-rose hover:brightness-95",
        className,
      )}
    />
  );
}

export function IconButton({ className, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={clsx(
        "inline-flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-sunken active:scale-95",
        className,
      )}
    />
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={clsx("inline-flex rounded-ctl bg-sunken p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex-1 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[13px] font-semibold transition",
            value === o.value ? "bg-surface text-ink shadow-float" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Chips (horizontal filter) ---------- */
export function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium transition",
            value === o.value ? "bg-ink text-canvas" : "bg-surface text-ink hover:bg-sunken",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={clsx("ml-1.5 tnum", value === o.value ? "opacity-60" : "text-muted")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Pills / status ---------- */
export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "jade" | "saffron" | "rose" | "sky";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold",
        tone === "neutral" && "bg-sunken text-muted",
        tone === "jade" && "bg-jade-soft text-jade-deep",
        tone === "saffron" && "bg-saffron-soft text-saffron",
        tone === "rose" && "bg-rose-soft text-rose",
        tone === "sky" && "bg-sky-soft text-sky",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DietMark({ diet }: { diet: Diet }) {
  const c = diet === "veg" ? "border-jade text-jade" : diet === "egg" ? "border-saffron text-saffron" : "border-rose text-rose";
  return (
    <span aria-label={diet === "veg" ? "Vegetarian" : diet === "egg" ? "Contains egg" : "Non-vegetarian"} className={clsx("inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border-[1.5px]", c)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

export function Avatar({ name, hue = 160, size = 36 }: { name: string; hue?: number; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue} 55% 92%)`,
        color: `hsl(${hue} 45% 32%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/* Dish art placeholder until real photos are uploaded to Storage */
export function DishArt({ hue, className }: { hue: number; name?: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(150deg, hsl(${hue} 70% 88%), hsl(${hue} 55% 74%))` }}
    >
      <span
        className="absolute left-1/2 top-1/2 h-[64%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, hsl(${hue} 60% 62%) 0 42%, rgb(255 255 255 / .55) 43% 60%, rgb(255 255 255 / .25) 61%)` }}
      />
    </div>
  );
}

/* ---------- Sheet: bottom sheet on phones, side panel on desktop ---------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 flex max-h-[92dvh] animate-sheet-up flex-col rounded-t-[28px] bg-canvas shadow-sheet",
          "lg:inset-y-3 lg:left-auto lg:right-3 lg:max-h-none lg:animate-pop lg:rounded-[24px]",
          wide ? "lg:w-[640px]" : "lg:w-[460px]",
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line lg:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3 lg:pt-5">
          <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="bg-sunken !h-8 !w-8">
            <X size={16} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="pb-safe border-t border-line bg-canvas px-5 pt-3 pb-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Form bits ---------- */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-12 w-full rounded-ctl bg-surface px-4 text-[16px] outline-none ring-1 ring-line placeholder:text-faint focus:ring-2 focus:ring-jade";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", checked ? "bg-jade" : "bg-line")}
    >
      <span
        className={clsx(
          "absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

/* ---------- Tiny charts (SVG, no chart lib) ---------- */
export function Bars({
  data,
  height = 120,
  highlightLast,
  format,
}: {
  data: { label: string; value: number; ghost?: number }[];
  height?: number;
  highlightLast?: boolean;
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => Math.max(d.value, d.ghost ?? 0)), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        return (
          <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <div className="relative flex w-full flex-1 items-end justify-center">
              {d.ghost !== undefined && (
                <div className="absolute bottom-0 w-full rounded-[5px] bg-sunken" style={{ height: `${(d.ghost / max) * 100}%` }} />
              )}
              <div
                title={format ? format(d.value) : String(d.value)}
                className={clsx("relative w-full rounded-[5px] transition-all", highlightLast && !isLast ? "bg-jade/35" : "bg-jade")}
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
              />
            </div>
            <span className="text-[11px] text-faint tnum">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, tone = "jade" }: { value: number; size?: number; stroke?: number; tone?: "jade" | "saffron" | "rose" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const col = tone === "jade" ? "rgb(var(--jade))" : tone === "saffron" ? "rgb(var(--saffron))" : "rgb(var(--rose))";
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={col}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, value))}
        style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.9,.3,1)" }}
      />
    </svg>
  );
}

export function Stat({ label, value, delta, tone }: { label: string; value: ReactNode; delta?: string; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-0.5 text-[22px] font-semibold tracking-tight tnum">{value}</div>
      {delta && <div className={clsx("text-[12px] font-medium tnum", tone === "down" ? "text-rose" : "text-jade")}>{delta}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-muted">{icon}</div>
      <div className="text-[16px] font-semibold">{title}</div>
      <p className="mt-1 max-w-xs text-[14px] text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* Uncontrolled helpers for prototype forms */

export function SwitchRow({ label, initial = false, hint }: { label: string; initial?: boolean; hint?: string }) {
  const [v, setV] = useLocalState(initial);
  return (
    <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-[12.5px] text-muted">{hint}</span>}
      </span>
      <Toggle label={label} checked={v} onChange={setV} />
    </div>
  );
}

export function LocalSegmented<T extends string>({ initial, options, className }: { initial: T; options: { value: T; label: ReactNode }[]; className?: string }) {
  const [v, setV] = useLocalState<T>(initial);
  return <Segmented className={className} value={v} onChange={setV} options={options} />;
}
