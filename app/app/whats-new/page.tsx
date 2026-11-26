"use client";

// What's new: the latest features and changes, newest first, in the chosen language.
import clsx from "clsx";
import Link from "next/link";
import { ArrowRight, CircleHelp, Sparkles, Wrench, Zap } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Page, PageHeader } from "@/components/ui";
import { openHelp } from "@/components/help";
import { L, dateLocale, useT } from "@/lib/i18n";
import { WHATS_NEW, markWhatsNewSeen, whatsNewSeen, type WhatsNew } from "@/lib/whats-new";

const TAG: Record<WhatsNew["tag"], { label: string; icon: typeof Sparkles; cls: string }> = {
  new: { label: "New", icon: Sparkles, cls: "bg-jade-soft text-jade-deep" },
  better: { label: "Better", icon: Zap, cls: "bg-sky-soft text-sky" },
  fixed: { label: "Fixed", icon: Wrench, cls: "bg-saffron-soft text-saffron" },
};

export default function WhatsNewPage() {
  const { lang } = useT();
  // what this phone had seen before opening the page: those stay plain, the rest get a dot
  const seenBefore = useMemo(() => whatsNewSeen(), []);
  useEffect(() => {
    markWhatsNewSeen();
    window.dispatchEvent(new Event("restropi:whatsnew"));
  }, []);
  const seenIdx = WHATS_NEW.findIndex((w) => w.id === seenBefore);

  // group by day
  const days: { date: string; items: { w: WhatsNew; fresh: boolean }[] }[] = [];
  WHATS_NEW.forEach((w, i) => {
    const fresh = seenIdx === -1 ? !!seenBefore || i < 3 : i < seenIdx;
    const last = days[days.length - 1];
    if (last?.date === w.date) last.items.push({ w, fresh });
    else days.push({ date: w.date, items: [{ w, fresh }] });
  });
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(dateLocale(), { day: "numeric", month: "long" });

  return (
    <>
      <PageHeader title={L("What's new")} subtitle={L("New features and changes in Restropi")} />
      <Page className="max-w-2xl space-y-6">
        {days.length === 0 && <p className="rounded-group bg-surface px-4 py-8 text-center text-[14.5px] text-muted">{L("Nothing new yet. New features will show here.")}</p>}
        {days.map((d) => (
          <section key={d.date}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{dayLabel(d.date)}</h2>
            <div className="space-y-3">
              {d.items.map(({ w, fresh }) => {
                const t = TAG[w.tag];
                return (
                  <article key={w.id} className="rounded-group bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", t.cls)}><t.icon size={17} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={clsx("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", t.cls)}>{L(t.label)}</span>
                          {fresh && <span className="h-2 w-2 rounded-full bg-rose" aria-label={L("Not seen yet")} />}
                        </div>
                        <h3 className="mt-1.5 text-[16px] font-semibold leading-snug">{w.title[lang]}</h3>
                        <ul className="mt-2 space-y-1.5">
                          {w.points[lang].map((p) => (
                            <li key={p} className="flex gap-2 text-[14px] leading-relaxed text-ink/75">
                              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink/40" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                        {w.href && (
                          <Link href={w.href} className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-jade">
                            {L("Open")} <ArrowRight size={15} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        <button onClick={openHelp} className="flex w-full items-center gap-3 rounded-group bg-surface p-4 text-left hover:shadow-float">
          <CircleHelp size={20} className="shrink-0 text-jade" />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">{L("Need help?")}</span>
            <span className="block text-[13px] text-muted">{L("Open the help chat and ask, any time.")}</span>
          </span>
          <ArrowRight size={16} className="text-muted" />
        </button>
      </Page>
    </>
  );
}
