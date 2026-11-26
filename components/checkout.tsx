"use client";

import { L } from "@/lib/i18n";
import clsx from "clsx";
import { Banknote, CheckCircle2, Clock3, CreditCard, FileText, MessageCircle, QrCode, Users, Minus, Plus, Percent, Layers, Ticket, X, Stamp as StampIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Field, Sheet, inputCls, Pill } from "./ui";
import { ScanQr } from "./qr";
import { upiUri } from "./upi";
import { couponActions, couponLabel, couponOff, couponProblem, guestActions, normCode, stampActions, useCan, useAllMenu, useCoupons, useCurrentOutlet, useFeature, useGuests, useMe, useMenu, useSettings } from "@/lib/live";
import { liveStamps, mayAct, programOf, rewardOff, stampProblem } from "@/lib/stamps";
import { StampBox } from "./stamps";
import { billFileName, printReceipt, receiptPdfBlob, receiptText } from "./receipt";
import { useToast } from "./toast";
import { gstRate, halfGstLabel, inr } from "@/lib/format";
import { PaymentSplit, paidSum } from "./payment-split";
import type { BillDiscount, Coupon, Payment, PayMethod } from "@/lib/types";

type Method = "upi" | "cash" | "card" | "mixed" | "split";

export { billTotals } from "@/lib/bill-totals";
import { billTotals } from "@/lib/bill-totals";

