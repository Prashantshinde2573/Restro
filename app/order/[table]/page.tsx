"use client";

import clsx from "clsx";
import { FullLoader } from "@/components/loader";
import { useParams } from "next/navigation";
import {
  Banknote,
  BellRing,
  Check,
  ClipboardCheck,
  Copy,
  CreditCard,
  MessageCircle,
  Minus,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, DietMark, Sheet } from "@/components/ui";
import { useToast } from "@/components/toast";
import { ItemSheet, makeLine, type CartLine } from "@/components/item-sheet";
import { PhotoSlide } from "@/components/menu-bits";
import { OtpSheet, type GuestProfile } from "@/components/otp-sheet";
import {
  ActiveFilters,
  CategoryRail,
  DishRow,
  FilterButton,
  FilterSheet,
  applyFilters,
  noFilters,
  sheetFilterCount,
  type MenuFilters,
} from "@/components/guest-menu";
import { PayPanel, ThankYou } from "@/components/guest-pay";
import { gstRate, halfGstLabel, inr, minutesSince } from "@/lib/format";
import { isShared, tableActions, useAllTables } from "@/lib/tables";
import { cloudConfigured, feedbackActions, guestActions, orderActions, orderingOpen, sessionActions, useAccount, useCategories, useFeature, useMenu, useOrders, useSettings } from "@/lib/live";
import { ensureGuest, useCloud } from "@/lib/cloud";
import type { MenuItem, Order, Payment } from "@/lib/types";

const STEPS = ["Received", "Accepted", "Preparing", "Ready", "Served"] as const;
const STEPS_MR = ["मिळाली", "स्वीकारली", "बनत आहे", "तयार", "टेबलवर"] as const;
const stepOf = (s: Order["status"]) => (s === "new" ? 0 : s === "accepted" ? 1 : s === "preparing" ? 2 : s === "ready" ? 3 : 4);
const PAIRINGS: Record<string, string> = { mains: "m10", starters: "m19", rice: "m16", breads: "m6", desserts: "m21", drinks: "m4", hot: "m16" };
const sumOf = (p: Payment[]) => p.reduce((s, x) => s + x.amount, 0);
const num = (n: number) => (n ? n : "…"); // cloud: number arrives a moment after the order

