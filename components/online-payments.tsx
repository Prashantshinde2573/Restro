"use client";

// Settings → Payments (owner only): connect this outlet to the restaurant's OWN Razorpay or
// Cashfree account, so guests can pay the bill online and it closes by itself.
// The secret keys go straight to the server, are checked with the gateway, and are stored
// encrypted (Supabase Vault). They are never shown again, not even to the owner.
import { AlertTriangle, Copy, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Segmented, inputCls } from "./ui";
import { useToast } from "./toast";
import { gatewayList, gatewayOff, gatewayProblems, gatewaySetup, gatewayWebhookUrl, type GatewayRow } from "@/lib/cloud";
import { inr } from "@/lib/format";

type Provider = "razorpay" | "cashfree";
const NAME: Record<Provider, string> = { razorpay: "Razorpay", cashfree: "Cashfree" };
type Problem = Awaited<ReturnType<typeof gatewayProblems>>[number];

export function OnlinePayments({ outletId, outletName }: { outletId: string; outletName: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<GatewayRow[] | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState<Provider>("razorpay");
  const [mode, setMode] = useState<"test" | "live">("test");
  const [keyId, setKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [webhook, setWebhook] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    gatewayList().then(setRows).catch(() => setRows([]));
    gatewayProblems().then(setProblems).catch(() => {});
  };
  useEffect(load, []);
  const g = rows?.find((r) => r.outlet_id === outletId);
  const on = !!g?.active;
  const outletProblems = problems.filter((p) => p.outlet_id === outletId);

  const startEdit = () => {
    setProvider(g?.provider ?? "razorpay");
    setMode(g?.mode ?? "test");
    setKeyId(g?.key_id ?? "");
    setSecret("");
    setWebhook("");
    setErr("");
    setEditing(true);
  };
  const wipe = () => {
    setSecret("");
    setWebhook("");
  };
  const keepWebhook = provider === "razorpay" && g?.provider === "razorpay" && g.has_webhook;
  const ready = keyId.trim().length >= 6 && secret.trim().length >= 8 && (provider === "cashfree" || keepWebhook || webhook.trim().length >= 6);

  const connect = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr("");
    try {
      await gatewaySetup({ outletId, provider, mode, keyId: keyId.trim(), secret: secret.trim(), ...(provider === "razorpay" && webhook.trim() ? { webhook: webhook.trim() } : {}) });
      wipe();
      setEditing(false);
      toast(`${NAME[provider]} connected · guests can pay online at ${outletName}`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await gatewayOff(outletId);
      toast("Online payments turned off");
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const hook = gatewayWebhookUrl(editing ? provider : g?.provider ?? provider, outletId);
  const copy = () => {
    void navigator.clipboard?.writeText(hook).then(() => toast("Webhook URL copied")).catch(() => {});
  };

  if (rows === null) return <div className="rounded-group bg-surface px-4 py-3 text-[14px] text-muted">Loading online payments…</div>;

  return (
    <div className="space-y-3">
      <div className="px-1 pt-2 text-[13px] font-medium text-muted">Online payments (your own gateway)</div>

      {!editing && (
        <div className="rounded-group bg-surface p-4">
          {on && g ? (
            <>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-jade" />
                <span className="text-[15px] font-semibold">{NAME[g.provider]} · {g.mode === "live" ? "Live" : "Test"}</span>
              </div>
              <div className="mt-1 text-[13px] text-muted">
                Key {g.key_id.slice(0, 12)}… · secret ••••{g.last4 ?? ""}
                {g.verified_at ? ` · checked ${new Date(g.verified_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
              </div>
              <p className="mt-2 text-[13px] text-muted">Guests see “Pay online” on their bill. The bill closes by itself once {NAME[g.provider]} confirms the money.</p>
              {g.mode === "test" && <p className="mt-2 rounded-[12px] bg-saffron-soft px-3 py-2 text-[13px] font-medium text-ink/80">Test mode: no real money moves. Switch to Live keys when you are ready.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="tinted" onClick={startEdit}>Change keys</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={turnOff}>Turn off</Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold">Let guests pay online</div>
              <p className="mt-1 text-[13px] text-muted">
                Connect your own Razorpay or Cashfree account. Money goes straight to your account; Restropi never holds it. The guest pays from the bill on their phone and it closes by itself.
              </p>
              <Button size="sm" className="mt-3" onClick={startEdit}>{g ? "Turn on again" : "Connect a gateway"}</Button>
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-4 rounded-group bg-surface p-4">
          <Field label="Gateway">
            <Segmented className="w-full" value={provider} onChange={(v) => { setProvider(v as Provider); setErr(""); }} options={[{ value: "razorpay", label: "Razorpay" }, { value: "cashfree", label: "Cashfree" }]} />
          </Field>
          <Field label="Mode" hint="Start with Test keys and pay a test bill. Then come back with Live keys.">
            <Segmented className="w-full" value={mode} onChange={(v) => setMode(v as "test" | "live")} options={[{ value: "test", label: "Test" }, { value: "live", label: "Live (real money)" }]} />
          </Field>
          <Field label={provider === "razorpay" ? "Key ID" : "App ID (Client ID)"} hint={provider === "razorpay" ? "Razorpay Dashboard → Account & Settings → API Keys. Starts with rzp_test_ or rzp_live_." : "Cashfree Dashboard → Developers → API Keys."}>
            <input className={inputCls} autoCapitalize="none" autoComplete="off" spellCheck={false} value={keyId} onChange={(e) => setKeyId(e.target.value.trim())} />
          </Field>
          <Field label={provider === "razorpay" ? "Key secret" : "Secret key"} hint="Sent once to the server and stored encrypted. Nobody can see it again, not even you.">
            <input className={inputCls} type="password" autoCapitalize="none" autoComplete="new-password" spellCheck={false} value={secret} onChange={(e) => setSecret(e.target.value)} />
          </Field>

          <div className="rounded-[14px] bg-sunken/50 p-3">
            <div className="text-[13.5px] font-semibold">Webhook (so a payment closes the bill even if the guest's phone goes off)</div>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12.5px] text-muted">
              {provider === "razorpay" ? (
                <>
                  <li>Razorpay Dashboard → Account & Settings → Webhooks → Add new webhook.</li>
                  <li>Paste this URL. Make up a webhook secret and type it there and below.</li>
                  <li>Tick the events <b>payment.captured</b> and <b>order.paid</b>.</li>
                </>
              ) : (
                <>
                  <li>Cashfree Dashboard → Developers → Webhooks → Add webhook.</li>
                  <li>Paste this URL and choose the payment success event.</li>
                  <li>Cashfree signs it with your secret key, so nothing more to type here.</li>
                </>
              )}
            </ol>
            <button type="button" onClick={copy} className="mt-2 flex w-full items-center gap-2 rounded-[10px] bg-surface px-3 py-2 text-left text-[12px] text-ink ring-1 ring-line">
              <span className="min-w-0 flex-1 truncate font-mono">{hook}</span>
              <Copy size={14} className="shrink-0 text-jade" />
            </button>
          </div>
          {provider === "razorpay" && (
            <Field label="Webhook secret" hint={keepWebhook ? "Leave empty to keep the saved one." : "The same secret you typed in Razorpay's webhook settings."}>
              <input className={inputCls} type="password" autoCapitalize="none" autoComplete="new-password" spellCheck={false} value={webhook} onChange={(e) => setWebhook(e.target.value)} />
            </Field>
          )}

          {err && <p className="text-[13.5px] font-medium text-rose">{err}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!ready || busy} onClick={connect}><Lock size={15} /> {busy ? "Checking the keys…" : "Check & connect"}</Button>
            <Button variant="ghost" onClick={() => { wipe(); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      {outletProblems.length > 0 && (
        <div className="rounded-group bg-rose-soft p-4 text-[13.5px]">
          <div className="flex items-center gap-2 font-semibold text-rose"><AlertTriangle size={16} /> Payments to check</div>
          <ul className="mt-2 space-y-1.5">
            {outletProblems.map((p) => (
              <li key={p.id} className="text-ink/80">
                {inr(p.amount_paise / 100)} · {NAME[p.provider as Provider] ?? p.provider} {p.payment_id ?? ""} · {new Date(p.paid_at ?? p.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                <span className="block text-[12.5px] text-rose">{p.note.replace(/:\s*refund this payment$/i, "")}. Refund it from your {NAME[p.provider as Provider] ?? "gateway"} dashboard.</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