export function Checkout({
  open,
  onClose,
  subtotal,
  label,
  onPaid,
  preferred,
  prepaid,
  lines,
  billNo,
  guest,
  couponCode,
  onCoupon,
}: {
  open: boolean;
  onClose: () => void;
  subtotal: number;
  label: string;
  /** Return "waiting" when the bill needs the owner's OK before it closes. */
  onPaid?: (payments: Payment[], extra?: { coupon?: string; discount?: number; discounts?: BillDiscount[] }) => "paid" | "waiting" | void;
  preferred?: PayMethod; // what the guest asked for from their phone
  prepaid?: Payment[]; // already paid by the guest from their phone (e.g. UPI half)
  lines?: { name: string; qty: number; price: number }[]; // what's on the bill (for the receipt)
  billNo?: number;
  /** the guest on this bill, when known (QR orders): fills in the name and number */
  guest?: { name?: string; phone?: string };
  /** coupon code the guest applied on their phone: put on the bill when it still works */
  couponCode?: string;
  /** a coupon was put on or taken off this bill here: the guest's phone shows the same bill */
  onCoupon?: (code?: string) => void;
}) {
  const toast = useToast();
  const [method, setMethod] = useState<Method>("upi");
  const [discountPct, setDiscountPct] = useState(0);
  // cash handed over; null = the exact amount (the default, follows the total)
  const [cash, setCash] = useState<number | null>(null);
  const [guests, setGuests] = useState(3);
  const [paidGuests, setPaidGuests] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  // the bill as it was when it was paid: the screen behind clears its cart once paid,
  // so the "Paid" screen, receipt, PDF and WhatsApp bill must not read the live (now empty) bill
  const [paidBill, setPaidBill] = useState<{ subtotal: number; label: string; lines?: { name: string; qty: number; price: number }[]; billNo?: number; t: ReturnType<typeof billTotals>; discounts: BillDiscount[] } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [custom, setCustom] = useState<{ on: boolean; kind: "pct" | "flat"; value: string }>({ on: false, kind: "pct", value: "" });
  const [mixed, setMixed] = useState<Payment[]>([]);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [codeErr, setCodeErr] = useState("");
  const coupons = useCoupons();
  const canDiscount = useCan("discount");
  const couponFeature = useFeature("coupons") === "ok";
  const couponsOn = couponFeature && canDiscount;
  // stamp card
  const [useRewardRaw, setUseReward] = useState<boolean | null>(null); // null = on whenever the card is full
  const [giveStamp, setGiveStamp] = useState<boolean | null>(null); // null = the program's default
  const menu = useMenu();
  const allMenu = useAllMenu(); // the stamp card's free dish may be on another outlet's menu (a brand-wide card)
  const guestsList = useGuests();

  // Start fresh each time the sheet opens — not when the bill behind it changes
  // (paying changes it, and that used to throw the "Paid" screen back to "Charge").
  const wasOpen = useRef(false);
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (opening) {
      setDone(false);
      setPaidBill(null);
      setStampNote(null);
      setWaiting(false);
      setPaidGuests([]);
      setCash(null);
      setDiscountPct(0);
      setCustom({ on: false, kind: "pct", value: "" });
      setPhone(guest?.phone ?? "");
      setGuestName(guest?.name ?? "");
      setUseReward(null);
      setGiveStamp(null);
      const asked = couponCode && couponFeature ? coupons.find((x) => x.code === normCode(couponCode)) : undefined;
      const ok = asked && !couponProblem(asked, subtotal, guest?.phone);
      setCoupon(ok ? asked! : null);
      setCode(ok ? asked!.code : "");
      setCodeErr(asked && !ok ? `Guest's coupon ${asked.code}: ${couponProblem(asked, subtotal, guest?.phone)}` : "");
      const pre = paidSum(prepaid ?? []);
      if (pre > 0) {
        // Guest paid part by UPI from their phone: open on "UPI + Cash" with that part filled in.
        setMethod("mixed");
        setMixed([...(prepaid ?? []), { method: "cash", amount: Math.max(0, billTotals(subtotal).total - pre) }]);
      } else {
        setMethod(preferred ?? "upi");
        setMixed([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const customOff = (() => {
    const v = Math.max(0, Number(custom.value) || 0);
    return Math.min(subtotal, Math.round(custom.kind === "pct" ? (subtotal * Math.min(v, 100)) / 100 : v));
  })();
  const settingsEarly = useSettings();
  const meEarly = useMe();
  const stampsOn = useFeature("stamps") === "ok" && !!settingsEarly.stamps?.on;
  const prog = programOf(settingsEarly.stamps);
  const phoneKey = phone.replace(/\D/g, "").slice(-10);
  const stampGuest = stampsOn && phoneKey.length === 10 ? guestsList.find((c) => c.phone.replace(/\D/g, "").slice(-10) === phoneKey) : undefined;
  const liveCount = liveStamps(stampGuest, prog).length;
  const canRedeem = stampsOn && liveCount >= prog.needed && mayAct(meEarly, prog.redeemers);
  const useReward = canRedeem && (useRewardRaw ?? true);
  const rewardAmt = useReward ? rewardOff(prog, subtotal, allMenu) : 0;
  const stampWhyNot = stampsOn && phoneKey.length === 10 ? stampProblem(prog, stampGuest, subtotal) : null;
  const mayGive = mayAct(meEarly, prog.givers);
  // the bill that uses the reward earns no stamp: the new card starts at 0
  const willStamp = stampsOn && phoneKey.length === 10 && !stampWhyNot && mayGive && !(rewardAmt > 0) && (giveStamp ?? prog.auto);
  const baseOff = coupon ? couponOff(coupon, subtotal) : custom.on ? customOff : Math.round((subtotal * discountPct) / 100);
  const t = billTotals(subtotal, Math.min(subtotal, baseOff + rewardAmt));
  // each discount with its reason: on the bill, the e-bill, the order and in reports
  const offOthers = Math.max(0, t.discount - rewardAmt);
  const discounts: BillDiscount[] = [
    ...(rewardAmt > 0 ? [{ kind: "reward" as const, label: `Stamp card · ${prog.reward}`, amount: rewardAmt }] : []),
    ...(offOthers > 0
      ? [coupon
          ? { kind: "coupon" as const, label: `Coupon ${coupon.code}`, amount: offOthers, code: coupon.code }
          : { kind: "staff" as const, label: custom.on ? (custom.kind === "pct" ? `Discount ${Math.min(100, Number(custom.value) || 0)}%` : "Discount") : `Discount ${discountPct}%`, amount: offOthers }]
      : []),
  ];
  const perGuest = Math.ceil(t.total / guests);
  const settings = useSettings();
  const splitOn = useFeature("splitByGuest") === "ok";
  const upi = settings.upi;
  const prepaidSum = paidSum(prepaid ?? []);

  const methods: { v: Method; label: string; icon: typeof QrCode }[] = [
    { v: "upi", label: "UPI", icon: QrCode },
    { v: "cash", label: "Cash", icon: Banknote },
    ...(settings.acceptCard === false ? [] : [{ v: "card" as Method, label: "Card", icon: CreditCard }]),
    { v: "mixed", label: "UPI + Cash", icon: Layers },
    ...(splitOn ? [{ v: "split" as Method, label: "Split by guest", icon: Users }] : []),
  ];

  useEffect(() => {
    if (method === "mixed" && mixed.length === 0) setMixed([{ method: "upi", amount: 0 }, { method: "cash", amount: 0 }]);
  }, [method, mixed.length]);

  const [paidWith, setPaidWith] = useState<Payment[]>([]);
  // what happened to the stamp card on this bill (shown on the Paid screen and in the e-bill)
  const [stampNote, setStampNote] = useState<string | null>(null);
  const outlet = useCurrentOutlet();
  const me = useMe();
  const receipt = () => {
    const b = paidBill ?? { subtotal, label, lines, billNo, t, discounts };
    return {
      by: me?.name,
      customer: guestName.trim() || undefined,
      settings,
      outletName: outlet.name,
      label: b.label,
      billNo: b.billNo,
      lines: b.lines?.length ? b.lines : [{ name: "Food & drinks", qty: 1, price: b.subtotal }],
      totals: b.t,
      discounts: b.discounts,
      payments: paidWith,
    };
  };
  // the number or the bill changed after the coupon went on: check it again (once-each, invited guests, min bill)
  useEffect(() => {
    if (!coupon) return;
    const why = couponProblem(coupon, subtotal, phone);
    if (!why) return;
    setCoupon(null);
    onCoupon?.(undefined);
    setCode(coupon.code);
    setCodeErr(why);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, subtotal]);

  const finish = () => {
    setPaidBill({ subtotal, label, lines, billNo, t, discounts });
    setDone(true);
    const payments: Payment[] =
      method === "mixed"
        ? mixed.filter((m) => m.amount > 0)
        : method === "split"
          ? [{ method: "upi", amount: t.total }]
          : [{ method, amount: t.total }];
    setPaidWith(payments);
    if (coupon) couponActions.used(coupon.id, phone);
    // a number typed at billing puts this guest (and the bill) in the guest book
    if (phone.replace(/\D/g, "").length >= 10)
      guestActions.fromBill(guestName, phone, { orderNo: billNo ?? 0, amount: t.total, method: payments.map((p) => p.method.toUpperCase()).join(" + ") });
    // stamp card: the reward first (a new card starts), then this bill's stamp
    setStampNote(
      rewardAmt > 0
        ? `${prog.reward} used · new stamp card ${Math.max(0, liveCount - prog.needed)}/${prog.needed}`
        : willStamp
          ? `Stamp added · ${liveCount + 1}/${prog.needed} for ${prog.reward}`
          : null,
    );
    if (rewardAmt > 0) stampActions.redeem(phone, liveCount, prog.needed, { reward: prog.reward, amount: rewardAmt, orderNo: billNo, by: me?.name, outletId: outlet.id });
    if (willStamp) stampActions.give(phone, { orderNo: billNo, by: me?.name, outletId: outlet.id });
    const r = onPaid?.(payments, { coupon: coupon?.code, discount: t.discount, discounts });
    setWaiting(r === "waiting");
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={done ? (waiting ? L("Sent for confirmation") : L("Paid")) : L("Charge {0}", label)}
      wide
      footer={
        done ? (
          <Button size="lg" className="w-full" onClick={onClose}>
            {L("Start next order")}</Button>
        ) : method === "split" ? (
          <Button size="lg" className="w-full" disabled={paidGuests.length < guests} onClick={finish}>
            {paidGuests.length < guests ? L("{0} share{1} left to collect", guests - paidGuests.length, guests - paidGuests.length > 1 ? "s" : "") : L("Close bill · {0}", inr(t.total))}
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={(method === "cash" && (cash ?? t.total) < t.total) || (method === "mixed" && paidSum(mixed) !== t.total)} onClick={finish}>
            {method === "upi" ? L("UPI received") : method === "cash" ? L("Cash received") : method === "card" ? L("Card approved") : L("All payments received")} · {inr(t.total)}
          </Button>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center pt-6 text-center">
          <div className={clsx("flex h-20 w-20 animate-pop items-center justify-center rounded-full", waiting ? "bg-saffron-soft" : "bg-jade-soft")}>
            {waiting ? <Clock3 size={42} className="text-saffron" /> : <CheckCircle2 size={44} className="text-jade" />}
          </div>
          <div className="mt-4 text-[34px] font-semibold tracking-tight tnum">{inr((paidBill?.t ?? t).total)}</div>
          <p className="max-w-sm text-[15px] text-muted">
            {waiting
              ? L("{0} is marked paid. The owner confirms it once the money is in; until then the bill stays open.", paidBill?.label ?? label)
              : L("{0} is paid and closed.", paidBill?.label ?? label)}
          </p>
          {stampNote && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-jade-soft px-3.5 py-1.5 text-[14px] font-semibold text-jade-deep">
              <StampIcon size={15} /> {stampNote}
            </div>
          )}
          <div className="mt-8 w-full max-w-sm space-y-3 text-left">
            <Field label={L("Send e-bill on WhatsApp")} hint={L("No paper needed. Opens WhatsApp with the bill typed in.")}>
              <div className="flex gap-2">
                <input className={inputCls} inputMode="tel" placeholder="98220 41187" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Button
                  variant="tinted"
                  className="!h-12 shrink-0"
                  onClick={() => {
                    const d = phone.replace(/\D/g, "").slice(-10);
                    if (d.length !== 10) return toast(L("Add a 10-digit number first"));
                    window.open(`https://wa.me/91${d}?text=${encodeURIComponent(receiptText(receipt()) + (stampNote ? `\n\n🎟️ ${stampNote}` : ""))}`, "_blank");
                  }}
                >
                  <MessageCircle size={17} /> {L("Send")}</Button>
              </div>
            </Field>
            <Button
              variant="tinted"
              className="w-full"
              onClick={async () => {
                const r = receipt();
                const name = `${billFileName(r)}.pdf`;
                const file = new File([receiptPdfBlob(r)], name, { type: "application/pdf" });
                // phones: share sheet → pick WhatsApp and the guest; computers: download it
                if (navigator.canShare?.({ files: [file] })) {
                  try {
                    await navigator.share({ files: [file], text: `Bill from ${r.settings.name || r.outletName}` });
                  } catch {
                    /* closed */
                  }
                  return;
                }
                const url = URL.createObjectURL(file);
                const a = document.createElement("a");
                a.href = url;
                a.download = name;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                toast(L("PDF saved. Attach it in WhatsApp to send."));
              }}
            >
              <FileText size={17} /> {L("Share bill as PDF")}</Button>
            <Button variant="plain" className="w-full" onClick={() => { if (!printReceipt(receipt())) toast(L("Allow pop-ups for this site to print")); }}>
              {L("Print receipt")}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* guest (optional): saved to the guest book and used for the WhatsApp e-bill */}
          <div className="grid grid-cols-[1fr_1.15fr] gap-2">
            <input className={clsx(inputCls, "!h-11 !text-[15px]")} placeholder={L("Customer name")} value={guestName} onChange={(e) => setGuestName(e.target.value)} aria-label={L("Customer name (optional)")} autoComplete="off" />
            <input className={clsx(inputCls, "!h-11 !text-[15px]")} inputMode="tel" placeholder={L("Mobile (optional)")} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d +]/g, ""))} aria-label={L("Customer mobile number (optional)")} autoComplete="off" />
          </div>
          {/* how the guest pays: first, so it's never missed below the fold */}
          {prepaidSum > 0 && (
            <div className="rounded-ctl bg-jade-soft px-3 py-2 text-[13.5px] text-jade-deep">
              {L("Guest already paid")} <b>{L("UPI")} {inr(prepaidSum)}</b> {L("from their phone. Collect")} <b>{inr(Math.max(0, t.total - prepaidSum))}</b> {L("in cash.")}</div>
          )}
          {preferred && !prepaidSum && (
            <div className="flex items-center gap-2 rounded-ctl bg-sky-soft px-3 py-2 text-[13.5px] text-sky">
              {L("Guest chose")} <b>{preferred === "upi" ? "UPI" : preferred === "cash" ? "cash" : "card"}</b> {L("from their phone. You can still change it.")}</div>
          )}
          <div className={clsx("grid gap-2", methods.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
            {methods.map((m) => (
              <button
                key={m.v}
                onClick={() => setMethod(m.v)}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-[16px] px-1 py-3 text-[12.5px] font-semibold transition",
                  method === m.v ? "bg-ink text-canvas" : "bg-surface text-ink hover:bg-sunken",
                )}
              >
                <m.icon size={20} />
                <span className="text-center leading-tight">{L(m.label)}</span>
              </button>
            ))}
          </div>
          {stampsOn && (
            <StampBox
              phoneOk={phoneKey.length === 10}
              name={stampGuest?.name || guestName}
              have={liveCount}
              program={prog}
              rewardAmt={rewardOff(prog, subtotal, allMenu)}
              canRedeem={canRedeem}
              useReward={useReward}
              onUseReward={setUseReward}
              mayGive={mayGive}
              whyNot={rewardAmt > 0 ? "No stamp on the reward bill · the card starts again at 0" : stampWhyNot}
              give={willStamp}
              onGive={(v) => setGiveStamp(v)}
            />
          )}
          {/* totals */}
          <div className="rounded-group bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] text-muted">{L("Amount due")}</span>
              <span className="text-[34px] font-semibold tracking-tight tnum">{inr(t.total)}</span>
            </div>
            <dl className="mt-2 space-y-1 text-[13.5px] text-muted">
              <div className="flex justify-between"><dt>{L("Items")}</dt><dd className="tnum">{inr(t.subtotal, { decimals: true })}</dd></div>
              {t.discount - rewardAmt > 0 && <div className="flex justify-between text-jade"><dt>{discounts.find((d) => d.kind !== "reward")?.label ?? L("Discount")}{coupon && couponCode && normCode(couponCode) === coupon.code ? L(" · from the guest") : ""}</dt><dd className="tnum">−{inr(t.discount - rewardAmt, { decimals: true })}</dd></div>}
              {rewardAmt > 0 && <div className="flex justify-between text-jade"><dt>{L("Stamp card ·")} {prog.reward}</dt><dd className="tnum">−{inr(rewardAmt, { decimals: true })}</dd></div>}
              <div className="flex justify-between"><dt>{L("CGST")} {halfGstLabel()}</dt><dd className="tnum">{inr(t.cgst, { decimals: true })}</dd></div>
              <div className="flex justify-between"><dt>{L("SGST")} {halfGstLabel()}</dt><dd className="tnum">{inr(t.sgst, { decimals: true })}</dd></div>
              <div className="flex justify-between"><dt>{L("Round off")}</dt><dd className="tnum">{t.roundOff.toFixed(2)}</dd></div>
            </dl>
            {canDiscount && <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              {[0, 5, 10].map((p) => (
                <button
                  key={p}
                  onClick={() => { setDiscountPct(p); if (coupon) onCoupon?.(undefined); setCoupon(null); setCustom((c) => ({ ...c, on: false })); }}
                  className={clsx("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold", !coupon && !custom.on && discountPct === p ? "bg-ink text-canvas" : "bg-sunken text-muted")}
                >
                  <Percent size={13} />
                  {p === 0 ? L("No discount") : L("{0}% off", p)}
                </button>
              ))}
              <button
                onClick={() => { if (coupon) onCoupon?.(undefined); setCoupon(null); setCustom((c) => ({ ...c, on: true })); }}
                className={clsx("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold", custom.on && !coupon ? "bg-ink text-canvas" : "bg-sunken text-muted")}
              >
                {L("Custom")}</button>
            </div>}
            {canDiscount && custom.on && !coupon && (
              <div className="mt-2 flex items-center gap-2">
                <div className="inline-flex shrink-0 rounded-ctl bg-sunken p-[3px]" role="tablist" aria-label={L("Discount in % or ₹")}>
                  {(["pct", "flat"] as const).map((k) => (
                    <button key={k} role="tab" aria-selected={custom.kind === k} onClick={() => setCustom((c) => ({ ...c, kind: k }))} className={clsx("rounded-[9px] px-3 py-1.5 text-[13px] font-semibold", custom.kind === k ? "bg-surface text-ink shadow-float" : "text-muted")}>
                      {k === "pct" ? "%" : "₹"}
                    </button>
                  ))}
                </div>
                <input
                  autoFocus
                  className={clsx(inputCls, "!h-10")}
                  inputMode="decimal"
                  placeholder={custom.kind === "pct" ? "e.g. 15" : "e.g. 50"}
                  value={custom.value}
                  onChange={(e) => setCustom((c) => ({ ...c, value: e.target.value.replace(/[^\d.]/g, "") }))}
                  aria-label={custom.kind === "pct" ? L("Discount percent") : L("Discount in rupees")}
                />
                <span className="shrink-0 text-[13px] font-semibold text-jade tnum">−{inr(customOff)}</span>
              </div>
            )}
            {couponsOn && (
              coupon ? (
                <div className="mt-3 flex items-center gap-2 rounded-ctl bg-jade-soft px-3 py-2 text-[13.5px] text-jade-deep">
                  <Ticket size={16} />
                  <span className="flex-1"><b>{coupon.code}</b> · {couponLabel(coupon)}</span>
                  <button aria-label={L("Remove coupon")} onClick={() => { setCoupon(null); onCoupon?.(undefined); }} className="p-1"><X size={15} /></button>
                </div>
              ) : (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const c = coupons.find((x) => x.code === normCode(code));
                    const why = couponProblem(c, subtotal, phone);
                    if (why) return setCodeErr(why);
                    setCodeErr("");
                    setDiscountPct(0);
                    setCustom((x) => ({ ...x, on: false }));
                    setCoupon(c!);
                    onCoupon?.(c!.code);
                  }}
                >
                  <input
                    className={clsx(inputCls, "!h-10 uppercase")}
                    placeholder={L("Coupon code")}
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setCodeErr(""); }}
                    aria-label={L("Coupon code")}
                  />
                  <Button type="submit" variant="tinted" size="sm" className="!h-10 shrink-0" disabled={!code.trim()}>{L("Apply")}</Button>
                </form>
              )
            )}
            {codeErr && <p className="mt-1.5 text-[12.5px] text-rose">{codeErr}</p>}
          </div>


          {method === "upi" && (
            <div className="flex flex-col items-center rounded-group bg-surface p-5 text-center">
              {upi ? (
                <>
                  <ScanQr value={upiUri({ upi, payee: settings.name, amount: t.total, note: label })} size={190} label={L("UPI QR for {0}", inr(t.total))} />
                  <div className="mt-3 text-[15px] font-semibold">{L("Scan with any UPI app —")} {inr(t.total)} {L("fills in by itself")}</div>
                </>
              ) : (
                <div className="text-[15px] font-semibold">{L("Collect")} {inr(t.total)} {L("by UPI")}</div>
              )}
              <div className="text-[13px] text-muted">{upi ? L("{0} · exact amount {1}", upi, inr(t.total)) : L("Add your UPI ID in Settings to show a QR")}</div>
            </div>
          )}

          {method === "cash" && (
            <div className="rounded-group bg-surface p-4">
              <div className="grid grid-cols-3 gap-2">
                {[t.total, Math.ceil(t.total / 100) * 100, Math.ceil(t.total / 500) * 500, 2000, 2500, 5000]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .slice(0, 6)
                  .map((v) => (
                    <button
                      key={v}
                      onClick={() => setCash(v === t.total ? null : v)}
                      className={clsx("rounded-ctl py-3 text-[16px] font-semibold tnum", (cash ?? t.total) === v ? "bg-jade text-white" : "bg-sunken")}
                    >
                      {v === t.total ? L("Exact") : inr(v)}
                    </button>
                  ))}
              </div>
              {cash !== null && cash > t.total && (
                <div className="mt-4 flex items-baseline justify-between rounded-ctl bg-jade-soft px-4 py-3">
                  <span className="text-[15px] font-medium text-jade-deep">{L("Give back")}</span>
                  <span className="text-[24px] font-semibold text-jade-deep tnum">{inr(cash - t.total)}</span>
                </div>
              )}
            </div>
          )}

          {method === "card" && (
            <div className="rounded-group bg-surface p-5 text-center text-[14px] text-muted">
              {L("Tap, dip or swipe on the card machine for")} <b className="text-ink">{inr(t.total)}</b>{L(", then confirm here.")}</div>
          )}

          {method === "mixed" && mixed.length > 0 && <PaymentSplit total={t.total} rows={mixed} onChange={setMixed} />}

          {method === "split" && (
            <div className="rounded-group bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold">{L("Split equally")}</div>
                  <div className="text-[13px] text-muted">{L("Tap each guest when their share is paid.")}</div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-sunken p-1">
                  <button aria-label={L("Fewer guests")} onClick={() => { setGuests((g) => Math.max(2, g - 1)); setPaidGuests([]); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Minus size={15} /></button>
                  <span className="w-6 text-center text-[15px] font-semibold tnum">{guests}</span>
                  <button aria-label={L("More guests")} onClick={() => { setGuests((g) => Math.min(12, g + 1)); setPaidGuests([]); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Plus size={15} /></button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {Array.from({ length: guests }).map((_, i) => {
                  const paid = paidGuests.includes(i);
                  return (
                    <button key={i} type="button" onClick={() => setPaidGuests((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} className="flex w-full items-center gap-3 rounded-ctl bg-sunken/60 px-3 py-2.5 text-left">
                      <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold", paid ? "bg-jade text-white" : "bg-surface text-muted")}>
                        {paid ? <CheckCircle2 size={16} /> : i + 1}
                      </span>
                      <span className="flex-1 text-[14px] font-medium">{L("Guest")} {i + 1}</span>
                      <span className="text-[14px] font-semibold tnum">{inr(i === guests - 1 ? t.total - perGuest * (guests - 1) : perGuest)}</span>
                      <Pill tone={paid ? "jade" : "neutral"}>{paid ? L("Paid") : L("Tap when paid")}</Pill>
                    </button>
                  );
                })}
              </div>
              
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
