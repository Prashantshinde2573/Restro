"use client";

// Email + password sign-in for restaurant owners and the super admin.
// There is no public sign-up: the super admin creates each restaurant and its owner login.
import { useState } from "react";
import { Button, Field, inputCls } from "@/components/ui";
import { changePassword, sendPasswordReset, signInOwner } from "@/lib/cloud";

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
        <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button size="lg" type="submit" className="w-full" disabled={!canGo || busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <button type="button" onClick={reset} className="block w-full text-center text-[13.5px] font-medium text-jade">
        Forgot password?
      </button>
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
        <input className={inputCls} type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} autoFocus />
      </Field>
      <Field label="Type it again">
        <input className={inputCls} type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
      </Field>
      <Button size="lg" type="submit" className="w-full" disabled={!!problem || busy}>
        {busy ? "Saving…" : problem && (p1 || p2) ? problem : "Save password"}
      </Button>
      {error && <p className="text-center text-[14px] font-medium text-rose">{error}</p>}
    </form>
  );
}
