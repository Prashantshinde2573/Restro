"use client";

// Ludo, pass & play: 2–4 players share one phone. Rules live in lib/ludo.ts.
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { COLORS, FINISH, HOME_LANE, SAFE, TRACK, cellOf, current, gameOver, move, movable, newGame, roll, type Color, type LudoState } from "@/lib/ludo";
import { tx, type GuestLang } from "@/lib/guest-lang";

const HEX: Record<Color, string> = { red: "#D9483B", green: "#18935B", yellow: "#E5A912", blue: "#2E74D0" };
const SOFT: Record<Color, string> = { red: "#FBE3E0", green: "#DDF3E8", yellow: "#FCF0CC", blue: "#DDE9FA" };
const YARD_AT: Record<Color, [number, number]> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };
const SAVE = "restropi.ludo";

const name = (c: Color, lang: GuestLang) =>
  ({ red: tx(lang, "Red", "लाल"), green: tx(lang, "Green", "हिरवा"), yellow: tx(lang, "Yellow", "पिवळा"), blue: tx(lang, "Blue", "निळा") })[c];

function Pips({ n }: { n: number }) {
  const spots: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [0, 2], [2, 0], [2, 2]],
    5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
    6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  };
  return (
    <svg viewBox="0 0 30 30" className="h-full w-full" aria-hidden>
      {spots[n].map(([r, c], i) => (
        <circle key={i} cx={7 + c * 8} cy={7 + r * 8} r={3} fill="currentColor" />
      ))}
    </svg>
  );
}

function Board({ s, can, onToken }: { s: LudoState; can: number[]; onToken: (i: number) => void }) {
  const me = current(s);
  // tokens grouped by cell, so several on one square sit side by side
  const at = new Map<string, { c: Color; i: number }[]>();
  for (const c of s.players)
    s.tokens[c].forEach((p, i) => {
      const [r, col] = cellOf(c, p, i);
      const k = `${r},${col}`;
      at.set(k, [...(at.get(k) ?? []), { c, i }]);
    });
  const startCell = (c: Color) => TRACK[({ red: 0, green: 13, yellow: 26, blue: 39 } as const)[c]];
  return (
    <svg viewBox="0 0 15 15" className="h-auto w-full touch-manipulation select-none rounded-[14px] bg-white shadow-[0_10px_30px_-18px_rgb(0_0_0/.4)]" role="img" aria-label="Ludo board">
      {/* yards */}
      {COLORS.map((c) => {
        const [r, col] = YARD_AT[c];
        const live = s.players.includes(c);
        return (
          <g key={c} opacity={live ? 1 : 0.35}>
            <rect x={col} y={r} width={6} height={6} fill={HEX[c]} />
            <rect x={col + 0.8} y={r + 0.8} width={4.4} height={4.4} rx={0.5} fill="#fff" />
            {[[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]].map(([dr, dc], i) => (
              <circle key={i} cx={col + dc + 0.5} cy={r + dr + 0.5} r={0.62} fill={SOFT[c]} stroke={HEX[c]} strokeWidth={0.06} />
            ))}
          </g>
        );
      })}
      {/* shared track */}
      {TRACK.map(([r, c], i) => {
        const owner = COLORS.find((k) => startCell(k)[0] === r && startCell(k)[1] === c);
        return (
          <g key={i}>
            <rect x={c} y={r} width={1} height={1} fill={owner ? HEX[owner] : "#fff"} stroke="#d9ddd8" strokeWidth={0.04} />
            {SAFE.has(i) && !owner && <text x={c + 0.5} y={r + 0.72} textAnchor="middle" fontSize={0.62} fill="#b3b9b4">★</text>}
          </g>
        );
      })}
      {/* home lanes */}
      {COLORS.map((c) => HOME_LANE[c].map(([r, col], i) => <rect key={`${c}${i}`} x={col} y={r} width={1} height={1} fill={HEX[c]} stroke="#fff" strokeWidth={0.04} />))}
      {/* home */}
      <polygon points="6,6 7.5,7.5 6,9" fill={HEX.red} />
      <polygon points="6,6 7.5,7.5 9,6" fill={HEX.green} />
      <polygon points="9,6 7.5,7.5 9,9" fill={HEX.yellow} />
      <polygon points="6,9 7.5,7.5 9,9" fill={HEX.blue} />
      {/* tokens */}
      {[...at.entries()].map(([k, list]) => {
        const [r, col] = k.split(",").map(Number);
        const home = r === 7 && col === 7;
        return list.map(({ c, i }, n) => {
          const spread = list.length > 1 && !home ? 0.22 : 0;
          const dx = home ? ({ red: -0.6, green: 0, yellow: 0.6, blue: 0 }[c] + (i - 1.5) * 0.12) : spread * ((n % 2) * 2 - 1);
          const dy = home ? { red: 0, green: -0.6, yellow: 0, blue: 0.6 }[c] : spread * (Math.floor(n / 2) * 2 - 1) * (list.length > 2 ? 1 : 0);
          const live = c === me && can.includes(i);
          const x = col + 0.5 + dx;
          const y = r + 0.5 + dy;
          const rad = home ? 0.2 : list.length > 1 ? 0.3 : 0.38;
          return (
            <g key={`${c}${i}`} onClick={live ? () => onToken(i) : undefined} style={{ cursor: live ? "pointer" : undefined }}>
              {live && <circle cx={x} cy={y} r={rad + 0.2} fill="none" stroke={HEX[c]} strokeWidth={0.08} className="animate-pulse" />}
              <circle cx={x} cy={y + 0.05} r={rad} fill="rgba(0,0,0,.25)" />
              <circle cx={x} cy={y} r={rad} fill={HEX[c]} stroke="#fff" strokeWidth={0.09} />
              <circle cx={x - rad * 0.3} cy={y - rad * 0.3} r={rad * 0.28} fill="rgba(255,255,255,.55)" />
              {live && <circle cx={x} cy={y} r={0.75} fill="transparent" />}
            </g>
          );
        });
      })}
    </svg>
  );
}

