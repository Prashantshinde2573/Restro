"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Lock,
  KeyRound,
  BellRing,
  X,
  Plus,
  History,
  CircleHelp,
  Store,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useT, type Lang, type TKey } from "@/lib/i18n";
import { FEATURES, PLAN_NAME, RENEW_WARN_DAYS, daysLeft, featureState, hasPerm, inOutlet, isOwner, outletKinds, routeFor } from "@/lib/access";
import { sessionActions, useAccount, useCurrentOutlet, useMe, useOrders, useOutlets } from "@/lib/live";
import { cloudSignOut, useCloud } from "@/lib/cloud";
import { ChangePassword } from "./owner-auth";
import { Avatar, Button, Pill, Sheet } from "./ui";
import { ClientOnly } from "./client-only";
import { FullLoader } from "./loader";
import { OrderAlerts } from "./order-alerts";
import { CallAlerts, WaiterCallBar } from "./waiter-calls";
import { TableJanitor } from "./table-janitor";
import { NoticeBell, SoundRow } from "./notifications";
import { HelpButton, HelpSheet } from "./help";
import { PlanSheet, openPlanSheet } from "./plan-sheet";

type NavItem = { href: string; key: TKey; icon: typeof Activity; badge?: number };

const groups: { key: TKey; items: NavItem[] }[] = [
  {
    key: "run",
    items: [
      { href: "/app", key: "pulse", icon: Activity },
      { href: "/app/pos", key: "pos", icon: SquarePlus },
      { href: "/app/orders", key: "orders", icon: ReceiptText },
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
      { href: "/app/access", key: "access", icon: KeyRound },
    ],
  },
  {
    key: "grow",
    items: [
      { href: "/app/guests", key: "customers", icon: Users },
      { href: "/app/campaigns", key: "marketing", icon: Megaphone },
      { href: "/app/insights", key: "insights", icon: Sparkles },
      { href: "/app/reports", key: "reports", icon: BarChart3 },
      { href: "/app/activity", key: "activity", icon: History },
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

/** Restropi logo for the app. `light` = white letters, for dark backgrounds. Size it with a height class. */
export function Wordmark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={light ? "/brand/restropi-logo-light.png" : "/brand/restropi-logo-dark.png"}
      alt="Restropi"
      width={597}
      height={180}
      className={clsx("block h-7 w-auto select-none", className)}
      draggable={false}
    />
  );
}

const langs: { v: Lang; label: string }[] = [
  { v: "en", label: "English" },
  { v: "mr", label: "मराठी" },
  { v: "hi", label: "हिंदी" },
];

type NavState = "ok" | "locked";

/** Which nav items this person sees: outlet type + plan + their own access. */
function useNav() {
  const me = useMe();
  const outlet = useCurrentOutlet();
  const { plan } = useAccount();
  const owner = isOwner(me);
  const state = (href: string): NavState | null => {
    const r = routeFor(href);
    if (!r) return "ok"; // home
    if (r.feature) {
      const f = featureState(r.feature, plan, outletKinds(outlet));
      if (f === "type") return null; // not used in this kind of outlet — hidden
      if (f === "plan") return owner ? "locked" : null; // owners see what an upgrade adds
    }
    if (r.perm && r.perm !== "ownerOrSettings" && !owner && !(hasPerm(me, r.perm) && inOutlet(me, outlet.id))) return null;
    return "ok";
  };
  const waiting = useOrders().filter((o) => o.status === "new" && (!o.outletId || o.outletId === outlet.id)).length;
  const navGroups = groups
    .map((g) => ({ ...g, items: g.items.flatMap((it) => (state(it.href) ? [{ ...it, state: state(it.href)!, badge: it.href === "/app/orders" && waiting ? waiting : undefined }] : [])) }))
    .filter((g) => g.items.length);
  return { navGroups, state };
}

/** Days until the plan ends, when the owner should be reminded (≤ 10), else null. */
function useRenewDays() {
  const me = useMe();
  const { renewsAt } = useAccount();
  const d = daysLeft(renewsAt);
  return isOwner(me) && d <= RENEW_WARN_DAYS ? d : null;
}

function Badge({ n }: { n: number }) {
  return (
    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose px-1 text-[11px] font-bold text-white tnum" aria-label={`${n} days left on your plan`}>
      {n > 0 ? n : "!"}
    </span>
  );
}

function OutletSwitcher({ compact }: { compact?: boolean }) {
  const account = useAccount();
  const me = useMe();
  const outlets = useOutlets().filter((o) => inOutlet(me, o.id));
  const current = useCurrentOutlet();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const initials = account.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          disabled={outlets.length < 2 && !isOwner(me)}
          aria-label={`Outlet: ${current.name}`}
          className="flex h-[38px] max-w-[160px] items-center gap-2 rounded-full px-3.5 text-[14.5px] font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10 disabled:hover:bg-transparent"
        >
          <Store size={17} strokeWidth={1.9} className="shrink-0" />
          <span className="min-w-0 truncate">{current.name || account.name}</span>
          {(outlets.length > 1 || isOwner(me)) && <ChevronDown size={15} className="shrink-0 text-white/80" />}
        </button>
      ) : (
      <button onClick={() => setOpen(true)} disabled={outlets.length < 2 && !isOwner(me)} className="flex w-full items-center gap-3 rounded-ctl px-2 py-2 text-left hover:bg-surface/60 disabled:hover:bg-transparent">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-[13px] font-bold text-canvas">{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{account.name}</span>
          <span className="block truncate text-[12px] text-muted">{current.name} · {current.businessType === "cafe" ? "Café" : "Restaurant"}</span>
        </span>
        {(outlets.length > 1 || isOwner(me)) && <ChevronsUpDown size={15} className="text-faint" />}
      </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Outlet">
        <div className="overflow-hidden rounded-group bg-surface">
          {outlets.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                sessionActions.setOutlet(o.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-line/80 px-4 py-3.5 text-left last:border-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{o.name}</span>
                <span className="block text-[12.5px] text-muted">{o.businessType === "cafe" ? "Café" : "Restaurant"}</span>
              </span>
              {o.id === current.id && <Check size={18} className="text-jade" />}
            </button>
          ))}
        </div>
        {isOwner(me) && (
          <Link href="/app/access" className="mt-3 flex items-center gap-2 px-1 text-[14px] font-semibold text-jade">
            <Plus size={16} /> Add or edit outlets
          </Link>
        )}
      </Sheet>
    </>
  );
}

