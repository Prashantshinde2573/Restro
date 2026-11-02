"use client";

// "Type your password to do this" — for risky changes (marking a paid bill unpaid).
import { useEffect, useState } from "react";
import { verifyMyPassword } from "@/lib/cloud";
import { PasswordInput } from "./owner-auth";
import { Button, Sheet } from "./ui";

export function PasswordCheck({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirmed: () => void;
}) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setPw("");
      setErr("");
      setBusy(false);
    }
  }, [open]);
  const go = async () => {
    if (!pw) return setErr("Type your password");
    setBusy(true);
    setErr("");
    try {
      await verifyMyPassword(pw);
      onConfirmed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wrong password");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button size="lg" variant="danger" className="w-full" disabled={busy} onClick={go}>
          {busy ? "Checking…" : confirmLabel}
        </Button>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void go();
        }}
      >
        <p className="text-[14.5px] text-muted">{body}</p>
        <label className="block text-[13px] font-medium text-muted">Your password</label>
        <PasswordInput value={pw} onChange={setPw} autoComplete="current-password" autoFocus />
        {err && <p className="text-[13px] font-medium text-rose">{err}</p>}
      </form>
    </Sheet>
  );
}
