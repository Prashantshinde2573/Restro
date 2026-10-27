"use client";

import clsx from "clsx";
import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Sheet, DietMark } from "./ui";
import { repo } from "@/lib/repo";
import type { MenuItem } from "@/lib/types";
import { inr } from "@/lib/format";

// Demo of voice ordering. In production: Web Speech API / a speech-to-text
// model with Marathi + Hindi + English, then a small parser that maps spoken
// dish names (with fuzzy matching and local nicknames) to menu items.
const script = {
  mr: "टेबल चार साठी दोन बटर चिकन, चार बटर नान, एक दाल मखनी आणि दोन मसाला ताक. पनीर टिक्का कमी तिखट.",
  en: "Table four — two butter chicken, four butter naan, one dal makhani, two masala chaas, and one paneer tikka, less spicy.",
};
const parsed: { id: string; qty: number; note?: string }[] = [
  { id: "m5", qty: 2 },
  { id: "m10", qty: 4 },
  { id: "m6", qty: 1 },
  { id: "m19", qty: 2 },
  { id: "m1", qty: 1, note: "Less spicy" },
];

export function VoiceOrder({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (lines: { item: MenuItem; qty: number; note?: string }[]) => void;
}) {
  const [lang, setLang] = useState<"mr" | "en">("mr");
  const [chars, setChars] = useState(0);
  const text = script[lang];
  const listening = chars < text.length;

  useEffect(() => {
    if (!open) return;
    setChars(0);
  }, [open, lang]);

  useEffect(() => {
    if (!open || !listening) return;
    const id = window.setTimeout(() => setChars((c) => Math.min(text.length, c + 3)), 40);
    return () => window.clearTimeout(id);
  }, [open, chars, listening, text.length]);

  const menu = repo.menu();
  const lines = parsed.map((p) => ({ item: menu.find((m) => m.id === p.id)!, qty: p.qty, note: p.note }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Speak the order"
      footer={
        <Button size="lg" className="w-full" disabled={listening} onClick={() => { onAdd(lines); onClose(); }}>
          {listening ? "Listening…" : `Add ${lines.reduce((s, l) => s + l.qty, 0)} items to order`}
        </Button>
      }
    >
      <div className="mb-4 flex gap-1 rounded-ctl bg-sunken p-1">
        {(["mr", "en"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} className={clsx("flex-1 rounded-[9px] py-1.5 text-[13px] font-semibold", lang === l ? "bg-surface shadow-float" : "text-muted")}>
            {l === "mr" ? "मराठी / हिंदी" : "English"}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center py-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          {listening && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-jade/40" />}
          <span className={clsx("relative flex h-20 w-20 items-center justify-center rounded-full", listening ? "bg-jade text-white" : "bg-jade-soft text-jade")}>
            <Mic size={30} />
          </span>
        </div>
        <p className="mt-5 min-h-[84px] text-center text-[18px] font-medium leading-snug">
          {text.slice(0, chars)}
          {listening && <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-jade" />}
        </p>
      </div>
      {!listening && (
        <div className="animate-fade-in overflow-hidden rounded-group bg-surface">
          <div className="border-b border-line px-4 py-2.5 text-[13px] text-muted">Understood as · Table T4</div>
          {lines.map((l) => (
            <div key={l.item.id} className="flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0">
              <DietMark diet={l.item.diet} />
              <span className="flex-1 text-[15px]">
                <b className="tnum">{l.qty}×</b> {l.item.name}
                {l.note && <span className="ml-2 text-[13px] text-saffron">{l.note}</span>}
              </span>
              <span className="text-[14px] text-muted tnum">{inr(l.qty * l.item.price)}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
