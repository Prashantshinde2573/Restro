"use client";

import { Copy, Smartphone } from "lucide-react";
import { ScanQr } from "./qr";
import { inr } from "@/lib/format";

/** name@bank — the shape every UPI ID has (e.g. saffronlane@okhdfc). */
export const isValidUpi = (v: string) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(v.trim());

/**
 * Standard UPI deep link. Every UPI app (GPay, PhonePe, Paytm, BHIM, bank apps)
 * reads it, so scanning the QR — or tapping the link on the same phone — opens
 * the app with our UPI ID and the exact amount already filled in.
 */
export function upiUri({ upi, payee, amount, note }: { upi: string; payee: string; amount: number; note?: string }) {
  // Keep "@" in the UPI ID unescaped and the note plain ASCII: a few UPI apps
  // reject "%40" or non-ASCII characters in a scanned link.
  const enc = (v: string) => encodeURIComponent(v.replace(/[^\x20-\x7E]/g, "-").replace(/\s+/g, " ").trim());
  const parts = [`pa=${upi.trim()}`, `pn=${enc(payee.slice(0, 40))}`, `am=${amount.toFixed(2)}`, "cu=INR"];
  if (note) parts.push(`tn=${enc(note.slice(0, 50))}`);
  return `upi://pay?${parts.join("&")}`;
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
}: {
  upi: string;
  payee: string;
  amount: number;
  note?: string;
  size?: number;
  compact?: boolean;
  onCopy?: () => void;
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
      {/* On a phone the guest can't scan their own screen: open the UPI app directly. */}
      <a
        href={uri}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-ctl bg-ink text-[15px] font-semibold text-canvas md:hidden"
      >
        <Smartphone size={17} /> Pay {inr(amount)} with a UPI app
      </a>
    </div>
  );
}
