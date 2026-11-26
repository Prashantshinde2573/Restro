"use client";

import { hasTables } from "@/lib/access";
import clsx from "clsx";
import { Check, Flame, Volume2, VolumeX } from "lucide-react";
import { chime } from "@/components/order-alerts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChannelIcon } from "@/components/channel";
import { Chips } from "@/components/ui";
import { useToast } from "@/components/toast";
import { orderActions, toAccept, useCurrentOutlet, useOutletOrders } from "@/lib/live";
import { minutesSince } from "@/lib/format";
import { orderWhere, tableActions, useTables } from "@/lib/tables";
import { useT, L } from "@/lib/i18n";
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
  const all = useOutletOrders();
  // The kitchen only sees orders a captain has accepted (QR/online orders start as "new").
  // An order paid before its food was ready (counter, delivery) stays here at its kitchen stage.
  // Self-service (no captains): the kitchen accepts new QR orders itself, in the New column.
  const outlet = useCurrentOutlet();
  const selfService = !!outlet.selfService;
  const orders = useMemo(
    () =>
      all
        .filter((o) => ["accepted", "preparing", "ready"].includes(o.status) || (o.status === "paid" && !!o.kitchenStatus) || (selfService && toAccept(o)))
        .map((o) => (o.status === "paid" && o.kitchenStatus ? { ...o, status: o.kitchenStatus } : o)),
    [all, selfService],
  );
  const waiting = selfService ? 0 : all.filter(toAccept).length;
  const accept = (o: Order) => {
    orderActions.setStatus(o.id, "accepted");
    if (o.tableId && o.partyId) tableActions.update(o.tableId, o.partyId, { pendingApproval: false });
    toast(L("Accepted #{0}", o.number));
  };
  const [station, setStation] = useState<Station>("all");
  const cafe = !hasTables(outlet); // counter-only café: no tandoor
  const [col, setCol] = useState<"new" | "preparing" | "ready" | null>(null);
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
    const live = orders.filter((o) => o.status === "new" || o.status === "accepted" || o.status === "preparing");
    // a ticket, and again for each add-on round put into it
    const key = (o: (typeof live)[number]) => `${o.id}:${o.lines.filter((l) => l.addOn).length}`;
    if (!seen.current) {
      seen.current = new Set(live.map(key));
      return;
    }
    const fresh = live.filter((o) => !seen.current!.has(key(o)));
    fresh.forEach((o) => seen.current!.add(key(o)));
    if (!fresh.length) return;
    chime("kitchen");
    if (!voice || !("speechSynthesis" in window)) return;
    // wait for the chime to finish, then read each new ticket (or the new add-on dishes) in full
    for (const o of fresh) {
      const todo = o.lines.filter((l) => !l.done);
      const added = todo.filter((l) => l.addOn);
      const addOn = added.length > 0 && added.length < o.lines.length;
      speak(ticketText({ ...o, lines: addOn ? added : todo }, lang, addOn), lang, 0.9, 900);
    }
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

  const columns: { key: "new" | "preparing" | "ready"; title: string; dot: string; bar: string }[] = [
    { key: "new", title: "New", dot: "bg-sky", bar: "border-t-sky" },
    { key: "preparing", title: "Cooking", dot: "bg-saffron", bar: "border-t-saffron" },
    { key: "ready", title: "Ready", dot: "bg-jade", bar: "border-t-jade" },
  ];
  const listOf = (k: "new" | "preparing" | "ready") =>
    visible
      .filter((o) => (k === "new" ? o.status === "accepted" || o.status === "new" : o.status === k))
      .sort((a, b) => Number(!!b.priority) - Number(!!a.priority) || a.createdAt.localeCompare(b.createdAt));
  // phones: open the column that needs the cook (new tickets first), not always "Cooking";
  // a tab picked by hand stays until it runs empty
  const firstBusy = columns.find((c) => listOf(c.key).length)?.key ?? "new";
  const shown = col && listOf(col).length ? col : firstBusy;

  return (
    <div className="dark min-h-dvh bg-canvas text-ink lg:min-h-[calc(100dvh-24px)] lg:rounded-[28px]">
      <div className="sticky top-[60px] z-20 space-y-2.5 bg-canvas/90 px-4 pb-3 pt-3 backdrop-blur-xl lg:top-0 lg:rounded-t-[28px] lg:px-8 lg:pt-7">
        <div className="flex items-center gap-2">
          <h1 className="large-title flex-1">{L("Kitchen")}</h1>
          {waiting > 0 && (
            <span title={L("QR / online orders a captain still has to accept. They come here once accepted.")} className="flex h-9 items-center gap-1.5 rounded-full bg-saffron/15 px-3 text-[12.5px] font-semibold text-saffron">
              <span className="h-2 w-2 animate-pulse rounded-full bg-saffron" /> {waiting} {L("to accept")}</span>
          )}
          <button
            onClick={() => setVoice((v) => !v)}
            aria-pressed={voice}
            aria-label={voice ? L("Stop reading orders aloud") : L("Read new orders aloud")}
            title={voice ? L("Reading new orders aloud · tap to stop") : L("Read new orders aloud")}
            className={clsx("flex h-9 w-9 items-center justify-center rounded-full", voice ? "bg-jade text-white" : "bg-surface text-muted")}
          >
            {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <div><Chips label={L("Station")} value={station} onChange={setStation} options={stations.filter((s) => !(cafe && s.v === "tandoor")).map((s) => ({ value: s.v, label: s.label }))} /></div>
          {allDay.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px]" title={L("Everything still to cook, added up")}>
              <span className="text-muted">{L("To cook:")}</span>
              {allDay.slice(0, 6).map(([n, q]) => (
                <span key={n} className="rounded-full bg-surface px-2 py-0.5"><b className="text-jade tnum">{q}</b> {n}</span>
              ))}
              {allDay.length > 6 && <span className="text-muted">+{allDay.length - 6}</span>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-ctl bg-sunken p-[3px] lg:hidden" role="tablist">
          {columns.map((c) => {
            const n = listOf(c.key).length;
            return (
              <button key={c.key} role="tab" aria-selected={shown === c.key} onClick={() => setCol(c.key)} className={clsx("flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[13.5px] font-semibold", shown === c.key ? "bg-surface" : "text-muted")}>
                <span className={clsx("h-2 w-2 rounded-full", c.dot)} /> {L(c.title)}
                <span className={clsx("min-w-5 rounded-full px-1.5 text-[11.5px] tnum", n ? "bg-ink/10 text-ink" : "opacity-50")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-28 lg:grid-cols-3 lg:px-8 lg:pb-8">
        {columns.map((c) => {
          const list = listOf(c.key);
          return (
            <section key={c.key} className={clsx("space-y-2.5", shown !== c.key && "hidden lg:block")}>
              <h2 className="hidden items-center gap-2 px-1 text-[14px] font-semibold text-muted lg:flex">
                <span className={clsx("h-2 w-2 rounded-full", c.dot)} /> {L(c.title)} <span className="tnum">{list.length}</span>
              </h2>
              {list.length === 0 && <div className="rounded-group border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-muted">{L("No tickets")}</div>}
              {list.map((o) => {
                const mins = minutesSince(o.createdAt);
                const tone = mins >= 20 ? "bg-rose/20 text-rose" : mins >= 12 ? "bg-saffron/20 text-saffron" : "bg-jade/20 text-jade";
                const fresh = c.key === "new" && mins < 2;
                const left = o.lines.filter((l) => !l.done).length;
                return (
                  <article key={o.id} className={clsx("overflow-hidden rounded-[18px] border-t-4 bg-surface", c.bar, o.priority && "ring-2 ring-saffron", fresh && "animate-pop ring-2 ring-sky")}>
                    <header className="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
                      <ChannelIcon channel={o.channel} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-[17px] font-bold leading-tight">{orderWhere(o.tableName ? o : { type: o.type }, tables)}</span>
                          <span className="shrink-0 text-[12px] text-muted tnum">#{o.number}</span>
                        </div>
                      </div>
                      {fresh && <span className="rounded-full bg-sky px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-canvas">{L("New")}</span>}
                      {o.priority && <Flame size={17} className="text-saffron" aria-label={L("Priority")} />}
                      <span className={clsx("rounded-full px-2 py-0.5 text-[13px] font-bold tnum", tone)} title={L("Minutes since the order came in")}>{mins}′</span>
                    </header>
                    <ul className="px-1.5 pb-1">
                      {o.lines.map((l, i) => (
                        <li key={i}>
                          <button onClick={() => toggleLine(o.id, l.idx)} title={l.done ? L("Mark not done") : L("Tick when this dish is done")} className="flex w-full items-start gap-2.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-sunken/50">
                            <span className={clsx("mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", l.done ? "border-jade bg-jade text-canvas" : "border-line")}>
                              {l.done && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span className={clsx("flex-1 text-[15px] leading-snug", l.done && "text-muted line-through decoration-2")}>
                              <b className="tnum">{l.qty}×</b> {l.name}
                              {l.addOn && !l.done && <span className="ml-1.5 inline-block rounded-full bg-saffron px-1.5 py-px align-[2px] text-[10px] font-bold uppercase text-white no-underline">{L("Add-on")}</span>}
                              {l.note && <span className="block text-[12.5px] font-semibold text-saffron no-underline">{L(l.note)}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="px-3 pb-3">
                      {o.status === "new" && (
                        <button onClick={() => accept(o)} className="h-10 w-full rounded-[12px] bg-saffron text-[14.5px] font-semibold text-canvas">{L("Accept order")}</button>
                      )}
                      {o.status === "accepted" && (
                        <button onClick={() => move(o.id, "preparing", `Started #${o.number}`)} className="h-10 w-full rounded-[12px] bg-sky text-[14.5px] font-semibold text-canvas">{L("Start cooking")}</button>
                      )}
                      {o.status === "preparing" && (
                        <button onClick={() => move(o.id, "ready", `#${o.number} ready · captain notified`)} className="h-10 w-full rounded-[12px] bg-jade text-[14.5px] font-semibold text-canvas">
                          {L("Mark ready")}{left > 0 && left < o.lines.length ? L(" · {0} left", left) : ""}
                        </button>
                      )}
                      {o.status === "ready" && (
                        <button onClick={() => move(o.id, "served", `#${o.number} served`)} className="h-10 w-full rounded-[12px] bg-sunken text-[14.5px] font-semibold">{L("Served · clear")}</button>
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
