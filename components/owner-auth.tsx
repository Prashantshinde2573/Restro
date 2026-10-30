"use client";

// Owner sign in / create account with email + password (Supabase Auth).
import { useState } from "react";
import { Button, Field, Segmented, inputCls } from "@/components/ui";
import { sendPasswordReset, signInOwner, signUpOwner } from "@/lib/cloud";

export function OwnerAuth({ startWith = "signin" }: { startWith?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(startWith);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canGo = okEmail && password.length >= 6 && (mode === "signin" || name.trim().length > 1);

  const go = async () => {
    setError("");
    setNote("");
    setBusy(true);
    try {
      if (mode === "signin") await signInOwner(email, password);
      else if ((await signUpOwner(email, password, name.trim())) === "confirm")
        setNote(`We sent a link to ${email.trim()}. Open it to confirm, then sign in here.`);
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
      setNote(`Password reset link sent to ${email.trim()}.`);
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
      <Segmented
        className="w-full"
        value={mode}
        onChange={(v) => { setMode(v); setError(""); setNote(""); }}
        options={[{ value: "signin", label: "Sign in" }, { value: "signup", label: "New account" }]}
      />
      {mode === "signup" && (
        <Field label="Your name">
          <input className={inputCls} autoComplete="name" placeholder="e.g. Prashant Patil" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <Field label="Email">
        <input className={inputCls} type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 6 characters." : undefined}>
        <input className={inputCls} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button size="lg" type="submit" className="w-full" disabled={!canGo || busy}>
        {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      {mode === "signin" && (
        <button type="button" onClick={reset} className="block w-full text-center text-[13.5px] font-medium text-jade">
          Forgot password?
        </button>
      )}
      {note && <p className="rounded-group bg-jade/10 p-3 text-[14px] text-ink">{note}</p>}
      {error && <p className="text-center text-[14px] font-medium text-rose">{error}</p>}
    </form>
  );
}
