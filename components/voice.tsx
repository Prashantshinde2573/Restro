"use client";

// Voice ordering: the browser listens (Chrome / Edge / Android; Safari partly),
// and what was said is matched to this restaurant's own menu.
// Say it like: "two butter chicken, four butter naan, one dal makhani".
import { sizedName, sizesOf } from "@/lib/sizes";
import clsx from "clsx";
import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Sheet, DietMark } from "./ui";
import { useMenu } from "@/lib/live";
import type { MenuItem, Size } from "@/lib/types";
import { inr } from "@/lib/format";

type Line = { item: MenuItem; qty: number; size?: Size };

const NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, ek: 1, two: 2, to: 2, too: 2, do: 2, don: 2, three: 3, teen: 3, tin: 3, four: 4, for: 4, char: 4, chaar: 4,
  five: 5, paach: 5, panch: 5, paanch: 5, six: 6, che: 6, saha: 6, seven: 7, saat: 7, sat: 7, eight: 8, aath: 8, aat: 8,
  nine: 9, nau: 9, nav: 9, ten: 10, das: 10, daha: 10, eleven: 11, twelve: 12, dozen: 12,
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Find menu dishes in what was said, with the number spoken just before each. */
export function parseOrder(text: string, menu: MenuItem[]): Line[] {
  const words = norm(text).split(" ").filter(Boolean);
  const items = menu
    .filter((m) => m.available !== false)
    .map((m) => ({ m, w: norm(m.name).split(" ").filter(Boolean) }))
    .filter((x) => x.w.length)
    .sort((a, b) => b.w.length - a.w.length); // longer names first: "butter naan" before "naan"
  const used = new Array(words.length).fill(false);
  const found: { at: number; item: MenuItem; qty: number; size?: Size }[] = [];
  // "large pizza", "pizza medium", "half biryani": a size said next to a dish that has sizes
  const sizeNear = (m: MenuItem, at: number, len: number) => {
    const sizes = sizesOf(m);
    if (!sizes.length) return undefined;
    const near = [words[at - 1], words[at - 2], words[at + len]].filter(Boolean);
    const is = (word: string, name: string) => {
      const n = norm(name);
      if (word === n) return true;
      return n.length === 1 && ["small", "medium", "large", "regular"].includes(word) && word[0] === n;
    };
    return sizes.find((z) => near.some((w) => is(w, z.name))) ?? sizes[0];
  };
  const same = (a: string, b: string) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a))); // naan / nan, chaas / chas
  for (const { m, w } of items) {
    for (let i = 0; i + w.length <= words.length; i++) {
      if (w.every((x, k) => !used[i + k] && same(words[i + k], x))) {
        for (let k = 0; k < w.length; k++) used[i + k] = true;
        const before = words[i - 1];
        const qty = before ? (/^\d+$/.test(before) ? Number(before) : NUM[before] ?? 1) : 1;
        found.push({ at: i, item: m, qty: Math.min(Math.max(qty, 1), 50), size: sizeNear(m, i, w.length) });
        i += w.length - 1;
      }
    }
  }
  const merged = new Map<string, Line & { at: number }>();
  found.sort((a, b) => a.at - b.at).forEach((f) => {
    const k = `${f.item.id}|${f.size?.id ?? ""}`;
    const cur = merged.get(k);
    if (cur) cur.qty += f.qty;
    else merged.set(k, { item: f.item, qty: f.qty, size: f.size, at: f.at });
  });
  return [...merged.values()].map(({ item, qty, size }) => ({ item, qty, size }));
}

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const getRec = (): (new () => Rec) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function VoiceOrder({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (lines: { item: MenuItem; qty: number; note?: string; size?: Size }[]) => void;
}) {
  const menu = useMenu();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);
  const supported = !!getRec();

  const start = () => {
    const R = getRec();
    if (!R) return;
    setError("");
    setText("");
    const r = new R();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
      setText(t.trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Allow the microphone for this site, then try again." : e.error === "no-speech" ? "Didn't hear anything. Try again." : "Couldn't listen. Try again.");
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };
  const stop = () => rec.current?.stop();

  useEffect(() => {
    if (open && supported) start();
    if (!open) {
      rec.current?.stop();
      setText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lines = parseOrder(text, menu);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Speak the order"
      footer={
        supported ? (
          <Button size="lg" className="w-full" disabled={!lines.length} onClick={() => { stop(); onAdd(lines); onClose(); }}>
            {lines.length ? `Add ${lines.reduce((s, l) => s + l.qty, 0)} items to order` : listening ? "Listening…" : "Nothing matched yet"}
          </Button>
        ) : undefined
      }
    >
      {!supported ? (
        <p className="rounded-group bg-surface p-4 text-[14.5px] text-muted">This browser can&apos;t listen. Use Chrome on Android or a computer.</p>
      ) : (
        <>
          <div className="flex flex-col items-center py-4">
            <button onClick={listening ? stop : start} className="relative flex h-20 w-20 items-center justify-center" aria-label={listening ? "Stop" : "Listen"}>
              {listening && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-jade/40" />}
              <span className={clsx("relative flex h-20 w-20 items-center justify-center rounded-full", listening ? "bg-jade text-white" : "bg-jade-soft text-jade")}>
                {listening ? <Mic size={30} /> : <MicOff size={28} />}
              </span>
            </button>
            <p className="mt-2 text-[13px] text-muted">{listening ? "Listening… tap to stop" : "Tap to speak again"}</p>
            <p className="mt-4 min-h-[60px] text-center text-[18px] font-medium leading-snug">
              {text || <span className="text-faint">Say the dishes with how many, e.g. &ldquo;two butter chicken, four naan&rdquo;</span>}
            </p>
            {error && <p className="text-[14px] font-medium text-rose">{error}</p>}
          </div>
          {lines.length > 0 && (
            <div className="animate-fade-in overflow-hidden rounded-group bg-surface">
              <div className="border-b border-line px-4 py-2.5 text-[13px] text-muted">Understood as</div>
              {lines.map((l) => (
                <div key={l.item.id} className="flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0">
                  <DietMark diet={l.item.diet} />
                  <span className="flex-1 text-[15px]"><b className="tnum">{l.qty}×</b> {sizedName(l.item.name, l.size?.name)}</span>
                  <span className="text-[14px] text-muted tnum">{inr(l.qty * (l.size?.price ?? l.item.price))}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
