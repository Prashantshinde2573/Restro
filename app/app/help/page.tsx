"use client";

// Help center: search, common problems by topic, the full manual to read here,
// and the designed PDF manuals in English, Marathi and Hindi to download or print.
import clsx from "clsx";
import { BookOpen, Download, Printer, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Page, PageHeader, inputCls } from "@/components/ui";
import { Blocks, ContactCard, FaqList, HelpLangSwitch, LANG_LABEL, ManualDownloads, useHelpLang } from "@/components/help";
import { HELP_LANGS, MANUALS, MANUAL_FILE, MANUAL_PDF, searchHelp, type Faq, type HelpLang } from "@/lib/help";

type Area = "all" | Faq["area"];

export default function HelpPage() {
  const [lang, setLang] = useHelpLang();
  const m = MANUALS[lang];
  const [q, setQ] = useState("");
  const [area, setArea] = useState<Area>("all");
  const [active, setActive] = useState(m.sections[0].id);
  const jumped = useRef(false);

  // ?lang=mr&s=tables from the help button
  useEffect(() => {
    if (jumped.current) return;
    jumped.current = true;
    const sp = new URLSearchParams(window.location.search);
    const l = sp.get("lang") as HelpLang | null;
    if (l && HELP_LANGS.includes(l)) setLang(l);
    const s = sp.get("s");
    if (s) setTimeout(() => goTo(s), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // highlight the section being read
  useEffect(() => {
    const els = m.sections.map((s) => document.getElementById("sec-" + s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (ents) => {
        const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.slice(4));
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [m, q]);

  const goTo = (id: string) => {
    setQ("");
    requestAnimationFrame(() => {
      const el = document.getElementById("sec-" + id);
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
      setActive(id);
    });
  };

  const res = useMemo(() => (q.trim() ? searchHelp(m, q) : null), [m, q]);
  const areas = useMemo(() => {
    const used = new Set(m.faq.map((f) => f.area));
    return (Object.keys(m.areas) as Faq["area"][]).filter((a) => used.has(a));
  }, [m]);
  const faqs = area === "all" ? m.faq : m.faq.filter((f) => f.area === area);

  return (
    <>
      <PageHeader title={m.ui.helpCenter} subtitle={m.subtitle} actions={<HelpLangSwitch value={lang} onChange={setLang} className="w-full sm:w-auto" />}>
        <div className="relative max-w-2xl">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.ui.searchPlaceholder} aria-label={m.ui.searchPlaceholder} className={clsx(inputCls, "h-[52px] pl-11 pr-11 shadow-float")} />
          {q && (
            <button onClick={() => setQ("")} aria-label={m.ui.back} className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-sunken text-muted">
              <X size={14} />
            </button>
          )}
        </div>
      </PageHeader>

      <Page>
        {res ? (
          <div className="max-w-3xl space-y-6">
            {res.faq.length === 0 && res.sections.length === 0 && <p className="rounded-[16px] bg-surface p-5 text-[15px] text-muted ring-1 ring-line/70">{m.ui.noResults}</p>}
            {res.faq.length > 0 && (
              <section>
                <h2 className="mb-3 text-[17px] font-semibold">{m.ui.commonProblems}</h2>
                <FaqList key={lang + q} items={res.faq} initialOpen={res.faq[0].id} />
              </section>
            )}
            {res.sections.length > 0 && (
              <section>
                <h2 className="mb-3 text-[17px] font-semibold">{m.ui.manual}</h2>
                <div className="space-y-2">
                  {res.sections.map((s) => (
                    <button key={s.id} onClick={() => goTo(s.id)} className="flex w-full items-center gap-3 rounded-[14px] bg-surface px-4 py-3.5 text-left ring-1 ring-line/70 hover:ring-jade/40">
                      <BookOpen size={17} className="shrink-0 text-jade" />
                      <span className="min-w-0"><span className="block text-[15px] font-semibold">{s.title}</span><span className="block text-[13px] text-muted">{s.summary}</span></span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <ContactCard m={m} />
          </div>
        ) : (
          <div className="space-y-10">
            {/* manuals */}
            <section className="overflow-hidden rounded-[22px] bg-[#0d1512] text-white">
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white/80"><BookOpen size={14} /> {m.ui.manuals} · {m.updated}</div>
                  <h2 className="mt-3 text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">{m.title}</h2>
                  <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-white/65">{m.sections.slice(1, 7).map((s) => s.title.replace(/^\d+\.\s*/, "")).join(" · ")} …</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => goTo(m.sections[0].id)} className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14.5px] font-semibold text-ink">
                      <BookOpen size={16} /> {m.ui.readManual}
                    </button>
                    <a href={MANUAL_PDF[lang]} download={MANUAL_FILE[lang]} className="flex h-11 items-center gap-2 rounded-full bg-jade px-5 text-[14.5px] font-semibold text-white">
                      <Download size={16} /> {m.ui.downloadPdf}
                    </a>
                    <a href={MANUAL_PDF[lang]} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-[14.5px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">
                      <Printer size={16} /> {m.ui.print}
                    </a>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {HELP_LANGS.map((l) => (
                    <a key={l} href={MANUAL_PDF[l]} download={MANUAL_FILE[l]} className={clsx("group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-[14px] p-3 ring-1 transition hover:-translate-y-0.5", l === lang ? "bg-white text-ink ring-white" : "bg-white/[.06] text-white ring-white/15 hover:bg-white/10")}>
                      <span className={clsx("flex h-7 w-7 items-center justify-center rounded-[8px] text-[13px] font-black", l === lang ? "bg-jade text-white" : "bg-white/15")}>R</span>
                      <span>
                        <span className="block text-[15px] font-semibold leading-tight">{LANG_LABEL[l]}</span>
                        <span className={clsx("mt-1 flex items-center gap-1 text-[12px]", l === lang ? "text-muted" : "text-white/60")}><Download size={12} /> PDF</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </section>

            {/* common problems */}
            <section>
              <h2 className="mb-3 text-[20px] font-semibold tracking-tight">{m.ui.commonProblems}</h2>
              <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
                {(["all", ...areas] as Area[]).map((a) => (
                  <button key={a} onClick={() => setArea(a)} className={clsx("h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold ring-1 transition-colors", area === a ? "bg-ink text-white ring-ink" : "bg-surface text-ink/80 ring-line hover:ring-ink/30")}>
                    {a === "all" ? m.ui.allTopics : m.areas[a]}
                  </button>
                ))}
              </div>
              <div className="max-w-3xl">
                <FaqList key={lang + area} items={faqs} />
              </div>
            </section>

            {/* the manual */}
            <section id="manual" className="grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
              <nav className="hidden lg:block">
                <div className="sticky top-6 max-h-[calc(100dvh-48px)] overflow-y-auto pr-2">
                  <div className="mb-2 px-3 text-[12.5px] font-semibold uppercase tracking-wide text-faint">{m.ui.contents}</div>
                  {m.sections.map((s) => (
                    <button key={s.id} onClick={() => goTo(s.id)} className={clsx("block w-full rounded-[10px] px-3 py-1.5 text-left text-[13.5px] leading-snug transition-colors", active === s.id ? "bg-surface font-semibold text-ink shadow-float" : "text-muted hover:text-ink")}>
                      {s.title}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="min-w-0 max-w-3xl">
                <div className="mb-5 lg:hidden">
                  <h2 className="mb-2 text-[20px] font-semibold tracking-tight">{m.ui.contents}</h2>
                  <div className="grid gap-1.5">
                    {m.sections.map((s) => (
                      <button key={s.id} onClick={() => goTo(s.id)} className="flex items-center justify-between rounded-[12px] bg-surface px-3.5 py-2.5 text-left text-[14px] font-medium ring-1 ring-line/60">
                        <span className="min-w-0 truncate">{s.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-5">
                  {m.sections.map((s) => (
                    <article key={s.id} id={"sec-" + s.id} className="scroll-mt-20 rounded-[20px] bg-surface p-5 ring-1 ring-line/60 sm:p-7">
                      <h3 className="text-[21px] font-semibold leading-tight tracking-tight">{s.title}</h3>
                      <p className="mb-4 mt-1 text-[14px] text-muted">{s.summary}</p>
                      <Blocks blocks={s.blocks} m={m} />
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="max-w-3xl space-y-4">
              <ManualDownloads m={m} />
              <ContactCard m={m} />
            </section>
          </div>
        )}
      </Page>
    </>
  );
}
