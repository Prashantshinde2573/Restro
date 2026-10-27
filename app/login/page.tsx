"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/shell";
import { Avatar, Button, Field, Segmented, inputCls } from "@/components/ui";
import { repo } from "@/lib/repo";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"owner" | "staff">("owner");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [who, setWho] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const staff = repo.staff().filter((s) => s.role !== "Owner").slice(0, 6);

  useEffect(() => {
    if (pin.length === 4) {
      const id = window.setTimeout(() => router.push("/app/pos"), 350);
      return () => window.clearTimeout(id);
    }
  }, [pin, router]);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-ink p-12 text-canvas lg:flex">
        <Wordmark className="text-[20px]" />
        <p className="max-w-md text-[34px] font-semibold leading-tight tracking-tight">
          Bills, kitchen, stock and staff — and a morning note that tells you what to fix.
        </p>
        <div className="text-[14px] text-canvas/60">Restro for restaurants, cafés and cloud kitchens</div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Wordmark className="text-[20px]" /></div>
          <h1 className="large-title">Sign in</h1>
          <p className="mt-1 text-[15px] text-muted">Saffron Lane · Baner, Pune</p>
          <Segmented
            className="mt-6 w-full"
            value={mode}
            onChange={(v) => { setMode(v); setPin(""); setWho(null); }}
            options={[{ value: "owner", label: "Owner or manager" }, { value: "staff", label: "Staff PIN" }]}
          />

          {mode === "owner" ? (
            <div className="mt-6 space-y-4">
              <Field label="Mobile number">
                <div className="flex gap-2">
                  <span className="flex h-12 items-center rounded-ctl bg-surface px-3 text-[16px] ring-1 ring-line">+91</span>
                  <input className={inputCls} inputMode="tel" placeholder="98220 41187" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </Field>
              {otpSent && (
                <Field label="6-digit code from SMS">
                  <input className={clsx(inputCls, "tracking-[0.5em] tnum")} inputMode="numeric" maxLength={6} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
                </Field>
              )}
              <Button
                size="lg"
                className="w-full"
                disabled={!otpSent ? phone.replace(/\D/g, "").length < 10 : otp.length < 6}
                onClick={() => (otpSent ? router.push("/app") : setOtpSent(true))}
              >
                {otpSent ? "Sign in" : "Send code"}
              </Button>
              <p className="text-center text-[13.5px] text-muted">
                New to Restro? <Link href="/onboarding" className="font-semibold text-jade">Set up your restaurant</Link>
              </p>
            </div>
          ) : !who ? (
            <div className="mt-6 grid grid-cols-3 gap-3">
              {staff.map((s) => (
                <button key={s.id} onClick={() => setWho(s.name)} className="flex flex-col items-center gap-2 rounded-group bg-surface px-2 py-4 active:scale-[.97]">
                  <Avatar name={s.name} hue={s.hue} size={48} />
                  <span className="text-center text-[13px] font-medium leading-tight">{s.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center">
              <div className="text-[15px] font-medium">Hi {who.split(" ")[0]}, enter your PIN</div>
              <div className="my-6 flex gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={clsx("h-3.5 w-3.5 rounded-full transition", i < pin.length ? "scale-110 bg-ink" : "bg-line")} />
                ))}
              </div>
              <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k) =>
                  k === "" ? (
                    <button key="back" onClick={() => setWho(null)} className="text-[14px] font-medium text-jade">Back</button>
                  ) : (
                    <button
                      key={k}
                      aria-label={k === "del" ? "Delete" : k}
                      onClick={() => setPin((p) => (k === "del" ? p.slice(0, -1) : p.length < 4 ? p + k : p))}
                      className="flex aspect-square items-center justify-center rounded-full bg-surface text-[26px] font-medium transition active:scale-95 active:bg-sunken"
                    >
                      {k === "del" ? <Delete size={22} /> : k}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
