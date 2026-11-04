"use client";

// In-app help as a chat: tap a question or a topic, or type your own — Restropi answers
// from the help content (common problems + step-by-step guides) in English, Marathi or Hindi.
// Used by the "?" button (a sheet) and the Help center page.
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { ArrowLeft, BookOpen, CircleHelp, Mail, MessageCircle, SendHorizontal } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { HELP_LANGS, MANUALS, SUPPORT, boldParts, faqsForPath, searchHelp, sectionForPath, type Block, type Faq, type HelpLang, type Manual, type Section } from "@/lib/help";
import { DEFAULT_CONTACT_WHATSAPP } from "@/lib/config";
import { Sheet } from "./ui";

const CONTACT_WA = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || DEFAULT_CONTACT_WHATSAPP).replace(/\D/g, "");
const LANG_LABEL: Record<HelpLang, string> = { en: "EN", mr: "मराठी", hi: "हिंदी" };

/** Which step-by-step guides belong to each topic. */
const AREA_SECTIONS: Record<Faq["area"], string[]> = {
  start: ["welcome", "start"],
  orders: ["new-order", "orders"],
  billing: ["billing", "confirm"],
  tables: ["tables"],
  qr: ["qr"],
  kitchen: ["kitchen"],
  menu: ["menu"],
  stock: ["stock"],
  team: ["team"],
  reports: ["reports"],
  plans: ["plans"],
  account: ["settings", "alerts", "safety"],
};