export function Ludo({ lang }: { lang: GuestLang }) {
  const [s, setS] = useState<LudoState | null>(null);
  const [rolling, setRolling] = useState<number | null>(null);
  const [face, setFace] = useState(6);
  const [sure, setSure] = useState(false); // "New game" asks once more
  const timer = useRef<number | undefined>(undefined);

  // keep the game if the phone sleeps or the sheet closes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVE);
      if (saved) setS(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (s) localStorage.setItem(SAVE, JSON.stringify(s));
      else localStorage.removeItem(SAVE);
    } catch {}
  }, [s]);
  useEffect(() => () => window.clearInterval(timer.current), []);

  const can = s ? movable(s) : [];
  // one choice: move it for them
  useEffect(() => {
    if (!s || s.dice == null || can.length !== 1) return;
    const t = window.setTimeout(() => setS((x) => (x ? move(x, can[0]) : x)), 550);
    return () => window.clearTimeout(t);
  }, [s, can.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) {
    return (
      <div className="flex flex-col items-center px-2 pb-4 pt-2 text-center">
        <div className="text-[44px]">🎲</div>
        <div className="mt-1 text-[20px] font-bold">{tx(lang, "Ludo", "लुडो")}</div>
        <p className="mt-1 max-w-[300px] text-[14px] text-muted">{tx(lang, "Play on this phone. Pass it on when it's the next player's turn.", "याच फोनवर खेळा. पुढच्याची पाळी आली की फोन त्याला द्या.")}</p>
        <div className="mt-5 text-[13px] font-semibold text-muted">{tx(lang, "How many players?", "किती खेळाडू?")}</div>
        <div className="mt-2 flex gap-2.5">
          {([2, 3, 4] as const).map((n) => (
            <button key={n} onClick={() => setS(newGame(n))} className="flex h-16 w-20 flex-col items-center justify-center rounded-[16px] border border-line bg-surface text-[22px] font-bold active:scale-95">
              {n}
              <span className="flex gap-0.5">
                {newGame(n).players.map((c) => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: HEX[c] }} />)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const me = current(s);
  const over = gameOver(s);
  const doRoll = () => {
    if (rolling != null || s.dice != null || over) return;
    const value = 1 + Math.floor(Math.random() * 6);
    let n = 0;
    setRolling(value);
    timer.current = window.setInterval(() => {
      n++;
      setFace(1 + Math.floor(Math.random() * 6));
      if (n >= 7) {
        window.clearInterval(timer.current);
        setFace(value);
        setRolling(null);
        setS((x) => (x ? roll(x, value) : x));
      }
    }, 60);
  };
  const note =
    s.last === "no-move" ? tx(lang, "No move — next player", "चाल नाही — पुढचा") :
    s.last === "three-sixes" ? tx(lang, "Three 6s — turn lost", "तीन वेळा 6 — पाळी गेली") :
    s.last === "capture" ? tx(lang, "Captured! Roll again", "मारली! पुन्हा फासा टाका") :
    s.last === "home" ? tx(lang, "Home! Roll again", "घरी पोहोचली! पुन्हा फासा टाका") :
    s.last === "six" ? tx(lang, "A 6 — roll again", "6 आला — पुन्हा टाका") : "";

  return (
    <div className="px-1 pb-2">
      {/* players */}
      <div className="mb-2.5 flex flex-wrap items-center justify-center gap-1.5">
        {s.players.map((c) => {
          const place = s.winners.indexOf(c);
          const home = s.tokens[c].filter((p) => p === FINISH).length;
          return (
            <span key={c} className={clsx("flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-semibold transition", c === me && !over ? "text-white" : "bg-sunken text-ink")} style={c === me && !over ? { background: HEX[c] } : undefined}>
              <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: HEX[c] }} />
              {name(c, lang)}
              {place >= 0 ? <span>· {["🥇", "🥈", "🥉", "4"][place]}</span> : <span className="opacity-70">· {home}/4</span>}
            </span>
          );
        })}
      </div>

      <div className="mx-auto max-w-[400px]">
        <Board s={s} can={s.dice != null ? can : []} onToken={(i) => setS(move(s, i))} />
      </div>

      {over ? (
        <div className="mt-4 text-center">
          <div className="text-[22px] font-bold">🏆 {name(s.winners[0], lang)} {tx(lang, "wins!", "जिंकला!")}</div>
          <div className="mt-3 flex justify-center gap-2">
            <button onClick={() => setS(newGame(s.players.length as 2 | 3 | 4))} className="rounded-full bg-jade-deep px-5 py-2.5 text-[15px] font-semibold text-white">{tx(lang, "Play again", "पुन्हा खेळा")}</button>
            <button onClick={() => setS(null)} className="rounded-full border border-line px-5 py-2.5 text-[15px] font-semibold">{tx(lang, "Players", "खेळाडू")}</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={doRoll}
            disabled={s.dice != null || rolling != null}
            aria-label={tx(lang, "Roll the dice", "फासा टाका")}
            className={clsx("flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[18px] bg-white p-2.5 shadow-[0_6px_16px_-8px_rgb(0_0_0/.35)] ring-2 transition active:scale-90", rolling != null && "animate-[spin_.42s_linear_infinite]")}
            style={{ color: HEX[me], ["--tw-ring-color" as string]: HEX[me] }}
          >
            <Pips n={rolling != null ? face : s.dice ?? face} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold" style={{ color: HEX[me] }}>
              {name(me, lang)} · {s.dice == null ? tx(lang, "tap the dice", "फासा टाका") : can.length > 1 ? tx(lang, "tap a token", "सोंगटी निवडा") : tx(lang, "moving…", "चालत आहे…")}
            </div>
            <div className="h-5 text-[13px] text-muted">{note}</div>
          </div>
          <button onClick={() => (sure ? (setS(null), setSure(false)) : setSure(true))} onBlur={() => setSure(false)} className={clsx("shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold", sure ? "border-rose/40 bg-rose-soft text-rose" : "border-line text-muted")}>
            {sure ? tx(lang, "Sure?", "नक्की?") : tx(lang, "New", "नवीन")}
          </button>
        </div>
      )}
    </div>
  );
}
