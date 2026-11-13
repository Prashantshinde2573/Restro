"use client";

import { GUEST_LANGS, tx, type GuestLang as Lang } from "@/lib/guest-lang";
import { GamesCard, GamesSheet, type GameId } from "@/components/games/games-sheet";
import { StampCard } from "@/components/stamps";
import { liveStamps, programOf, rewardOff } from "@/lib/stamps";
import { planStatus } from "@/lib/plan-status";
import { hasSizes, sizedName } from "@/lib/sizes";
import clsx from "clsx";
import { FullLoader } from "@/components/loader";
import { useParams } from "next/navigation";
import { Banknote, BellRing, Check, ChevronDown, ConciergeBell, CreditCard, Languages, Minus, Plus, QrCode, ReceiptText, Search, ShoppingBag, Users, UtensilsCrossed, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, DietMark, Sheet } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ItemSheet, makeLine, type CartLine } from "@/components/item-sheet";
import { PhotoSlide } from "@/components/menu-bits";
import { OtpSheet, type GuestProfile } from "@/components/otp-sheet";
import {
  ActiveFilters,
  MenuBar,
  DishCard,
  FilterButton,
  GuestTabs,
  FilterSheet,
  applyFilters,
  noFilters,
  sheetFilterCount,
  type MenuFilters,
} from "@/components/guest-menu";
import { PayPanel, ThankYou } from "@/components/guest-pay";
import { GuestCountScreen } from "@/components/guest-count";
import { gstRate, halfGstLabel, inr, minutesSince } from "@/lib/format";
import { isShared, tableActions, useAllTables } from "@/lib/tables";
import { callActions, cloudConfigured, feedbackActions, liveCalls, useCalls, guestActions, orderActions, orderingOpen, sessionActions, useAccount, useCategories, useFeature, useMenu, useOrders, useSettings } from "@/lib/live";
import { useReady } from "@/lib/store";
import { cloudSignOut, ensureGuest, guestStamps, useCloud } from "@/lib/cloud";
import type { MenuItem, Order, Payment, Stamp } from "@/lib/types";

const STEPS = ["Received", "Accepted", "Preparing", "Ready", "Served"] as const;
const STEPS_MR = ["मिळाली", "स्वीकारली", "बनत आहे", "तयार", "टेबलवर"] as const;
const stepOf = (s: Order["status"]) => (s === "new" ? 0 : s === "accepted" ? 1 : s === "preparing" ? 2 : s === "ready" ? 3 : 4);
const PAIRINGS: Record<string, string> = { mains: "m10", starters: "m19", rice: "m16", breads: "m6", desserts: "m21", drinks: "m4", hot: "m16" };
const sumOf = (p: Payment[]) => p.reduce((s, x) => s + x.amount, 0);
const DONE_TTL = 6 * 60 * 60 * 1000; // a finished visit stays closed on this phone for 6 hours (unless the QR is scanned again)
const num = (n: number) => (n ? n : "…"); // cloud: number arrives a moment after the order

function StatusTrack({ status, lang }: { status: Order["status"]; lang: Lang }) {
  const cur = stepOf(status);
  const labels = STEPS.map((en, i) => tx(lang, en, STEPS_MR[i]));
  return (
    <ol className="flex items-start" aria-label={`Order status: ${STEPS[cur]}`}>
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full items-center">
            <span className={clsx("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= cur ? "bg-jade" : "bg-line")} />
            <span
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                i < cur ? "bg-jade text-white" : i === cur ? "bg-jade text-white ring-4 ring-jade-soft" : "bg-sunken text-faint",
              )}
            >
              {i < cur ? <Check size={14} strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <span className={clsx("h-0.5 flex-1", i === labels.length - 1 ? "bg-transparent" : i < cur ? "bg-jade" : "bg-line")} />
          </div>
          <span className={clsx("text-center text-[11px] font-medium leading-tight", i <= cur ? "text-ink" : "text-faint")}>{l}</span>
        </li>
      ))}
    </ol>
  );
}


// While the bill is being settled by staff (cash, card, or the cash half of "Cash + UPI").
type Waiting = { ids: string[]; kind: "upi" | "cash" | "card" | "mixed"; amount: number; upiPart?: number; payFirst: boolean; claimSeen?: boolean };
type Thanks = { payments: Payment[]; orderNo?: number; orderId?: string; token?: boolean };

