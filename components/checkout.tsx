"use client";

import clsx from "clsx";
import { Banknote, CheckCircle2, CreditCard, FileText, MessageCircle, QrCode, Users, Minus, Plus, Percent, Layers, Ticket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Sheet, inputCls, Pill } from "./ui";
import { ScanQr } from "./qr";
import { upiUri } from "./upi";
import { couponActions, couponLabel, couponOff, couponProblem, guestActions, normCode, useCoupons, useCurrentOutlet, useFeature, useSettings } from "@/lib/live";
import { printReceipt, receiptPdfBlob, receiptText } from "./receipt";
import { useToast } from "./toast";
import { gstRate, halfGstLabel, inr } from "@/lib/format";
import { PaymentSplit, paidSum } from "./payment-split";
import type { Coupon, Payment, PayMethod } from "@/lib/types";

type Method = "upi" | "cash" | "card" | "mixed" | "split";

export function billTotals(subtotal: number, discount = 0) {
  const taxable = Math.max(0, subtotal - discount);
  const gst = Math.round(taxable * gstRate() * 100) / 100;
  const total = Math.round(taxable + gst);
  return { subtotal, discount, taxable, cgst: gst / 2, sgst: gst / 2, roundOff: total - (taxable + gst), total };
}

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
}: {
  open: boolean;
  onClose: () => void;
  subtotal: number;
  label: string;
  onPaid?: (payments: Payment[], extra?: { coupon?: string; discount?: number }) => void;
  preferred?: PayMethod; // what the guest asked for from their phone
  prepaid?: Payment[]; // already paid by the guest from their phone (e.g. UPI half)
  lines?: { name: string; qty: number; price: number }[]; // what's on the bill (for the receipt)
  billNo?: number;
}) {
  const toast = useToast();
  const [method, setMethod] = useState<Method>("upi");
  const [discountPct, setDiscountPct] = useState(0);
  const [cash, setCash] = useState<number | null>(null);
  const [guests, setGuests] = useState(3);
  const [paidGuests, setPaidGuests] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [phone, setPhone] = useState("");
  const [guestName, setGuestName] = useState("");
  const [custom, setCustom] = useState<{ on: boolean; kind: "pct" | "flat"; value: string }>({ on: false, kind: "pct", value: "" });
  const [mixed, setMixed] = useState<Payment[]>([]);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [codeErr, setCodeErr] = useState("");
  const coupons = useCoupons();
  const couponsOn = useFeature("coupons") === "ok";

  useEffect(() => {
    if (open) {
      setDone(false);
      setPaidGuests([]);
      setCash(null);
      setDiscountPct(0);
      setCustom({ on: false, kind: "pct", value: "" });
      setPhone("");
      setGuestName("");
      setCoupon(null);
      setCode("");
      setCodeErr("");
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
  }, [open, preferred, prepaid, subtotal]);

  const customOff = (() => {
    const v = Math.max(0, Number(custom.value) || 0);
    return Math.min(subtotal, Math.round(custom.kind === "pct" ? (subtotal * Math.min(v, 100)) / 100 : v));
  })();
  const t = billTotals(subtotal, coupon ? couponOff(coupon, subtotal) : custom.on ? customOff : Math.round((subtotal * discountPct) / 100));
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
  const outlet = useCurrentOutlet();
  const receipt = () => ({
    settings,
    outletName: outlet.name,
    label,
    billNo,
    lines: lines?.length ? lines : [{ name: "Food & drinks", qty: 1, price: subtotal }],
    totals: t,
    payments: paidWith,
  });
  const finish = () => {
    setDone(true);
    const payments: Payment[] =
      method === "mixed"
        ? mixed.filter((m) => m.amount > 0)
        : method === "split"
          ? [{ method: "upi", amount: t.total }]
          : [{ method, amount: t.total }];
    setPaidWith(payments);
    if (coupon) couponActions.used(coupon.id);
    // a number typed at billing puts this guest (and the bill) in the guest book
    if (phone.replace(/\D/g, "").length >= 10)
      guestActions.fromBill(guestName, phone, { orderNo: billNo ?? 0, amount: t.total, method: payments.map((p) => p.method.toUpperCase()).join(" + ") });
    onPaid?.(payments, { coupon: coupon?.code, discount: t.discount });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={done ? "Paid" : `Charge ${label}`}
      wide
      footer={
        done ? (
          <Button size="lg" className="w-full" onClick={onClose}>
            Start next order
          </Button>
        ) : method === "split" ? (
          <Button size="lg" className="w-full" disabled={paidGuests.length < guests} onClick={finish}>
            {paidGuests.length < guests ? `${guests - paidGuests.length} share${guests - paidGuests.length > 1 ? "s" : ""} left to collect` : `Close bill · ${inr(t.total)}`}
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={(method === "cash" && (cash ?? 0) < t.total) || (method === "mixed" && paidSum(mixed) !== t.total)} onClick={finish}>
            {method === "upi" ? "Payment received" : method === "cash" ? "Cash received" : method === "card" ? "Card approved" : "All payments received"} · {inr(t.total)}
          </Button>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center pt-6 text-center">
          <div className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-jade-soft">
            <CheckCircle2 size={44} className="text-jade" />
          </div>
          <div className="mt-4 text-[34px] font-semibold tracking-tight tnum">{inr(t.total)}</div>
          <p className="text-[15px] text-muted">{label} is paid and closed. Other parties at a shared table keep their own bills.</p>
          <div className="mt-8 w-full max-w-sm space-y-3 text-left">
            <Field label="Send e-bill on WhatsApp" hint="No paper needed. Opens WhatsApp with the bill typed in.">
              <div className="flex gap-2">
                <input className={inputCls} inputMode="tel" placeholder="98220 41187" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Button
                  variant="tinted"
                  className="!h-12 shrink-0"
                  onClick={() => {
                    const d = phone.replace(/\D/g, "").slice(-10);
                    if (d.length !== 10) return toast("Add a 10-digit number first");
                    window.open(`https://wa.me/91${d}?text=${encodeURIComponent(receiptText(receipt()))}`, "_blank");
                  }}
                >
                  <MessageCircle size={17} /> Send
                </Button>
              </div>
            </Field>
            <Button
              variant="tinted"
              className="w-full"
              onClick={async () => {
                const r = receipt();
                const name = `bill-${billNo ?? "receipt"}.pdf`;
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
                toast("PDF saved. Attach it in WhatsApp to send.");
              }}
            >
              <FileText size={17} /> Share bill as PDF
            </Button>
            <Button variant="plain" className="w-full" onClick={() => { if (!printReceipt(receipt())) toast("Allow pop-ups for this site to print"); }}>
              Print receipt
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* guest (optional): saved to the guest book and used for the WhatsApp e-bill */}
          <div className="grid grid-cols-[1fr_1.15fr] gap-2">
            <input className={clsx(inputCls, "!h-11 !text-[15px]")} placeholder="Customer name" value={guestName} onChange={(e) => setGuestName(e.target.value)} aria-label="Customer name (optional)" autoComplete="off" />
            <input className={clsx(inputCls, "!h-11 !text-[15px]")} inputMode="tel" placeholder="Mobile (optional)" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d +]/g, ""))} aria-label="Customer mobile number (optional)" autoComplete="off" />
          </div>
          {/* totals */}
          <div className="rounded-group bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] text-muted">Amount due</span>
              <span className="text-[34px] font-semibold tracking-tight tnum">{inr(t.total)}</span>
            </div>
            <dl className="mt-2 space-y-1 text-[13.5px] text-muted">
              <div className="flex justify-between"><dt>Items</dt><dd className="tnum">{inr(t.subtotal, { decimals: true })}</dd></div>
              {t.discount > 0 && <div className="flex justify-between text-jade"><dt>{coupon ? `Coupon ${coupon.code}` : "Discount"}</dt><dd className="tnum">−{inr(t.discount, { decimals: true })}</dd></div>}
              <div className="flex justify-between"><dt>CGST {halfGstLabel()}</dt><dd className="tnum">{inr(t.cgst, { decimals: true })}</dd></div>
              <div className="flex justify-between"><dt>SGST {halfGstLabel()}</dt><dd className="tnum">{inr(t.sgst, { decimals: true })}</dd></div>
              <div className="flex justify-between"><dt>Round off</dt><dd className="tnum">{t.roundOff.toFixed(2)}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              {[0, 5, 10].map((p) => (
                <button
                  key={p}
                  onClick={() => { setDiscountPct(p); setCoupon(null); setCustom((c) => ({ ...c, on: false })); }}
                  className={clsx("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold", !coupon && !custom.on && discountPct === p ? "bg-ink text-canvas" : "bg-sunken text-muted")}
                >
                  <Percent size={13} />
                  {p === 0 ? "No discount" : `${p}% off`}
                </button>
              ))}
              <button
                onClick={() => { setCoupon(null); setCustom((c) => ({ ...c, on: true })); }}
                className={clsx("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold", custom.on && !coupon ? "bg-ink text-canvas" : "bg-sunken text-muted")}
              >
                Custom
              </button>
            </div>
            {custom.on && !coupon && (
              <div className="mt-2 flex items-center gap-2">
                <div className="inline-flex shrink-0 rounded-ctl bg-sunken p-[3px]" role="tablist" aria-label="Discount in % or ₹">
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
                  aria-label={custom.kind === "pct" ? "Discount percent" : "Discount in rupees"}
                />
                <span className="shrink-0 text-[13px] font-semibold text-jade tnum">−{inr(customOff)}</span>
              </div>
            )}
            {couponsOn && (
              coupon ? (
                <div className="mt-3 flex items-center gap-2 rounded-ctl bg-jade-soft px-3 py-2 text-[13.5px] text-jade-deep">
                  <Ticket size={16} />
                  <span className="flex-1"><b>{coupon.code}</b> · {couponLabel(coupon)}</span>
                  <button aria-label="Remove coupon" onClick={() => setCoupon(null)} className="p-1"><X size={15} /></button>
                </div>
              ) : (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const c = coupons.find((x) => x.code === normCode(code));
                    const why = couponProblem(c, subtotal);
                    if (why) return setCodeErr(why);
                    setCodeErr("");
                    setDiscountPct(0);
                    setCustom((x) => ({ ...x, on: false }));
                    setCoupon(c!);
                  }}
                >
                  <input
                    className={clsx(inputCls, "!h-10 uppercase")}
                    placeholder="Coupon code"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setCodeErr(""); }}
                    aria-label="Coupon code"
                  />
                  <Button type="submit" variant="tinted" size="sm" className="!h-10 shrink-0" disabled={!code.trim()}>Apply</Button>
                </form>
              )
            )}
            {codeErr && <p className="mt-1.5 text-[12.5px] text-rose">{codeErr}</p>}
          </div>

          {/* method */}
          {prepaidSum > 0 && (
            <div className="rounded-ctl bg-jade-soft px-3 py-2 text-[13.5px] text-jade-deep">
              Guest already paid <b>UPI {inr(prepaidSum)}</b> from their phone. Collect <b>{inr(Math.max(0, t.total - prepaidSum))}</b> in cash.
            </div>
          )}
          {preferred && !prepaidSum && (
            <div className="flex items-center gap-2 rounded-ctl bg-sky-soft px-3 py-2 text-[13.5px] text-sky">
              Guest chose <b>{preferred === "upi" ? "UPI" : preferred === "cash" ? "cash" : "card"}</b> from their phone. You can still change it.
            </div>
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
                <span className="text-center leading-tight">{m.label}</span>
              </button>
            ))}
          </div>

          {method === "upi" && (
            <div className="flex flex-col items-center rounded-group bg-surface p-5 text-center">
              <ScanQr value={upiUri({ upi, payee: settings.name, amount: t.total, note: label })} size={190} label={`UPI QR for ${inr(t.total)}`} />
              <div className="mt-3 text-[15px] font-semibold">Scan with any UPI app — {inr(t.total)} fills in by itself</div>
              <div className="text-[13px] text-muted">{upi} · exact amount {inr(t.total)}</div>
              <Pill tone="jade" className="mt-3">Also showing on the guest screen</Pill>
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
                      onClick={() => setCash(v)}
                      className={clsx("rounded-ctl py-3 text-[16px] font-semibold tnum", cash === v ? "bg-jade text-white" : "bg-sunken")}
                    >
                      {v === t.total ? "Exact" : inr(v)}
                    </button>
                  ))}
              </div>
              {cash !== null && cash >= t.total && (
                <div className="mt-4 flex items-baseline justify-between rounded-ctl bg-jade-soft px-4 py-3">
                  <span className="text-[15px] font-medium text-jade-deep">Give back</span>
                  <span className="text-[24px] font-semibold text-jade-deep tnum">{inr(cash - t.total)}</span>
                </div>
              )}
            </div>
          )}

          {method === "card" && (
            <div className="rounded-group bg-surface p-5 text-center text-[14px] text-muted">
              Tap, dip or swipe on the card machine for <b className="text-ink">{inr(t.total)}</b>, then confirm here.
            </div>
          )}

          {method === "mixed" && mixed.length > 0 && <PaymentSplit total={t.total} rows={mixed} onChange={setMixed} />}

          {method === "split" && (
            <div className="rounded-group bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-semibold">Split equally</div>
                  <div className="text-[13px] text-muted">Tap each guest when their share is paid.</div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-sunken p-1">
                  <button aria-label="Fewer guests" onClick={() => { setGuests((g) => Math.max(2, g - 1)); setPaidGuests([]); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Minus size={15} /></button>
                  <span className="w-6 text-center text-[15px] font-semibold tnum">{guests}</span>
                  <button aria-label="More guests" onClick={() => { setGuests((g) => Math.min(12, g + 1)); setPaidGuests([]); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"><Plus size={15} /></button>
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
                      <span className="flex-1 text-[14px] font-medium">Guest {i + 1}</span>
                      <span className="text-[14px] font-semibold tnum">{inr(i === guests - 1 ? t.total - perGuest * (guests - 1) : perGuest)}</span>
                      <Pill tone={paid ? "jade" : "neutral"}>{paid ? "Paid" : "Tap when paid"}</Pill>
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
