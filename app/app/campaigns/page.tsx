"use client";

// Message guests on WhatsApp. Each message opens in WhatsApp with the text
// typed in, so it goes from the restaurant's own number (no paid API needed).
import clsx from "clsx";
import { Check, MessageCircle, Send, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Chips, Field, Group, Page, PageHeader, Segmented } from "@/components/ui";
import { CouponsPanel, couponState } from "@/components/coupons";
import { couponLabel, useAccount, useCoupons, useFeature, useGuests } from "@/lib/live";
import { guestMatch, waLink, type GuestSeg } from "@/lib/wa";
import { timeAgo } from "@/lib/format";
import { TEMPLATES, fillTemplate, type TemplateLang } from "@/lib/wa-templates";

export default function CampaignsPage() {
  const account = useAccount();
  const guests = useGuests();
  const [seg, setSeg] = useState<GuestSeg>("optin");
  const [msg, setMsg] = useState(`Hi {name}! Thank you for visiting ${account.name || "us"}. We'd love to see you again this week 🙏`);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"messages" | "coupons">("messages");
  const [tLang, setTLang] = useState<TemplateLang>("en");
  const [tId, setTId] = useState<string | null>(null);
  const applyTemplate = (id: string, lang = tLang) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTId(id);
    setMsg(fillTemplate(t, lang, account.name));
  };
  const blanks = msg.match(/\[[^\]]+\]/g) ?? [];
  const couponsOn = useFeature("coupons") === "ok";
  const live = useCoupons().filter((c) => couponState(c).tone === "jade");

  const list = useMemo(() => guests.filter((g) => guestMatch(g, seg) && g.phone.replace(/\D/g, "").length >= 10), [guests, seg]);
  const first = (n: string) => (n || "there").split(" ")[0];

  return (
    <>
      <PageHeader title={tab === "coupons" ? "Coupons" : "Message guests"} subtitle={tab === "coupons" ? "Discount codes your guests use on the bill" : "Send offers and news on WhatsApp from your own number"}>
        {couponsOn && (
          <Segmented value={tab} onChange={setTab} options={[{ value: "messages", label: "Messages" }, { value: "coupons", label: "Coupons" }]} />
        )}
      </PageHeader>
      {tab === "coupons" && couponsOn ? (
        <Page><CouponsPanel /></Page>
      ) : (
      <Page className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="min-w-0 space-y-5">
          <Field label="Who gets it">
            <Chips
              value={seg}
              onChange={(v) => { setSeg(v); setSent(new Set()); }}
              options={[
                { value: "optin", label: "OK with offers", count: guests.filter((g) => guestMatch(g, "optin")).length },
                { value: "regular", label: "Regulars", count: guests.filter((g) => guestMatch(g, "regular")).length },
                { value: "lapsed", label: "Not seen 30+ days", count: guests.filter((g) => guestMatch(g, "lapsed")).length },
                { value: "all", label: "Everyone", count: guests.length },
              ]}
            />
          </Field>
          {seg !== "optin" && <p className="-mt-2 text-[13px] text-saffron">Only message guests who&apos;d expect to hear from you.</p>}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-muted">Templates</span>
              <div role="group" aria-label="Template language" className="flex gap-1 rounded-full bg-sunken p-0.5">
                {(
                  [
                    ["en", "English"],
                    ["mr", "मराठी"],
                    ["hi", "हिंदी"],
                  ] as [TemplateLang, string][]
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={tLang === v}
                    onClick={() => { setTLang(v); if (tId) applyTemplate(tId, v); }}
                    className={clsx("rounded-full px-2.5 py-1 text-[12.5px] font-semibold", tLang === v ? "bg-surface text-ink shadow-sm" : "text-muted")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  aria-pressed={tId === t.id}
                  className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1", tId === t.id ? "bg-ink text-canvas ring-ink" : "bg-surface text-ink ring-line")}
                >
                  <span aria-hidden>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Message" hint="{name} becomes each guest's first name.">
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} className="w-full rounded-ctl bg-surface p-4 text-[15px] outline-none ring-1 ring-line focus:ring-1 focus:ring-jade/40" />
          </Field>
          {blanks.length > 0 && (
            <p className="-mt-2 rounded-[12px] bg-saffron-soft px-3 py-2 text-[13px] text-ink">
              Fill in {blanks.map((b, i) => <b key={i}>{i ? ", " : ""}{b}</b>)} before sending.
            </p>
          )}
          {couponsOn && live.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-2">
              {live.slice(0, 4).map((c) => (
                <button key={c.id} onClick={() => setMsg((m) => `${m.trimEnd()}\n\n🎁 ${couponLabel(c)} with code *${c.code}*`)} className="flex items-center gap-1.5 rounded-full bg-jade-soft px-3 py-1.5 text-[12.5px] font-semibold text-jade-deep">
                  <Ticket size={13} /> Add {c.code}
                </button>
              ))}
            </div>
          )}
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">Preview</div>
            <div className="rounded-[22px] bg-[#E7DED3] p-3">
              <div className="ml-auto max-w-[95%] whitespace-pre-wrap rounded-[14px] rounded-tr-[4px] bg-white p-3 text-[13.5px] leading-snug text-[#111] shadow-sm">
                {msg.replaceAll("{name}", first(list[0]?.name ?? "Neha"))}
              </div>
            </div>
          </div>
        </div>

        <Group title={`${list.length} guest${list.length === 1 ? "" : "s"} · ${sent.size} sent`} flush>
          {list.length === 0 && (
            <p className="px-4 py-8 text-center text-[14px] text-muted">{guests.length ? "No guests in this group." : "Guests appear here once they order with their phone number."}</p>
          )}
          {list.map((g) => {
            const done = sent.has(g.id);
            return (
              <div key={g.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                <Avatar name={g.name || "Guest"} hue={((g.name || "G").charCodeAt(0) * 37) % 360} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{g.name || "Guest"}</div>
                  <div className="text-[12.5px] text-muted">{g.phone} · {timeAgo(g.lastVisit)}</div>
                </div>
                <a
                  href={waLink(g.phone, msg.replaceAll("{name}", first(g.name)))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setSent((s) => new Set(s).add(g.id))}
                  className={clsx("flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold", done ? "bg-sunken text-muted" : "bg-[#25D366] text-white")}
                >
                  {done ? <><Check size={15} /> Sent</> : <><Send size={14} /> Send</>}
                </a>
              </div>
            );
          })}
          {list.length > 0 && (
            <p className="flex items-center gap-1.5 px-4 py-3 text-[12.5px] text-muted lg:px-5">
              <MessageCircle size={13} /> Each tap opens WhatsApp with the message ready. Press send there.
            </p>
          )}
        </Group>
      </Page>
      )}
    </>
  );
}
