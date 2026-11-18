"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/shell";
import { KotTicket, PhoneOwner, UpiCard } from "@/components/site/mockups";
import { RiseText } from "@/components/site/motion";
import { Mesh } from "@/components/site/hero";
import { Button, Field, Segmented, inputCls } from "@/components/ui";
import { ChangePassword, OwnerAuth } from "@/components/owner-auth";
import { cloudSignOut, publicInfo, signInStaff, useCloud, type StaffChoice } from "@/lib/cloud";
import { sessionActions } from "@/lib/live";
import { CookingLoader } from "@/components/loader";

const RID_KEY = "restropi.rid"; // the restaurant this device last signed in to (shows its name)
const PHONE_KEY = "restropi.staffPhone"; // last staff mobile used here, so they only type the PIN

export default function LoginPage() {
  const router = useRouter();
  const cloud = useCloud();
  const [mode, setMode] = useState<"owner" | "staff">("owner");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [place, setPlace] = useState("");
  // the same number and PIN work in more than one restaurant: which one?
  const [choices, setChoices] = useState<StaffChoice[] | null>(null);

  // opens on Owner; the staff sign-in link (…/login?r=…) or a phone used by staff before opens on Staff
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("r");
    let r = fromUrl;
    let saved = "";
    try {
      if (fromUrl) localStorage.setItem(RID_KEY, fromUrl);
      r = r ?? localStorage.getItem(RID_KEY);
      saved = localStorage.getItem(PHONE_KEY) ?? "";
    } catch {}
    if (saved) setPhone(saved);
    if (fromUrl || saved) setMode("staff");
    if (r) publicInfo(r).then((i) => setPlace(i?.name ?? "")).catch(() => {});
  }, []);

  // already signed in → straight in (after setting their own password)
  useEffect(() => {
    if (cloud.status !== "ready" || cloud.role === "guest" || cloud.mustChangePassword) return;
    try {
      if (cloud.rid) localStorage.setItem(RID_KEY, cloud.rid);
    } catch {}
    router.replace(cloud.role === "superadmin" ? "/admin" : "/app");
  }, [cloud, router]);

  // staff: mobile number + PIN, on any phone or tablet
  const digits = phone.replace(/\D/g, "").slice(-10);
  const canStaff = digits.length === 10 && /^\d{4}$/.test(pin) && !busy;
  const staffSignIn = (e?: React.FormEvent, rid?: string) => {
    e?.preventDefault();
    if (!canStaff) {
      setError(digits.length !== 10 ? "Enter your 10-digit mobile number" : "Enter your 4-digit PIN");
      return;
    }
    setBusy(true);
    setError("");
    signInStaff(digits, pin, rid)
      .then((res) => {
        if ("choose" in res) {
          setChoices(res.choose);
          setBusy(false);
          return;
        }
        const { rid, memberId } = res;
        setChoices(null);
        try {
          localStorage.setItem(PHONE_KEY, digits);
          localStorage.setItem(RID_KEY, rid);
        } catch {}
        sessionActions.setMember(memberId);
        // stay busy: the app opens as soon as the restaurant has loaded
      })
      .catch((err: Error) => {
        setError(err.message);
        setPin("");
        setBusy(false);
      });
  };
  const [linkExpired, setLinkExpired] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (q.get("link") === "expired" || h.get("error_code") === "otp_expired") setLinkExpired(true);
  }, []);
  const mustSet = cloud.status === "ready" && cloud.role !== "guest" && cloud.role !== "staff" && cloud.mustChangePassword;
  // signed in: show a loader until the app opens (it loads the restaurant first)
  const entering = (cloud.status === "ready" && cloud.role !== "guest" && !cloud.mustChangePassword) || (busy && mode === "staff");

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {entering && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-canvas/95 backdrop-blur-sm" role="status" aria-live="polite">
          <CookingLoader size={64} label="Signing in" />
          <p className="text-[15px] font-semibold text-ink/80">{cloud.status === "ready" ? "Opening your restaurant…" : "Signing in…"}</p>
        </div>
      )}
      <div className="relative isolate m-3 hidden flex-1 flex-col justify-between overflow-hidden rounded-[36px] bg-canvas p-12 lg:flex">
        <Mesh solid />
        <Link href="/" className="relative w-fit" aria-label="Restropi home"><Wordmark className="h-8" /></Link>
        {/* the owner's evening, floating in 3D */}
        <div aria-hidden className="relative mx-auto h-[420px] w-full max-w-[460px]" style={{ perspective: "1400px" }}>
          <div className="absolute inset-0" style={{ transformStyle: "preserve-3d", transform: "rotateX(14deg) rotateY(-18deg) rotateZ(4deg)" }}>
            <div className="absolute left-[18%] top-0" style={{ transform: "translateZ(0px)" }}><div className="animate-float"><div className="glass rounded-[48px] p-2.5"><PhoneOwner /></div></div></div>
            <div className="absolute right-0 top-[38%]" style={{ transform: "translateZ(120px)" }}><div className="animate-float" style={{ animationDelay: "-3s" }}><div className="glass rounded-[30px] p-2.5"><UpiCard className="!shadow-none" /></div></div></div>
            <div className="absolute bottom-0 left-0" style={{ transform: "translateZ(80px) rotateZ(-6deg)" }}><div className="animate-float" style={{ animationDelay: "-5s" }}><div className="glass rounded-[26px] p-2.5"><KotTicket className="!shadow-none" /></div></div></div>
          </div>
        </div>
        <div className="relative">
          <RiseText as="p" text="Bills, kitchen, tables, stock and staff — *in one place.*" className="max-w-md text-[40px] font-semibold leading-[1.02] tracking-[-0.035em]" />
          <div className="mt-4 text-[14px] text-muted">Restropi for restaurants and cafés</div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col lg:items-center lg:justify-center lg:py-10">
        {/* phones: a photo on top, the form slides up over it */}
        <div className="relative h-[36svh] min-h-[230px] max-h-[360px] shrink-0 overflow-hidden bg-ink lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/video/hero-poster.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/55" />
          <Link href="/" aria-label="Back to website" className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition active:scale-95">
            <ArrowLeft size={20} />
          </Link>
          <div className="absolute inset-x-5 bottom-12 text-white">
            <Link href="/" aria-label="Restropi home" className="block w-fit"><Wordmark light className="h-8" /></Link>
            <p className="mt-2 max-w-[18rem] text-[14px] leading-snug text-white/85">Bills, kitchen, tables and stock, in one place.</p>
          </div>
        </div>
        <Link
          href="/"
          className="absolute right-6 top-6 hidden h-10 items-center gap-1.5 rounded-full bg-surface pl-3 pr-4 text-[14px] font-semibold text-ink ring-1 ring-line transition hover:bg-sunken lg:flex"
        >
          <ArrowLeft size={16} /> Back to website
        </Link>
        <div className="relative z-10 -mt-7 flex flex-1 justify-center rounded-t-[28px] bg-canvas px-5 pb-10 pt-8 lg:mt-0 lg:flex-none lg:rounded-none lg:p-0">
        <div className="w-full max-w-sm">
          {mustSet ? (
            <>
              <ChangePassword
                title="Set a new password"
                subtitle={`${cloud.email ? `For ${cloud.email}. ` : ""}Choose your own password to continue.`}
              />
              <button onClick={() => void cloudSignOut()} className="mt-4 block w-full text-center text-[14px] font-medium text-muted">Sign out</button>
            </>
          ) : (
          <>
          <h1 className="large-title">Sign in</h1>
          {linkExpired && (
            <p className="mt-3 rounded-group bg-saffron-soft p-3 text-[14px] text-ink">
              That email link was already used or has expired. Each link works once — use &ldquo;Forgot password?&rdquo; to get a new one, and open only the newest email.
            </p>
          )}
          {place && <p className="mt-1 text-[15px] text-muted">{place}</p>}
          <Segmented
            className="mt-6 w-full !rounded-[14px] !p-1 [&_button]:!rounded-[11px] [&_button]:!py-3 [&_button]:!text-[15.5px]"
            value={mode}
            onChange={(v) => { setMode(v); setPin(""); setError(""); }}
            options={[{ value: "owner", label: "Owner" }, { value: "staff", label: "Staff PIN" }]}
          />

          {mode === "owner" ? (
            <div className="mt-6 space-y-4">
              <OwnerAuth />
              <p className="text-center text-[13px] text-faint">Restaurant logins are given by Restropi. Staff sign in with their PIN.</p>
            </div>
          ) : (
            <form onSubmit={staffSignIn} className="mt-6 space-y-4">
              <Field label="Mobile number">
                <input
                  className={inputCls}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={14}
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/[^\d ]/g, "")); setError(""); setChoices(null); }}
                  placeholder="98xxx xxxxx"
                />
              </Field>
              <Field label="PIN">
                <input
                  className={clsx(inputCls, "tracking-[0.5em]")}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="current-password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); setChoices(null); }}
                  placeholder="••••"
                />
              </Field>
              {choices ? (
                <div className="space-y-2 rounded-group bg-surface p-3">
                  <div className="px-1 text-[14px] font-semibold">This number works in {choices.length} restaurants. Which one?</div>
                  {choices.map((c) => (
                    <button
                      key={c.rid}
                      type="button"
                      disabled={busy || c.paused}
                      onClick={() => staffSignIn(undefined, c.rid)}
                      className="flex w-full items-center justify-between rounded-[14px] bg-sunken px-4 py-3 text-left text-[15px] font-semibold active:scale-[.99] disabled:opacity-50"
                    >
                      {c.name}
                      <span className="text-[12.5px] font-normal text-muted">{c.paused ? "paused" : "Sign in →"}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setChoices(null)} className="w-full pt-1 text-center text-[13px] font-medium text-muted">Cancel</button>
                </div>
              ) : (
                <Button type="submit" className="w-full" disabled={busy}>
                  <LogIn size={17} /> {busy ? "Signing in…" : "Sign in"}
                </Button>
              )}
              <p className="text-center text-[13px] text-faint">Use the mobile number your manager added for you and your 4-digit PIN.</p>
            </form>
          )}
          {error && <p className="mt-4 text-center text-[14px] font-medium text-rose">{error}</p>}
          </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
