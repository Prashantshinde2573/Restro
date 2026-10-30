"use client";

import { BadgeCheck, MessageCircle, QrCode, Search, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, Chips, Group, Page, PageHeader, Pill, Segmented, Sheet } from "@/components/ui";
import { useGuests, useFeedback } from "@/lib/live";
import { inr, timeAgo } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { guestMatch, waLink, type GuestSeg } from "@/lib/wa";

type Seg = GuestSeg;
const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} className={i < n ? "fill-saffron text-saffron" : "text-line"} />
      ))}
    </span>
  );
}
export default function GuestsPage() {
  const [tab, setTab] = useState<"guests" | "reviews">("guests");
  const [seg, setSeg] = useState<Seg>("all");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const all = useGuests();
  const fb = useFeedback().slice().sort((a, b) => b.at.localeCompare(a.at));

  const sel: Customer | null = all.find((c) => c.id === selId) ?? null;
  const list = useMemo(
    () => all.filter((c) => guestMatch(c, seg) && (!q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit)),
    [all, seg, q],
  );
  const back = all.filter((c) => c.visits > 1 && daysSince(c.lastVisit) <= 30).length;
  const avg = fb.length ? fb.reduce((s, f) => s + f.stars, 0) / fb.length : 0;

  return (
    <>
      <PageHeader title="Guests" subtitle={all.length ? `${all.length} guest${all.length === 1 ? "" : "s"} · ${back} came back in the last 30 days` : "Your guest book"}>
        <Segmented value={tab} onChange={setTab} options={[{ value: "guests", label: "Guest book" }, { value: "reviews", label: `Feedback${fb.length ? ` · ${fb.length}` : ""}` }]} />
      </PageHeader>
      <Page>
        {tab === "guests" ? (
          all.length === 0 ? (
            <div className="flex flex-col items-center rounded-group bg-surface px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade"><Users size={26} /></span>
              <h2 className="mt-4 text-[18px] font-semibold">No guests yet</h2>
              <p className="mt-1 max-w-sm text-[14.5px] text-muted">Guests are added when they order from the table QR with their phone number, or when you add a number to a bill.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone" className="h-11 w-full rounded-ctl bg-surface pl-10 pr-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade lg:max-w-md" />
              </div>
              <Chips
                value={seg}
                onChange={setSeg}
                options={[
                  { value: "all", label: "Everyone", count: all.length },
                  { value: "regular", label: "Regulars (3+ visits)", count: all.filter((c) => guestMatch(c, "regular")).length },
                  { value: "lapsed", label: "Not seen 30+ days", count: all.filter((c) => guestMatch(c, "lapsed")).length },
                  { value: "optin", label: "OK with offers", count: all.filter((c) => guestMatch(c, "optin")).length },
                ]}
              />
              <Group flush>
                {list.map((c) => (
                  <button key={c.id} onClick={() => setSelId(c.id)} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
                    <Avatar name={c.name || "Guest"} hue={((c.name || "G").charCodeAt(0) * 37) % 360} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-medium">{c.name || "Guest"}</span>
                        {c.verified && <BadgeCheck size={15} className="text-jade" aria-label="Number verified" />}
                        {c.source === "qr" && c.visits <= 1 && <Pill tone="sky"><QrCode size={11} /> New via QR</Pill>}
                      </div>
                      <div className="truncate text-[13px] text-muted">{c.phone} · {c.visits} {c.visits === 1 ? "visit" : "visits"} · {timeAgo(c.lastVisit)}</div>
                    </div>
                    <div className="text-right text-[14px] font-semibold tnum">{inr(c.spend)}</div>
                  </button>
                ))}
                {list.length === 0 && <p className="px-4 py-6 text-center text-[14px] text-muted">No one matches.</p>}
              </Group>
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-group bg-line/70">
              {[
                ["Average rating", fb.length ? avg.toFixed(1) : "—"],
                ["Happy (4–5★)", String(fb.filter((f) => f.stars >= 4).length)],
                ["Unhappy (1–3★)", String(fb.filter((f) => f.stars <= 3).length)],
              ].map(([l, v]) => (
                <div key={l} className="bg-surface p-4">
                  <div className="text-[13px] text-muted">{l}</div>
                  <div className="mt-1 text-[26px] font-semibold tracking-tight tnum">{v}</div>
                </div>
              ))}
            </div>
            <Group title="Latest feedback" flush>
              {fb.length === 0 && <p className="px-4 py-6 text-center text-[14px] text-muted">Guests rate their visit on the thank-you screen after paying. Their ratings show here.</p>}
              {fb.map((f) => (
                <div key={f.id} className="border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium">{f.customer || "Guest"}</span>
                    <Stars n={f.stars} />
                    <span className="ml-auto text-[12.5px] text-muted">{timeAgo(f.at)}</span>
                  </div>
                  {f.text && <p className="mt-1 text-[14px]">{f.text}</p>}
                  {f.stars <= 3 && <Pill tone="rose" className="mt-2">Needs a look</Pill>}
                </div>
              ))}
            </Group>
          </div>
        )}
      </Page>

      <Sheet open={!!sel} onClose={() => setSelId(null)} title={sel?.name || "Guest"}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={sel.name || "Guest"} hue={((sel.name || "G").charCodeAt(0) * 37) % 360} size={60} />
              <div className="flex items-center gap-1.5 text-[15px] text-muted">
                +91 {sel.phone} {sel.verified && <BadgeCheck size={16} className="text-jade" aria-label="Verified" />}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-group bg-line/70">
              {[["Visits", sel.visits], ["Spent", inr(sel.spend)], ["Average bill", inr(Math.round(sel.spend / Math.max(1, sel.visits)))]].map(([l, v]) => (
                <div key={String(l)} className="bg-surface p-3 text-center">
                  <div className="text-[18px] font-semibold tnum">{v}</div>
                  <div className="text-[12px] text-muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-group bg-surface">
              {[
                ["Last visit", timeAgo(sel.lastVisit)],
                ["Came from", sel.source === "qr" ? "Table QR" : sel.source === "whatsapp" ? "WhatsApp" : "Counter"],
                ["Offers on WhatsApp", sel.optIn ? "Yes" : "No"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-4 border-b border-line/80 px-4 py-3 text-[14.5px] last:border-0">
                  <span className="text-muted">{l}</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 px-1 text-[15px] font-semibold">Bills</div>
              <div className="overflow-hidden rounded-group bg-surface">
                {(sel.bills ?? []).map((b) => (
                  <div key={b.orderNo + b.at} className="flex items-center justify-between border-b border-line/80 px-4 py-3 text-[14.5px] last:border-0">
                    <span>
                      #{b.orderNo}
                      <span className="block text-[12.5px] text-muted">{timeAgo(b.at)} · {b.method}</span>
                    </span>
                    <span className="font-semibold tnum">{inr(b.amount)}</span>
                  </div>
                ))}
                {!sel.bills?.length && <div className="px-4 py-3 text-[14px] text-muted">No bills yet.</div>}
              </div>
            </div>
            <a href={waLink(sel.phone)} target="_blank" rel="noreferrer" className="block">
              <Button variant="tinted" className="w-full"><MessageCircle size={16} /> Message on WhatsApp</Button>
            </a>
          </div>
        )}
      </Sheet>
    </>
  );
}