function StatusTrack({ status, lang }: { status: Order["status"]; lang: "en" | "mr" }) {
  const cur = stepOf(status);
  const labels = lang === "mr" ? STEPS_MR : STEPS;
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

type Lang = "en" | "mr";
const tx = (lang: Lang, en: string, mr: string) => (lang === "mr" ? mr : en);

// While the bill is being settled by staff (cash, card, or the cash half of "Cash + UPI").
type Waiting = { ids: string[]; kind: "cash" | "card" | "mixed"; amount: number; upiPart?: number; payFirst: boolean };
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
      setCloudErr("This QR code is missing the restaurant link.");
      return;
    }
    ensureGuest(rid).catch(() => setCloudErr("Couldn't connect. Check your internet and scan again."));
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
    const id = window.setTimeout(() => setGaveUp(true), 15000);
    return () => window.clearTimeout(id);
  }, []);
  const cloudLoading = cloudConfigured && !cloudErr && !gaveUp && (!cloud.rid || !account.name || (!counter && !t && !waitedLong));

  const [lang, setLang] = useState<Lang>("en");
  const mr = lang === "mr";
  const [view, setView] = useState<"menu" | "orders">("menu");
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
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [thanks, setThanks] = useState<Thanks | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [, tick] = useState(0);

  // ---- who is this phone? (its group for this visit to the table, guest profile) ----
  const storeKey = t ? `restropi.party.${t.name}.${t.visitId}` : "";
  const [myParty, setMyParty] = useState<string | null>(null);
  const [mine, setMine] = useState<string[]>([]); // counter orders placed from this phone
  const [guest, setGuest] = useState<GuestProfile | null>(null);
  useEffect(() => {
    try {
      if (storeKey) setMyParty(localStorage.getItem(storeKey));
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
  const addMine = (id: string) =>
    setMine((m) => {
      const next = [id, ...m].slice(0, 20);
      try {
        localStorage.setItem("restropi.mine.counter", JSON.stringify(next));
      } catch {}
      return next;
    });

  const party = t?.parties.find((p) => p.id === myParty);
  const shared = t ? isShared(t) : false;
  const groupName = party ? (shared ? `Group ${party.id}` : tx(lang, "Your group", "तुमचा गट")) : "";
  const unclaimed = !party ? t?.parties.find((p) => p.source === "captain" && !p.phoneClaimed) : undefined;

  const myOrders = useMemo(() => {
    // cancelled orders stay visible for an hour, so the guest knows what happened
    const keep = (o: Order) => o.status !== "cancelled" || minutesSince(o.createdAt) < 60;
    if (counter) return allOrders.filter((o) => mine.includes(o.id) && keep(o) && minutesSince(o.createdAt) < 240);
    return t && myParty
      ? allOrders.filter((o) => o.tableName === t.name && (o.partyId ?? "A") === myParty && keep(o) && (o.status !== "paid" || o.guestPhone))
      : [];
  }, [allOrders, t, myParty, counter, mine]);
  const openOrders = useMemo(() => myOrders.filter((o) => o.status !== "paid" && o.status !== "cancelled"), [myOrders]);
  // Restaurant flow: the running bill. Pay-first orders are already settled from the phone.
  const unbilled = useMemo(() => openOrders.filter((o) => !(o.prepaid ?? []).length && !o.payClaim && !(payNow && o.payPreference)), [openOrders, payNow]);
  // where this phone's bill stands: nothing to pay / payment sent (restaurant confirms) / paid
  const sentClaim = openOrders.find((o) => o.payClaim)?.payClaim;
  const paidOrders = myOrders.filter((o) => o.status === "paid");
  const billState: "open" | "sent" | "paid" | "none" = unbilled.length ? "open" : sentClaim ? "sent" : paidOrders.length && !openOrders.length ? "paid" : "none";
  const paidTotal = paidOrders.reduce((s, o) => s + (o.payments?.reduce((a, p) => a + p.amount, 0) ?? 0), 0);

  // ---- settling: show the thank-you once staff have the money ----
  useEffect(() => {
    if (!waiting) return;
    const os = allOrders.filter((o) => waiting.ids.includes(o.id));
    if (!os.length) return;
    const payments: Payment[] =
      waiting.kind === "mixed"
        ? [{ method: "upi", amount: waiting.upiPart ?? 0 }, { method: "cash", amount: waiting.amount - (waiting.upiPart ?? 0) }]
        : [{ method: waiting.kind, amount: waiting.amount }];
    // Pay-first: staff accept the order once they have the cash/card payment at the counter.
    // staff took the money (paid, or marked paid and waiting for the owner's OK)
    const settled = waiting.payFirst ? os.every((o) => o.status !== "new") : os.every((o) => o.status === "paid" || !!o.payClaim);
    if (settled) {
      setThanks({ payments: waiting.payFirst ? payments : os[0].payments ?? os[0].payClaim?.payments ?? payments, orderNo: os[0].number, orderId: os[0].id, token: waiting.payFirst });
      setWaiting(null);
      setConfirmed(null);
      setBillOpen(false);
      return;
    }
  }, [waiting, allOrders]);



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
  const tapAdd = (m: MenuItem) => (m.options?.length ? setDetail(m) : addLine(makeLine(m, 1)));
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
      p = tableActions.seat(t.id, 1, { source: "qr", phoneClaimed: true, pendingApproval: !extra.prepaid, server: undefined });
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
        name: l.item.name,
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

  // QR ordering only in the hours the owner set (Settings → Ordering), and not while paused.
  const [, tickHours] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tickHours((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const hours = orderingOpen(settings);
  const isOpen = hours.open;
  const closedText = hours.open
    ? ""
    : hours.why === "paused"
      ? tx(lang, "Ordering from the phone is paused right now. Please order with our staff.", "आत्ता फोनवरून ऑर्डर बंद आहे. कृपया स्टाफकडे ऑर्डर द्या.")
      : tx(lang, `You can browse the menu — ordering opens at ${hours.opensAt}.`, `मेनू पाहू शकता — ऑर्डर ${hours.opensAt} पासून.`);
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
    setConfirmed(sendOrder(guest).id);
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
  const billGst = Math.round(billItems * gstRate() * 100) / 100;
  const tip = Math.round((billItems * tipPct) / 100);
  const billTotal = Math.round(billItems + billGst + tip);
  const billIds = unbilled.map((o) => o.id);
  const who = guest?.name ?? "Guest";

  const billUpi = () => {
    orderActions.setPreference(billIds, "upi");
    // The restaurant checks the money came in and confirms; the table closes then.
    orderActions.settle(billIds, [{ method: "upi", amount: billTotal }], who, { source: "guest" });
    if (t && party) tableActions.update(t.id, party.id, { status: "billing", paymentPending: true });
    setBillOpen(false);
    setThanks({ payments: [{ method: "upi", amount: billTotal }], orderNo: unbilled[0]?.number, orderId: unbilled[0]?.id });
  };
  const billLater = (kind: "cash" | "card" | "mixed", upiPart?: number) => {
    if (kind === "mixed" && upiPart) orderActions.prepay(billIds, { method: "upi", amount: upiPart }, who);
    else orderActions.setPreference(billIds, kind === "card" ? "card" : "cash");
    if (t && party) tableActions.update(t.id, party.id, { status: "billing" });
    setWaiting({ ids: billIds, kind, amount: billTotal, upiPart, payFirst: false });
  };

  const confirmedOrder = allOrders.find((o) => o.id === confirmed);
  const thanksOrder = thanks?.orderId ? allOrders.find((o) => o.id === thanks.orderId) : undefined;

  if (cloudLoading) {
    return (
      <FullLoader label="Loading menu" />
    );
  }
  if (cloudErr || !account.name || (!t && !counter)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center bg-canvas px-6 text-center">
        <QrCode size={32} className="text-muted" />
        <div className="mt-3 text-[20px] font-semibold">This QR code isn&apos;t active</div>
        <p className="mt-2 text-[15px] text-muted">Please ask a staff member for help, or scan the code on your table again.</p>
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
    <div className="mx-auto min-h-dvh max-w-md bg-canvas pb-36 sm:max-w-2xl">
      {/* ---------- header ---------- */}
      <header className="px-5 pb-3 pt-6">
        <div className="flex items-center justify-between gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/restropi-logo-dark.png" alt="Restropi" width={597} height={180} className="h-[22px] w-auto select-none" draggable={false} />
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-canvas">
              {placeLabel}
              {party && shared && <> · {groupName}</>}
            </span>
            <button onClick={() => setLang(mr ? "en" : "mr")} className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold ring-1 ring-line">{mr ? "English" : "मराठी"}</button>
          </div>
        </div>
        <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-tight">{settings.name}</h1>
        <p className="text-[14px] text-muted">
          {payNow
            ? tx(lang, "Order and pay from your phone. We'll call your token when it's ready.", "फोनवरून ऑर्डर करा आणि पैसे भरा. तयार झालं की टोकन बोलावू.")
            : tx(lang, "Order from your phone. We'll bring it to your table.", "फोनवरून ऑर्डर करा. आम्ही टेबलवर आणू.")}
        </p>

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

      {/* ---------- menu / my orders switch ---------- */}
      {myOrders.length > 0 && (
        <div className="px-4 pb-1">
          <div className="flex rounded-ctl bg-sunken p-[3px]" role="tablist">
            {(["menu", "orders"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={clsx("flex-1 rounded-[9px] py-2 text-[14px] font-semibold", view === v ? "bg-surface shadow-float" : "text-muted")}>
                {v === "menu" ? tx(lang, "Menu", "मेनू") : `${tx(lang, "My orders", "माझ्या ऑर्डर्स")} · ${myOrders.length}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "menu" ? (
        <>
          {/* search, veg/non-veg, filters — each its own control */}
          <div ref={barRef} className="sticky top-0 z-20 space-y-2 border-b border-line/60 bg-canvas px-4 pb-3 pt-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  enterKeyHint="search"
                  placeholder={tx(lang, "Search menu", "मेनू शोधा")}
                  className="h-11 w-full rounded-ctl bg-surface pl-10 pr-9 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade [&::-webkit-search-cancel-button]:hidden"
                />
                {q && <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-faint"><X size={15} /></button>}
              </div>
              <FilterButton count={sheetFilterCount(filters)} onClick={() => setFilterOpen(true)} lang={lang} />
            </div>
            <ActiveFilters f={filters} setF={setFilters} cats={cats} lang={lang} />
          </div>

          <div className="flex items-start gap-2.5 px-3 pt-3">
            {grouped.length > 1 && (
              <aside className="sticky z-10 flex w-[76px] shrink-0 self-start flex-col sm:w-[92px]" style={{ top: barH + 12, maxHeight: `calc(100dvh - ${barH + 12}px - ${count > 0 || openOrders.length > 0 ? 96 : 16}px)` }}>
                <CategoryRail groups={grouped.map((g) => ({ c: g.c, n: g.items.length }))} active={activeCat} onPick={jumpTo} lang={lang} />
              </aside>
            )}
            <main className="min-w-0 flex-1 space-y-6 pb-4">
              {filtering && grouped.length > 0 && (
                <p className="px-1 text-[13px] text-muted">{tx(lang, `${shownItems.length} dishes`, `${shownItems.length} डिश`)}</p>
              )}
              {grouped.length === 0 && (
                <div className="py-16 text-center">
                  <div className="text-[16px] font-semibold">{tx(lang, "No dishes match", "काही सापडलं नाही")}</div>
                  <button onClick={() => { setQ(""); setFilters(noFilters); }} className="mt-2 text-[14px] font-semibold text-jade">{tx(lang, "Clear search and filters", "शोध आणि फिल्टर काढा")}</button>
                </div>
              )}
              {grouped.map(({ c, items }) => (
                <section key={c.id} id={`cat-${c.id}`} style={{ scrollMarginTop: barH + 12 }}>
                  <h2 className="mb-2 flex items-center gap-2 px-1 text-[17px] font-semibold leading-tight tracking-tight">
                    {c.icon && <span aria-hidden>{c.icon}</span>} {c.name}
                    <span className="text-[13px] font-medium text-faint tnum">{items.length}</span>
                  </h2>
                  <div className="overflow-hidden rounded-[18px] bg-surface">
                    {items.map((m) => (
                      <DishRow key={m.id} m={m} qty={qtyOf(m.id)} onOpen={() => setDetail(m)} onAdd={() => tapAdd(m)} onLess={() => tapLess(m)} lang={lang} readOnly={!qrOn || !isOpen} />
                    ))}
                  </div>
                </section>
              ))}
              <PoweredBy />
            </main>
          </div>
        </>
      ) : (
        /* ---------- my orders ---------- */
        <main className="space-y-3 px-4 pt-3">
          {(billState === "sent" || billState === "paid") && (
            <BillDone state={billState} claimTotal={sentClaim ? sentClaim.payments.reduce((a, p) => a + p.amount, 0) : 0} paidTotal={paidTotal} lang={lang} compact />
          )}
          {myOrders.map((o) => (
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
          {!counter && (
            <button onClick={() => toast(tx(lang, "A waiter is on the way", "वेटर येत आहे"))} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-surface py-3.5 text-[15px] font-semibold">
              <BellRing size={17} /> {tx(lang, "Call a waiter", "वेटरला बोलवा")}
            </button>
          )}
        </main>
      )}

      {/* ---------- bottom bar ---------- */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 [--safe-pb:16px] sm:max-w-2xl">
        {count > 0 ? (
          <button onClick={() => setCartOpen(true)} className="flex w-full animate-pop items-center gap-3 rounded-[18px] bg-jade px-5 py-4 text-white shadow-float">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-[13px] font-bold tnum">{count}</span>
            <span className="text-[15px] tnum opacity-90">{inr(itemTotal)} <span className="text-[12px] opacity-75">+ GST</span></span>
            <span className="ml-auto text-[16px] font-semibold">{tx(lang, "View cart", "कार्ट पहा")}</span>
          </button>
        ) : openOrders.length > 0 ? (
          <div className={clsx("grid gap-2", !payNow && unbilled.length > 0 ? "grid-cols-2" : "grid-cols-1")}>
            <Button size="lg" variant="plain" className="shadow-float" onClick={() => { setView(view === "menu" ? "orders" : "menu"); window.scrollTo({ top: 0 }); }}>
              {view === "menu" ? <><ReceiptText size={17} /> {tx(lang, "My orders", "माझ्या ऑर्डर्स")}</> : <><UtensilsCrossed size={17} /> {tx(lang, "Order more", "आणखी ऑर्डर")}</>}
            </Button>
            {!payNow && unbilled.length > 0 && (
              <Button size="lg" className="shadow-float" onClick={() => { setTipPct(0); setBillOpen(true); }}>
                {tx(lang, "Get the bill", "बिल मागवा")}
              </Button>
            )}
          </div>
        ) : null}
      </div>

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
                  <div className="text-[15px] font-medium leading-snug">{l.item.name}</div>
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

          <input value={note} onChange={(e) => setNote(e.target.value)} className="h-12 w-full rounded-ctl bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade" placeholder={tx(lang, "Note for the kitchen (no onion, less sugar…)", "किचनसाठी सूचना (कमी तिखट, कांदा नको…)")} />

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
            setConfirmed(sendOrder(g).id);
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
          onClose={() => { setThanks(null); setView(thanks.token ? "orders" : "menu"); window.scrollTo({ top: 0 }); }}
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
        {waiting && !waiting.payFirst ? (
          <div className="flex flex-col items-center pt-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-saffron-soft text-saffron">{waiting.kind === "card" ? <CreditCard size={30} /> : <Banknote size={30} />}</div>
            <p className="mt-4 max-w-xs text-[15px] text-muted">
              {waiting.kind === "mixed"
                ? tx(lang, `UPI ${inr(waiting.upiPart ?? 0)} received. Your captain is coming to collect ${inr(waiting.amount - (waiting.upiPart ?? 0))} in cash.`, `UPI ${inr(waiting.upiPart ?? 0)} मिळाले. कॅप्टन ${inr(waiting.amount - (waiting.upiPart ?? 0))} रोख घ्यायला येत आहे.`)
                : waiting.kind === "cash"
                  ? tx(lang, `Your captain is bringing the bill. Please keep ${inr(waiting.amount)} ready in cash.`, `कॅप्टन बिल घेऊन येत आहे. ${inr(waiting.amount)} रोख तयार ठेवा.`)
                  : tx(lang, "Your captain is bringing the card machine.", "कॅप्टन कार्ड मशीन घेऊन येत आहे.")}
            </p>
            <p className="mt-3 text-[13px] text-faint">{tx(lang, "This screen says thank you once it's done.", "झालं की इथे धन्यवाद दिसेल.")}</p>
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
function BillDone({ state, claimTotal, paidTotal, lang, compact = false }: { state: "open" | "sent" | "paid" | "none"; claimTotal: number; paidTotal: number; lang: "en" | "mr"; compact?: boolean }) {
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
          {paid ? tx(lang, "All settled. Thank you!", "सगळं झालं. धन्यवाद!") : tx(lang, "The restaurant is confirming it. Nothing more to pay.", "रेस्टॉरंट खात्री करत आहे. आणखी काही भरायचं नाही.")}
        </div>
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
