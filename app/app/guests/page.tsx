"use client";

import clsx from "clsx";
import { Cake, Gift, Lock, MessageCircle, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, Chips, Group, Page, PageHeader, Pill, Segmented, Sheet } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr, timeAgo } from "@/lib/format";
import type { Customer } from "@/lib/types";

type Seg = "all" | "inner" | "birthday" | "lapsed" | "unhappy";

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
  const toast = useToast();
  const [tab, setTab] = useState<"guests" | "reviews">("guests");
  const [seg, setSeg] = useState<Seg>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Customer | null>(null);
  const all = repo.customers();
  const fb = repo.feedback();

  const days = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
  const match = (c: Customer, s: Seg) =>
    s === "all" ? true : s === "inner" ? c.tier === "Inner circle" || c.tier === "Gold" : s === "birthday" ? !!c.birthday : s === "lapsed" ? days(c.lastVisit) > 30 : c.mood === "unhappy";
  const list = useMemo(() => all.filter((c) => match(c, seg) && (!q || `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()))), [all, seg, q]);

  return (
    <>
      <PageHeader title="Guests" subtitle="1,920 guests · 38% came back this month">
        <Segmented value={tab} onChange={setTab} options={[{ value: "guests", label: "Guest book" }, { value: "reviews", label: "Reviews" }]} />
      </PageHeader>
      <Page>
        {tab === "guests" ? (
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
                { value: "inner", label: "Regulars", count: all.filter((c) => match(c, "inner")).length },
                { value: "birthday", label: "Birthday soon", count: all.filter((c) => match(c, "birthday")).length },
                { value: "lapsed", label: "Not seen 30+ days", count: all.filter((c) => match(c, "lapsed")).length },
                { value: "unhappy", label: "Unhappy last visit", count: all.filter((c) => match(c, "unhappy")).length },
              ]}
            />
            {seg === "lapsed" && (
              <div className="flex flex-col gap-3 rounded-group bg-saffron-soft/70 p-4 sm:flex-row sm:items-center">
                <p className="flex-1 text-[14px]">These guests used to come every 2 weeks. A personal WhatsApp brings back about 1 in 6.</p>
                <Button size="sm" onClick={() => toast("Win-back message scheduled for 11 am")}><MessageCircle size={15} /> Send win-back offer</Button>
              </div>
            )}
            <Group flush>
              {list.map((c) => (
                <button key={c.id} onClick={() => setSel(c)} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
                  <Avatar name={c.name} hue={(c.name.charCodeAt(0) * 37) % 360} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium">{c.name}</span>
                      {c.birthday && <Cake size={14} className="text-saffron" aria-label={`Birthday ${c.birthday}`} />}
                    </div>
                    <div className="truncate text-[13px] text-muted">{c.visits} visits · loves {c.favourite} · {timeAgo(c.lastVisit)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold tnum">{inr(c.spend)}</div>
                    <Pill tone={c.tier === "Inner circle" ? "jade" : c.tier === "Gold" ? "saffron" : "neutral"}>{c.tier}</Pill>
                  </div>
                </button>
              ))}
            </Group>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
              {[
                ["Google rating", "4.6", "up from 4.3 in July"],
                ["New Google reviews", "38", "this month"],
                ["Kept private", "6", "unhappy guests reached you first"],
                ["Replied within 1 hour", "92%", ""],
              ].map(([l, v, n]) => (
                <div key={l} className="bg-surface p-4">
                  <div className="text-[13px] text-muted">{l}</div>
                  <div className="mt-1 text-[26px] font-semibold tracking-tight tnum">{v}</div>
                  <div className="text-[12.5px] text-muted">{n}</div>
                </div>
              ))}
            </div>
            <Group title="How it works">
              <p className="text-[14px] leading-relaxed text-muted">
                Every e-bill on WhatsApp ends with “How was your meal?”. Guests who tap 4–5 stars get a one-tap link to post on Google.
                Guests who tap 1–3 stars talk to you privately, so you can fix it before it becomes a public review.
              </p>
            </Group>
            <Group title="Latest feedback" flush>
              {fb.map((f) => (
                <div key={f.id} className="border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium">{f.customer}</span>
                    <Stars n={f.stars} />
                    <span className="ml-auto text-[12.5px] text-muted">{timeAgo(f.at)}</span>
                  </div>
                  <p className="mt-1 text-[14px]">{f.text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {f.routed === "google" ? (
                      <Pill tone="jade">Sent to Google</Pill>
                    ) : (
                      <Pill tone="rose"><Lock size={11} /> Private to you</Pill>
                    )}
                    {f.replied ? (
                      <span className="text-[12.5px] text-muted">Replied</span>
                    ) : (
                      <button onClick={() => toast(f.routed === "private" ? "Apology + ₹200 voucher sent on WhatsApp" : "Thank-you reply posted")} className="text-[13px] font-semibold text-jade">
                        {f.routed === "private" ? "Say sorry with a voucher" : "Reply"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Group>
          </div>
        )}
      </Page>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={sel.name} hue={(sel.name.charCodeAt(0) * 37) % 360} size={60} />
              <div>
                <div className="text-[15px] text-muted">{sel.phone}</div>
                <Pill tone={sel.tier === "Inner circle" ? "jade" : sel.tier === "Gold" ? "saffron" : "neutral"} className="mt-1">{sel.tier}</Pill>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-group bg-line/70">
              {[["Visits", sel.visits], ["Spent", inr(sel.spend)], ["Points", sel.points.toLocaleString("en-IN")]].map(([l, v]) => (
                <div key={String(l)} className="bg-surface p-3 text-center">
                  <div className="text-[18px] font-semibold tnum">{v}</div>
                  <div className="text-[12px] text-muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-group bg-surface">
              {[
                ["Usually orders", sel.favourite],
                ["Last visit", timeAgo(sel.lastVisit)],
                ["Birthday", sel.birthday ?? "Not added"],
                ["Average bill", inr(Math.round(sel.spend / sel.visits))],
                ["Notes", sel.mood === "unhappy" ? "Complained about salt in mutton last time" : "Prefers window seat"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-4 border-b border-line/80 px-4 py-3 text-[14.5px] last:border-0">
                  <span className="text-muted">{l}</span>
                  <span className={clsx("text-right font-medium", l === "Notes" && sel.mood === "unhappy" && "text-rose")}>{v}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="tinted" onClick={() => toast(`WhatsApp opened for ${sel.name}`)}><MessageCircle size={16} /> Message</Button>
              <Button variant="plain" onClick={() => toast("₹200 voucher sent")}><Gift size={16} /> Send voucher</Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
