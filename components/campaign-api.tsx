"use client";

// Campaigns → "Send all at once" (WhatsApp API, Pro): an approved template to the chosen guests.
// The server sends only to guests of this outlet who said yes to offers, never after STOP, at most
// one offer a day to each guest, and stops at once if WhatsApp starts limiting the number.
import { Check, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Field, inputCls } from "./ui";
import { waCampaign, waTemplates, type WaCampaignResult, type WaTemplate } from "@/lib/cloud";
import type { Customer } from "@/lib/types";

const key = (t: { name: string; language: string }) => `${t.name}|${t.language}`;

export function CampaignApi({ guests, outletId, onSent }: { guests: Customer[]; outletId: string; onSent?: (phones: string[], text: string) => void }) {
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<WaCampaignResult | null>(null);
  useEffect(() => {
    waTemplates().then((t) => setTemplates(t.filter((x) => x.ok))).catch((e) => { setTemplates([]); setErr((e as Error).message); });
  }, []);
  const t = templates?.find((x) => key(x) === pick);
  const blanks = Math.max(0, (t?.params ?? 0) - 1);
  useEffect(() => { setExtra((e) => Array.from({ length: blanks }, (_, i) => e[i] ?? "")); setSure(false); setRes(null); }, [pick, blanks]);
  const yes = useMemo(() => guests.filter((g) => g.optIn === true && g.phone.replace(/\D/g, "").length >= 10), [guests]);
  const sample = yes[0]?.name?.split(" ")[0] || "Neha";
  const preview = t ? t.body.replace(/\{\{(\d+)\}\}/g, (_, n) => (n === "1" ? sample : extra[Number(n) - 2] || `[${n}]`)) : "";
  const filled = extra.every((x) => x.trim());
  const many = yes.slice(0, 300);

  const send = async () => {
    if (!t || !filled || !many.length) return;
    if (!sure) return setSure(true);
    setBusy(true);
    setErr("");
    try {
      const r = await waCampaign({ outletId, template: t.name, lang: t.language, extra, phones: many.map((g) => g.phone) });
      setRes(r);
      if (r.sent > 0) onSent?.(many.map((g) => g.phone), `${t.body} ${extra.join(" ")}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setSure(false);
    }
  };

  if (templates === null) return <p className="text-[14px] text-muted">Loading your approved templates…</p>;
  return (
    <div className="space-y-4">
      <Field label="Approved template" hint="Make offer templates in WhatsApp Manager → Message templates (category Marketing). {{1}} becomes each guest's first name.">
        <select className={inputCls} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose…</option>
          {templates.map((x) => <option key={key(x)} value={key(x)}>{x.name} · {x.language} · {x.category.toLowerCase()}</option>)}
        </select>
      </Field>
      {templates.length === 0 && !err && <p className="text-[13px] text-muted">No approved templates yet. Meta usually approves a template within a few minutes to a day.</p>}
      {extra.map((v, i) => (
        <Field key={i} label={`Blank {{${i + 2}}}`}>
          <input className={inputCls} maxLength={200} value={v} onChange={(e) => setExtra((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
        </Field>
      ))}
      {t && (
        <div className="rounded-[22px] bg-[#E7DED3] p-3">
          <div className="ml-auto max-w-[95%] whitespace-pre-wrap rounded-[14px] rounded-tr-[4px] bg-white p-3 text-[13.5px] leading-snug text-[#111] shadow-sm">{preview}</div>
        </div>
      )}
      <p className="text-[13px] text-muted">
        Goes to <b>{many.length}</b> guest{many.length === 1 ? "" : "s"} in this group who said yes to offers{yes.length > 300 ? " (the first 300; send again for the rest)" : ""}. Guests who wrote STOP, or got an offer in the last 24 hours, are skipped.
      </p>
      {err && <p className="text-[13.5px] font-medium text-rose">{err}</p>}
      {res ? (
        <div className="rounded-group bg-jade-soft p-4 text-[14px] text-jade-deep">
          <div className="flex items-center gap-2 font-semibold"><Check size={16} /> Sent to {res.sent}</div>
          <div className="mt-1 text-[13px]">
            {[res.failed && `${res.failed} failed`, res.noOptIn && `${res.noOptIn} not OK with offers`, res.stopped && `${res.stopped} wrote STOP`, res.recent && `${res.recent} got an offer today`, res.limit && `${res.limit} over today's limit`].filter(Boolean).join(" · ") || "Nobody skipped."}
          </div>
          {res.errors.length > 0 && <div className="mt-1 text-[12.5px] text-rose">{res.errors.join(" · ")}</div>}
        </div>
      ) : (
        <Button size="lg" className="w-full" variant={sure ? "danger" : "primary"} disabled={!t || !filled || !many.length || busy} onClick={send}>
          <Send size={16} /> {busy ? "Sending…" : sure ? `Yes, send to ${many.length} now` : `Send to ${many.length} guest${many.length === 1 ? "" : "s"}`}
        </Button>
      )}
    </div>
  );
}
