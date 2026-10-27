"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Boxes,
  ChefHat,
  ChevronsUpDown,
  LayoutGrid,
  Megaphone,
  MoreHorizontal,
  ReceiptText,
  Settings,
  Sparkles,
  SquarePlus,
  UtensilsCrossed,
  Users,
  UserRound,
  Check,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT, type Lang, type TKey } from "@/lib/i18n";
import { repo } from "@/lib/repo";
import { Avatar, Sheet } from "./ui";
import { ClientOnly } from "./client-only";

type NavItem = { href: string; key: TKey; icon: typeof Activity; badge?: number };

const groups: { key: TKey; items: NavItem[] }[] = [
  {
    key: "run",
    items: [
      { href: "/app", key: "pulse", icon: Activity },
      { href: "/app/pos", key: "pos", icon: SquarePlus },
      { href: "/app/orders", key: "orders", icon: ReceiptText, badge: 2 },
      { href: "/app/tables", key: "tables", icon: LayoutGrid },
      { href: "/app/kitchen", key: "kitchen", icon: ChefHat },
    ],
  },
  {
    key: "manage",
    items: [
      { href: "/app/menu", key: "menu", icon: UtensilsCrossed },
      { href: "/app/inventory", key: "inventory", icon: Boxes },
      { href: "/app/team", key: "staff", icon: UserRound },
    ],
  },
  {
    key: "grow",
    items: [
      { href: "/app/guests", key: "customers", icon: Users },
      { href: "/app/campaigns", key: "marketing", icon: Megaphone },
      { href: "/app/insights", key: "insights", icon: Sparkles },
      { href: "/app/reports", key: "reports", icon: BarChart3 },
    ],
  },
];

const tabs: NavItem[] = [
  { href: "/app", key: "pulse", icon: Activity },
  { href: "/app/orders", key: "orders", icon: ReceiptText },
  { href: "/app/pos", key: "pos", icon: SquarePlus },
  { href: "/app/tables", key: "tables", icon: LayoutGrid },
];

const isActive = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="rgb(var(--jade))" />
        <path d="M8 17V7.5h4.6a3 3 0 0 1 .4 6L16 17" stroke="white" strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Restro
    </span>
  );
}

const langs: { v: Lang; label: string }[] = [
  { v: "en", label: "English" },
  { v: "mr", label: "मराठी" },
  { v: "hi", label: "हिंदी" },
];

function OutletSwitcher() {
  const r = repo.restaurant();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(r.outlet);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-ctl px-2 py-2 text-left hover:bg-surface/60">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-[13px] font-bold text-canvas">SL</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{r.name}</span>
          <span className="block truncate text-[12px] text-muted">{current}</span>
        </span>
        <ChevronsUpDown size={15} className="text-faint" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Switch outlet">
        <div className="overflow-hidden rounded-group bg-surface">
          {r.outlets.map((o) => (
            <button
              key={o}
              onClick={() => {
                setCurrent(o);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between border-b border-line/80 px-4 py-3.5 text-left last:border-0"
            >
              <span className="text-[15px] font-medium">{o}</span>
              {o === current && <Check size={18} className="text-jade" />}
            </button>
          ))}
        </div>
        <p className="mt-3 px-1 text-[13px] text-muted">Every outlet keeps its own menu prices, stock and staff. Reports can combine all three.</p>
      </Sheet>
    </>
  );
}

function Sidebar() {
  const path = usePathname();
  const { t, lang, setLang } = useT();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col px-3 py-5 lg:flex">
      <Link href="/app" className="px-2 pb-5">
        <Wordmark className="text-[19px]" />
      </Link>
      <OutletSwitcher />
      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="px-3 pb-1 text-[12px] font-medium text-faint">{t(g.key)}</div>
            {g.items.map((it) => {
              const active = isActive(path, it.href);
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px] font-medium transition-colors",
                    active ? "bg-surface text-ink shadow-float" : "text-muted hover:bg-surface/60 hover:text-ink",
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-jade" : undefined} />
                  <span className="flex-1">{t(it.key)}</span>
                  {it.badge ? <span className="rounded-full bg-saffron px-1.5 text-[11px] font-bold text-white tnum">{it.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-3 space-y-1 border-t border-line pt-3">
        <Link
          href="/app/settings"
          className={clsx(
            "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px] font-medium",
            path.startsWith("/app/settings") ? "bg-surface shadow-float" : "text-muted hover:bg-surface/60 hover:text-ink",
          )}
        >
          <Settings size={18} strokeWidth={1.8} />
          {t("settings")}
        </Link>
        <div className="flex items-center gap-1 px-2 pt-2">
          {langs.map((l) => (
            <button
              key={l.v}
              onClick={() => setLang(l.v)}
              className={clsx("flex-1 rounded-[8px] py-1 text-[12px] font-semibold", lang === l.v ? "bg-ink text-canvas" : "text-muted hover:bg-surface/60")}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function TabBar() {
  const path = usePathname();
  const { t, lang, setLang } = useT();
  const [more, setMore] = useState(false);
  const moreItems = [...groups.flatMap((g) => g.items), { href: "/app/settings", key: "settings" as TKey, icon: Settings }].filter(
    (i) => !tabs.some((tb) => tb.href === i.href),
  );
  const moreActive = moreItems.some((i) => isActive(path, i.href));
  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-canvas/85 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {tabs.map((it) => {
            const active = isActive(path, it.href);
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2">
                <Icon size={23} strokeWidth={active ? 2.2 : 1.7} className={active ? "text-jade" : "text-faint"} />
                <span className={clsx("text-[10.5px] font-medium", active ? "text-jade" : "text-faint")}>{t(it.key)}</span>
              </Link>
            );
          })}
          <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2">
            <MoreHorizontal size={23} strokeWidth={moreActive ? 2.2 : 1.7} className={moreActive ? "text-jade" : "text-faint"} />
            <span className={clsx("text-[10.5px] font-medium", moreActive ? "text-jade" : "text-faint")}>{t("more")}</span>
          </button>
        </div>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title={t("more")}>
        <div className="mb-4">
          <OutletSwitcher />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {moreItems.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setMore(false)}
                className="flex flex-col items-center gap-2 rounded-group bg-surface px-2 py-4 active:scale-[.97]"
              >
                <Icon size={22} className="text-jade" />
                <span className="text-[13px] font-medium">{t(it.key)}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-5 flex gap-1 rounded-ctl bg-sunken p-1">
          {langs.map((l) => (
            <button
              key={l.v}
              onClick={() => setLang(l.v)}
              className={clsx("flex-1 rounded-[9px] py-2 text-[14px] font-semibold", lang === l.v ? "bg-surface shadow-float" : "text-muted")}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh lg:bg-sunken">
      <Sidebar />
      <main className="min-w-0 flex-1 lg:py-3 lg:pr-3">
        <div className="min-h-dvh lg:min-h-[calc(100dvh-24px)] lg:rounded-[28px] lg:bg-canvas">
          <ClientOnly>{children}</ClientOnly>
        </div>
      </main>
      <TabBar />
    </div>
  );
}

export function UserChip() {
  const r = repo.restaurant();
  return (
    <Link href="/app/settings" aria-label="Your profile" className="lg:hidden">
      <Avatar name={r.owner} hue={160} size={34} />
    </Link>
  );
}
