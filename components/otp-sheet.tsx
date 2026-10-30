"use client";

import clsx from "clsx";
import { Check, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Sheet } from "./ui";

export interface GuestProfile {
  name: string;
  phone: string;
  optIn: boolean;
}

const DEMO_CODE = "2468"; // Firebase phase: real SMS/WhatsApp OTP via Firebase Phone Auth

/**
 * Asked once, right before the first order is sent — not when the guest
 * opens the menu. Name + mobile → 4-digit code → done. Remembered on the phone.
 */
export function OtpSheet({ open, onClose, onVerified, lang }: { open: boolean; onClose: () => void; onVerified: (g: GuestProfile) => void; lang: "en" | "mr" }) {
  const mr = lang === "mr";
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const verifiedRef = useRef(onVerified);
  verifiedRef.current = onVerified;

  useEffect(() => {
    if (open) {
      setStep("details");
      setCode("");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  // Check the code once, when the 4th digit is typed.
  const submitCode = (value: string) => {
    if (value.length !== 4) return;
    if (value === DEMO_CODE) {
      setCode("");
      verifiedRef.current({ name: name.trim(), phone: phone.replace(/\D/g, "").slice(-10), optIn });
    } else {
      setError(mr ? "कोड चुकीचा आहे. पुन्हा टाका." : "That code isn't right. Try again.");
      setCode("");
    }
  };

  const digits = phone.replace(/\D/g, "");
  const validPhone = /^[6-9]\d{9}$/.test(digits);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={step === "details" ? (mr ? "ऑर्डर पाठवण्याआधी" : "One quick step") : mr ? "कोड टाका" : "Enter the code"}
      footer={
        step === "details" ? (
          <Button size="lg" className="w-full" disabled={!name.trim() || !validPhone} onClick={() => { setStep("code"); setWait(30); window.setTimeout(() => codeRef.current?.focus(), 250); }}>
            {mr ? "कोड पाठवा" : "Send code"}
          </Button>
        ) : undefined
      }
    >
      {step === "details" ? (
        <div className="space-y-4">
          <p className="text-[15px] text-muted">
            {mr ? "तुमचं बिल आणि ऑर्डरची माहिती या नंबरवर येईल. एकदाच विचारतो." : "We'll send your bill and order updates to this number. We only ask once."}
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{mr ? "तुमचं नाव" : "Your name"}</span>
            <input autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={mr ? "उदा. नेहा" : "e.g. Neha"} className="h-12 w-full rounded-ctl bg-surface px-4 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-jade" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{mr ? "मोबाईल नंबर" : "Mobile number"}</span>
            <div className="flex gap-2">
              <span className="flex h-12 items-center rounded-ctl bg-surface px-3 text-[16px] ring-1 ring-line">+91</span>
              <input autoComplete="tel-national" inputMode="tel" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98220 41187" className="h-12 w-full rounded-ctl bg-surface px-4 text-[16px] outline-none ring-1 ring-line tnum focus:ring-2 focus:ring-jade" />
            </div>
            {digits.length >= 10 && !validPhone && <span className="mt-1 block text-[13px] text-rose">{mr ? "10 अंकी मोबाईल नंबर टाका" : "Enter a 10-digit Indian mobile number"}</span>}
          </label>
          <button onClick={() => setOptIn((v) => !v)} className="flex w-full items-start gap-3 text-left" aria-pressed={optIn}>
            <span className={clsx("mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-2", optIn ? "border-jade bg-jade text-white" : "border-line")}>
              {optIn && <Check size={13} strokeWidth={3} />}
            </span>
            <span className="text-[14px] text-muted">{mr ? "WhatsApp वर ऑफर्स आणि वाढदिवसाची भेट पाठवा" : "Send me offers and a birthday treat on WhatsApp"}</span>
          </button>
          <p className="flex items-start gap-2 text-[12.5px] text-faint">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            {mr ? "तुमचा नंबर फक्त या रेस्टॉरंटकडे राहतो. कधीही बंद करता येईल." : "Your number stays with this restaurant only. You can opt out any time."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[15px] text-muted">
            {mr ? `+91 ${digits} वर 4 अंकी कोड पाठवला आहे.` : `We sent a 4-digit code to +91 ${digits}.`}{" "}
            <button onClick={() => setStep("details")} className="font-semibold text-jade">{mr ? "नंबर बदला" : "Change"}</button>
          </p>
          <input
            ref={codeRef}
            aria-label="4-digit code"
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setError("");
              setCode(v);
              submitCode(v);
            }}
            className={clsx("h-16 w-full rounded-[16px] bg-surface text-center text-[30px] font-semibold tracking-[0.6em] outline-none ring-1 tnum focus:ring-2 focus:ring-jade", error ? "ring-rose" : "ring-line")}
          />
          {error && <p className="text-[14px] font-medium text-rose">{error}</p>}
          <div className="flex items-center justify-between text-[13.5px]">
            <span className="rounded-full bg-saffron-soft px-2.5 py-1 font-medium text-saffron">Demo code: {DEMO_CODE}</span>
            {wait > 0 ? (
              <span className="text-muted tnum">{mr ? `पुन्हा पाठवा ${wait}s` : `Resend in ${wait}s`}</span>
            ) : (
              <button onClick={() => setWait(30)} className="font-semibold text-jade">{mr ? "पुन्हा पाठवा" : "Resend code"}</button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
