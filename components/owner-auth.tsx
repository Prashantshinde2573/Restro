"use client";

// Email + password sign-in for restaurant owners and the super admin.
// There is no public sign-up: the super admin creates each restaurant and its owner login.
import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

// shows "Continue with Google" once the Google provider is set up in Supabase
const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";
import { Button, Field, inputCls } from "@/components/ui";
import { changePassword, sendPasswordReset, signInOwner, signInWithGoogle } from "@/lib/cloud";

export function OwnerAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canGo = okEmail && password.length >= 6;

  const go = async () => {
    setError("");
    setNote("");
    setBusy(true);
    try {
      await signInOwner(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError("");
    if (!okEmail) return setError("Type your email first");
    try {
      await sendPasswordReset(email);
      setNote(`If ${email.trim()} has an account, a reset link is on its way.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canGo && !busy) void go();
      }}
    >
      <Field label="Email">
        <input className={inputCls} type="email" autoComplete="username" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <PasswordInput autoComplete="current-password" value={password} onChange={setPassword} />
      </Field>
      <Button size="lg" type="submit" className="w-full" disabled={!canGo || busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <button type="button" onClick={reset} className="block w-full text-center text-[13.5px] font-medium text-jade">
        Forgot password?
      </button>
      {GOOGLE_LOGIN && (
        <>
          <div className="flex items-center gap-3 text-[12.5px] text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <Button
            type="button"
            variant="plain"
            size="lg"
            className="w-full !bg-surface ring-1 ring-line"
            onClick={() => signInWithGoogle().catch((e) => setError((e as Error).message))}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
            Continue with Google
          </Button>
        </>
      )}
      {note && <p className="rounded-group bg-jade-soft p-3 text-[14px] text-ink">{note}</p>}
      {error && <p className="text-center text-[14px] font-medium text-rose">{error}</p>}
    </form>
  );
}

/** Shown after signing in with a temporary password, before anything else. */
export function ChangePassword({ title = "Set your password", subtitle, onDone }: { title?: string; subtitle?: string; onDone?: () => void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const problem = p1.length < 8 ? "Use at least 8 characters" : p1 !== p2 ? "Both passwords must match" : "";

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (problem || busy) return;
        setBusy(true);
        setError("");
        try {
          await changePassword(p1);
          onDone?.();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      <Field label="New password" hint="At least 8 characters.">
        <PasswordInput autoComplete="new-password" value={p1} onChange={setP1} autoFocus />
      </Field>
      <Field label="Type it again">
        <PasswordInput autoComplete="new-password" value={p2} onChange={setP2} />
      </Field>
      <Button size="lg" type="submit" className="w-full" disabled={!!problem || busy}>
        {busy ? "Saving…" : problem && (p1 || p2) ? problem : "Save password"}
      </Button>
      {error && <p className="text-center text-[14px] font-medium text-rose">{error}</p>}
    </form>
  );
}

/** Password box with a show / hide eye. */
export function PasswordInput({ value, onChange, autoComplete, autoFocus }: { value: string; onChange: (v: string) => void; autoComplete?: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className={clsx(inputCls, "pr-12")} type={show ? "text" : "password"} autoComplete={autoComplete} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
