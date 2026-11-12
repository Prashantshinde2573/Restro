"use client";

import { hasTables } from "@/lib/access";
import clsx from "clsx";
import { Check, Flame, Volume2, VolumeX } from "lucide-react";
import { chime } from "@/components/order-alerts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChannelIcon } from "@/components/channel";
import { useToast } from "@/components/toast";
import { orderActions, useCurrentOutlet, useOrders } from "@/lib/live";
import { minutesSince } from "@/lib/format";
import { orderWhere, useTables } from "@/lib/tables";
import { useT } from "@/lib/i18n";
import { speak, ticketText, voiceOnText } from "@/lib/speak";
import type { MenuItem, Order } from "@/lib/types";

type Station = "all" | MenuItem["station"];
const stations: { v: Station; label: string }[] = [
  { v: "all", label: "All stations" },
  { v: "kitchen", label: "Kitchen" },
  { v: "tandoor", label: "Tandoor" },
  { v: "bar", label: "Bar" },
  { v: "dessert", label: "Desserts" },
];

export default function KitchenPage() {
  const toast = useToast();
  const all = useOrders();
  // The kitchen only sees orders a captain has accepted (QR/online orders start as "new").
  const orders = useMemo(() => all.filter((o) => ["accepted", "preparing", "ready"].includes(o.status)), [all]);
  const waiting = all.filter((o) => o.status === "new").length;
  const [station, setStation] = useState<Station>("all");
  const cafe = !hasTables(useCurrentOutlet()); // counter-only café: no tandoor
  const [col, setCol] = useState<"new" | "preparing" | "ready">("preparing");
  const [, tick] = useState(0);
  const tables = useTables();

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  // new ticket: chime, and (when on) read it aloud — "Table T5. 2 Paneer Tikka, 1 Butter Naan"
  const { lang } = useT(); // tickets are read in the app's language (English / हिंदी / मराठी)
  const [voice, setVoiceRaw] = useState(false);
  useEffect(() => {
    try {
      setVoiceRaw(localStorage.getItem("restropi.kotVoice") === "1");
    } catch {}
  }, []);
  const setVoice = (f: (v: boolean) => boolean) =>
    setVoiceRaw((v) => {
      const n = f(v);
      try {
        localStorage.setItem("restropi.kotVoice", n ? "1" : "0");
      } catch {}
      if (n) speak(voiceOnText(lang), lang);
      return n;
    });
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const live = orders.filter((o) => o.status === "accepted" || o.status === "preparing");
    if (!seen.current) {
      seen.current = new Set(live.map((o) => o.id));
      return;
    }
    const fresh = live.filter((o) => !seen.current!.has(o.id));
    fresh.forEach((o) => seen.current!.add(o.id));
    if (!fresh.length) return;
    chime("kitchen");
    if (!voice || !("speechSynthesis" in window)) return;
    for (const o of fresh) speak(ticketText(o, lang), lang);
  }, [orders, voice, lang]);

  const visible = useMemo(
    () =>
      orders
        .map((o) => ({ ...o, lines: o.lines.map((l, i) => ({ ...l, idx: i })).filter((l) => station === "all" || l.station === station) }))
        .filter((o) => o.lines.length > 0),
    [orders, station],
  );

  const allDay = useMemo(() => {
    const m = new Map<string, number>();
    visible.filter((o) => o.status !== "ready").forEach((o) => o.lines.filter((l) => !l.done).forEach((l) => m.set(l.name, (m.get(l.name) ?? 0) + l.qty)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [visible]);

  const move = (id: string, status: Order["status"], msg: string) => {
    orderActions.setStatus(id, status);
    toast(msg);
  };
  const toggleLine = (id: string, idx: number) => orderActions.toggleLine(id, idx);

  const columns: { key: "new" | "preparing" | "ready"; title: string }[] = [
    { key: "new", title: "New" },
    { key: "preparing", title: "Cooking" },
    { key: "ready", title: "Ready to serve" },
  ];

  return (
    <div className="dark min-h-dvh bg-canvas text-ink lg:min-h-[calc(100dvh-24px)] lg:rounded-[28px]">
      <div className="sticky top-[60px] z-20 space-y-3 bg-canvas/90 lg:top-0 px-4 pb-3 pt-3 backdrop-blur-xl lg:rounded-t-[28px] lg:px-8 lg:pt-8">
        <div className="flex items-center justify-between">
          <h1 className="large-title">Kitchen</h1>
          <button
            onClick={() => setVoice((v) => !v)}
            aria-pressed={voice}
            className={clsx("flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold", voice ? "bg-jade text-white" : "bg-surface text-muted")}
          >
            {voice ? <Volume2 size={16} /> : <VolumeX size={16} />} {voice ? "Reading orders aloud" : "Read orders aloud"}
          </button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {stations.filter((s) => !(cafe && s.v === "tandoor")).map((s) => (
            <button
              key={s.v}
              onClick={() => setStation(s.v)}
              className={clsx("shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium", station === s.v ? "bg-ink text-canvas" : "bg-surface text-ink")}
            >
              {s.label}
            </button>
          ))}
        </div>
        {waiting > 0 && (
          <p className="text-[13px] text-saffron">{waiting} new {waiting > 1 ? "orders are" : "order is"} waiting for a captain to accept — they appear here once accepted.</p>
        )}
        {allDay.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 text-[13.5px] lg:mx-0 lg:px-0">
            <span className="shrink-0 text-muted">To cook</span>
            {allDay.map(([n, q]) => (
              <span key={n} className="shrink-0"><b className="text-jade tnum">{q}</b> {n}</span>
            ))}
          </div>
        )}
        <div className="flex rounded-ctl bg-sunken p-[3px] lg:hidden">
          {columns.map((c) => (
            <button key={c.key} onClick={() => setCol(c.key)} className={clsx("flex-1 rounded-[9px] py-1.5 text-[13px] font-semibold", col === c.key ? "bg-surface" : "text-muted")}>
              {c.title} <span className="tnum opacity-60">{visible.filter((o) => o.status === (c.key === "new" ? "accepted" : c.key)).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-28 lg:grid-cols-3 lg:px-8 lg:pb-8">
        {columns.map((c) => {
          const list = visible.filter((o) => o.status === (c.key === "new" ? "accepted" : c.key)).sort((a, b) => Number(!!b.priority) - Number(!!a.priority) || a.createdAt.localeCompare(b.createdAt));
          return (
            <section key={c.key} className={clsx("space-y-3", col !== c.key && "hidden lg:block")}>
              <h2 className="hidden px-1 text-[15px] font-semibold text-muted lg:block">
                {c.title} <span className="tnum">{list.length}</span>
              </h2>
              {list.length === 0 && <div className="rounded-group border border-dashed border-line px-4 py-10 text-center text-[14px] text-muted">No tickets</div>}
              {list.map((o) => {
                const mins = minutesSince(o.createdAt);
                const tone = mins >= 20 ? "text-rose" : mins >= 12 ? "text-saffron" : "text-jade";
                return (
                  <article key={o.id} className={clsx("overflow-hidden rounded-group bg-surface", o.priority && "ring-2 ring-saffron")}>
                    <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                      <ChannelIcon channel={o.channel} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[17px] font-semibold">{orderWhere(o.tableName ? o : { type: o.type }, tables)}</div>
                        <div className="text-[12px] text-muted tnum">#{o.number} · {o.staff}</div>
                      </div>
                      {o.priority && <Flame size={18} className="text-saffron" aria-label="Priority" />}
                      <span className={clsx("text-[22px] font-semibold tnum", tone)}>{mins}′</span>
                    </header>
                    <ul className="px-2 py-1">
                      {o.lines.map((l, i) => (
                        <li key={i}>
                          <button onClick={() => toggleLine(o.id, l.idx)} className="flex w-full items-start gap-3 rounded-ctl px-2 py-2 text-left hover:bg-sunken/50">
                            <span className={clsx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", l.done ? "border-jade bg-jade text-canvas" : "border-line")}>
                              {l.done && <Check size={14} strokeWidth={3} />}
                            </span>
                            <span className={clsx("flex-1 text-[16px] leading-snug", l.done && "text-muted line-through decoration-2")}>
                              <b className="tnum">{l.qty}</b> {l.name}
                              {l.note && <span className="mt-0.5 block text-[13px] font-semibold text-saffron no-underline">{l.note}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="p-3 pt-1">
                      {o.status === "accepted" && (
                        <button onClick={() => move(o.id, "preparing", `Started #${o.number}`)} className="h-12 w-full rounded-ctl bg-sky text-[15px] font-semibold text-canvas">Start cooking</button>
                      )}
                      {o.status === "preparing" && (
                        <button onClick={() => move(o.id, "ready", `#${o.number} ready · captain notified`)} className="h-12 w-full rounded-ctl bg-jade text-[15px] font-semibold text-canvas">Mark ready</button>
                      )}
                      {o.status === "ready" && (
                        <button onClick={() => move(o.id, "served", `#${o.number} served`)} className="h-12 w-full rounded-ctl bg-sunken text-[15px] font-semibold">Served · clear ticket</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
