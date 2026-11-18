"use client";

// Settings → WhatsApp API (owner, Pro plan and up): the restaurant's OWN WhatsApp Business number
// through Meta's WhatsApp Cloud API. Bills and "your order is ready" go out by themselves, and offers
// go to guests who said yes, from Campaigns. The access token and app secret go once to the server
// (Supabase Vault) and are never shown again. Without it, the WhatsApp buttons work as before.
import { Copy, Lock, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, inputCls } from "./ui";
import { useToast } from "./toast";
import { openPlanSheet } from "./plan-sheet";
import { useFeature } from "@/lib/live";
import { waAccount, waConnect, waMessages, waOff, waSaveAuto, waTemplates, waTest, waWebhookUrl, type WaAccountRow, type WaMessage, type WaTemplate } from "@/lib/cloud";

const key = (t: { name: string; language: string }) => `${t.name}|${t.language}`;
const pickOf = (v: string) => (v ? { template: v.split("|")[0], lang: v.split("|")[1] } : null);
const STATUS: Record<string, string> = { sending: "Sending", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed", skipped: "Skipped" };

export function WhatsAppApi() {
  const toast = useToast();
  const plan = useFeature("waApi");
  const [acc, setAcc] = useState<WaAccountRow | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [token, setToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [bill, setBill] = useState("");
  const [ready, setReady] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testT, setTestT] = useState("");
  const [log, setLog] = useState<WaMessage[]>([]);

  const load = () =>
    waAccount()
      .then((a) => {
        setAcc(a);
        setBill(a?.settings?.bill ? `${a.settings.bill.template}|${a.settings.bill.lang}` : "");
        setReady(a?.settings?.ready ? `${a.settings.ready.template}|${a.settings.ready.lang}` : "");
        if (a?.active) {
          waTemplates().then(setTemplates).catch((e) => { setTemplates([]); setErr((e as Error).message); });
          waMessages(20).then(setLog).catch(() => {});
        }
      })
      .catch(() => setAcc(null));
  useEffect(() => {
    if (plan === "ok") void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  if (plan !== "ok") {
    return (
      <div className="space-y-3 rounded-group bg-surface p-4">
        <div className="flex items-center gap-2 text-[15px] font-semibold"><MessageCircle size={18} className="text-[#25D366]" /> WhatsApp API is on the Pro plan</div>
        <p className="text-[13.5px] text-muted">Bills and “your order is ready” go out by themselves from your own WhatsApp number, and offers go to guests in one tap. On your plan, the WhatsApp buttons open WhatsApp with the message typed in, as now.</p>
        <Button size="sm" onClick={() => openPlanSheet("pro")}>See the Pro plan</Button>
      </div>
    );
  }
  if (acc === undefined) return <div className="rounded-group bg-surface px-4 py-3 text-[14px] text-muted">Loading…</div>;

  const on = !!acc?.active;
  const copy = (text: string, what: string) => void navigator.clipboard?.writeText(text).then(() => toast(`${what} copied`)).catch(() => {});
  const ready_ = /^\d{6,25}$/.test(phoneId.trim()) && /^\d{6,25}$/.test(wabaId.trim()) && token.trim().length >= 50 && (acc ? !appSecret || /^[a-f0-9]{32}$/i.test(appSecret.trim()) : /^[a-f0-9]{32}$/i.test(appSecret.trim()));

  const connect = async () => {
    if (!ready_ || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await waConnect({ phoneId: phoneId.trim(), wabaId: wabaId.trim(), token: token.trim(), ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}) });
      setToken("");
      setAppSecret("");
      setEditing(false);
      toast(`WhatsApp connected · ${r.display}`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveAuto = async () => {
    setBusy(true);
    setErr("");
    try {
      await waSaveAuto({ bill: pickOf(bill), ready: pickOf(ready) });
      toast("Saved · automatic messages updated");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    const t = pickOf(testT);
    if (!t || testTo.replace(/\D/g, "").length < 10) return;
    setBusy(true);
    try {
      await waTest(testTo, t.template, t.lang);
      toast("Test message sent");
      waMessages(20).then(setLog).catch(() => {});
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      await waOff();
      toast("WhatsApp API turned off · WhatsApp buttons work as before");
      await load();
    } finally {
      setBusy(false);
    }
  };
  const usable = (templates ?? []).filter((t) => t.ok);
  const option = (t: WaTemplate) => <option key={key(t)} value={key(t)}>{t.name} · {t.language} · {t.params} blank{t.params === 1 ? "" : "s"}</option>;
  const bodyOf = (v: string) => (templates ?? []).find((t) => key(t) === v)?.body;

  return (
    <div className="space-y-4">
      {!editing && on && acc && (
        <div className="rounded-group bg-surface p-4">
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-jade" /><span className="text-[15px] font-semibold">{acc.display_phone} · {acc.verified_name}</span></div>
          <div className="mt-1 text-[13px] text-muted">Token ••••{acc.last4 ?? ""} · stored encrypted</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="tinted" onClick={() => { setPhoneId(acc.phone_number_id); setWabaId(acc.waba_id); setToken(""); setAppSecret(""); setErr(""); setEditing(true); }}>Change token</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={turnOff}>Turn off</Button>
          </div>
        </div>
      )}

      {!editing && !on && (
        <div className="rounded-group bg-surface p-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold"><MessageCircle size={18} className="text-[#25D366]" /> Send from your own WhatsApp number</div>
          <p className="mt-1 text-[13px] text-muted">Connect your WhatsApp Business number (Meta WhatsApp Cloud API). Bills and “ready” messages then go out by themselves, and offers go to guests who said yes, in one tap. Meta charges for messages on your Meta account.</p>
          <Button size="sm" className="mt-3" onClick={() => { setPhoneId(acc?.phone_number_id ?? ""); setWabaId(acc?.waba_id ?? ""); setErr(""); setEditing(true); }}>{acc ? "Turn on again" : "Connect WhatsApp"}</Button>
        </div>
      )}

      {editing && (
        <div className="space-y-4 rounded-group bg-surface p-4">
          <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] text-muted">
            <li>Meta Business Suite → WhatsApp Manager: your number must be added and verified.</li>
            <li>developers.facebook.com → your app → WhatsApp → API Setup: copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b>.</li>
            <li>Business Settings → System users → Generate token (permissions whatsapp_business_messaging and whatsapp_business_management). Paste the <b>permanent token</b>.</li>
            <li>App settings → Basic → <b>App secret</b>.</li>
          </ol>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone number ID"><input className={inputCls} inputMode="numeric" autoComplete="off" value={phoneId} onChange={(e) => setPhoneId(e.target.value.replace(/\D/g, ""))} /></Field>
            <Field label="WhatsApp Business Account ID"><input className={inputCls} inputMode="numeric" autoComplete="off" value={wabaId} onChange={(e) => setWabaId(e.target.value.replace(/\D/g, ""))} /></Field>
          </div>
          <Field label="Permanent access token" hint="Sent once to the server and stored encrypted. Nobody can see it again, not even you.">
            <input className={inputCls} type="password" autoComplete="new-password" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />
          </Field>
          <Field label="App secret" hint={acc ? "Leave empty to keep the saved one." : "Lets Restropi check that delivery updates and replies really come from WhatsApp."}>
            <input className={inputCls} type="password" autoComplete="new-password" spellCheck={false} value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
          </Field>
          {err && <p className="text-[13.5px] font-medium text-rose">{err}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!ready_ || busy} onClick={connect}><Lock size={15} /> {busy ? "Checking with WhatsApp…" : "Check & connect"}</Button>
            <Button variant="ghost" onClick={() => { setToken(""); setAppSecret(""); setEditing(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      {on && acc && !editing && (
        <>
          <div className="rounded-[14px] bg-sunken/50 p-3">
            <div className="text-[13.5px] font-semibold">Webhook (delivery ticks and STOP replies)</div>
            <p className="mt-1 text-[12.5px] text-muted">Your app → WhatsApp → Configuration → Webhook: paste the URL and the verify token, then subscribe to <b>messages</b>.</p>
            {[["Callback URL", waWebhookUrl()], ["Verify token", acc.verify_token]].map(([label, v]) => (
              <button key={label} type="button" onClick={() => copy(v, label)} className="mt-2 flex w-full items-center gap-2 rounded-[10px] bg-surface px-3 py-2 text-left text-[12px] ring-1 ring-line">
                <span className="shrink-0 font-semibold">{label}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-muted">{v}</span>
                <Copy size={14} className="shrink-0 text-jade" />
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-group bg-surface p-4">
            <div className="text-[15px] font-semibold">Messages that go out by themselves</div>
            <p className="text-[12.5px] text-muted">Pick an approved template (Meta allows only these for messages you start). Make them in WhatsApp Manager → Message templates, category Utility.</p>
            {templates === null ? (
              <p className="text-[13px] text-muted">Loading your templates…</p>
            ) : (
              <>
                <Field label="E-bill after payment" hint="Blanks filled in order: {{1}} guest's first name, {{2}} amount, {{3}} restaurant · outlet, {{4}} bill number.">
                  <select className={inputCls} value={bill} onChange={(e) => setBill(e.target.value)}>
                    <option value="">Off (use the WhatsApp button as now)</option>
                    {usable.filter((t) => t.params <= 4).map(option)}
                  </select>
                </Field>
                {bill && <p className="-mt-2 rounded-[10px] bg-sunken/60 px-3 py-2 text-[12.5px] text-muted">{bodyOf(bill)}</p>}
                <Field label="Token ready (counter orders)" hint="{{1}} token number, {{2}} restaurant · outlet.">
                  <select className={inputCls} value={ready} onChange={(e) => setReady(e.target.value)}>
                    <option value="">Off</option>
                    {usable.filter((t) => t.params <= 2).map(option)}
                  </select>
                </Field>
                {ready && <p className="-mt-2 rounded-[10px] bg-sunken/60 px-3 py-2 text-[12.5px] text-muted">{bodyOf(ready)}</p>}
                {(templates ?? []).some((t) => !t.ok) && <p className="text-[12px] text-faint">Not shown: templates with a photo header, named or button variables.</p>}
                {err && <p className="text-[13.5px] font-medium text-rose">{err}</p>}
                <Button size="sm" disabled={busy} onClick={saveAuto}>Save</Button>
              </>
            )}
          </div>

          <div className="space-y-3 rounded-group bg-surface p-4">
            <div className="text-[15px] font-semibold">Send a test</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className={inputCls} inputMode="tel" placeholder="Your mobile number" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Test number" />
              <select className={inputCls} value={testT} onChange={(e) => setTestT(e.target.value)} aria-label="Template">
                <option value="">Template…</option>
                {usable.map(option)}
              </select>
              <Button disabled={busy || !testT || testTo.replace(/\D/g, "").length < 10} onClick={test}>Send</Button>
            </div>
          </div>

          {log.length > 0 && (
            <div className="rounded-group bg-surface p-4">
              <div className="mb-2 text-[15px] font-semibold">Recent messages</div>
              <ul className="space-y-1.5 text-[13px]">
                {log.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-muted">{m.kind}</span>
                    <span className="min-w-0 flex-1 truncate">{m.to_phone.replace(/(\d{5})(\d{5})/, "$1 $2")} · {m.template ?? ""}</span>
                    <span className={m.status === "failed" ? "font-semibold text-rose" : m.status === "read" || m.status === "delivered" ? "text-jade" : "text-muted"} title={m.error ?? undefined}>{STATUS[m.status] ?? m.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
