"use client";

// Two-step login with Google Authenticator (or any authenticator app):
//  - TwoStepGate: after the password, ask for the 6-digit code (or, for the super admin, set it up)
//  - TwoStepSetup: scan the QR, type the first code
//  - TwoStepCard: on/off, the phones it's on, add / remove (owner profile and super admin)
import clsx from "clsx";
import { Check, Copy, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cloudSignOut, recheckSignIn, twoStepCheck, twoStepConfirm, twoStepDevices, twoStepRemove, twoStepStart, type TwoStepDevice } from "@/lib/cloud";
import { Button } from "./ui";

/** One field for the 6 digits: big, numbers only, sends itself at 6. */
function CodeInput({ onCode, busy, autoFocus = true }: { onCode: (c: string) => void; busy: boolean; autoFocus?: boolean }) {
  const [v, setV] = useState("");
  const sent = useRef("");
  useEffect(() => {
    if (v.length === 6 && sent.current !== v && !busy) {
      sent.current = v;
      onCode(v);
    }
  }, [v, busy, onCode]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      aria-label="6-digit code"
      placeholder="••••••"
      disabled={busy}
      className="h-16 w-full rounded-[16px] bg-surface text-center text-[30px] font-semibold tracking-[0.45em] ring-1 ring-line tnum placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-jade disabled:opacity-60"
    />
  );
}

/** Scan the QR with the app, then type the first code. */
export function TwoStepSetup({ onDone }: { onDone: () => void }) {
  const [s, setS] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    twoStepStart().then(setS).catch((e) => setErr((e as Error).message));
  }, []);
  const confirm = useCallback(
    async (code: string) => {
      if (!s) return;
      setBusy(true);
      setErr("");
      try {
        await twoStepConfirm(s.id, code);
        onDone();
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [s, onDone],
  );
  return (
    <div className="space-y-4">
      <ol className="space-y-1.5 text-[14px] text-muted">
        <li><b className="text-ink">1.</b> Open <b className="text-ink">Google Authenticator</b> on your phone → <b className="text-ink">+</b> → Scan a QR code</li>
        <li><b className="text-ink">2.</b> Type the 6-digit code it shows</li>
      </ol>
      <div className="flex flex-col items-center rounded-group bg-surface p-4">
        {s ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.qr} alt="QR code for your authenticator app" width={180} height={180} className="h-[180px] w-[180px] rounded-[12px] bg-white p-2" />
        ) : (
          <div className="h-[180px] w-[180px] animate-pulse rounded-[12px] bg-sunken" />
        )}
        {s && (
          <button
            onClick={() => { navigator.clipboard?.writeText(s.secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); }}
            className="mt-3 flex max-w-full items-center gap-1.5 rounded-full bg-sunken px-3 py-1.5 text-[12px] text-muted"
            title="Can't scan? Type this key in the app"
          >
            <span className="truncate font-mono">{s.secret}</span>
            {copied ? <Check size={13} className="shrink-0 text-jade" /> : <Copy size={13} className="shrink-0" />}
          </button>
        )}
      </div>
      <CodeInput onCode={confirm} busy={busy || !s} autoFocus={false} />
      {err && <p className="text-[13.5px] font-medium text-rose" role="alert">{err}</p>}
    </div>
  );
}