/** Signed-in person: profile, change password, sign out. */
function MeButton({ compact }: { compact?: boolean }) {
  const me = useMe();
  const { lang, setLang } = useT();
  const cloud = useCloud();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  if (!me) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={clsx("flex items-center gap-2.5 rounded-[10px] text-left", compact ? "" : "w-full px-2 py-1.5 hover:bg-surface/60")} aria-label="Signed in as">
        <Avatar name={me.name} hue={me.hue} photo={me.photo} size={compact ? 32 : 30} />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold">{me.name}</span>
            <span className="block truncate text-[12px] text-muted">{me.role === "owner" ? "Owner · admin" : me.role === "subadmin" ? `Sub admin · ${me.title}` : me.title}</span>
          </span>
        )}
      </button>
      <Sheet open={open} onClose={() => { setOpen(false); setPw(false); }} title={pw ? "Change password" : "Signed in as"}>
        {pw ? (
          <ChangePassword title="" onDone={() => { setPw(false); setOpen(false); }} />
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-group bg-surface p-4">
              <Avatar name={me.name} hue={me.hue} photo={me.photo} size={40} />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">{me.name}</div>
                <div className="truncate text-[13px] text-muted">{me.role === "owner" ? `Owner · ${cloud.email ?? ""}` : me.title}</div>
              </div>
            </div>
            <div className="mt-3 flex gap-1 rounded-ctl bg-sunken p-1" role="radiogroup" aria-label="Language">
              {langs.map((l) => (
                <button key={l.v} role="radio" aria-checked={lang === l.v} onClick={() => setLang(l.v)} className={clsx("flex-1 rounded-[9px] py-2 text-[14px] font-semibold", lang === l.v ? "bg-surface shadow-float" : "text-muted")}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="mt-3"><SoundRow /></div>
            {cloud.role === "owner" && (
              <button onClick={() => setPw(true)} className="mt-3 flex w-full items-center gap-2 rounded-group bg-surface px-4 py-3 text-left text-[15px] font-medium">
                <KeyRound size={17} className="text-jade" /> Change password
              </button>
            )}
            <button
              onClick={async () => {
                setOpen(false);
                await cloudSignOut();
                window.location.href = "/login";
              }}
              className="mt-4 block w-full text-center text-[14px] font-semibold text-rose"
            >
              Sign out
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}

function Sidebar() {
  const path = usePathname();
  const { t } = useT();
  const { navGroups } = useNav();
  const renew = useRenewDays();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col px-3 py-5 lg:flex">
      <div className="flex items-center justify-between px-2 pb-5">
        <Link href="/app">
          <Wordmark className="h-[30px]" />
        </Link>
        <div className="flex items-center gap-1.5"><HelpButton /><NoticeBell /></div>
      </div>
      <OutletSwitcher />
      <nav className="no-scrollbar mt-3 flex-1 space-y-3.5 overflow-y-auto">
        {navGroups.map((g) => (
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
                    "flex items-center gap-3 rounded-[10px] px-3 py-[7px] text-[14.5px] font-medium transition-colors",
                    active ? "bg-surface text-ink shadow-float" : "text-muted hover:bg-surface/60 hover:text-ink",
                    it.state === "locked" && "opacity-60",
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-jade" : undefined} />
                  <span className="flex-1">{t(it.key)}</span>
                  {it.state === "locked" ? <Lock size={13} className="text-faint" /> : it.badge ? <span className="rounded-full bg-saffron px-1.5 text-[11px] font-bold text-white tnum">{it.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-3 space-y-1 border-t border-line pt-3">
        <Link
          href="/app/help"
          className={clsx(
            "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px] font-medium",
            path.startsWith("/app/help") ? "bg-surface shadow-float" : "text-muted hover:bg-surface/60 hover:text-ink",
          )}
        >
          <CircleHelp size={18} strokeWidth={1.8} />
          <span className="flex-1">{t("help")}</span>
        </Link>
        <Link
          href="/app/settings"
          className={clsx(
            "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14.5px] font-medium",
            path.startsWith("/app/settings") ? "bg-surface shadow-float" : "text-muted hover:bg-surface/60 hover:text-ink",
          )}
        >
          <Settings size={18} strokeWidth={1.8} />
          <span className="flex-1">{t("settings")}</span>
          {renew !== null && <Badge n={renew} />}
        </Link>
        <MeButton />
      </div>
    </aside>
  );
}

function TabBar() {
  const path = usePathname();
  const { t, lang, setLang } = useT();
  const [more, setMore] = useState(false);
  const { navGroups, state } = useNav();
  const renew = useRenewDays();
  const myTabs = tabs.filter((tb) => state(tb.href) === "ok");
  const moreItems = [...navGroups.flatMap((g) => g.items), { href: "/app/settings", key: "settings" as TKey, icon: Settings, state: "ok" as NavState }, { href: "/app/help", key: "help" as TKey, icon: CircleHelp, state: "ok" as NavState }].filter(
    (i) => !myTabs.some((tb) => tb.href === i.href),
  );
  const moreActive = moreItems.some((i) => isActive(path, i.href));
  // a link in "More" was tapped: close it once the new page is showing
  useEffect(() => setMore(false), [path]);
  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-canvas/85 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {myTabs.map((it) => {
            const active = isActive(path, it.href);
            const Icon = it.icon;
            return (
              <Link key={it.href} href={it.href} className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2">
                <Icon size={23} strokeWidth={active ? 2.2 : 1.7} className={active ? "text-jade" : "text-faint"} />
                <span className={clsx("text-[10.5px] font-medium", active ? "text-jade" : "text-faint")}>{t(it.key)}</span>
              </Link>
            );
          })}
          <button onClick={() => setMore(true)} className="relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2">
            <MoreHorizontal size={23} strokeWidth={moreActive ? 2.2 : 1.7} className={moreActive ? "text-jade" : "text-faint"} />
            <span className={clsx("text-[10.5px] font-medium", moreActive ? "text-jade" : "text-faint")}>{t("more")}</span>
            {renew !== null && <span className="absolute right-[calc(50%-20px)] top-1"><Badge n={renew} /></span>}
          </button>
        </div>
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title={t("more")}>
        <div className="mb-4 space-y-1">
          <OutletSwitcher />
          <MeButton />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {moreItems.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => { if (isActive(path, it.href)) setMore(false); }}
                className={clsx("relative flex flex-col items-center gap-2 rounded-group bg-surface px-2 py-4 active:scale-[.97]", it.state === "locked" && "opacity-60")}
              >
                <Icon size={22} className="text-jade" />
                <span className="text-center text-[13px] font-medium">{t(it.key)}</span>
                {it.state === "locked" && <Lock size={12} className="absolute right-2.5 top-2.5 text-faint" />}
                {it.href === "/app/settings" && renew !== null && <span className="absolute right-2 top-2"><Badge n={renew} /></span>}
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

/** Owner reminder from 10 days before the plan ends. Hidden for the day once closed. */
function RenewBanner() {
  const days = useRenewDays();
  const { plan, renewsAt } = useAccount();
  const key = `restropi.renewHidden.${new Date().toDateString()}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (days === null || (hidden && days > 0)) return null;
  const date = new Date(renewsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const ended = days <= 0;
  return (
    <div className={clsx("flex items-center gap-3 px-4 py-2.5 text-[13.5px] lg:rounded-t-[28px] lg:px-6", ended ? "bg-rose text-white" : "bg-rose-soft text-rose")} role="status">
      <BellRing size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        {ended ? (
          <><b>Your {PLAN_NAME[plan]} plan has ended.</b> Renew to keep billing running.</>
        ) : (
          <><b>{PLAN_NAME[plan]} plan ends in {days} {days === 1 ? "day" : "days"}</b> ({date}). Renew to avoid any break.</>
        )}
      </span>
      <button onClick={() => openPlanSheet()} className={clsx("shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold", ended ? "bg-white text-rose" : "bg-rose text-white")}>Renew</button>
      {!ended && (
        <button
          aria-label="Hide for today"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, "1");
            } catch {}
          }}
          className="shrink-0 p-1"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

/** Blocks a screen the plan, outlet type or person's access doesn't allow. */
function RouteGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const me = useMe();
  const outlet = useCurrentOutlet();
  const { plan } = useAccount();
  const r = routeFor(path);
  if (!r) return <>{children}</>;
  const f = r.feature ? featureState(r.feature, plan, outletKinds(outlet)) : "ok";
  const allowed = isOwner(me) || (r.perm && r.perm !== "ownerOrSettings" ? hasPerm(me, r.perm) && inOutlet(me, outlet.id) : true);
  if (f === "ok" && allowed) return <>{children}</>;
  const need = r.feature ? FEATURES[r.feature] : null;
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-muted"><Lock size={24} /></span>
      {f === "type" ? (
        <>
          <h1 className="mt-4 text-[22px] font-semibold">{outlet.businessType === "cafe" ? "Not on for counter service" : "Not on for table service"}</h1>
          <p className="mt-1 max-w-sm text-[15px] text-muted">
            {outlet.name} is set up for {outlet.businessType === "cafe" ? "counter orders only" : "table service only"}, so {need?.label.toLowerCase()} is off here.
            {isOwner(me) && <> To use both, turn on <Link href="/app/settings" className="font-semibold text-jade">{outlet.businessType === "cafe" ? "“Also serve at tables”" : "“Also take counter orders”"}</Link> in Settings → Ordering.</>}
          </p>
        </>
      ) : !allowed ? (
        <>
          <h1 className="mt-4 text-[22px] font-semibold">No access</h1>
          <p className="mt-1 max-w-sm text-[15px] text-muted">Ask your admin to give you access to this.</p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-[22px] font-semibold">{need?.label}</h1>
          <p className="mt-1 max-w-sm text-[15px] text-muted">Part of the {PLAN_NAME[need!.plan]} plan. You&apos;re on {PLAN_NAME[plan]}.</p>
          {isOwner(me) && <Button className="mt-5" onClick={() => openPlanSheet(need!.plan)}>Upgrade to {PLAN_NAME[need!.plan]}</Button>}
          {!isOwner(me) && <Pill tone="neutral" className="mt-4">Ask your owner to upgrade</Pill>}
        </>
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Wordmark className="mb-8 h-8" />
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

export function Spinner() {
  return (
    <FullLoader />
  );
}

const signOutAndLeave = async () => {
  await cloudSignOut();
  window.location.href = "/login";
};

/** Only signed-in owner/staff of an active restaurant get past here. */
function AuthGate({ children }: { children: ReactNode }) {
  const cloud = useCloud();
  const me = useMe();
  const account = useAccount();
  const router = useRouter();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 8000);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (cloud.status === "signedOut" || (cloud.status === "ready" && cloud.role === "guest")) router.replace("/login");
    else if (cloud.status === "ready" && cloud.role === "superadmin") router.replace("/admin");
    else if (cloud.status === "ready" && cloud.mustChangePassword) router.replace("/login");
  }, [cloud, router]);

  if (cloud.status === "off") {
    return (
      <Centered>
        <h1 className="text-[22px] font-semibold">Setup needed</h1>
        <p className="mt-2 text-[15px] text-muted">Add the Supabase URL and publishable key to <code>.env.local</code>, then restart the app.</p>
      </Centered>
    );
  }
  if (cloud.status === "needsOnboarding") {
    return (
      <Centered>
        <h1 className="text-[22px] font-semibold">No restaurant on this login</h1>
        <p className="mt-2 text-[15px] text-muted">{cloud.email} isn&apos;t linked to a restaurant. Ask Restropi support to set up your restaurant.</p>
        <Button variant="plain" className="mt-6 !bg-sunken" onClick={signOutAndLeave}>Sign out</Button>
      </Centered>
    );
  }
  if (cloud.status === "ready" && (cloud.role === "owner" || cloud.role === "staff") && account.status === "suspended") {
    return (
      <Centered>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-soft text-rose"><Lock size={24} /></span>
        <h1 className="mt-4 text-[22px] font-semibold">{account.name || "This restaurant"} is paused</h1>
        <p className="mt-2 text-[15px] text-muted">Billing, orders and the QR menu are off for now. Renew the plan to turn it back on. Your data is safe.</p>
        {cloud.role === "owner" && <Button className="mt-6" onClick={() => openPlanSheet()}>Renew plan</Button>}
        <Button variant="plain" className="mt-3 !bg-sunken" onClick={signOutAndLeave}>Sign out</Button>
        {cloud.role === "owner" && <PlanSheet />}
      </Centered>
    );
  }
  if (cloud.status !== "ready" || (cloud.role !== "owner" && cloud.role !== "staff") || cloud.mustChangePassword || !me) {
    // signed in but the person record isn't there (removed from the team)
    if (cloud.status === "ready" && cloud.role === "staff" && waited && !me) {
      return (
        <Centered>
          <h1 className="text-[22px] font-semibold">No access</h1>
          <p className="mt-2 text-[15px] text-muted">Your access was turned off. Ask your manager.</p>
          <Button variant="plain" className="mt-6 !bg-sunken" onClick={signOutAndLeave}>Sign out</Button>
        </Centered>
      );
    }
    return <Spinner />;
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ClientOnly fallback={null}>
      <AuthGate>
        <AppFrame>{children}</AppFrame>
      </AuthGate>
    </ClientOnly>
  );
}

/** Phone only: app name in the middle (like Instagram), outlet on the left, you on the right. */
function MobileTopBar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="pt-safe sticky top-0 z-30 bg-canvas/90 backdrop-blur-xl lg:hidden">
      {/* floating dark bar: logo on the left; outlet, alerts and you on the right */}
      <div className={clsx("mx-2 mt-2 flex h-[52px] items-center gap-2 rounded-[18px] bg-[#0a0a0a] pl-4 pr-2 text-white transition-shadow", scrolled && "shadow-[0_10px_24px_-12px_rgb(0_0_0/.55)]")}>
        <Link href="/app" aria-label="Restropi home" className="mr-auto shrink-0">
          <Wordmark light className="h-[26px]" />
        </Link>
        <OutletSwitcher compact />
        <NoticeBell dark />
        <MeButton compact />
      </div>
    </div>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh lg:bg-sunken">
      <ClientOnly fallback={<div className="hidden w-[244px] shrink-0 lg:block" />}>
        <Sidebar />
      </ClientOnly>
      <main className="min-w-0 flex-1 lg:py-3 lg:pr-3">
        <div className="min-h-dvh lg:min-h-[calc(100dvh-24px)] lg:rounded-[28px] lg:bg-canvas">
          <ClientOnly>
            <MobileTopBar />
            <div aria-hidden className="h-3 lg:hidden" />
            <RenewBanner />
            <RouteGate>{children}</RouteGate>
            <PlanSheet />
            <OrderAlerts />
            <CallAlerts />
            <TableJanitor />
            <WaiterCallBar />
            <HelpSheet />
          </ClientOnly>
        </div>
      </main>
      <ClientOnly fallback={null}>
        <TabBar />
      </ClientOnly>
    </div>
  );
}

/** Kept for old imports: the phone top bar now shows who is signed in. */
export function UserChip() {
  return null;
}
