"use client";

import clsx from "clsx";
import { Banknote, CheckCircle2, CreditCard, MessageCircle, QrCode, Users, Minus, Plus, Gift, Percent, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Sheet, inputCls, Pill } from "./ui";
import { ScanQr } from "./qr";
import { upiUri } from "./upi";
import { useFeature, useSettings } from "@/lib/live";
import { useToast } from "./toast";
import { inr, GST_RATE } from "@/lib/format";
import { PaymentSplit, paidSum } from "./payment-split";
import type { Payment, PayMethod } from "@/lib/types";

type Method = "upi" | "cash" | "card" | "mixed" | "split";

export function billTotals(subtotal: number, discount = 0) {
  const taxable = Math.max(0, subtotal - discount);
  const gst = Math.round(taxable * GST_RATE * 100) / 100;
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
}: {
  open: boolean;
  onClose: () => void;
  subtotal: number;
  label: string;
  onPaid?: (payments: Payment[]) => void;
  preferred?: PayMethod; // what the guest asked for from their phone
  prepaid?: Payment[]; // already paid by the guest from their phone (e.g. UPI half)
}) {
  const toast = useToast();
  const [method, setMethod] = useState<Method>("upi");
  const [discountPct, setDiscountPct] = useState(0);
  const [cash, setCash] = useState<number | null>(null);
  const [guests, setGuests] = useState(3);
  const [paidGuests, setPaidGuests] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [phone, setPhone] = useState("");
  const [loyalty, setLoyalty] = useState(false);
  const [mixed, setMixed] = useState<Payment[]>([]);

  useEffect(() => {
    if (open) {
      setDone(false);
      setPaidGuests([]);
      setCash(null);
      setDiscountPct(0);
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

  // Demo: guests "pay" one by one on their phones in split mode
  useEffect(() => {
    if (!open || method !== "split" || done) return;
    if (paidGuests.length >= guests) return;
    const id = window.setTimeout(() => setPaidGuests((p) => [...p, p.length]), 1800);
    return () => window.clearTimeout(id);
  }, [open, method, paidGuests, guests, done]);

  const loyaltyOff = loyalty ? 120 : 0;
  const t = billTotals(subtotal, Math.round((subtotal * discountPct) / 100) + loyaltyOff);
  const perGuest = Math.ceil(t.total / guests);
  const settings = useSettings();
  const splitOn = useFeature("splitByGuest") === "ok";
  const upi = settings.upi;
  const prepaidSum = paidSum(prepaid ?? []);

  const methods: { v: Method; label: string; icon: typeof QrCode }[] = [
    { v: "upi", label: "UPI", icon: QrCode },
    { v: "cash", label: "Cash", icon: Banknote },
    { v: "card", label: "Card", icon: CreditCard },
    { v: "mixed", label: "UPI + Cash", icon: Layers },
    ...(splitOn ? [{ v: "split" as Method, label: "Split by guest", icon: Users }] : []),
  ];

  useEffect(() => {
    if (method === "mixed" && mixed.length === 0) setMixed([{ method: "upi", amount: 0 }, { method: "cash", amount: 0 }]);
  }, [method, mixed.length]);

  const finish = () => {
    setDone(true);
    const payments: Payment[] =
      method === "mixed"
        ? mixed.filter((m) => m.amount > 0)
        : method === "split"
          ? [{ method: "upi", amount: t.total }]
          : [{ method, amount: t.total }];
    onPaid?.(payments);
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
            {paidGuests.length < guests ? `Waiting for ${guests - paidGuests.length} guest${guests - paidGuests.length > 1 ? "s" : ""}…` : `Close bill · ${inr(t.total)}`}
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
            <Field label="Send e-bill on WhatsApp" hint="No paper needed. The guest also gets a 1-tap feedback link.">
              <div className="flex gap-2">
                <input className={inputCls} inputMode="tel" placeholder="98220 41187" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Button
                  variant="tinted"
                  className="!h-12 shrink-0"
                  onClick={() => toast(phone ? `E-bill sent to ${phone}` : "Add a number first")}
                >
                  <MessageCircle size={17} /> Send
                </Button>
              </div>
            </Field>
            <Button variant="plain" className="w-full" onClick={() => toast("Sent to printer")}>
              Print receipt
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* totals */}
          <div className="rounded-group bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] text-muted">Amount due</span>
              <span className="text-[34px] font-semibold tracking-tight tnum">{inr(t.total)}</span>
            </div>
            <dl className="mt-2 space-y-1 text-[13.5px] text-muted">
              <div className="flex justify-between"><dt>Items</dt><dd className="tnum">{inr(t.subtotal, { decimals: true })}</dd></div>
              {t.discount > 0 && <div className="flex justify-between text-jade"><dt>Discount</dt><dd className="tnum">−{inr(t.discount, { decimals: true })}</dd></div>}
              <div className="flex justify-between"><dt>CGST 2.5%</dt><dd className="tnum">{inr(t.cgst, { decimals: true })}</dd></div>
              <div className="flex justify-between"><dt>SGST 2.5%</dt><dd className="tnum">{inr(t.sgst, { decimals: true })}</dd></div>
              <div className="flex justify-between"><dt>Round off</dt><dd className="tnum">{t.roundOff.toFixed(2)}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              {[0, 5, 10].map((p) => (
                <button
                  key={p}
                  onClick={() => setDiscountPct(p)}
                  className={clsx("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold", discountPct === p ? "bg-ink text-canvas" : "bg-sunken text-muted")}
                >
                  <Percent size={13} />
                  {p === 0 ? "No discount" : `${p}% off`}
                </button>
              ))}
              <button
                onClick={() => setLoyalty((v) => !v)}
                className={clsx("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold", loyalty ? "bg-saffron text-white" : "bg-sunken text-muted")}
              >
                <Gift size={13} /> Use 1,200 points (₹120)
              </button>
            </div>
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
                  <div className="text-[15px] font-semibold">Each guest pays on their phone</div>
                  <div className="text-[13px] text-muted">They scan the table QR and pay their share by UPI.</div>
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
                    <div key={i} className="flex items-center gap-3 rounded-ctl bg-sunken/60 px-3 py-2.5">
                      <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold", paid ? "bg-jade text-white" : "bg-surface text-muted")}>
                        {paid ? <CheckCircle2 size={16} /> : i + 1}
                      </span>
                      <span className="flex-1 text-[14px] font-medium">Guest {i + 1}</span>
                      <span className="text-[14px] font-semibold tnum">{inr(i === guests - 1 ? t.total - perGuest * (guests - 1) : perGuest)}</span>
                      <Pill tone={paid ? "jade" : "neutral"}>{paid ? "Paid" : "Waiting"}</Pill>
                    </div>
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