/** Full screen after the password: the code, or (super admin) setting it up. */
export function TwoStepGate({ mode, email, who }: { mode: "enroll" | "verify"; email?: string | null; who: "owner" | "superadmin" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const done = useCallback(async () => {
    setBusy(true);
    await recheckSignIn();
  }, []);
  const check = useCallback(async (code: string) => {
    setBusy(true);
    setErr("");
    try {
      await twoStepCheck(code);
      await recheckSignIn();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }, []);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-[380px]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade-deep"><ShieldCheck size={26} /></span>
        <h1 className="mt-4 text-center text-[22px] font-semibold tracking-tight">{mode === "enroll" ? "Set up two-step login" : "Enter your code"}</h1>
        <p className="mt-1.5 text-center text-[14.5px] text-muted">
          {mode === "enroll" ? "Needed for the super admin. Takes a minute." : "Open your authenticator app and type the 6-digit code for Restropi."}
        </p>
        {email && <p className="mt-1 text-center text-[13px] text-faint">{email}</p>}
        <div className="mt-6">
          {mode === "enroll" ? (
            <TwoStepSetup onDone={done} />
          ) : (
            <div className="space-y-3">
              <CodeInput onCode={check} busy={busy} />
              {err && <p className="text-center text-[13.5px] font-medium text-rose" role="alert">{err}</p>}
              <p className="text-center text-[12.5px] text-muted">
                {who === "owner" ? "Lost your phone? Ask Restropi support to reset two-step login." : "Lost your phone? Use your second device."}
              </p>
            </div>
          )}
        </div>
        <button onClick={async () => { await cloudSignOut(); window.location.href = "/login"; }} className="mt-6 block w-full text-center text-[14px] font-semibold text-rose">
          Sign out
        </button>
      </div>
    </div>
  );
}

/** On/off and the phones it's on. `required`: can't remove the last phone (super admin). */
export function TwoStepCard({ required = false, onToast }: { required?: boolean; onToast?: (m: string) => void }) {
  const [list, setList] = useState<TwoStepDevice[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => twoStepDevices().then(setList).catch((e) => setErr((e as Error).message)), []);
  useEffect(() => {
    void load();
  }, [load]);
  const on = (list?.length ?? 0) > 0;

  if (adding)
    return (
      <div className="rounded-group bg-sunken/50 p-4">
        <TwoStepSetup onDone={() => { setAdding(false); void load(); onToast?.(on ? "Phone added" : "Two-step login is on"); }} />
        <button onClick={() => setAdding(false)} className="mt-3 block w-full text-center text-[14px] font-semibold text-muted">Cancel</button>
      </div>
    );
  return (
    <div className="overflow-hidden rounded-group bg-surface">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", on ? "bg-jade-soft text-jade-deep" : "bg-sunken text-muted")}><ShieldCheck size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Two-step login</span>
          <span className="block text-[13px] text-muted">{list === null ? "…" : on ? "On · a code from your phone at every new sign-in" : "Off · add Google Authenticator for extra safety"}</span>
        </span>
        {list !== null && !on && <Button size="sm" onClick={() => setAdding(true)}>Turn on</Button>}
      </div>
      {on && (
        <>
          <ul className="divide-y divide-line/80 border-t border-line/80">
            {list!.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                <Smartphone size={16} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-[14px]">{d.name}</span>
                {!(required && list!.length === 1) && (
                  removing === d.id ? (
                    <span className="flex items-center gap-1.5">
                      <button onClick={() => setRemoving(null)} className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-muted">Keep</button>
                      <button
                        onClick={async () => {
                          setErr("");
                          try {
                            await twoStepRemove(d.id);
                            onToast?.(list!.length === 1 ? "Two-step login is off" : "Phone removed");
                          } catch (e) {
                            setErr((e as Error).message);
                          }
                          setRemoving(null);
                          void load();
                        }}
                        className="rounded-full bg-rose px-2.5 py-1 text-[12.5px] font-semibold text-white"
                      >
                        Remove
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setRemoving(d.id)} aria-label={`Remove ${d.name}`} className="rounded-full p-1.5 text-muted hover:bg-sunken hover:text-rose"><Trash2 size={15} /></button>
                  )
                )}
              </li>
            ))}
          </ul>
          <button onClick={() => setAdding(true)} className="w-full border-t border-line/80 px-4 py-2.5 text-left text-[14px] font-semibold text-jade-deep">
            + Add another phone{required && list!.length === 1 ? " (recommended)" : ""}
          </button>
        </>
      )}
      {err && <p className="border-t border-line/80 px-4 py-2.5 text-[13px] font-medium text-rose" role="alert">{err}</p>}
    </div>
  );
}
