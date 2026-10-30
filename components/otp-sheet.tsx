"use client";

import clsx from "clsx";
import { Check, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, Sheet } from "./ui";

export interface GuestProfile {
  name: string;
  phone: string;
  optIn: boolean;
}

/**
 * Asked once, right before the first order is sent — not when the guest
 * opens the menu. Name + mobile → done. Remembered on the phone.
 * (No SMS code: SMS costs money per message. Add phone OTP later if needed.)
 */
export function OtpSheet({ open, onClose, onVerified, lang }: { open: boolean; onClose: () => void; onVerified: (g: GuestProfile) => void; lang: "en" | "mr" }) {
  const mr = lang === "mr";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(true);

  const digits = phone.replace(/\D/g, "");
  const validPhone = /^[6-9]\d{9}$/.test(digits);
  const go = () => {
    if (!name.trim() || !validPhone) return;
    onVerified({ name: name.trim(), phone: digits.slice(-10), optIn });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mr ? "ऑर्डर पाठवण्याआधी" : "One quick step"}
      footer={
        <Button size="lg" className="w-full" disabled={!name.trim() || !validPhone} onClick={go}>
          {mr ? "पुढे" : "Continue"}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-[15px] text-muted">
          {mr ? "तुमची ऑर्डर ओळखण्यासाठी नाव आणि नंबर. एकदाच विचारतो." : "So the restaurant knows whose order it is. We only ask once."}
        </p>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">{mr ? "तुमचं नाव" : "Your name"}</span>
          <input autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={mr ? "उदा. नेहा" : "e.g. Neha"} className="h-12 w-full rounded-ctl bg-surface px-4 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-jade" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">{mr ? "मोबाईल नंबर" : "Mobile number"}</span>
          <div className="flex gap-2">
            <span className="flex h-12 items-center rounded-ctl bg-surface px-3 text-[16px] ring-1 ring-line">+91</span>
            <input autoComplete="tel-national" inputMode="tel" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="98220 41187" className="h-12 w-full rounded-ctl bg-surface px-4 text-[16px] outline-none ring-1 ring-line tnum focus:ring-2 focus:ring-jade" />
          </div>
          {digits.length >= 10 && !validPhone && <span className="mt-1 block text-[13px] text-rose">{mr ? "10 अंकी मोबाईल नंबर टाका" : "Enter a 10-digit Indian mobile number"}</span>}
        </label>
        <button onClick={() => setOptIn((v) => !v)} className="flex w-full items-start gap-3 text-left" aria-pressed={optIn}>
          <span className={clsx("mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-2", optIn ? "border-jade bg-jade text-white" : "border-line")}>
            {optIn && <Check size={13} strokeWidth={3} />}
          </span>
          <span className="text-[14px] text-muted">{mr ? "WhatsApp वर ऑफर्स पाठवा" : "Send me offers on WhatsApp"}</span>
        </button>
        <p className="flex items-start gap-2 text-[12.5px] text-faint">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          {mr ? "तुमचा नंबर फक्त या रेस्टॉरंटकडे राहतो." : "Your number stays with this restaurant only."}
        </p>
      </div>
    </Sheet>
  );
}
