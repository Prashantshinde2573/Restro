"use client";

import { Copy, Download, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { ScanQr } from "./qr";
import { inr } from "@/lib/format";

/** name@bank — the shape every UPI ID has (e.g. saffronlane@okhdfc). */
// The part after "@" is the bank's handle (okaxis, ybl, paytm…): letters and digits, never a
// domain — "name@gmail.com" is an email address, not a UPI ID, and UPI apps reject it.
export const isValidUpi = (v: string) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(v.trim());

/**
 * Standard UPI deep link. Every UPI app (GPay, PhonePe, Paytm, BHIM, bank apps)
 * reads it, so scanning the QR — or tapping the link on the same phone — opens
 * the app with our UPI ID and the exact amount already filled in.
 */
// No message (tn) goes into the payment: only the UPI ID, the name and the amount (owner's choice, 25 Nov 2026).
// `note` stays in the type so callers don't change; it is not sent.
export function upiUri({ upi, payee, amount }: { upi: string; payee: string; amount: number; note?: string }) {
  // Keep "@" in the UPI ID unescaped and the name plain ASCII: a few UPI apps
  // reject "%40" or non-ASCII characters in a scanned link.
  // accents become plain letters first ("Café" → "Cafe"), anything else non-ASCII becomes "-"
  const enc = (v: string) => encodeURIComponent(v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "-").replace(/\s+/g, " ").trim());
  const parts = [`pa=${upi.trim()}`, `pn=${enc(payee.slice(0, 40))}`, `am=${amount.toFixed(2)}`, "cu=INR"];
  return `upi://pay?${parts.join("&")}`;
}

/** The payment QR as a picture on the phone (share sheet, or a download), to scan from the gallery. */
export async function saveQr(uri: string, amount: number) {
  try {
    const url = await QRCode.toDataURL(uri, { margin: 3, width: 720, errorCorrectionLevel: "M" });
    const name = `upi-pay-${Math.round(amount)}.png`;
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch {
        /* closed the share sheet: fall back to a download */
      }
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  } catch {
    /* nothing to do: the QR on screen still works from another phone */
  }
}

/** QR for one exact amount + "open UPI app" for guests paying on the same phone. */
export function UpiPayCard({
  upi,
  payee,
  amount,
  note,
  size = 200,
  compact,
  onCopy,
  onOpen,
  downloadOnly = false,
  onSaved,
}: {
  /** the guest tapped "Pay with a UPI app" */
  onOpen?: () => void;
  upi: string;
  payee: string;
  amount: number;
  note?: string;
  size?: number;
  compact?: boolean;
  onCopy?: () => void;
  /** no "open UPI app" link (UPI apps refuse it for a personal UPI ID): the guest saves the QR and pays from their app */
  downloadOnly?: boolean;
  /** the guest saved the QR */
  onSaved?: () => void;
}) {
  if (!isValidUpi(upi)) {
    return (
      <div className="rounded-group bg-rose-soft px-4 py-3 text-[14px] text-rose">
        No valid UPI ID is set for this outlet yet. Add it in Settings → Payments.
      </div>
    );
  }
  const uri = upiUri({ upi, payee, amount, note });
  return (
    <div className="flex flex-col items-center text-center">
      {!compact && <div className="text-[13px] font-medium text-muted">Pay {payee}</div>}
      <div className="text-[30px] font-semibold tracking-tight tnum">{inr(amount)}</div>
      <div className="mt-3 rounded-[20px] bg-white p-3 shadow-float">
        <ScanQr value={uri} size={size} label={`UPI QR for ${inr(amount)} to ${upi}`} />
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(upi).catch(() => {});
          onCopy?.();
        }}
        className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted"
      >
        {upi} <Copy size={13} />
      </button>
      <p className="mt-1 text-[12.5px] text-faint">Scan with any UPI app — the amount fills in by itself.</p>
      {downloadOnly ? (
        <>
          <button
            onClick={() => { void saveQr(uri, amount); onSaved?.(); }}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-ctl bg-ink text-[15px] font-semibold text-canvas"
          >
            <Download size={17} /> Download QR &amp; pay {inr(amount)}
          </button>
          <p className="mt-2 text-[12.5px] leading-snug text-muted">Open your UPI app → Scan → pick the saved QR from your photos.</p>
        </>
      ) : (
      <>
      {/* On a phone the guest can't scan their own screen: open the UPI app directly. */}
      <a
        href={uri}
        onClick={() => onOpen?.()}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-ctl bg-ink text-[15px] font-semibold text-canvas md:hidden"
      >
        <Smartphone size={17} /> Pay {inr(amount)} with a UPI app
      </a>
      {/* UPI apps often refuse "tap to pay" links to a personal UPI ID; scanning the same QR from the
          gallery is allowed, so the guest can save it and scan it in their app */}
      <div className="mt-3 w-full rounded-[14px] bg-sunken/70 px-3 py-2.5 text-left text-[12.5px] leading-snug text-muted md:hidden">
        App says <b className="text-ink">declined</b> or nothing happens? Save the QR, open your UPI app → Scan → pick the photo.
        <button onClick={() => void saveQr(uri, amount)} className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-surface text-[13px] font-semibold text-ink ring-1 ring-line">
          <Download size={15} /> Save QR
        </button>
      </div>
      </>
      )}
    </div>
  );
}