/** "**bold**" text, with new lines kept. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((ln, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {boldParts(ln).map((p, j) => (p.bold ? <strong key={j} className="font-semibold text-ink">{p.text}</strong> : <Fragment key={j}>{p.text}</Fragment>))}
        </Fragment>
      ))}
    </>
  );
}

/** A guide's content, sized for a chat bubble. */
function Blocks({ blocks, m }: { blocks: Block[]; m: Manual }) {
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        if ("p" in b) return <p key={i}><Rich text={b.p} /></p>;
        if ("h" in b) return <div key={i} className="pt-1 font-semibold text-ink">{b.h}</div>;
        if ("steps" in b)
          return (
            <ol key={i} className="space-y-2">
              {b.steps.map((s, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-jade text-[11px] font-bold text-white tnum">{j + 1}</span>
                  <span className="min-w-0"><Rich text={s} /></span>
                </li>
              ))}
            </ol>
          );
        if ("list" in b)
          return (
            <ul key={i} className="space-y-1.5">
              {b.list.map((s, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-jade" />
                  <span className="min-w-0"><Rich text={s} /></span>
                </li>
              ))}
            </ul>
          );
        if ("tip" in b || "warn" in b) {
          const tip = "tip" in b;
          return (
            <div key={i} className={clsx("rounded-[12px] px-3 py-2", tip ? "bg-jade-soft/70" : "bg-saffron-soft/70")}>
              <div className={clsx("text-[11.5px] font-bold uppercase tracking-wide", tip ? "text-jade" : "text-saffron")}>{tip ? m.ui.goodToKnow : m.ui.careful}</div>
              <Rich text={tip ? b.tip : b.warn} />
            </div>
          );
        }
        if ("table" in b)
          return (
            <div key={i} className="-mx-1 overflow-x-auto rounded-[12px] ring-1 ring-line">
              <table className={clsx("w-full border-collapse text-left text-[12.5px] leading-snug", b.table.head.length > 3 && "min-w-[440px]")}>
                <thead>
                  <tr className="bg-sunken">{b.table.head.map((h, j) => <th key={j} className="px-2.5 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {b.table.rows.map((r, j) => (
                    <tr key={j} className="border-t border-line">
                      {r.map((c, k) => (
                        <td key={k} className={clsx("px-2.5 py-1.5 align-top", k === 0 && "font-medium", c === "✓" && "font-bold text-jade", c === "—" && "text-faint")}>
                          <Rich text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        return null;
      })}
    </div>
  );
}

function Contact({ m }: { m: Manual }) {
  return (
    <>
      <div className="font-semibold text-ink">{m.ui.contact}</div>
      <p className="mt-0.5">{m.ui.contactBody}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {CONTACT_WA && (
          <a href={`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent("Hi Restropi, I need help with: ")}`} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-[13.5px] font-semibold text-white">
            <MessageCircle size={15} /> {m.ui.whatsapp}
          </a>
        )}
        <a href={`mailto:${SUPPORT.email}?subject=${encodeURIComponent("Restropi help")}`} className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13.5px] font-semibold text-white">
          <Mail size={15} /> {SUPPORT.email}
        </a>
      </div>
    </>
  );
}

type Msg = { from: "bot" | "me"; key: number; body: ReactNode };
type Chip = { key: string; label: ReactNode; run: () => void; tone?: "guide" | "nav" };

/** The help chat. `full` = the Help center page (taller, with the header). */
export function HelpChat({ full = false }: { full?: boolean }) {
  const path = usePathname() ?? "/app";
  const { lang: appLang } = useT();
  const [lang, setLang] = useState<HelpLang>(appLang);
  useEffect(() => setLang(appLang), [appLang]);
  const m = MANUALS[lang];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [area, setArea] = useState<Faq["area"] | null>(null);
  const [related, setRelated] = useState<Faq[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const n = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  // start (again) in the chosen language
  useEffect(() => {
    window.clearTimeout(timer.current);
    setTyping(false);
    setArea(null);
    setRelated([]);
    setAsked([]);
    setMsgs([{ from: "bot", key: n.current++, body: m.ui.hello }]);
  }, [m]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const say = (mine: ReactNode, answer: ReactNode, after?: () => void) => {
    if (typing) return;
    setMsgs((x) => [...x, { from: "me", key: n.current++, body: mine }]);
    setTyping(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setTyping(false);
      setMsgs((x) => [...x, { from: "bot", key: n.current++, body: answer }]);
      after?.();
    }, 650);
  };

  const relatedTo = (f: Faq) => m.faq.filter((x) => x.area === f.area && x.id !== f.id && !asked.includes(x.id)).slice(0, 3);
  const askFaq = (f: Faq) => {
    setAsked((a) => [...a, f.id]);
    say(f.q, <Rich text={f.a} />, () => setRelated(relatedTo(f)));
  };
  const askGuide = (s: Section) => say(`${m.ui.stepByStep}: ${s.title.replace(/^\d+\.\s*/, "")}`, (
    <>
      <div className="mb-2 flex items-center gap-1.5 font-semibold text-ink"><BookOpen size={15} className="text-jade" /> {s.title.replace(/^\d+\.\s*/, "")}</div>
      <Blocks blocks={s.blocks} m={m} />
    </>
  ), () => setRelated([]));
  const askContact = () => say(m.ui.talkToUs, <Contact m={m} />, () => setRelated([]));

  const submit = () => {
    const q = text.trim();
    if (!q || typing) return;
    setText("");
    const r = searchHelp(m, q);
    const f = r.faq[0];
    if (f) {
      setAsked((a) => [...a, f.id]);
      say(q, <Rich text={f.a} />, () => setRelated(r.faq.slice(1, 4).length ? r.faq.slice(1, 4) : relatedTo(f)));
      return;
    }
    const s = r.sections[0];
    if (s) {
      say(q, (
        <>
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-ink"><BookOpen size={15} className="text-jade" /> {s.title.replace(/^\d+\.\s*/, "")}</div>
          <Blocks blocks={s.blocks} m={m} />
        </>
      ), () => setRelated([]));
      return;
    }
    say(q, (
      <>
        <p>{m.ui.noResults}</p>
        <div className="mt-3"><Contact m={m} /></div>
      </>
    ), () => setRelated([]));
  };

  // the chips under the chat
  const here = faqsForPath(m, path).filter((f) => !asked.includes(f.id)).slice(0, 4);
  const guide = sectionForPath(path);
  const guideSec = guide ? m.sections.find((s) => s.id === guide) : undefined;
  const areas = (Object.keys(m.areas) as Faq["area"][]).filter((a) => m.faq.some((f) => f.area === a) || AREA_SECTIONS[a].length);
  let chips: Chip[];
  if (area) {
    chips = [
      { key: "back", label: <><ArrowLeft size={13} className="inline -translate-y-px" /> {m.ui.topics}</>, run: () => setArea(null), tone: "nav" },
      ...AREA_SECTIONS[area].map((id) => m.sections.find((s) => s.id === id)).filter(Boolean).map((s) => ({ key: "g" + s!.id, label: <><BookOpen size={13} className="inline -translate-y-px" /> {s!.title.replace(/^\d+\.\s*/, "")}</>, run: () => askGuide(s!), tone: "guide" as const })),
      ...m.faq.filter((f) => f.area === area && !asked.includes(f.id)).map((f) => ({ key: f.id, label: f.q, run: () => askFaq(f) })),
    ];
  } else if (related.length) {
    chips = [
      ...related.map((f) => ({ key: f.id, label: f.q, run: () => askFaq(f) })),
      { key: "topics", label: m.ui.topics + " →", run: () => setRelated([]), tone: "nav" },
      { key: "talk", label: m.ui.talkToUs, run: askContact, tone: "nav" },
    ];
  } else {
    chips = [
      ...here.map((f) => ({ key: f.id, label: f.q, run: () => askFaq(f) })),
      ...(guideSec ? [{ key: "g" + guideSec.id, label: <><BookOpen size={13} className="inline -translate-y-px" /> {m.ui.stepByStep}: {guideSec.title.replace(/^\d+\.\s*/, "")}</>, run: () => askGuide(guideSec), tone: "guide" as const }] : []),
      ...areas.map((a) => ({ key: "a" + a, label: m.areas[a], run: () => setArea(a), tone: "nav" as const })),
      { key: "talk", label: m.ui.talkToUs, run: askContact, tone: "nav" },
    ];
  }

  return (
    <div className={clsx("flex min-h-0 flex-col overflow-hidden bg-surface", full ? "h-full rounded-[24px] ring-1 ring-line/70" : "h-full")}>
      {/* header */}
      <div className="flex shrink-0 items-center gap-3 bg-ink px-4 py-3 text-white">
        <span className="relative">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/restropi-mark.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#4ade80] ring-2 ring-ink" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-tight">{m.ui.helper}</span>
          <span className="block text-[12px] text-white/60">{m.ui.online}</span>
        </span>
        <div className="flex rounded-full bg-white/10 p-0.5" role="radiogroup" aria-label="Language">
          {HELP_LANGS.map((l) => (
            <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={clsx("rounded-full px-2.5 py-1 text-[12.5px] font-semibold", lang === l ? "bg-white text-ink" : "text-white/75")}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      {/* messages */}
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-sunken/60 px-3.5 py-4">
        {msgs.map((x) => (
          <div key={x.key} className={clsx("flex animate-fade-in", x.from === "me" ? "justify-end" : "justify-start")}>
            <div className={clsx("max-w-[88%] px-3.5 py-2.5 text-[14.5px] leading-relaxed", x.from === "me" ? "rounded-[18px] rounded-br-[6px] bg-jade text-white" : "rounded-[18px] rounded-bl-[6px] bg-surface text-ink/85 ring-1 ring-line/60")}>
              {x.body}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex">
            <div className="flex gap-1 rounded-[18px] rounded-bl-[6px] bg-surface px-4 py-3.5 ring-1 ring-line/60" aria-label="Typing">
              {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink/30" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
      </div>

      {/* chips + input */}
      <div className="shrink-0 border-t border-line/70 bg-surface p-3">
        {!area && !related.length && here.length > 0 && <div className="mb-1.5 px-1 text-[12px] font-semibold text-muted">{m.ui.forThisScreen}</div>}
        {area && <div className="mb-1.5 px-1 text-[12px] font-semibold text-muted">{m.areas[area]}</div>}
        {related.length > 0 && !area && <div className="mb-1.5 px-1 text-[12px] font-semibold text-muted">{m.ui.related}</div>}
        <div className={clsx("flex flex-wrap gap-1.5 overflow-y-auto pb-2.5", full ? "max-h-[132px] sm:max-h-[180px]" : "max-h-[150px]")}>
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={c.run}
              disabled={typing}
              className={clsx(
                "rounded-full px-3 py-1.5 text-left text-[13px] font-medium ring-1 transition disabled:opacity-50",
                c.tone === "nav" ? "bg-surface text-ink ring-line hover:ring-ink/30" : c.tone === "guide" ? "bg-jade-soft text-jade-deep ring-jade/20 hover:ring-jade/40" : "bg-sunken text-ink/85 ring-transparent hover:bg-jade-soft hover:text-jade-deep",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={m.ui.askPlaceholder}
            aria-label={m.ui.askPlaceholder}
            className="h-11 min-w-0 flex-1 rounded-full bg-sunken px-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade"
          />
          <button type="submit" disabled={!text.trim() || typing} aria-label={m.ui.send} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-jade text-white disabled:opacity-40">
            <SendHorizontal size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- the "?" button and its sheet ---------------- */
let openFn: (() => void) | null = null;
const openHelp = () => openFn?.();

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
  const { lang } = useT();
  useEffect(() => {
    openFn = () => setOpen(true);
    return () => { openFn = null; };
  }, []);
  useEffect(() => setOpen(false), [path]);
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={MANUALS[lang].ui.help}>
      <div className="-mx-5 -mb-5 -mt-1.5 h-[min(680px,76dvh)] lg:h-[calc(100dvh-110px)]">
        <HelpChat />
      </div>
    </Sheet>
  );
}