export default function GuestOrder() {
  const params = useParams<{ table: string }>();
  const table = decodeURIComponent(params?.table ?? "").toString().toUpperCase();
  const counter = table === "COUNTER"; // café counter QR — no table
  const toast = useToast();
  const settings = useSettings();
  const cafe = settings.businessType === "cafe" && !settings.mixed; // counter only, no tables
  const payNow = counter || settings.payFirst; // pay before the order goes to the kitchen
  // QR ordering is a Growth feature; on Starter the QR shows the menu only.
  const qrOn = useFeature("qrOrdering") === "ok";
  const menuAll = useMenu();
  const menu = useMemo(() => menuAll.filter((m) => m.available), [menuAll]);
  const cats = useCategories();
  const tables = useAllTables(); // every outlet: the QR link names the table
  const allOrders = useOrders();
  const t = counter ? undefined : tables.find((x) => x.id.toUpperCase() === table) ?? tables.find((x) => x.name.toUpperCase() === table);

  // Cloud: sign this phone in as a guest of the restaurant in the QR link (?r=…).
  const cloud = useCloud();
  const [cloudErr, setCloudErr] = useState("");
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    if (!cloudConfigured) return;
    let rid = new URLSearchParams(window.location.search).get("r");
    try {
      rid = rid ?? localStorage.getItem("restropi.rid") ?? process.env.NEXT_PUBLIC_DEFAULT_RID ?? null;
      if (rid) localStorage.setItem("restropi.rid", rid);
    } catch {}
    if (!rid) {
      setCloudErr("link");
      return;
    }
    const tryConnect = (tries: number): void =>
      void ensureGuest(rid!).catch((e: Error) => {
        if (e.message === "OTHER_RESTAURANT") return setCloudErr("other");
        if (tries > 0) return void window.setTimeout(() => tryConnect(tries - 1), 1500);
        setCloudErr("net");
      });
    tryConnect(2);
    const id = window.setTimeout(() => setWaitedLong(true), 6000);
    return () => window.clearTimeout(id);
  }, []);
  const account = useAccount();
  // Use the outlet this QR belongs to (its UPI ID, café/restaurant mode, menu prices).
  useEffect(() => {
    const o = counter ? new URLSearchParams(window.location.search).get("o") : t?.outletId;
    if (o) sessionActions.setOutlet(o);
  }, [counter, t?.outletId]);
  // a suspended or deleted restaurant never loads: give up after a while instead of spinning
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGaveUp(true), 25000);
    return () => window.clearTimeout(id);
  }, []);
  // Only call a table "not found" once the tables have really arrived from the server.
  const tablesReady = useReady("tables");
  const cloudLoading = cloudConfigured && !cloudErr && !gaveUp && (!cloud.rid || !account.name || (!counter && !t && !(tablesReady && waitedLong)));

  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const l = localStorage.getItem("restropi.guestLang");
      if (l === "en" || l === "mr" || l === "hi") setLangState(l);
    } catch {}
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("restropi.guestLang", l); } catch {}
  };
  // ---- after the bill is paid this visit is over: back / reload lands on the thank-you page, a fresh QR scan starts again ----
  const doneKey = `restropi.done.${table}`;
  const thanksUrl = () => `/order/${encodeURIComponent(params?.table ?? table)}/thanks${window.location.search}`;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const check = (fromCache: boolean) => {
      try {
        const raw = localStorage.getItem(doneKey);
        if (!raw) return;
        const at = Number(JSON.parse(raw).at) || 0;
        const nav = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
        const fresh = !fromCache && nav === "navigate"; // the QR was scanned again (or the link opened anew)
        if (fresh || Date.now() - at > DONE_TTL) return localStorage.removeItem(doneKey);
        setLeaving(true);
        window.location.replace(thanksUrl());
      } catch {}
    };
    check(false);
    const onShow = (e: PageTransitionEvent) => e.persisted && check(true); // restored from the back/forward cache
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey]);
  const [view, setView] = useState<"menu" | "browse" | "orders">("menu");
  const [moreOpen, setMoreOpen] = useState(false);
  const [game, setGame] = useState<GameId | null>(null);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<MenuFilters>(noFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [eat, setEat] = useState<"here" | "away">("here");
  const [detail, setDetail] = useState<MenuItem | null>(null);
  const [photosOf, setPhotosOf] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const afterOtp = useRef<"order" | "pay">("order");
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [ownBill, setOwnBill] = useState(false); // "we're a separate group" picked on a shared table
  const [billOpen, setBillOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false); // pay-first: pay for the cart
  const [tipPct, setTipPct] = useState(0);
  const [useReward, setUseReward] = useState(true);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [thanks, setThanks] = useState<Thanks | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  // ---- who is this phone? (its group for this visit to the table, guest profile) ----
  const storeKey = t ? `restropi.party.${t.name}.${t.visitId}` : "";
  const [myParty, setMyParty] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>([]); // counter orders placed from this phone
  const [guestCount, setGuestCount] = useState<number | null>(null); // asked right after the scan (tables only)
  const [countOpen, setCountOpen] = useState(false); // "change" from the header
  const [skipAsk, setSkipAsk] = useState(false); // just paid and tapped Done: show the menu, ask guests only if they order again
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  useEffect(() => {
    try {
      if (storeKey) setMyParty(localStorage.getItem(storeKey));
      if (storeKey) setGuestCount(Number(localStorage.getItem(storeKey + ".guests")) || null);
      const g = localStorage.getItem("restropi.guest");
      if (g) setGuest(JSON.parse(g));
      const m = localStorage.getItem("restropi.mine.counter");
      if (m) setMine(JSON.parse(m));
    } catch {}
  }, [storeKey]);
  const remember = useCallback(
    (pid: string | null) => {
      setMyParty(pid);
      try {
        if (pid) localStorage.setItem(storeKey, pid);
        else localStorage.removeItem(storeKey);
      } catch {}
    },
    [storeKey],
  );
  const pickGuests = (n: number) => {
    setGuestCount(n);
    setCountOpen(false);
    window.scrollTo({ top: 0 }); // start the menu from the top
    try { localStorage.setItem(storeKey + ".guests", String(n)); } catch {}
    // already seated: update the party so staff see the right number
    const pp = t?.parties.find((x) => x.id === myParty);
    if (t && pp && pp.guests !== n) tableActions.update(t.id, pp.id, { guests: n });
  };
  const addMine = (id: string) =>
    setMine((m) => {
      const next = [id, ...m].slice(0, 20);
      try {
        localStorage.setItem("restropi.mine.counter", JSON.stringify(next));
      } catch {}
      return next;
    });

  const party = t?.parties.find((p) => p.id === myParty);
  // "Call a waiter": this phone's latest call to this table that is still going
  const calls = useCalls();
  const myCall = t ? liveCalls(calls).find((c) => c.tableId === t.id) : undefined;
  const callWaiter = () => {
    if (!t) return;
    callActions.call({ outletId: t.outletId, tableId: t.id, tableName: t.name, partyId: myParty ?? undefined, customer: guest?.name });
    toast(tx(lang, "Calling a waiter…", "वेटरला बोलावत आहे…"));
  };
  // a new group at this table: ask how many guests before the menu
  const needCount = !!t && !counter && !party && (t.parties.length === 0 || ownBill) && !guestCount;
  const shared = t ? isShared(t) : false;
  const groupName = party ? (shared ? `Group ${party.id}` : tx(lang, "Your group", "तुमचा गट")) : "";

  const myOrders = useMemo(() => {
    // cancelled orders stay visible for an hour, so the guest knows what happened
    const keep = (o: Order) => o.status !== "cancelled" || minutesSince(o.createdAt) < 60;
    if (counter) return allOrders.filter((o) => mine.includes(o.id) && keep(o) && minutesSince(o.createdAt) < 240);
    return t && myParty
      ? allOrders.filter((o) => o.tableName === t.name && (o.partyId ?? "A") === myParty && keep(o) && (o.status !== "paid" || o.guestPhone))
      : [];
  }, [allOrders, t, myParty, counter, mine]);
  const openOrders = useMemo(() => myOrders.filter((o) => o.status !== "paid" && o.status !== "cancelled"), [myOrders]);
  // This visit's orders on top; finished orders from earlier visits go under "Previous orders".
  const [nowOrders, pastOrders] = useMemo(() => {
    const visitFrom = party ? Date.parse(party.since) - 60_000 : null;
    const done = (o: Order) => o.status === "paid" || o.status === "cancelled" || (counter && o.status === "served");
    const past = (o: Order) => done(o) && (visitFrom != null ? Date.parse(o.createdAt) < visitFrom : minutesSince(o.createdAt) > 30);
    return [myOrders.filter((o) => !past(o)), myOrders.filter(past)];
  }, [myOrders, party, counter]);
  const [showPast, setShowPast] = useState(false);
  // stamp card: the program, and this guest's own stamps
  const stampsFeature = useFeature("stamps") === "ok";
  const stampProg = stampsFeature && settings.stamps?.on ? programOf(settings.stamps) : null;
  const [myStamps, setMyStamps] = useState<number | null>(null);
  useEffect(() => {
    if (!stampProg) return;
    let live = true;
    guestStamps().then((r) => {
      if (live && r) setMyStamps(r.stamps.length ? liveStamps({ stamps: r.stamps as Stamp[] }, stampProg).length : r.rewards ? 0 : null);
    });
    return () => {
      live = false;
    };
  }, [!!stampProg, myOrders.length, openOrders.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const stampCard = stampProg ? (
    <div>
      <StampCard
        have={myStamps ?? 0}
        needed={stampProg.needed}
        reward={stampProg.reward}
        title={tx(lang, "Your stamp card", "तुमचं स्टॅम्प कार्ड")}
        note={
          myStamps == null
            ? tx(lang, `A stamp on every bill with your number. ${stampProg.needed} stamps = ${stampProg.reward}.`, `तुमच्या नंबरच्या प्रत्येक बिलावर एक स्टॅम्प. ${stampProg.needed} स्टॅम्प = ${stampProg.reward}.`)
            : myStamps >= stampProg.needed
              ? payNow || counter
                ? tx(lang, `Card full! Show this to our staff when you pay — ${stampProg.reward} on this bill.`, `कार्ड भरलं! पैसे भरताना हे स्टाफला दाखवा — या बिलावर ${stampProg.reward}.`)
                : tx(lang, `Card full! When you tap Pay, your ${stampProg.reward} comes off the bill.`, `कार्ड भरलं! "भरा" दाबल्यावर ${stampProg.reward} बिलातून कमी होईल.`)
              : tx(lang, `${stampProg.needed - myStamps} more to go for ${stampProg.reward}`, `${stampProg.reward} साठी अजून ${stampProg.needed - myStamps}`)
        }
      />
      {stampProg.terms && <p className="mt-1.5 px-1 text-[12px] text-muted">{stampProg.terms}</p>}
    </div>
  ) : null;
  // When an order reaches the table, open "My orders": that's where the bill and Pay are.
  const ordersReadyEarly = useReady("orders");
  const served = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!ordersReadyEarly) return;
    const now = new Set(myOrders.filter((o) => o.status === "served").map((o) => o.id));
    if (served.current === null) {
      served.current = now; // what was already served when the page opened
      return;
    }
    const fresh = [...now].some((id) => !served.current!.has(id));
    served.current = now;
    if (fresh && !payNow) {
      setView("orders");
      setCartOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast(tx(lang, "Served · your bill and Pay are here", "टेबलवर आली · बिल आणि पेमेंट इथे आहे"));
    }
  }, [myOrders, ordersReadyEarly]); // eslint-disable-line react-hooks/exhaustive-deps
  // Restaurant flow: the running bill. Pay-first orders are already settled from the phone.
  const unbilled = useMemo(() => openOrders.filter((o) => !(o.prepaid ?? []).length && !o.payClaim && !(payNow && o.payPreference)), [openOrders, payNow]);
  // where this phone's bill stands: nothing to pay / payment sent (restaurant confirms) / paid
  const sentClaim = openOrders.find((o) => o.payClaim)?.payClaim;
  // pay at the end: the bill opens only once the kitchen has accepted every order on it
  const awaitingKitchen = !payNow && unbilled.some((o) => o.status === "new");
  const paidOrders = myOrders.filter((o) => o.status === "paid");
  const billState: "open" | "sent" | "paid" | "none" = unbilled.length ? "open" : sentClaim ? "sent" : paidOrders.length && !openOrders.length ? "paid" : "none";
  const paidTotal = paidOrders.reduce((s, o) => s + (o.payments?.reduce((a, p) => a + p.amount, 0) ?? 0), 0);
  // Bill settled (pay at the end): close this visit on the phone and go to the thank-you page.
  const finishing = useRef(false);
  const finishVisit = (pays: Payment[], orderNo?: number) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      localStorage.setItem(doneKey, JSON.stringify({ at: Date.now() }));
      localStorage.setItem(
        `restropi.thanks.${table}`,
        JSON.stringify({ place: settings.name, logo: settings.logo ?? "", name: guest?.name ?? "", payments: pays, orderNo: orderNo ?? 0, lang, rid: cloud.rid ?? "", at: Date.now() }),
      );
    } catch {}
    setLeaving(true);
    window.location.replace(thanksUrl());
  };
  // The restaurant marked the bill paid while this page was open (e.g. paid to the captain without tapping Pay here).
  const lastBill = useRef(billState);
  const lastOpen = useRef<string[]>([]);
  useEffect(() => {
    const was = lastBill.current;
    lastBill.current = billState;
    const openIds = lastOpen.current;
    if (payNow || counter || billState !== "paid" || (was !== "open" && was !== "sent")) return;
    const settled = paidOrders.filter((o) => openIds.includes(o.id));
    const pays = (settled.length ? settled : paidOrders).flatMap((o) => o.payments ?? []);
    finishVisit(pays, (settled[0] ?? paidOrders[0])?.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billState]);
  useEffect(() => {
    if (openOrders.length) lastOpen.current = openOrders.map((o) => o.id); // the bill that's being settled
  }, [openOrders]);

  // ---- settling: show the thank-you once the money is confirmed ----
  // Remember a payment we are waiting on, so a reload keeps the "being confirmed" screen.
  const waitKey = `restropi.waiting.${table}`;
  const ordersReady = ordersReadyEarly;
  useEffect(() => {
    try {
      const w = localStorage.getItem(waitKey);
      const saved = w ? (JSON.parse(w) as Waiting & { at?: number }) : null;
      // only a recent one (a few hours): old leftovers are dropped
      if (saved && saved.at && Date.now() - saved.at < 6 * 3600_000) setWaiting(saved);
      else if (w) localStorage.removeItem(waitKey);
    } catch {}
  }, [waitKey]);
  useEffect(() => {
    try {
      if (waiting && !waiting.payFirst) localStorage.setItem(waitKey, JSON.stringify({ ...waiting, at: Date.now() }));
      else localStorage.removeItem(waitKey);
    } catch {}
  }, [waiting, waitKey]);
  useEffect(() => {
    if (!waiting) return;
    const os = allOrders.filter((o) => waiting.ids.includes(o.id));
    if (!os.length) {
      if (ordersReady) setWaiting(null); // a saved wait for orders this phone can't see any more
      return;
    }
    const payments: Payment[] =
      waiting.kind === "mixed"
        ? [{ method: "upi", amount: waiting.upiPart ?? 0 }, { method: "cash", amount: waiting.amount - (waiting.upiPart ?? 0) }]
        : [{ method: waiting.kind, amount: waiting.amount }];
    if (waiting.payFirst) {
      // Pay-first: staff accept the order once they have the cash/card payment at the counter.
      if (os.every((o) => o.status !== "new")) {
        setThanks({ payments, orderNo: os[0].number, orderId: os[0].id, token: true });
        setWaiting(null);
        setConfirmed(null);
      }
      return;
    }
    // Pay at the end: say thank you only once the owner has confirmed the money (the bill is paid).
    if (os.every((o) => o.status === "paid" || o.status === "cancelled") && os.some((o) => o.status === "paid")) {
      const paid = os.find((o) => o.status === "paid")!;
      setWaiting(null);
      try { localStorage.removeItem(waitKey); } catch {}
      finishVisit(paid.payments ?? payments, paid.number);
      return;
    }
    const claimed = os.some((o) => !!o.payClaim);
    if (claimed && !waiting.claimSeen) setWaiting({ ...waiting, claimSeen: true });
    else if (!claimed && waiting.claimSeen) {
      // the owner tapped "Not received": the bill is open again
      setWaiting(null);
      setBillOpen(true);
      toast(tx(lang, "The restaurant hasn't received this payment yet. Please check and pay again, or ask our staff.", "रेस्टॉरंटला अजून हे पैसे मिळालेले नाहीत. तपासून पुन्हा भरा, किंवा स्टाफला विचारा."));
    }
  }, [waiting, allOrders, ordersReady]);



  // ---- menu: search + filters ----
  const shownItems = useMemo(() => applyFilters(menu, filters, q, cats), [menu, filters, q, cats]);
  const grouped = useMemo(
    () => cats.map((c) => ({ c, items: shownItems.filter((m) => m.categoryId === c.id) })).filter((g) => g.items.length),
    [cats, shownItems],
  );
  const filtering = !!q.trim() || sheetFilterCount(filters) > 0;

  // height of the sticky search bar, so the side bar and section jumps sit right under it
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(68);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarH(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  // side bar follows the scroll
  useEffect(() => {
    if (view !== "menu") return;
    if (!grouped.length) return;
    // the last section whose heading has reached the search bar; the last one at the very bottom
    // (sections are looked up each time: they appear only after the page finishes loading)
    let raf = 0;
    const pick = () => {
      raf = 0;
      const els = grouped.map((g) => document.getElementById(`cat-${g.c.id}`)).filter(Boolean) as HTMLElement[];
      if (!els.length) return;
      const line = barH + 24;
      let cur = els[0];
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = els[els.length - 1];
      setActiveCat(cur.id.replace("cat-", ""));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    const again = window.setTimeout(pick, 400); // after the menu shows
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.clearTimeout(again);
      window.removeEventListener("scroll", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [grouped, view, barH, cloudLoading]);
  /** Menu tab → a category: back to home, scrolled to it. */
  const openCat = (id: string) => {
    setQ("");
    setFilters((f) => ({ ...f, cats: [] }));
    setView("menu");
    window.setTimeout(() => {
      setActiveCat(id);
      document.getElementById(`cat-${id}`)?.scrollIntoView({ block: "start" });
    }, 60);
  };
  const jumpTo = (id: string) => {
    setActiveCat(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const qtyOf = (id: string) => cart.filter((l) => l.item.id === id).reduce((s, l) => s + l.qty, 0);
  const addLine = (line: CartLine) =>
    setCart((c) => {
      const i = c.findIndex((x) => x.key === line.key);
      return i >= 0 ? c.map((x, j) => (j === i ? { ...x, qty: x.qty + line.qty } : x)) : [...c, line];
    });
  const changeLine = (key: string, d: number) => setCart((c) => c.flatMap((x) => (x.key !== key ? [x] : x.qty + d <= 0 ? [] : [{ ...x, qty: x.qty + d }])));
  const tapAdd = (m: MenuItem) => {
    // after paying and leaving, a new order at this table asks for the number of guests again
    if (needCount && skipAsk) return setSkipAsk(false);
    return m.options?.length || hasSizes(m) ? setDetail(m) : addLine(makeLine(m, 1));
  };
  const tapLess = (m: MenuItem) => {
    const last = [...cart].reverse().find((l) => l.item.id === m.id);
    if (last) changeLine(last.key, -1);
  };

  const count = cart.reduce((s, l) => s + l.qty, 0);
  const itemTotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const gst = Math.round(itemTotal * gstRate() * 100) / 100;
  const payable = Math.round(itemTotal + gst);

  const pairing = useMemo(() => {
    if (!cart.length) return null;
    const ids = new Set(cart.map((l) => l.item.id));
    for (const l of cart) {
      const pid = PAIRINGS[l.item.categoryId];
      const m = pid ? menu.find((x) => x.id === pid) : undefined;
      if (m && !ids.has(m.id)) return m;
    }
    return null;
  }, [cart, menu]);

  // ---- placing an order ----
  const sendOrder = (g: GuestProfile, extra: Partial<Order> = {}): Order => {
    let p = party;
    if (t && !p) {
      // New phone = new group on this table. Its first order waits for staff to
      // accept — unless it's already paid from the phone (a paid order is no prank).
      p = tableActions.seat(t.id, guestCount ?? 1, { source: "qr", phoneClaimed: true, pendingApproval: !extra.prepaid, server: undefined });
      remember(p.id);
    }
    const order = orderActions.add({
      type: (cafe || counter) && eat === "away" ? "takeaway" : "dine-in",
      channel: "qr",
      tableId: t?.id,
      tableName: t?.name ?? "Counter",
      partyId: p?.id,
      customer: g.name,
      guestPhone: g.phone,
      staff: "QR",
      createdAt: new Date().toISOString(),
      status: p?.pendingApproval ? "new" : "accepted",
      lines: cart.map((l) => ({
        itemId: l.item.id,
        name: sizedName(l.item.name, l.size),
        qty: l.qty,
        price: l.unitPrice,
        station: l.item.station,
        note: [...l.options, ...(note ? [note] : [])].join(" · ") || undefined,
      })),
      ...extra,
    });
    if (t && p) {
      const cur = tables.find((x) => x.id === t.id)?.parties.find((x) => x.id === p!.id);
      tableActions.update(t.id, p.id, { status: "ordered", total: (cur?.total ?? 0) + itemTotal });
    }
    if (counter) addMine(order.id);
    guestActions.upsert(g.name, g.phone, g.optIn);
    setCart([]);
    setNote("");
    setCartOpen(false);
    return order;
  };

  // Table QR ordering only in the opening hours (Settings → Details on bills), and not while paused.
  const [, tickHours] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tickHours((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  // opening hours apply to table QR only; the counter QR takes orders any time (pause still stops both)
  const hours = orderingOpen(counter ? { ordersPaused: settings.ordersPaused } : settings);
  const isOpen = hours.open;
  const closedText = hours.open
    ? ""
    : hours.why === "paused"
      ? tx(lang, "Ordering from the phone is paused right now. Please order with our staff.", "आत्ता फोनवरून ऑर्डर बंद आहे. कृपया स्टाफकडे ऑर्डर द्या.")
      : tx(lang, `You can browse the menu — ordering opens at ${hours.opensAt}.`, `मेनू पाहू शकता — ऑर्डर ${hours.opensAt} पासून.`);
  // After a table order: straight to My orders — live status, the bill so far and the games are all there.
  const showMyOrders = () => {
    setCartOpen(false);
    setView("orders");
    window.scrollTo({ top: 0 });
    toast(tx(lang, "Order placed", "ऑर्डर पाठवली"));
  };
  const placeOrder = () => {
    if (!isOpen) return toast(closedText);
    if (payNow) {
      if (!guest) {
        afterOtp.current = "pay";
        return setOtpOpen(true);
      }
      setCartOpen(false);
      return setPayOpen(true);
    }
    if (!guest) {
      afterOtp.current = "order";
      return setOtpOpen(true);
    }
    sendOrder(guest);
    showMyOrders();
  };

  // ---- pay-first outcomes (café) ----
  const payFirstUpi = () => {
    if (!guest) return;
    const o = sendOrder(guest, { prepaid: [{ method: "upi", amount: payable }], payPreference: "upi", status: "accepted" });
    setPayOpen(false);
    setThanks({ payments: [{ method: "upi", amount: payable }], orderNo: o.number, orderId: o.id, token: true });
  };
  const payFirstLater = (kind: "cash" | "card" | "mixed", upiPart?: number) => {
    if (!guest) return;
    const o = sendOrder(guest, {
      status: "new",
      payPreference: kind === "card" ? "card" : "cash",
      ...(kind === "mixed" && upiPart ? { prepaid: [{ method: "upi" as const, amount: upiPart }] } : {}),
    });
    setPayOpen(false);
    setWaiting({ ids: [o.id], kind, amount: payable, upiPart, payFirst: true });
    setConfirmed(o.id);
  };

  // ---- the group's bill (restaurant flow) ----
  const billItems = unbilled.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty * l.price, 0), 0);
  // a full stamp card: the guest can use the reward on this bill (on by default; the restaurant confirms it with the payment)
  const rewardReady = !!stampProg && myStamps != null && myStamps >= stampProg.needed;
  const rewardAmt = rewardReady && useReward ? rewardOff(stampProg!, billItems, menuAll) : 0;
  const billTaxable = Math.max(0, billItems - rewardAmt);
  const billGst = Math.round(billTaxable * gstRate() * 100) / 100;
  const tip = Math.round((billItems * tipPct) / 100);
  const billTotal = Math.round(billTaxable + billGst + tip);
  const billIds = unbilled.map((o) => o.id);
  const who = guest?.name ?? "Guest";

  const billUpi = () => {
    orderActions.setPreference(billIds, "upi");
    // The restaurant checks the money came in and confirms; the table closes then.
    orderActions.settle(billIds, [{ method: "upi", amount: billTotal }], who, {
      source: "guest",
      ...(rewardAmt > 0 ? { discount: rewardAmt, reward: { name: stampProg!.reward, amount: rewardAmt } } : {}),
    });
    if (t && party) tableActions.update(t.id, party.id, { status: "billing", paymentPending: true });
    // stay on the bill: it says "being confirmed" until the owner confirms, then thank you
    setWaiting({ ids: billIds, kind: "upi", amount: billTotal, payFirst: false, claimSeen: true });
  };
  const billLater = (kind: "cash" | "card" | "mixed", upiPart?: number) => {
    if (rewardReady) orderActions.askReward(billIds, rewardAmt > 0); // staff see "use the reward" already on at checkout
    if (kind === "mixed" && upiPart) orderActions.prepay(billIds, { method: "upi", amount: upiPart }, who);
    else orderActions.setPreference(billIds, kind === "card" ? "card" : "cash");
    if (t && party) tableActions.update(t.id, party.id, { status: "billing" });
    setWaiting({ ids: billIds, kind, amount: billTotal, upiPart, payFirst: false });
  };

  const confirmedOrder = allOrders.find((o) => o.id === confirmed);
  const thanksOrder = thanks?.orderId ? allOrders.find((o) => o.id === thanks.orderId) : undefined;

  if (leaving) return <FullLoader label="Thank you" />;
  if (cloudLoading) {
    return (
      <FullLoader label="Loading menu" />
    );
  }
  if (cloudErr || !account.name || (!t && !counter) || planStatus(account).locked) {
    // say what actually went wrong, so the guest (or the owner testing) knows what to do
    const why: { title: string; body: string; action?: { label: string; run: () => void } } =
      cloudErr === "other"
        ? {
            title: "You're signed in to another restaurant",
            body: "This phone is signed in to a Restropi account of a different restaurant, so it can't open this menu. Sign out to open it as a guest, or scan with another phone.",
            action: { label: "Sign out and open the menu", run: () => void cloudSignOut().finally(() => window.location.reload()) },
          }
        : cloudErr === "net" || (!account.name && !cloudErr)
          ? {
              title: "Couldn't open the menu",
              body: "Check your internet and try again. If it keeps happening, please ask a staff member — this QR may no longer be active.",
              action: { label: "Try again", run: () => window.location.reload() },
            }
          : cloudErr === "link"
            ? { title: "This QR code isn't complete", body: "It is missing the restaurant link. Please ask a staff member for a new QR code." }
            : account.status === "suspended" || planStatus(account).locked
              ? { title: "Ordering is paused", body: "This restaurant isn't taking orders on this QR right now. Please order with our staff." }
              : {
                  title: "This QR code isn't active",
                  body: "This table may have been removed or renamed. Please ask a staff member for help, or scan the code on your table again.",
                  action: { label: "Try again", run: () => window.location.reload() },
                };
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-canvas px-6 text-center">
        <QrCode size={32} className="text-muted" />
        <div className="mt-3 text-[20px] font-semibold">{why.title}</div>
        <p className="mt-2 text-[15px] text-muted">{why.body}</p>
        {why.action && (
          <Button size="lg" className="mt-6" onClick={why.action.run}>{why.action.label}</Button>
        )}
      </div>
    );
  }

  const statusLine = (s: Order["status"]) =>
    s === "new"
      ? payNow ? tx(lang, "Waiting for your payment at the counter", "काउंटरवर पेमेंटची वाट") : tx(lang, "Waiting for staff to accept", "स्टाफ ऑर्डर पाहत आहे")
      : s === "accepted"
        ? tx(lang, "Accepted — sent to the kitchen", "स्वीकारली — किचनला गेली")
        : s === "preparing"
          ? tx(lang, "Being prepared", "बनत आहे")
          : s === "ready"
            ? cafe || counter ? tx(lang, "Ready — collect it at the counter", "तयार — काउंटरवरून घ्या") : tx(lang, "Ready — on its way", "तयार — येत आहे")
            : s === "paid"
              ? tx(lang, "Done. Enjoy!", "झालं. आनंद घ्या!")
              : tx(lang, "Served. Enjoy your meal!", "टेबलवर आली");

  const placeLabel = counter ? tx(lang, "Counter", "काउंटर") : `${tx(lang, "Table", "टेबल")} ${t!.name}`;
  const cashWhere = payNow ? "counter" : "table";

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-canvas pb-[140px] sm:max-w-2xl">
      {/* ---------- how many guests (table orders, before the menu) ---------- */}
      {t && !counter && qrOn && isOpen && !thanks && !waiting && ((needCount && !skipAsk) || countOpen) && (
        <GuestCountScreen
          place={placeLabel}
          restaurant={settings.name}
          lang={lang}
          initial={party?.guests ?? guestCount}
          onPick={pickGuests}
          onClose={countOpen ? () => setCountOpen(false) : ownBill && !party ? () => setOwnBill(false) : undefined}
        />
      )}

      {/* ---------- header ---------- */}
      <header className="px-4 pb-1 pt-4">
        <div className="flex items-center justify-between gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/restropi-logo-dark.png" alt="Restropi" width={597} height={180} className="h-[26px] w-auto select-none" draggable={false} />
          <div className="flex items-center gap-1">
            <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-canvas">
              {placeLabel}
              {party && shared && <> · {groupName}</>}
            </span>
            <button onClick={() => setMoreOpen(true)} aria-label={tx(lang, "More", "अधिक")} className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full active:bg-sunken">
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M4 10h20M10 18h14" /></svg>
            </button>
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          {settings.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo} alt={`${settings.name} logo`} className="h-12 w-12 shrink-0 rounded-[14px] bg-white object-contain p-1 ring-1 ring-line" />
          )}
          <h1 className="min-w-0 text-[24px] font-bold leading-tight tracking-tight">{settings.name}</h1>
        </div>
        <p className="mt-0.5 text-[13.5px] text-ink/70">
          {payNow
            ? tx(lang, "Order and pay from your phone. We'll call your token when it's ready.", "फोनवरून ऑर्डर करा आणि पैसे भरा. तयार झालं की टोकन बोलावू.")
            : tx(lang, "Order from your phone. We'll bring it to your table.", "फोनवरून ऑर्डर करा. आम्ही टेबलवर आणू.")}
        </p>
        {myCall && (
          <div className="mt-2.5 flex">
            <span className={clsx("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold", myCall.status === "taken" ? "bg-jade-soft text-jade-deep" : "bg-saffron-soft text-saffron")}>
              <BellRing size={13} /> {myCall.status === "taken" ? tx(lang, `${myCall.toName ?? "Waiter"} is coming`, `${myCall.toName ?? "वेटर"} येत आहे`) : tx(lang, "Waiter called", "वेटरला बोलावलं")}
            </span>
          </div>
        )}

        {t && qrOn && !payNow && !cafe && (party ? (
          shared ? (
            <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-surface px-4 py-3 text-[13.5px]">
              <Users size={18} className="shrink-0 text-jade" />
              <span><b>{groupName}</b>{guest ? ` · ${guest.name}` : ""} <span className="text-muted">· {tx(lang, "your own bill at this table", "या टेबलवर तुमचं स्वतंत्र बिल")}</span></span>
            </div>
          ) : null
        ) : t.parties.length > 0 && !ownBill ? (
          <div className="mt-4 rounded-[18px] bg-surface p-4">
            <div className="text-[15px] font-semibold">{tx(lang, "Someone is already at this table", "या टेबलवर आधीच कोणी बसलं आहे")}</div>
            <p className="mt-0.5 text-[13.5px] text-muted">{tx(lang, "Are you with them? Then you share one bill.", "तुम्ही त्यांच्यासोबत आहात का? मग एकच बिल.")}</p>
            <div className="mt-3 grid gap-2">
              {t.parties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { tableActions.update(t.id, p.id, { phoneClaimed: true }); remember(p.id); toast(tx(lang, "Joined · you're on the same bill", "जोडलं · एकच बिल")); }}
                  className="flex items-center gap-3 rounded-[14px] bg-jade px-4 py-3 text-left text-white active:scale-[.99]"
                >
                  <Users size={18} className="shrink-0" />
                  <span className="flex-1 text-[14.5px] font-semibold">
                    {t.parties.length > 1 ? tx(lang, `Yes, join Group ${p.id}`, `हो, ग्रुप ${p.id} मध्ये जोडा`) : tx(lang, "Yes, we're together", "हो, आम्ही सोबत आहोत")}
                    <span className="block text-[12.5px] font-normal opacity-80">{p.guests} {p.guests > 1 ? tx(lang, "guests", "जण") : tx(lang, "guest", "जण")}{p.total ? ` · ${inr(Math.round(p.total * (1 + gstRate())))}` : ""}</span>
                  </span>
                </button>
              ))}
              <button onClick={() => setOwnBill(true)} className="rounded-[14px] bg-sunken px-4 py-3 text-left text-[14.5px] font-semibold">
                {tx(lang, "No, we're a separate group", "नाही, आम्ही वेगळे आहोत")}
                <span className="block text-[12.5px] font-normal text-muted">{tx(lang, "You get your own bill", "तुमचं स्वतंत्र बिल")}</span>
              </button>
            </div>
          </div>
        ) : null)}
      </header>

      {!qrOn && (
        <div className="mx-4 mb-3 rounded-[18px] bg-sky-soft px-4 py-3 text-[14px] text-sky">
          {tx(lang, "Browse the menu here — please order with our staff.", "इथे मेनू पहा — ऑर्डर स्टाफकडे द्या.")}
        </div>
      )}

      {qrOn && !isOpen && (
        <div className="mx-4 mb-3 rounded-[18px] bg-saffron-soft px-4 py-3 text-[14px]">
          <b>{hours.open ? "" : hours.why === "paused" ? tx(lang, "Orders paused.", "ऑर्डर थांबवल्या आहेत.") : tx(lang, "We're closed right now.", "आत्ता ऑर्डर बंद आहे.")}</b> {closedText}
        </div>
      )}

      {view === "menu" ? (
        /* ---------- home: diet ▾ · category ▾ · filters, then dish cards ---------- */
        <>
          <div ref={barRef} className="sticky top-0 z-20 bg-canvas/95 px-4 pb-2 pt-2.5 backdrop-blur">
            <MenuBar
              diet={filters.diet}
              onDiet={(d) => setFilters({ ...filters, diet: d })}
              menu={menu}
              groups={grouped.map((g) => ({ c: g.c, n: g.items.length }))}
              active={activeCat}
              onPick={jumpTo}
              filterCount={sheetFilterCount({ ...filters, diet: "all" })}
              onFilters={() => setFilterOpen(true)}
              lang={lang}
            />
            {(q.trim() || sheetFilterCount({ ...filters, diet: "all" }) > 0) && (
              <div className="mt-2 flex items-center gap-2">
                {q.trim() && (
                  <button onClick={() => setQ("")} className="flex shrink-0 items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-2 text-[13px] font-semibold text-canvas">
                    “{q.trim()}” <X size={13} />
                  </button>
                )}
                <div className="min-w-0 flex-1"><ActiveFilters f={{ ...filters, diet: "all" }} setF={(f) => setFilters({ ...f, diet: filters.diet })} cats={cats} lang={lang} /></div>
              </div>
            )}
          </div>
          <main className="space-y-6 px-4 pb-4 pt-2.5">
            {grouped.length === 0 && (
              <div className="py-16 text-center">
                <div className="text-[16px] font-semibold">{tx(lang, "No dishes match", "काही सापडलं नाही")}</div>
                <button onClick={() => { setQ(""); setFilters(noFilters); }} className="mt-2 text-[14px] font-semibold text-jade">{tx(lang, "Clear search and filters", "शोध आणि फिल्टर काढा")}</button>
              </div>
            )}
            {grouped.map(({ c, items }) => (
              <section key={c.id} id={`cat-${c.id}`} style={{ scrollMarginTop: barH + 8 }}>
                <h2 className="mb-2.5 flex items-center gap-2 px-0.5">
                  {c.icon ? <span aria-hidden className="text-[18px] leading-none">{c.icon}</span> : <ConciergeBell size={20} strokeWidth={1.8} className="text-jade-deep" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight">{c.name}</span>
                  <span className="shrink-0 text-[12.5px] font-semibold text-ink/60 tnum">{items.length} {items.length === 1 ? tx(lang, "item", "डिश") : tx(lang, "items", "डिश")}</span>
                </h2>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {items.map((m) => (
                    <DishCard key={m.id} m={m} qty={qtyOf(m.id)} onOpen={() => setDetail(m)} onAdd={() => tapAdd(m)} onLess={() => tapLess(m)} lang={lang} readOnly={!qrOn || !isOpen} />
                  ))}
                </div>
              </section>
            ))}
            <PoweredBy />
          </main>
        </>
      ) : view === "browse" ? (
        /* ---------- menu tab: search, filters, every category ---------- */
        <main className="px-4 pt-2">
          <div className="sticky top-0 z-20 -mx-4 flex gap-2 bg-canvas/95 px-4 pb-3 pt-2 backdrop-blur">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                enterKeyHint="search"
                placeholder={tx(lang, "Search dishes", "डिश शोधा")}
                className="h-11 w-full rounded-full bg-surface pl-10 pr-9 text-[15px] outline-none ring-1 ring-line placeholder:text-faint focus:ring-1 focus:ring-jade/40 [&::-webkit-search-cancel-button]:hidden"
              />
              {q && <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-faint"><X size={15} /></button>}
            </div>
            <FilterButton count={sheetFilterCount(filters)} onClick={() => setFilterOpen(true)} lang={lang} />
          </div>
          {filtering ? (
            <>
              <div className="mb-3 flex items-baseline justify-between px-0.5">
                <span className="text-[15px] font-semibold">{tx(lang, `${shownItems.length} dishes`, `${shownItems.length} डिश`)}</span>
                <button onClick={() => { setQ(""); setFilters(noFilters); }} className="text-[13.5px] font-semibold text-jade">{tx(lang, "Clear", "काढा")}</button>
              </div>
              <ActiveFilters f={filters} setF={setFilters} cats={cats} lang={lang} />
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {shownItems.map((m) => (
                  <DishCard key={m.id} m={m} qty={qtyOf(m.id)} onOpen={() => setDetail(m)} onAdd={() => tapAdd(m)} onLess={() => tapLess(m)} lang={lang} readOnly={!qrOn || !isOpen} />
                ))}
              </div>
              {shownItems.length === 0 && <p className="py-12 text-center text-[15px] text-muted">{tx(lang, "No dishes match", "काही सापडलं नाही")}</p>}
            </>
          ) : (
            <>
              <h2 className="mb-2.5 px-0.5 text-[17px] font-bold tracking-tight">{tx(lang, "Categories", "प्रकार")}</h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {cats.map((c) => {
                  const n = menu.filter((m) => m.categoryId === c.id).length;
                  if (!n) return null;
                  const cover = menu.find((m) => m.categoryId === c.id && m.photos?.length) ?? menu.find((m) => m.categoryId === c.id)!;
                  return (
                    <button key={c.id} onClick={() => openCat(c.id)} className="overflow-hidden rounded-[16px] bg-surface text-left ring-1 ring-line/70 active:scale-[.98]">
                      <PhotoSlide item={cover} className="aspect-[16/10] w-full" />
                      <span className="flex items-center gap-1.5 px-2.5 py-2">
                        {c.icon && <span aria-hidden className="text-[18px]">{c.icon}</span>}
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{c.name}</span>
                        <span className="text-[12.5px] font-semibold text-muted tnum">{n}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </main>
      ) : (
        /* ---------- my orders ---------- */
        <main className="space-y-3 px-4 pt-3">
          {(billState === "sent" || billState === "paid") && (
            <BillDone state={billState} claimTotal={sentClaim ? sentClaim.payments.reduce((a, p) => a + p.amount, 0) : 0} paidTotal={paidTotal} lang={lang} compact />
          )}
          {nowOrders.length === 0 && (
            <div className="flex flex-col items-center rounded-[22px] bg-surface px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-muted"><ReceiptText size={24} /></span>
              <div className="mt-3 text-[17px] font-semibold">{tx(lang, "No orders yet", "अजून ऑर्डर नाही")}</div>
              <p className="mt-1 max-w-xs text-[14px] text-muted">{tx(lang, "Add dishes from the menu and place your order. You can follow it here, and pay the bill from here too.", "मेनूमधून डिश जोडा आणि ऑर्डर द्या. ऑर्डरची स्थिती आणि बिल इथेच दिसेल.")}</p>
              <Button size="lg" className="mt-5" onClick={() => { setView("menu"); window.scrollTo({ top: 0 }); }}><UtensilsCrossed size={17} /> {tx(lang, "See the menu", "मेनू पहा")}</Button>
            </div>
          )}
          {nowOrders.map((o) => (
            <section key={o.id} className="rounded-[22px] bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[16px] font-semibold">{payNow ? tx(lang, "Token", "टोकन") : tx(lang, "Order", "ऑर्डर")} #{num(o.number)}</span>
                <span className="text-[13px] text-muted">{o.type === "takeaway" ? tx(lang, "Take away · ", "पार्सल · ") : ""}{o.customer} · {minutesSince(o.createdAt)} min</span>
              </div>
              <ul className="mt-2 space-y-1 text-[14px]">
                {o.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      {l.qty}× {l.name}
                      {l.note && <span className="block text-[12.5px] text-muted">{l.note}</span>}
                    </span>
                    <span className="shrink-0 text-muted tnum">{inr(l.qty * l.price)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                {o.status === "cancelled" ? (
                  <span className="inline-flex rounded-full bg-rose-soft px-2.5 py-1 text-[12.5px] font-semibold text-rose">{tx(lang, "Not accepted by the restaurant · please ask our staff", "रेस्टॉरंटने स्वीकारली नाही · स्टाफला विचारा")}</span>
                ) : o.status === "paid" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-jade-soft px-2.5 py-1 text-[12.5px] font-semibold text-jade-deep"><Check size={13} /> {tx(lang, "Paid", "पैसे भरले")}</span>
                ) : o.payClaim ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-saffron-soft px-2.5 py-1 text-[12.5px] font-semibold text-saffron">{tx(lang, "Payment sent · being confirmed", "पैसे पाठवले · खात्री होत आहे")}</span>
                ) : (
                  <>
                    {(o.prepaid ?? []).length > 0 && <div className="mb-2 text-[12.5px] font-semibold text-jade">{tx(lang, `UPI ${inr(sumOf(o.prepaid!))} paid`, `UPI ${inr(sumOf(o.prepaid!))} भरले`)}</div>}
                    <div className="mb-2 text-[13px] font-medium text-muted">{statusLine(o.status)}</div>
                    <StatusTrack status={o.status} lang={lang} />
                  </>
                )}
              </div>
            </section>
          ))}
          {!payNow && unbilled.length > 0 && (
            <div className="flex items-baseline justify-between px-1 pt-1 text-[15px]">
              <span className="text-muted">{tx(lang, "Bill so far", "आतापर्यंतचं बिल")} · incl. GST</span>
              <span className="text-[20px] font-semibold tnum">{inr(Math.round(billItems * (1 + gstRate())))}</span>
            </div>
          )}
          {openOrders.some((o) => o.status !== "served") && <GamesCard onGame={setGame} lang={lang} />}
          {!counter && (
            myCall?.status === "taken" ? (
              <div className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-jade-soft py-3.5 text-[15px] font-semibold text-jade-deep">
                <Check size={17} /> {tx(lang, `${myCall.toName ?? "A waiter"} is coming to your table`, `${myCall.toName ?? "वेटर"} तुमच्या टेबलवर येत आहे`)}
              </div>
            ) : myCall?.status === "open" ? (
              <div className="flex w-full items-center gap-2 rounded-[18px] bg-saffron-soft py-2 pl-4 pr-2 text-saffron">
                <BellRing size={17} className="animate-pulse" />
                <span className="flex-1 text-[15px] font-semibold">{tx(lang, "Calling a waiter…", "वेटरला बोलावत आहे…")}</span>
                <button onClick={() => callActions.cancel(myCall.id)} className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink">{tx(lang, "Cancel", "रद्द करा")}</button>
              </div>
            ) : (
              <button onClick={callWaiter} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-surface py-3.5 text-[15px] font-semibold">
                <BellRing size={17} /> {tx(lang, "Call a waiter", "वेटरला बोलवा")}
              </button>
            )
          )}
          {stampCard}
          {pastOrders.length > 0 && (
            <div className="overflow-hidden rounded-[22px] bg-surface">
              <button onClick={() => setShowPast((v) => !v)} aria-expanded={showPast} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
                <span className="text-[15px] font-semibold">{tx(lang, "Previous orders", "आधीच्या ऑर्डर्स")} <span className="text-muted">({pastOrders.length})</span></span>
                <ChevronDown size={18} className={clsx("text-muted transition-transform", showPast && "rotate-180")} />
              </button>
              {showPast && (
                <ul className="divide-y divide-line/80 border-t border-line/80">
                  {pastOrders.map((o) => (
                    <li key={o.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-semibold">{payNow ? tx(lang, "Token", "टोकन") : tx(lang, "Order", "ऑर्डर")} #{num(o.number)}</span>
                        <span className="text-[12.5px] text-muted">{new Date(o.createdAt).toLocaleDateString(lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "mr-IN", { day: "numeric", month: "short" })} · {new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                      <div className="mt-0.5 text-[13px] text-muted">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
                      <div className="mt-1 flex items-center justify-between text-[13px]">
                        <span className={clsx("font-semibold", o.status === "cancelled" ? "text-rose" : "text-jade-deep")}>{o.status === "cancelled" ? tx(lang, "Not accepted", "स्वीकारली नाही") : tx(lang, "Paid", "पैसे भरले")}</span>
                        <span className="font-semibold tnum">{inr(o.lines.reduce((a, l) => a + l.qty * l.price, 0))}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </main>
      )}

      {/* ---------- above the tabs: cart total, or where the bill stands ---------- */}
      <div className="fixed inset-x-0 bottom-[60px] z-30 mx-auto max-w-md px-4 pb-2 sm:max-w-2xl">
        {count > 0 && view !== "orders" ? (
          <button onClick={() => setCartOpen(true)} className="flex w-full animate-pop items-center gap-3 rounded-[16px] bg-jade-deep px-4 py-3 text-white">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-[13px] font-bold tnum">{count}</span>
            <span className="text-[15px] tnum opacity-90">{inr(itemTotal)} <span className="text-[12px] opacity-75">+ GST</span></span>
            <span className="ml-auto text-[15px] font-semibold">{tx(lang, "View cart", "कार्ट पहा")}</span>
          </button>
        ) : view === "orders" && !payNow && billState !== "none" ? (
          <div className="grid grid-cols-1 gap-2">
            {/* where the bill stands: pay it / already paid, owner confirming / paid */}
            {!payNow && billState === "open" && awaitingKitchen && !waiting && (
              <div className="flex h-14 flex-col items-center justify-center rounded-[18px] bg-surface px-3 text-center shadow-float ring-1 ring-line">
                <span className="text-[14.5px] font-semibold">{tx(lang, "Waiting for the kitchen to accept", "किचनकडून ऑर्डर स्वीकारली जाण्याची वाट")}</span>
                <span className="text-[11.5px] font-medium leading-tight text-muted">{tx(lang, "You can pay once your order is accepted", "ऑर्डर स्वीकारली की पैसे भरता येतील")}</span>
              </div>
            )}
            {!payNow && billState === "open" && (!awaitingKitchen || waiting) && (
              <Button size="lg" className="shadow-float" onClick={() => { setTipPct(0); setUseReward(true); setBillOpen(true); }}>
                {waiting && !waiting.payFirst ? tx(lang, "Payment on the way", "पैसे देत आहे") : <>{tx(lang, "Pay", "भरा")} <span className="tnum">{inr(billTotal)}</span></>}
              </Button>
            )}
            {!payNow && billState === "sent" && (
              <button onClick={() => setBillOpen(true)} className="flex h-14 flex-col items-center justify-center rounded-[18px] bg-saffron-soft px-3 text-saffron shadow-float ring-1 ring-saffron/25">
                <span className="flex items-center gap-1.5 text-[15px] font-semibold"><Check size={16} strokeWidth={2.6} /> {tx(lang, "Already paid", "पैसे भरले")}</span>
                <span className="text-[11.5px] font-medium leading-tight text-saffron/85">{tx(lang, "Confirming with owner", "मालकाकडून खात्री होत आहे")}</span>
              </button>
            )}
            {!payNow && billState === "paid" && (
              <button onClick={() => setBillOpen(true)} className="flex h-14 items-center justify-center gap-1.5 rounded-[18px] bg-jade px-3 text-[15px] font-semibold text-white shadow-float">
                <Check size={17} strokeWidth={2.6} /> {tx(lang, "Bill paid", "बिल भरलं")}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* ---------- bottom tabs ---------- */}
      <GuestTabs
        tab={view === "menu" ? "home" : view === "browse" ? "menu" : "orders"}
        onTab={(tb) => {
          if (tb === "cart") return count ? setCartOpen(true) : toast(tx(lang, "Your cart is empty · tap + on a dish", "कार्ट रिकामी आहे · डिशवर + दाबा"));
          setView(tb === "home" ? "menu" : tb === "menu" ? "browse" : "orders");
          window.scrollTo({ top: 0 });
        }}
        cartCount={count}
        ordersBadge={openOrders.length}
        showCart={qrOn}
        waiter={counter || !t ? null : myCall ? myCall.status as "open" | "taken" : "idle"}
        onWaiter={() => {
          if (!myCall) return callWaiter();
          if (myCall.status === "open") {
            callActions.cancel(myCall.id);
            toast(tx(lang, "Waiter call cancelled", "वेटर कॉल रद्द केला"));
          } else toast(tx(lang, `${myCall.toName ?? "A waiter"} is coming to your table`, `${myCall.toName ?? "वेटर"} तुमच्या टेबलवर येत आहे`));
        }}
        lang={lang}
      />

      <GamesSheet game={game} onGame={setGame} onClose={() => setGame(null)} lang={lang} />

      {/* ---------- ☰ more: language, guests, call a waiter ---------- */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={settings.name}>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-group bg-surface">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-[15px] font-medium">{tx(lang, "You're at", "तुम्ही आहात")}</span>
              <span className="text-[15px] font-semibold">{placeLabel}{party && shared ? ` · ${groupName}` : ""}</span>
            </div>
            {t && !counter && qrOn && (party?.guests || guestCount) && (party || !t.parties.length || ownBill) ? (
              <button onClick={() => { setMoreOpen(false); setCountOpen(true); }} className="flex w-full items-center justify-between border-t border-line/80 px-4 py-3.5 text-left">
                <span className="text-[15px] font-medium">{tx(lang, "Guests", "किती जण")}</span>
                <span className="flex items-center gap-2 text-[15px] font-semibold"><Users size={15} /> {party?.guests ?? guestCount} <span className="text-[13px] font-semibold text-jade">{tx(lang, "Change", "बदला")}</span></span>
              </button>
            ) : null}
            <div className="flex items-center justify-between border-t border-line/80 px-4 py-3">
              <span className="flex items-center gap-2 text-[15px] font-medium"><Languages size={17} /> {tx(lang, "Language", "भाषा")}</span>
              <div className="flex rounded-ctl bg-sunken p-[3px]">
                {GUEST_LANGS.map((l) => (
                  <button key={l.id} onClick={() => setLang(l.id)} className={clsx("rounded-[9px] px-2.5 py-1.5 text-[13px] font-semibold", lang === l.id ? "bg-surface shadow-float" : "text-muted")}>{l.label}</button>
                ))}
              </div>
            </div>
          </div>
            {!counter && (
              myCall?.status === "taken" ? (
                <div className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-jade-soft py-3.5 text-[15px] font-semibold text-jade-deep">
                  <Check size={17} /> {tx(lang, `${myCall.toName ?? "A waiter"} is coming to your table`, `${myCall.toName ?? "वेटर"} तुमच्या टेबलवर येत आहे`)}
                </div>
              ) : myCall?.status === "open" ? (
                <div className="flex w-full items-center gap-2 rounded-[18px] bg-saffron-soft py-2 pl-4 pr-2 text-saffron">
                  <BellRing size={17} className="animate-pulse" />
                  <span className="flex-1 text-[15px] font-semibold">{tx(lang, "Calling a waiter…", "वेटरला बोलावत आहे…")}</span>
                  <button onClick={() => callActions.cancel(myCall.id)} className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink">{tx(lang, "Cancel", "रद्द करा")}</button>
                </div>
              ) : (
                <button onClick={() => { callWaiter(); setMoreOpen(false); }} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-surface py-3.5 text-[15px] font-semibold">
                  <BellRing size={17} /> {tx(lang, "Call a waiter", "वेटरला बोलवा")}
                </button>
              )
            )}
          {stampCard}
          <button onClick={() => { setMoreOpen(false); window.setTimeout(() => setGame("ludo"), 350); }} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-surface py-3.5 text-[15px] font-semibold">
            🎮 {tx(lang, "Play a game", "खेळ खेळा")}
          </button>
          {myOrders.length > 0 && (
            <button onClick={() => { setMoreOpen(false); setView("orders"); window.scrollTo({ top: 0 }); }} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-surface py-3.5 text-[15px] font-semibold">
              <ReceiptText size={17} /> {tx(lang, "My orders and bill", "माझ्या ऑर्डर्स आणि बिल")}
            </button>
          )}
          <PoweredBy />
        </div>
      </Sheet>

      {/* ---------- dish detail / photos ---------- */}
      <ItemSheet item={detail} onClose={() => setDetail(null)} onAdd={qrOn && isOpen ? addLine : undefined} photosOnly={!qrOn || !isOpen} />
      <ItemSheet item={photosOf} onClose={() => setPhotosOf(null)} photosOnly />

      {/* ---------- filters ---------- */}
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={setFilters} menu={menu} cats={cats} term={q} lang={lang} />

      {/* ---------- cart ---------- */}
      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={tx(lang, "Your order", "तुमची ऑर्डर")}
        footer={
          <Button size="lg" className="w-full" disabled={!count || !isOpen} onClick={placeOrder}>
            {payNow
              ? tx(lang, `Continue to pay · ${inr(payable)}`, `पैसे भरा · ${inr(payable)}`)
              : `${tx(lang, myOrders.length ? "Send to kitchen" : "Place order", "ऑर्डर पाठवा")} · ${inr(payable)}`}
          </Button>
        }
      >
        <div className="space-y-4">
          {!payNow && unbilled.length > 0 && (
            <p className="rounded-ctl bg-jade-soft px-3 py-2 text-[13.5px] text-jade-deep">
              {tx(lang, `This is added to your table's running bill (${unbilled.length} earlier ${unbilled.length > 1 ? "orders" : "order"}).`, "हे तुमच्या आधीच्या बिलात जोडलं जाईल.")}
            </p>
          )}
          {(cafe || counter) && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx(lang, "Eat here or take away", "इथे खाणार की पार्सल")}>
              {([["here", tx(lang, "Eat here", "इथे खाणार"), UtensilsCrossed], ["away", tx(lang, "Take away", "पार्सल"), ShoppingBag]] as const).map(([v, l, I]) => (
                <button key={v} role="radio" aria-checked={eat === v} onClick={() => setEat(v)} className={clsx("flex items-center justify-center gap-2 rounded-ctl py-3 text-[14.5px] font-semibold", eat === v ? "bg-ink text-canvas" : "bg-surface")}>
                  <I size={17} /> {l}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-hidden rounded-group bg-surface">
            {cart.map((l) => (
              <div key={l.key} className="flex items-start gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                <span className="mt-1"><DietMark diet={l.item.diet} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium leading-snug">{sizedName(l.item.name, l.size)}</div>
                  {l.options.length > 0 && <div className="mt-0.5 text-[12.5px] text-muted">{l.options.join(" · ")}</div>}
                  <div className="mt-1 text-[13.5px] text-muted tnum">{inr(l.qty * l.unitPrice)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-sunken p-0.5">
                  <button aria-label="Less" onClick={() => changeLine(l.key, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Minus size={14} /></button>
                  <span className="w-6 text-center text-[14px] font-semibold tnum">{l.qty}</span>
                  <button aria-label="More" onClick={() => changeLine(l.key, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          {pairing && (
            <div className="flex items-center gap-3 rounded-group bg-surface p-3">
              <PhotoSlide item={pairing} className="h-12 w-12 shrink-0 rounded-[12px]" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] text-muted">{tx(lang, "Goes well with your order", "यासोबत छान लागतं")}</div>
                <div className="truncate text-[15px] font-medium">{pairing.name} · {inr(pairing.price)}</div>
              </div>
              <Button size="sm" variant="tinted" onClick={() => tapAdd(pairing)}><Plus size={15} /> {tx(lang, "Add", "जोडा")}</Button>
            </div>
          )}

          <input value={note} onChange={(e) => setNote(e.target.value)} className="h-12 w-full rounded-ctl bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:ring-1 focus:ring-jade/40" placeholder={tx(lang, "Note for the kitchen (no onion, less sugar…)", "किचनसाठी सूचना (कमी तिखट, कांदा नको…)")} />

          <dl className="space-y-1.5 rounded-group bg-surface p-4 text-[14.5px]">
            <div className="flex justify-between"><dt className="text-muted">{tx(lang, "Item total", "पदार्थ")}</dt><dd className="tnum">{inr(itemTotal, { decimals: true })}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">CGST {halfGstLabel()} + SGST {halfGstLabel()}</dt><dd className="tnum">{inr(gst, { decimals: true })}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{tx(lang, "Service charge", "सर्व्हिस चार्ज")}</dt><dd className="text-jade">{tx(lang, "None", "नाही")}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold"><dt>{tx(lang, "To pay", "एकूण")}</dt><dd className="tnum">{inr(payable)}</dd></div>
            <p className="pt-1 text-[12.5px] text-faint">
              {payNow ? tx(lang, "Pay now — UPI, cash, or part cash part UPI.", "आत्ता भरा — UPI, रोख किंवा थोडे रोख थोडे UPI.") : tx(lang, "You pay at the end — UPI, cash, card, or part cash part UPI.", "पैसे शेवटी भरा — UPI, रोख, कार्ड किंवा दोन्ही.")}
            </p>
          </dl>
        </div>
      </Sheet>

      {/* ---------- pay-first: pay for this order ---------- */}
      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title={tx(lang, `Pay ${inr(payable)}`, `${inr(payable)} भरा`)}>
        {payOpen && (
          <PayPanel
            amount={payable}
            upi={settings.upi}
            payee={settings.name}
            note={`${settings.name} · ${placeLabel}`}
            lang={lang}
            cashWhere="counter"
            onUpiPaid={payFirstUpi}
            onCash={() => payFirstLater("cash")}
            onCard={() => payFirstLater("card")}
            onMixed={(upiPart) => payFirstLater("mixed", upiPart)}
          />
        )}
      </Sheet>

      {/* ---------- OTP (only before the first order) ---------- */}
      <OtpSheet
        open={otpOpen}
        lang={lang}
        onClose={() => setOtpOpen(false)}
        onVerified={(g) => {
          setGuest(g);
          try {
            localStorage.setItem("restropi.guest", JSON.stringify(g));
          } catch {}
          setOtpOpen(false);
          if (afterOtp.current === "pay") {
            setCartOpen(false);
            setPayOpen(true);
          } else {
            sendOrder(g);
            showMyOrders();
          }
        }}
      />

      {/* ---------- confirmation (and "pay at the counter" for pay-first cash) ---------- */}
      {confirmedOrder && !thanks && (
        <div className="fixed inset-0 z-40 mx-auto flex max-w-md animate-fade-in flex-col bg-canvas px-5 pb-6 pt-14" role="dialog" aria-label="Order placed">
          <div className="flex flex-1 flex-col items-center text-center">
            {waiting?.payFirst ? (
              <div className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-saffron-soft text-saffron">{waiting.kind === "card" ? <CreditCard size={36} /> : <Banknote size={36} />}</div>
            ) : (
              <div className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-jade text-white"><Check size={40} strokeWidth={2.5} /></div>
            )}
            <div className="mt-5 text-[14px] font-medium text-muted">{payNow ? tx(lang, "Your token", "तुमचा टोकन") : tx(lang, "Order placed", "ऑर्डर पाठवली")}</div>
            <div className="mt-1 text-[44px] font-semibold tracking-tight tnum">#{num(confirmedOrder.number)}</div>
            <div className="text-[15px] text-muted">
              {placeLabel}
              {shared && party ? ` · ${groupName}` : ""} · {confirmedOrder.lines.reduce((s, l) => s + l.qty, 0)} {tx(lang, "items", "पदार्थ")}
            </div>
            {waiting?.payFirst && (
              <div className="mt-6 w-full rounded-[22px] bg-saffron-soft p-4 text-left text-[15px]">
                <b>
                  {waiting.kind === "mixed"
                    ? tx(lang, `UPI ${inr(waiting.upiPart ?? 0)} received. Please pay ${inr(waiting.amount - (waiting.upiPart ?? 0))} cash at the counter.`, `UPI ${inr(waiting.upiPart ?? 0)} मिळाले. उरलेले ${inr(waiting.amount - (waiting.upiPart ?? 0))} रोख काउंटरवर द्या.`)
                    : waiting.kind === "card"
                      ? tx(lang, `Please pay ${inr(waiting.amount)} by card at the counter.`, `${inr(waiting.amount)} कार्डने काउंटरवर भरा.`)
                      : tx(lang, `Please pay ${inr(waiting.amount)} cash at the counter.`, `${inr(waiting.amount)} रोख काउंटरवर द्या.`)}
                </b>{" "}
                {tx(lang, "Show this token. Your order goes to the kitchen as soon as you pay.", "हा टोकन दाखवा. पैसे भरल्यावर ऑर्डर किचनला जाईल.")}
              </div>
            )}
            <div className="mt-6 w-full rounded-[22px] bg-surface p-4 text-left">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[15px] font-semibold">{statusLine(confirmedOrder.status)}</span>
                <span className="text-[13px] text-muted">~15 min</span>
              </div>
              <StatusTrack status={confirmedOrder.status} lang={lang} />
            </div>
            <p className="mt-4 text-[13px] text-muted">{tx(lang, "You can close this — status stays in My orders.", "हे बंद केलं तरी चालेल. स्थिती 'माझ्या ऑर्डर्स' मध्ये दिसेल.")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="plain" onClick={() => { setConfirmed(null); setView("orders"); window.scrollTo({ top: 0 }); }}>{tx(lang, "My orders", "माझ्या ऑर्डर्स")}</Button>
            <Button size="lg" onClick={() => { setConfirmed(null); setView("menu"); }}>{tx(lang, "Order more", "आणखी ऑर्डर")}</Button>
          </div>
        </div>
      )}

      {/* ---------- thank you ---------- */}
      {thanks && (
        <ThankYou
          name={guest?.name}
          place={settings.name}
          payments={thanks.payments}
          orderNo={thanksOrder?.number || thanks.orderNo || undefined}
          token={thanks.token ? thanksOrder?.number || thanks.orderNo || undefined : undefined}
          lang={lang}
          onRate={(stars, text) =>
            feedbackActions.add({ customer: guest?.name ?? "Guest", stars, text: text || (stars >= 4 ? "Loved it" : "Not happy"), routed: stars >= 4 ? "google" : "private" })
          }
          onClose={() => { setThanks(null); setSkipAsk(true); setView(thanks.token ? "orders" : "menu"); window.scrollTo({ top: 0 }); }}
        >
          {thanks.token && thanksOrder && thanksOrder.status !== "paid" && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="mb-3 text-[14px] font-semibold">{statusLine(thanksOrder.status)}</div>
              <StatusTrack status={thanksOrder.status} lang={lang} />
            </div>
          )}
        </ThankYou>
      )}

      {/* ---------- final bill (restaurant flow) ---------- */}
      <Sheet
        open={billOpen}
        onClose={() => setBillOpen(false)}
        title={waiting && !waiting.payFirst ? tx(lang, "Almost done", "जवळजवळ झालं") : tx(lang, "Your bill", "तुमचं बिल")}
      >
        {waiting && !waiting.payFirst && (waiting.kind === "upi" || waiting.claimSeen) ? (
          <BillDone state="sent" claimTotal={waiting.amount} paidTotal={0} lang={lang} />
        ) : waiting && !waiting.payFirst ? (
          <div className="flex flex-col items-center pt-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-saffron-soft text-saffron">{waiting.kind === "card" ? <CreditCard size={30} /> : <Banknote size={30} />}</div>
            <p className="mt-4 max-w-xs text-[15px] text-muted">
              {waiting.kind === "mixed"
                ? tx(lang, `UPI ${inr(waiting.upiPart ?? 0)} received. Your captain is coming to collect ${inr(waiting.amount - (waiting.upiPart ?? 0))} in cash.`, `UPI ${inr(waiting.upiPart ?? 0)} मिळाले. कॅप्टन ${inr(waiting.amount - (waiting.upiPart ?? 0))} रोख घ्यायला येत आहे.`)
                : waiting.kind === "cash"
                  ? tx(lang, `Your captain is bringing the bill. Please keep ${inr(waiting.amount)} ready in cash.`, `कॅप्टन बिल घेऊन येत आहे. ${inr(waiting.amount)} रोख तयार ठेवा.`)
                  : tx(lang, "Your captain is bringing the card machine.", "कॅप्टन कार्ड मशीन घेऊन येत आहे.")}
            </p>
            <p className="mt-3 text-[13px] text-faint">{tx(lang, "Once the restaurant confirms the payment, this screen says thank you.", "रेस्टॉरंटने पैसे मिळाल्याची खात्री केली की इथे धन्यवाद दिसेल.")}</p>
          </div>
        ) : unbilled.length === 0 ? (
          <BillDone state={billState} claimTotal={sentClaim ? sentClaim.payments.reduce((a, p) => a + p.amount, 0) : 0} paidTotal={paidTotal} lang={lang} />
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-group bg-surface">
              {unbilled.map((o) => (
                <div key={o.id} className="border-b border-line/80 px-4 py-3 last:border-0">
                  <div className="mb-1 text-[12.5px] font-semibold text-muted">#{num(o.number)} · {o.customer}</div>
                  {o.lines.map((l, i) => (
                    <div key={i} className="flex justify-between text-[14px]"><span>{l.qty}× {l.name}</span><span className="tnum">{inr(l.qty * l.price)}</span></div>
                  ))}
                </div>
              ))}
            </div>
            {rewardReady && (
              <button
                type="button"
                onClick={() => setUseReward((v) => !v)}
                aria-pressed={useReward}
                className={clsx("flex w-full items-center gap-3 rounded-group p-4 text-left ring-1", useReward ? "bg-[#fff7e0] ring-saffron/40" : "bg-surface ring-line")}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[20px]">🎁</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{tx(lang, `Use my reward: ${stampProg!.reward}`, `माझं बक्षीस वापरा: ${stampProg!.reward}`)}</span>
                  <span className="block text-[12.5px] text-muted">
                    {useReward
                      ? tx(lang, `−${inr(rewardOff(stampProg!, billItems, menuAll))} on this bill · your card starts again after this`, `या बिलावर −${inr(rewardOff(stampProg!, billItems, menuAll))} · यानंतर कार्ड पुन्हा सुरू`)
                      : tx(lang, "Tap to use it on this bill", "या बिलावर वापरण्यासाठी टॅप करा")}
                  </span>
                </span>
                <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", useReward ? "border-jade bg-jade text-white" : "border-line")}>{useReward && <Check size={14} strokeWidth={3} />}</span>
              </button>
            )}
            <div>
              <div className="mb-2 text-[14px] font-semibold">{tx(lang, "Tip for the staff (optional)", "स्टाफसाठी टिप (ऐच्छिक)")}</div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 5, 10, 15].map((p) => (
                  <button key={p} onClick={() => setTipPct(p)} className={clsx("rounded-ctl py-2.5 text-[14px] font-semibold", tipPct === p ? "bg-ink text-canvas" : "bg-surface")}>
                    {p === 0 ? tx(lang, "No tip", "नको") : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
            <dl className="space-y-1.5 rounded-group bg-surface p-4 text-[14.5px]">
              <div className="flex justify-between"><dt className="text-muted">{tx(lang, "Item total", "पदार्थ")}</dt><dd className="tnum">{inr(billItems, { decimals: true })}</dd></div>
              {rewardAmt > 0 && <div className="flex justify-between text-jade"><dt>{tx(lang, "Stamp card reward", "स्टॅम्प कार्ड बक्षीस")} · {stampProg!.reward}</dt><dd className="tnum">−{inr(rewardAmt, { decimals: true })}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">CGST {halfGstLabel()} + SGST {halfGstLabel()}</dt><dd className="tnum">{inr(billGst, { decimals: true })}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{tx(lang, "Service charge", "सर्व्हिस चार्ज")}</dt><dd className="text-jade">{tx(lang, "None", "नाही")}</dd></div>
              {tip > 0 && <div className="flex justify-between"><dt className="text-muted">{tx(lang, "Tip", "टिप")}</dt><dd className="tnum">{inr(tip)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-[17px] font-semibold"><dt>{tx(lang, "Total payable", "भरायचे")}</dt><dd className="tnum">{inr(billTotal)}</dd></div>
            </dl>
            <div className="text-[14px] font-semibold">{tx(lang, "How will you pay?", "कसे भरणार?")}</div>
            <PayPanel
              amount={billTotal}
              upi={settings.upi}
              payee={settings.name}
              note={`${settings.name} · ${placeLabel}`}
              lang={lang}
              cashWhere={cashWhere}
              onUpiPaid={billUpi}
              onCash={() => billLater("cash")}
              onCard={() => billLater("card")}
              onMixed={(upiPart) => billLater("mixed", upiPart)}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** The bill is settled (or sent): no pay buttons, just where it stands. */
function BillDone({ state, claimTotal, paidTotal, lang, compact = false }: { state: "open" | "sent" | "paid" | "none"; claimTotal: number; paidTotal: number; lang: Lang; compact?: boolean }) {
  if (state === "none" || state === "open") {
    return compact ? null : <p className="py-8 text-center text-[15px] text-muted">{tx(lang, "Nothing to pay yet. Your bill shows here once you order.", "अजून भरायचं काही नाही. ऑर्डर केल्यावर बिल इथे दिसेल.")}</p>;
  }
  const paid = state === "paid";
  return (
    <div className={clsx("flex items-center gap-3 rounded-[20px] p-4", paid ? "bg-jade text-white" : "bg-saffron-soft", !compact && "mt-2 flex-col py-8 text-center")}>
      <span className={clsx("flex shrink-0 items-center justify-center rounded-full", compact ? "h-10 w-10" : "h-16 w-16", paid ? "bg-white/20" : "bg-white text-saffron")}>
        <Check size={compact ? 20 : 30} strokeWidth={2.5} />
      </span>
      <div className={compact ? "min-w-0 flex-1" : ""}>
        <div className={clsx("font-semibold", compact ? "text-[15.5px]" : "text-[20px]")}>
          {paid ? tx(lang, "Bill paid", "बिल भरलं") : tx(lang, "Payment sent", "पैसे पाठवले")} · <span className="tnum">{inr(paid ? paidTotal : claimTotal)}</span>
        </div>
        <div className={clsx("text-[13.5px]", paid ? "text-white/85" : "text-ink/70")}>
          {paid ? tx(lang, "Confirmed by the restaurant. Thank you!", "रेस्टॉरंटने खात्री केली. धन्यवाद!") : tx(lang, "Already paid · confirming with the owner. Nothing more to pay.", "पैसे भरले · मालकाकडून खात्री होत आहे. आणखी काही भरायचं नाही.")}
        </div>
        {!paid && !compact && (
          <ol className="mx-auto mt-5 max-w-[260px] space-y-2 text-left text-[13.5px]">
            <li className="flex items-center gap-2.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-jade text-white"><Check size={12} strokeWidth={3} /></span>{tx(lang, "You paid", "तुम्ही पैसे भरले")}</li>
            <li className="flex items-center gap-2.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-saffron"><span className="h-2 w-2 animate-pulse rounded-full bg-saffron" /></span>{tx(lang, "Owner checks the payment", "मालक पेमेंट तपासत आहे")}</li>
            <li className="flex items-center gap-2.5 text-ink/50"><span className="h-5 w-5 rounded-full ring-2 ring-line" />{tx(lang, "Bill shows Paid", "बिलावर “भरलं” दिसेल")}</li>
          </ol>
        )}
      </div>
    </div>
  );
}

/** Small "Powered by Restropi" line at the end of the menu. */
function PoweredBy() {
  return (
    <a href="https://restropi.com" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 pb-2 pt-4 text-[12px] text-faint">
      <span>Ordering powered by</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/restropi-logo-dark.png" alt="Restropi" width={597} height={180} className="h-4 w-auto opacity-80" />
    </a>
  );
}
