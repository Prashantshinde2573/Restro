"use client";

import clsx from "clsx";
import Link from "next/link";
import { ArrowUp, Banknote, Boxes, Percent, RotateCcw, ShieldCheck, Sparkles, Trash2, TrendingUp, CalendarRange } from "lucide-react";
import { useState } from "react";
import { Button, Group, Page, PageHeader, Pill, Sheet } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr, timeAgo } from "@/lib/format";
import type { LeakAlert } from "@/lib/types";

const kindIcon = { void: Trash2, discount: Percent, cash: Banknote, stock: Boxes, refund: RotateCcw };

const answers: Record<string, string> = {
  "Which dish should I push this weekend?":
    "Push Kothimbir Vadi and Kokum Sharbat. Both earn over 80% margin, guests who try them rate them 4.7+, but they sell less than a third of your starters. Captains suggesting them with every rooftop table would add roughly ₹6,500 this weekend.",
  "Why was last Monday slow?":
    "Last Monday did ₹49,700 — 21% under your Monday average. Lunch was normal; dinner dropped after 8 pm. It rained from 7:40 pm and Swiggy orders went up 30%, but dine-in fell by 38 guests. Nothing went wrong in the restaurant.",
  "How much do Swiggy and Zomato cost me?":
    "This month you paid about ₹41,200 in commission on ₹1.87 lakh of aggregator orders (22%). 312 of those guests have also ordered from you directly — a 10% direct-order offer to them would still save you about 12% per order.",
  "Who is my best captain this month?":
    "Sneha Kale: highest sales per table (₹2,140), highest guest rating (4.9) and lowest void count (0). Rohit sells more in total but works 6 more shifts.",
};

export default function InsightsPage() {
  const toast = useToast();
  const alerts = repo.leakAlerts();
  const [sel, setSel] = useState<LeakAlert | null>(null);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<{ q: string; a: string } | null>(null);
  const [thinking, setThinking] = useState(false);

  const ask = (question: string) => {
    setQ("");
    setThinking(true);
    setAsked({ q: question, a: "" });
    window.setTimeout(() => {
      setThinking(false);
      setAsked({ q: question, a: answers[question] ?? "In the live version I'll answer this from your own sales, stock and staff data. Try one of the suggested questions to see how it works." });
    }, 900);
  };

  const atRisk = alerts.reduce((s, a) => s + (a.amount ?? 0), 0);

  return (
    <>
      <PageHeader title="Insights" subtitle="What your numbers are saying, in plain words" />
      <Page className="space-y-6">
        {/* Ask Restro */}
        <section className="rounded-[24px] bg-surface p-4 lg:p-6">
          <div className="flex items-center gap-2 text-[14px] font-semibold"><Sparkles size={16} className="text-saffron" /> Ask about your restaurant</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) ask(q.trim());
            }}
            className="mt-3 flex items-center gap-2 rounded-[16px] bg-sunken p-1.5 pl-4"
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Why was last Monday slow?" className="h-10 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint" />
            <button aria-label="Ask" className="flex h-10 w-10 items-center justify-center rounded-full bg-jade text-white disabled:opacity-40" disabled={!q.trim()}>
              <ArrowUp size={18} />
            </button>
          </form>
          {asked ? (
            <div className="mt-4 animate-fade-in">
              <div className="text-[13px] font-medium text-muted">{asked.q}</div>
              {thinking ? (
                <div className="mt-2 flex gap-1">
                  {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-faint" style={{ animationDelay: `${i * 150}ms` }} />)}
                </div>
              ) : (
                <p className="mt-1.5 max-w-3xl text-[16px] leading-relaxed">{asked.a}</p>
              )}
            </div>
          ) : null}
          <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {Object.keys(answers).map((k) => (
              <button key={k} onClick={() => ask(k)} className="shrink-0 rounded-full bg-sunken px-3.5 py-2 text-[13.5px] font-medium hover:bg-line">
                {k}
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Leak guard */}
          <Group
            title={<span className="flex items-center gap-2"><ShieldCheck size={17} className="text-jade" /> Leak guard</span>}
            action={<span className="text-[13px] text-muted">{inr(atRisk)} worth checking this week</span>}
            flush
          >
            {alerts.map((a) => {
              const Icon = kindIcon[a.kind];
              return (
                <button key={a.id} onClick={() => setSel(a)} className="flex w-full items-start gap-3 border-b border-line/80 px-4 py-3.5 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
                  <span className={clsx("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", a.severity === "high" ? "bg-rose-soft text-rose" : a.severity === "medium" ? "bg-saffron-soft text-saffron" : "bg-sunken text-muted")}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{a.title}</div>
                    <div className="text-[13px] text-muted">{a.who ? `${a.who} · ` : ""}{timeAgo(a.at)}</div>
                  </div>
                  {a.amount ? <span className="text-[14px] font-semibold tnum">{inr(a.amount)}</span> : null}
                </button>
              );
            })}
          </Group>

          <div className="space-y-6">
            <Group title="Saved by Restro this month">
              <div className="text-[34px] font-semibold tracking-tight tnum">{inr(18_420)}</div>
              <div className="mt-3 space-y-2 text-[14px]">
                {[["Stock not wasted (forecast)", 7900], ["Leaks caught", 4120], ["Guests won back", 6400]].map(([l, v]) => (
                  <div key={String(l)} className="flex justify-between"><span className="text-muted">{l}</span><span className="font-medium tnum">{inr(Number(v))}</span></div>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] text-faint">More than 7× your Growth plan.</p>
            </Group>
            <Group flush>
              <Link href="/app/menu" className="flex items-center gap-3 border-b border-line/80 px-4 py-3.5 lg:px-5">
                <TrendingUp size={18} className="text-jade" />
                <span className="flex-1 text-[15px] font-medium">Which dishes earn the most</span>
                <Pill tone="saffron">3 ideas</Pill>
              </Link>
              <Link href="/app/inventory" className="flex items-center gap-3 px-4 py-3.5 lg:px-5">
                <CalendarRange size={18} className="text-jade" />
                <span className="flex-1 text-[15px] font-medium">Tomorrow&apos;s forecast and prep</span>
                <Pill tone="jade">240 guests</Pill>
              </Link>
            </Group>
          </div>
        </div>
      </Page>

      <Sheet
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.title ?? ""}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="plain" size="lg" onClick={() => { setSel(null); toast("Marked as fine"); }}>It&apos;s fine</Button>
            <Button size="lg" onClick={() => { setSel(null); toast("Noted on staff record"); }}>Follow up</Button>
          </div>
        }
      >
        {sel && (
          <div className="space-y-4">
            <Pill tone={sel.severity === "high" ? "rose" : sel.severity === "medium" ? "saffron" : "neutral"}>{sel.severity === "high" ? "Check today" : sel.severity === "medium" ? "Worth a look" : "For your info"}</Pill>
            <p className="text-[16px] leading-relaxed">{sel.detail}</p>
            <div className="overflow-hidden rounded-group bg-surface">
              {[["Who", sel.who ?? "—"], ["When", timeAgo(sel.at)], ["Amount", sel.amount ? inr(sel.amount) : "—"]].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-line/80 px-4 py-3 text-[14.5px] last:border-0">
                  <span className="text-muted">{l}</span><span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-muted">Restro compares every shift with your usual pattern. Alerts are hints, not accusations — most have an innocent reason.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}
