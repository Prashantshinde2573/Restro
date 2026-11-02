"use client";

// Help: the manual renderer, the questions list, and the help sheet opened from the "?" button.
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, CircleHelp, Download, Info, Mail, MessageCircle, Search, TriangleAlert } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { HELP_LANGS, MANUALS, MANUAL_FILE, MANUAL_PDF, SUPPORT, boldParts, faqsForPath, searchHelp, sectionForPath, type Block, type Faq, type HelpLang, type Manual } from "@/lib/help";
import { DEFAULT_CONTACT_WHATSAPP } from "@/lib/config";

const CONTACT_WA = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || DEFAULT_CONTACT_WHATSAPP).replace(/\D/g, "");
import { Sheet, inputCls } from "./ui";

export const LANG_LABEL: Record<HelpLang, string> = { en: "English", mr: "मराठी", hi: "हिंदी" };

/** "**bold**" text, with new lines kept. */
export function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((ln, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {boldParts(ln).map((p, j) => (p.bold ? <strong key={j} className="font-semibold text-ink">{p.text}</strong> : <Fragment key={j}>{p.text}</Fragment>))}
        </Fragment>
      ))}
    </>
  );
}

export function HelpLangSwitch({ value, onChange, className }: { value: HelpLang; onChange: (l: HelpLang) => void; className?: string }) {
  return (
    <div className={clsx("flex gap-1 rounded-ctl bg-sunken p-1", className)} role="radiogroup" aria-label="Language">
      {HELP_LANGS.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={clsx("flex-1 rounded-[9px] px-3 py-1.5 text-[14px] font-semibold transition-colors", value === l ? "bg-surface text-ink shadow-float" : "text-muted hover:text-ink")}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/** The manual's content blocks. */
export function Blocks({ blocks, m }: { blocks: Block[]; m: Manual }) {
  return (
    <div className="space-y-3.5 text-[15px] leading-[1.65] text-ink/85">
      {blocks.map((b, i) => {
        if ("p" in b) return <p key={i}><Rich text={b.p} /></p>;
        if ("h" in b) return <h4 key={i} className="pt-2 text-[15.5px] font-semibold text-ink">{b.h}</h4>;
        if ("steps" in b)
          return (
            <ol key={i} className="space-y-2.5">
              {b.steps.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jade text-[12.5px] font-bold text-white tnum" aria-label={`${m.ui.step} ${j + 1}`}>{j + 1}</span>
                  <span className="min-w-0"><Rich text={s} /></span>
                </li>
              ))}
            </ol>
          );
        if ("list" in b)
          return (
            <ul key={i} className="space-y-2">
              {b.list.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-jade" />
                  <span className="min-w-0"><Rich text={s} /></span>
                </li>
              ))}
            </ul>
          );
        if ("tip" in b)
          return (
            <div key={i} className="flex gap-3 rounded-[14px] bg-jade-soft/70 p-3.5 ring-1 ring-jade/15">
              <Info size={18} className="mt-[3px] shrink-0 text-jade" />
              <div className="min-w-0"><div className="text-[12.5px] font-bold uppercase tracking-wide text-jade">{m.ui.goodToKnow}</div><Rich text={b.tip} /></div>
            </div>
          );
        if ("warn" in b)
          return (
            <div key={i} className="flex gap-3 rounded-[14px] bg-saffron-soft/70 p-3.5 ring-1 ring-saffron/20">
              <TriangleAlert size={18} className="mt-[3px] shrink-0 text-saffron" />
              <div className="min-w-0"><div className="text-[12.5px] font-bold uppercase tracking-wide text-saffron">{m.ui.careful}</div><Rich text={b.warn} /></div>
            </div>
          );
        if ("table" in b) {
          const wide = b.table.head.length > 3;
          return (
            <div key={i} className="-mx-1 overflow-x-auto rounded-[14px] ring-1 ring-line">
              <table className={clsx("w-full border-collapse text-left text-[13.5px] leading-snug", wide && "min-w-[560px]")}>
                <thead>
                  <tr className="bg-sunken">
                    {b.table.head.map((h, j) => (
                      <th key={j} className={clsx("px-3 py-2.5 font-semibold text-ink", wide && j > 0 && "text-center")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.table.rows.map((r, j) => (
                    <tr key={j} className="border-t border-line bg-surface">
                      {r.map((c, k) => (
                        <td key={k} className={clsx("px-3 py-2 align-top", k === 0 ? "font-medium text-ink" : "text-ink/80", wide && k > 0 && "text-center tnum", c === "✓" && "font-bold text-jade", c === "—" && "text-faint")}>
                          <Rich text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/** One question that opens to show its answer. */
export function FaqItem({ f, open, onToggle }: { f: Faq; open: boolean; onToggle: () => void }) {
  return (
    <div className={clsx("rounded-[14px] bg-surface ring-1 transition-shadow", open ? "shadow-float ring-jade/25" : "ring-line/70")}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <CircleHelp size={18} className={clsx("mt-[2px] shrink-0", open ? "text-jade" : "text-faint")} />
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{f.q}</span>
        <ChevronDown size={18} className={clsx("mt-[2px] shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 pl-[46px] text-[14.5px] leading-[1.65] text-ink/85">
          <Rich text={f.a} />
        </div>
      )}
    </div>
  );
}

export function FaqList({ items, initialOpen }: { items: Faq[]; initialOpen?: string }) {
  const [open, setOpen] = useState<string | null>(initialOpen ?? null);
  return (
    <div className="space-y-2">
      {items.map((f) => (
        <FaqItem key={f.id} f={f} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />
      ))}
    </div>
  );
}

/** Download links for the three PDF manuals. */
export function ManualDownloads({ m, compact }: { m: Manual; compact?: boolean }) {
  return (
    <div className={clsx("grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
      {HELP_LANGS.map((l) => (
        <a
          key={l}
          href={MANUAL_PDF[l]}
          download={MANUAL_FILE[l]}
          className={clsx("group flex items-center gap-3 rounded-[14px] bg-surface ring-1 ring-line/70 transition hover:ring-jade/40 active:scale-[.98]", compact ? "flex-col px-2 py-3 text-center" : "px-4 py-3.5")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-ink text-white"><BookOpen size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold">{LANG_LABEL[l]}</span>
            <span className="flex items-center gap-1 text-[12.5px] text-muted group-hover:text-jade" style={compact ? { justifyContent: "center" } : undefined}><Download size={12} /> PDF</span>
          </span>
        </a>
      ))}
      {!compact && <span className="sr-only">{m.ui.downloadPdf}</span>}
    </div>
  );
}

export function ContactCard({ m, className }: { m: Manual; className?: string }) {
  const wa = CONTACT_WA;
  return (
    <div className={clsx("rounded-[18px] bg-ink p-5 text-white", className)}>
      <div className="text-[17px] font-semibold">{m.ui.contact}</div>
      <p className="mt-1 text-[14px] leading-relaxed text-white/70">{m.ui.contactBody}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {wa && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent("Hi Restropi, I need help with: ")}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-semibold text-white">
            <MessageCircle size={16} /> {m.ui.whatsapp}
          </a>
        )}
        <a href={`mailto:${SUPPORT.email}?subject=${encodeURIComponent("Restropi help")}`} className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">
          <Mail size={16} /> {SUPPORT.email}
        </a>
      </div>
    </div>
  );
}

/** Help language follows the app language. */
export function useHelpLang(): [HelpLang, (l: HelpLang) => void] {
  const { lang } = useT();
  const [l, setL] = useState<HelpLang>(lang);
  useEffect(() => setL(lang), [lang]);
  return [l, setL];
}

/* ---------------- the "?" button and its sheet ---------------- */
let openFn: (() => void) | null = null;
export const openHelp = () => openFn?.();

export function HelpButton({ dark = false }: { dark?: boolean }) {
  return (
    <button
      onClick={openHelp}
      aria-label="Help"
      title="Help"
      className={clsx("flex h-[34px] w-[34px] items-center justify-center rounded-full", dark ? "text-white hover:bg-white/10" : "bg-surface text-ink shadow-float hover:bg-sunken")}
    >
      <CircleHelp size={18} />
    </button>
  );
}

export function HelpSheet() {
  const path = usePathname() ?? "/app";
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useHelpLang();
  const [q, setQ] = useState("");
  const m = MANUALS[lang];
  useEffect(() => {
    openFn = () => setOpen(true);
    return () => { openFn = null; };
  }, []);
  useEffect(() => setOpen(false), [path]);
  const res = useMemo(() => (q.trim() ? searchHelp(m, q) : null), [m, q]);
  const here = useMemo(() => faqsForPath(m, path), [m, path]);
  const sec = sectionForPath(path);
  const secTitle = sec ? m.sections.find((s) => s.id === sec)?.title : undefined;
  const close = () => { setOpen(false); setQ(""); };

  let body: ReactNode;
  if (res) {
    body = res.faq.length || res.sections.length ? (
      <div className="space-y-4">
        {res.faq.length > 0 && <FaqList key={q} items={res.faq.slice(0, 8)} initialOpen={res.faq[0]?.id} />}
        {res.sections.length > 0 && (
          <div>
            <div className="mb-2 text-[13px] font-semibold text-muted">{m.ui.manual}</div>
            <div className="space-y-1.5">
              {res.sections.slice(0, 5).map((s) => (
                <Link key={s.id} href={`/app/help?s=${s.id}&lang=${lang}`} className="flex items-center gap-3 rounded-[12px] bg-surface px-3.5 py-3 ring-1 ring-line/70 hover:ring-jade/40">
                  <BookOpen size={16} className="shrink-0 text-jade" />
                  <span className="min-w-0"><span className="block text-[14.5px] font-semibold">{s.title}</span><span className="block truncate text-[12.5px] text-muted">{s.summary}</span></span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    ) : (
      <p className="rounded-[14px] bg-surface p-4 text-[14.5px] text-muted">{m.ui.noResults}</p>
    );
  } else {
    body = (
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[13px] font-semibold text-muted">{m.ui.forThisScreen}</div>
          <FaqList key={lang + path} items={here.slice(0, 6)} />
          {sec && secTitle && (
            <Link href={`/app/help?s=${sec}&lang=${lang}`} className="mt-2 flex items-center gap-2 px-1 text-[14px] font-semibold text-jade hover:underline">
              <BookOpen size={15} /> {secTitle}
            </Link>
          )}
        </div>
        <div>
          <div className="mb-2 text-[13px] font-semibold text-muted">{m.ui.manuals}</div>
          <ManualDownloads m={m} compact />
        </div>
        <Link href={`/app/help?lang=${lang}`} className="flex h-12 items-center justify-center gap-2 rounded-full bg-jade text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_rgb(var(--jade)/.8)]">
          <CircleHelp size={17} /> {m.ui.openHelpCenter}
        </Link>
        <ContactCard m={m} />
      </div>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={m.ui.help}>
      <HelpLangSwitch value={lang} onChange={setLang} className="mb-3" />
      <div className="relative mb-4">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.ui.searchPlaceholder} className={clsx(inputCls, "pl-10")} aria-label={m.ui.searchPlaceholder} />
      </div>
      {body}
    </Sheet>
  );
}
