"use client";

// How the guest pays from their phone: UPI (exact-amount QR), cash, cash + UPI,
// or card. And the thank-you screen they see once the bill is settled.

import { tx, type GuestLang as Lang } from "@/lib/guest-lang";
import clsx from "clsx";
import { Banknote, Check, CreditCard, Layers, Lock, QrCode, Star, Ticket, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./ui";
import { UpiPayCard } from "./upi";
import { useToast } from "./toast";
import { inr } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { guestCoupon, type GuestCoupon } from "@/lib/cloud";
import { currentOutletId } from "@/lib/live";


export type GuestPayChoice = "upi" | "cash" | "mixed" | "card";

/** The body of the pay sheet. The parent decides what happens on each outcome. */
export function PayPanel({
  amount,
  upi,
  payee,
  note,
  lang,
  allowCard = true,
  cashWhere,
  onUpiPaid,
  onCash,
  onCard,
  onMixed,
  online,
  onOnline,
  onlineBusy = false,
  onlineAmount,
}: {
  /** what the gateway will charge, when it differs (a tip is not taken online) */
  onlineAmount?: number;
  /** the outlet takes payments on its own gateway: the guest can pay in the gateway's checkout */
  online?: { provider: "razorpay" | "cashfree"; mode: "test" | "live" } | null;
  onOnline?: () => void;
  onlineBusy?: boolean;
  amount: number;
  upi: string;
  payee: string;
  note: string;
  lang: Lang;
  allowCard?: boolean;
  cashWhere: "table" | "counter";
  onUpiPaid: () => void;
  onCash: () => void;
  onCard: () => void;
  onMixed: (upiPart: number, cashPart: number) => void;
}) {
  const toast = useToast();
  const [m, setM] = useState<GuestPayChoice>("upi");
  const half = Math.max(0, Math.round(amount / 2 / 10) * 10);
  const [cashPart, setCashPart] = useState(half);
  useEffect(() => setCashPart(Math.max(0, Math.round(amount / 2 / 10) * 10)), [amount]);
  const upiPart = Math.max(0, amount - cashPart);
  // "I've paid" only after the guest went to pay (UPI app opened), or says they scanned the QR
  const [opened, setOpened] = useState(false);
  const [scanned, setScanned] = useState(false);
  useEffect(() => { setOpened(false); setScanned(false); }, [m, amount, upiPart]);
  const canConfirm = opened || scanned;
  const confirmGate = (button: ReactNode) =>
    canConfirm ? (
      <div className="mt-4 animate-fade-in">
        <p className="mb-2 rounded-[12px] bg-saffron-soft px-3 py-2 text-[13px] font-medium text-ink/80">
          {tx(lang, "Tap this only after the money has gone from your UPI app. The restaurant will check it.", "UPI ॲपमधून पैसे गेल्यानंतरच हे दाबा. रेस्टॉरंट ते तपासेल.")}
        </p>
        {button}
      </div>
    ) : (
      <button onClick={() => setScanned(true)} className="mt-4 w-full text-center text-[13.5px] font-semibold text-muted underline underline-offset-4">
        {tx(lang, "Already paid by scanning the QR?", "QR स्कॅन करून आधीच भरलं?")}
      </button>
    );

  const choices: { v: GuestPayChoice; label: string; icon: typeof QrCode }[] = [
    { v: "upi", label: tx(lang, "UPI", "UPI"), icon: QrCode },
    { v: "cash", label: tx(lang, "Cash", "रोख"), icon: Banknote },
    { v: "mixed", label: tx(lang, "Cash + UPI", "रोख + UPI"), icon: Layers },
    ...(allowCard ? [{ v: "card" as const, label: tx(lang, "Card", "कार्ड"), icon: CreditCard }] : []),
  ];
  const where = cashWhere === "counter" ? tx(lang, "at the counter", "काउंटरवर") : tx(lang, "to your captain", "कॅप्टनकडे");

  return (
    <div className="space-y-4">
      {online && onOnline && (
        <div className="rounded-group bg-jade-soft p-4">
          <Button size="lg" className="w-full" disabled={onlineBusy} onClick={onOnline}>
            <Lock size={17} /> {onlineBusy ? tx(lang, "Opening payment…", "पेमेंट उघडत आहे…") : tx(lang, `Pay ${inr(onlineAmount ?? amount)} online`, `${inr(onlineAmount ?? amount)} ऑनलाइन भरा`)}
          </Button>
          <p className="mt-2 text-center text-[12.5px] leading-snug text-jade-deep">
            {tx(lang, "Any UPI app or card · the bill closes by itself", "कोणतेही UPI ॲप किंवा कार्ड · बिल आपोआप बंद होते")}
            {onlineAmount != null && onlineAmount < amount && <span className="block">{tx(lang, "Tip is not added online. Give it to the staff if you like.", "ऑनलाइन टिप जोडली जात नाही. हवी असल्यास स्टाफला द्या.")}</span>}
            <span className="block text-jade-deep/70">{tx(lang, `Secure payment by ${online.provider === "razorpay" ? "Razorpay" : "Cashfree"}`, `${online.provider === "razorpay" ? "Razorpay" : "Cashfree"} द्वारे सुरक्षित पेमेंट`)}{online.mode === "test" ? " · TEST" : ""}</span>
          </p>
        </div>
      )}
      {online && onOnline && <div className="text-center text-[12.5px] font-semibold uppercase tracking-wider text-faint">{tx(lang, "or pay another way", "किंवा दुसऱ्या प्रकारे भरा")}</div>}
      <div className={clsx("grid gap-2", choices.length === 4 ? "grid-cols-4" : "grid-cols-3")} role="radiogroup" aria-label={tx(lang, "How will you pay?", "कसे भरणार?")}>
        {choices.map(({ v, label, icon: I }) => (
          <button
            key={v}
            role="radio"
            aria-checked={m === v}
            onClick={() => setM(v)}
            className={clsx("flex flex-col items-center gap-1.5 rounded-[16px] px-1 py-3 text-[12.5px] font-semibold", m === v ? "bg-ink text-canvas" : "bg-surface")}
          >
            <I size={19} /> <span className="leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {m === "upi" && (
        <div className="rounded-group bg-surface p-5">
          <UpiPayCard upi={upi} payee={payee} amount={amount} note={note} onOpen={() => setOpened(true)} onCopy={() => toast(tx(lang, "UPI ID copied", "UPI ID कॉपी केला"))} />
          {confirmGate(
            <Button size="lg" className="w-full" onClick={onUpiPaid}>
              <Check size={18} /> {tx(lang, `I've paid ${inr(amount)}`, `${inr(amount)} भरले`)}
            </Button>,
          )}
        </div>
      )}

      {m === "cash" && (
        <div className="rounded-group bg-surface p-5 text-center">
          <Banknote size={30} className="mx-auto text-saffron" />
          <p className="mt-3 text-[15px]">{tx(lang, `Pay ${inr(amount)} in cash ${where}.`, `${inr(amount)} रोख ${where} द्या.`)}</p>
          <Button size="lg" className="mt-4 w-full" onClick={onCash}>{tx(lang, `I'll pay ${inr(amount)} in cash`, `${inr(amount)} रोख देईन`)}</Button>
        </div>
      )}

      {m === "card" && (
        <div className="rounded-group bg-surface p-5 text-center">
          <CreditCard size={30} className="mx-auto text-sky" />
          <p className="mt-3 text-[15px]">{cashWhere === "counter" ? tx(lang, "Tap or swipe your card at the counter.", "काउंटरवर कार्ड वापरा.") : tx(lang, "Your captain will bring the card machine.", "कॅप्टन कार्ड मशीन आणेल.")}</p>
          <Button size="lg" className="mt-4 w-full" onClick={onCard}>{tx(lang, `Pay ${inr(amount)} by card`, `${inr(amount)} कार्डने भरा`)}</Button>
        </div>
      )}

      {m === "mixed" && (
        <div className="space-y-4 rounded-group bg-surface p-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">{tx(lang, "Cash part", "रोख भाग")}</span>
              <span className="text-[13px] text-muted">{tx(lang, "Slide to choose", "सरकवून निवडा")}</span>
            </div>
            <input
              type="range"
              className="range-single"
              min={0}
              max={amount}
              step={10}
              value={cashPart}
              aria-label={tx(lang, "Cash amount", "रोख रक्कम")}
              onChange={(e) => setCashPart(Math.min(amount, Number(e.target.value)))}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-ctl bg-saffron-soft py-2.5">
                <div className="text-[12px] font-semibold text-saffron">{tx(lang, "Cash", "रोख")}</div>
                <div className="text-[19px] font-semibold tnum">{inr(cashPart)}</div>
              </div>
              <div className="rounded-ctl bg-jade-soft py-2.5">
                <div className="text-[12px] font-semibold text-jade">UPI</div>
                <div className="text-[19px] font-semibold tnum">{inr(upiPart)}</div>
              </div>
            </div>
          </div>
          {upiPart > 0 ? (
            <>
              <UpiPayCard upi={upi} payee={payee} amount={upiPart} note={`${note} (UPI part)`} size={170} compact onOpen={() => setOpened(true)} onCopy={() => toast(tx(lang, "UPI ID copied", "UPI ID कॉपी केला"))} />
              {confirmGate(
                <Button size="lg" className="w-full" disabled={cashPart <= 0} onClick={() => onMixed(upiPart, cashPart)}>
                  <Check size={18} /> {tx(lang, `Paid ${inr(upiPart)} UPI · ${inr(cashPart)} cash ${where}`, `${inr(upiPart)} UPI भरले · ${inr(cashPart)} रोख`)}
                </Button>,
              )}
            </>
          ) : (
            <p className="text-center text-[14px] text-muted">{tx(lang, "That's all cash — choose Cash above.", "हे सगळं रोख आहे — वर 'रोख' निवडा.")}</p>
          )}
        </div>
      )}

      <p className="text-center text-[12px] text-faint">{tx(lang, "Money goes straight to the restaurant's UPI ID. No extra charges.", "पैसे थेट रेस्टॉरंटच्या UPI ID वर जातात. अतिरिक्त शुल्क नाही.")}</p>
    </div>
  );
}

/** Full-screen thank you, shown once the bill is settled. Rating is saved for the owner. */
export function ThankYou({
  name,
  place,
  payments,
  orderNo,
  token,
  lang,
  pending = false,
  closed = false,
  onRate,
  onClose,
  children,
  stamp,
}: {
  /** the guest's stamp card, shown under the rating */
  stamp?: ReactNode;
  /** the visit is over (own page): no "Done", ask to scan the QR to order again */
  closed?: boolean;
  /** the guest says they paid; the owner hasn't confirmed it yet */
  pending?: boolean;
  name?: string;
  place: string;
  payments: Payment[];
  orderNo?: number;
  token?: number;
  lang: Lang;
  onRate: (stars: number, text: string) => void;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const label = (p: Payment) => (p.method === "upi" ? "UPI" : p.method === "cash" ? tx(lang, "Cash", "रोख") : tx(lang, "Card", "कार्ड"));
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md animate-fade-in flex-col overflow-y-auto bg-canvas px-5 pb-6 pt-12" role="dialog" aria-label="Thank you">
      <div className="flex flex-1 flex-col items-center text-center">
        <div className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-jade text-white"><Check size={40} strokeWidth={2.5} /></div>
        <h1 className="mt-5 text-[30px] font-semibold tracking-tight">{tx(lang, `Thank you${name ? `, ${name.split(" ")[0]}` : ""}!`, `धन्यवाद${name ? `, ${name.split(" ")[0]}` : ""}!`)}</h1>
        <p className="mt-1 text-[15px] text-muted">{tx(lang, `Thanks for visiting ${place}. See you again soon 🙏`, `${place} ला भेट दिल्याबद्दल धन्यवाद. पुन्हा या 🙏`)}</p>

        <div className="mt-6 w-full rounded-[22px] bg-surface p-4 text-left">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] text-muted">{pending ? tx(lang, "Payment sent", "पैसे पाठवले") : tx(lang, "Paid", "भरले")}</span>
            <span className="text-[26px] font-semibold tnum">{inr(total)}</span>
          </div>
          <div className={clsx("mt-2 flex items-center gap-2 rounded-[12px] px-3 py-2 text-[13.5px] font-semibold", pending ? "bg-saffron-soft text-saffron" : "bg-jade-soft text-jade-deep")}>
            {pending ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-saffron" /> : <Check size={15} strokeWidth={2.6} />}
            {pending ? tx(lang, "Confirming with the owner · nothing more to pay", "मालकाकडून खात्री होत आहे · आणखी काही भरायचं नाही") : tx(lang, "Confirmed by the restaurant", "रेस्टॉरंटने खात्री केली")}
          </div>
          {payments.length > 0 && (
            <div className="mt-1 text-[13.5px] text-muted">{payments.map((p) => `${label(p)} ${inr(p.amount)}`).join(" + ")}</div>
          )}
          {(token || orderNo) && (
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-[14px] text-muted">{token ? tx(lang, "Your token", "तुमचा टोकन") : tx(lang, "Order", "ऑर्डर")}</span>
              <span className="text-[22px] font-semibold tnum">#{token ?? orderNo}</span>
            </div>
          )}
          {children}
        </div>

        <div className="mt-6 text-[17px] font-semibold">{tx(lang, "How was everything?", "सगळं कसं होतं?")}</div>
        {sent ? (
          <p className="mt-2 text-[14px] text-jade">{tx(lang, "Thanks — we read every rating.", "धन्यवाद — आम्ही प्रत्येक रेटिंग वाचतो.")}</p>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} aria-label={`${s} stars`} onClick={() => setStars(s)}>
                  <Star size={36} className={s <= stars ? "fill-saffron text-saffron" : "text-line"} />
                </button>
              ))}
            </div>
            {stars > 0 && (
              <div className="mt-4 w-full animate-fade-in text-left">
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={stars >= 4 ? tx(lang, "What did you like? (optional)", "काय आवडलं? (ऐच्छिक)") : tx(lang, "What went wrong? It goes straight to the owner.", "काय चुकलं? थेट मालकाला जाईल.")}
                  className="w-full rounded-ctl bg-surface p-3 text-[15px] outline-none ring-1 ring-line focus:ring-1 focus:ring-jade/40"
                />
                <Button size="lg" variant="tinted" className="mt-2 w-full" onClick={() => { onRate(stars, text); setSent(true); }}>
                  {tx(lang, "Send rating", "रेटिंग पाठवा")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {stamp}
      {closed ? (
        <div className="mt-6 flex w-full items-center gap-3 rounded-[18px] bg-surface p-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jade-soft text-jade-deep"><QrCode size={20} /></span>
          <span className="text-[14px] leading-snug text-muted">
            <b className="block text-[15px] text-ink">{tx(lang, "Your visit is complete", "तुमची भेट पूर्ण झाली")}</b>
            {tx(lang, "Want to order again? Scan the QR on your table.", "पुन्हा ऑर्डर करायची आहे? टेबलवरचा QR पुन्हा स्कॅन करा.")}
          </span>
        </div>
      ) : (
        <Button size="lg" className="mt-6 w-full" onClick={onClose}>{tx(lang, "Done", "झालं")}</Button>
      )}
    </div>
  );
}

/** Discount of a coupon on this many rupees of food (0 when the bill is too small). */
export function guestCouponOff(c: GuestCoupon | null, subtotal: number) {
  if (!c || (c.minBill && subtotal < c.minBill)) return 0;
  const raw = c.kind === "percent" ? (subtotal * c.value) / 100 : c.value;
  return Math.max(0, Math.min(subtotal, Math.round(c.kind === "percent" && c.maxOff ? Math.min(raw, c.maxOff) : raw)));
}
const couponText = (c: GuestCoupon, lang: Lang) =>
  c.kind === "percent"
    ? tx(lang, `${c.value}% off${c.maxOff ? ` (up to ${inr(c.maxOff)})` : ""}`, `${c.value}% सूट${c.maxOff ? ` (${inr(c.maxOff)} पर्यंत)` : ""}`)
    : tx(lang, `${inr(c.value)} off`, `${inr(c.value)} सूट`);

/** "Have a coupon code?" on the guest's bill: type the code from the restaurant's WhatsApp message. */
export function CouponBox({ lang, subtotal, applied, onChange, phone }: { lang: Lang; subtotal: number; applied: GuestCoupon | null; onChange: (c: GuestCoupon | null) => void; phone?: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (applied) {
    const off = guestCouponOff(applied, subtotal);
    return (
      <div className="flex items-center gap-3 rounded-group bg-jade-soft p-3.5 text-jade-deep">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"><Ticket size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{applied.code} · {couponText(applied, lang)}</div>
          <div className="text-[12.5px] text-jade-deep/80">
            {off > 0
              ? tx(lang, `You save ${inr(off)} on this bill`, `या बिलावर ${inr(off)} वाचले`)
              : tx(lang, `Works on bills of ${inr(applied.minBill ?? 0)} or more`, `${inr(applied.minBill ?? 0)} किंवा जास्तच्या बिलावर`)}
          </div>
        </div>
        <button type="button" aria-label={tx(lang, "Remove coupon", "कूपन काढा")} onClick={() => onChange(null)} className="p-1.5"><X size={16} /></button>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-group border-[1.5px] border-dashed border-line bg-surface p-3.5 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jade-soft text-jade"><Ticket size={17} /></span>
        <span className="flex-1 text-[15px] font-semibold">{tx(lang, "Have a coupon code?", "कूपन कोड आहे?")}</span>
        <span className="text-[13.5px] font-semibold text-jade">{tx(lang, "Apply", "वापरा")}</span>
      </button>
    );
  }
  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 3) return setErr(tx(lang, "Enter the code", "कोड टाका"));
    setBusy(true);
    setErr("");
    const r = await guestCoupon(c, currentOutletId(), phone).catch(() => ({ problem: "Couldn't check the code. Try again." }) as { coupon?: GuestCoupon; problem?: string });
    setBusy(false);
    if (!r.coupon) return setErr(r.problem ?? "No coupon with this code");
    if (r.coupon.minBill && subtotal < r.coupon.minBill) return setErr(tx(lang, `Works on bills of ${inr(r.coupon.minBill)} or more`, `${inr(r.coupon.minBill)} किंवा जास्तच्या बिलावरच चालतो`));
    onChange(r.coupon);
    setOpen(false);
    setCode("");
  };
  return (
    <form onSubmit={apply} className="rounded-group bg-surface p-3.5">
      <div className="mb-2 text-[14px] font-semibold">{tx(lang, "Coupon code", "कूपन कोड")}</div>
      <div className="flex gap-2">
        <input
          autoFocus
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)); setErr(""); }}
          placeholder={tx(lang, "e.g. WELCOME10", "उदा. WELCOME10")}
          aria-label={tx(lang, "Coupon code", "कूपन कोड")}
          autoCapitalize="characters"
          className="h-11 min-w-0 flex-1 rounded-ctl bg-canvas px-3.5 text-[15px] font-semibold uppercase tracking-wide outline-none ring-1 ring-line focus:ring-jade/40"
        />
        <Button type="submit" disabled={busy}>{busy ? "…" : tx(lang, "Apply", "वापरा")}</Button>
      </div>
      {err && <p className="mt-2 text-[13px] font-medium text-rose">{err}</p>}
    </form>
  );
}
