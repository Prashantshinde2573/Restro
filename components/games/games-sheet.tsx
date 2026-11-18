"use client";

// Games for guests while the food is on its way: Ludo (2–4 players on one
// phone) and Chef Run (one player).
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Sheet } from "@/components/ui";
import { tx, type GuestLang } from "@/lib/guest-lang";

export type GameId = "ludo" | "run";
// each game loads only when it's opened
const Ludo = dynamic(() => import("./ludo").then((m) => m.Ludo), { ssr: false });
const ChefRun = dynamic(() => import("./chef-run").then((m) => m.ChefRun), { ssr: false });

export function GamesSheet({ game, onGame, onClose, lang }: { game: GameId | null; onGame: (g: GameId) => void; onClose: () => void; lang: GuestLang }) {
  return (
    <Sheet open={!!game} onClose={onClose} title={tx(lang, "Games", "खेळ")}>
      <div className="mb-3 flex rounded-full border border-line bg-surface p-1">
        {([
          { id: "ludo", label: tx(lang, "🎲 Ludo · 2–4 players", "🎲 लुडो · 2–4 जण") },
          { id: "run", label: tx(lang, "👨‍🍳 Chef Run · 1 player", "👨‍🍳 शेफ रन · 1 जण") },
        ] as const).map((g) => (
          <button key={g.id} onClick={() => onGame(g.id)} aria-pressed={game === g.id} className={clsx("flex-1 rounded-full px-2 py-2 text-[13px] font-semibold transition", game === g.id ? "bg-jade-soft text-jade-deep" : "text-muted")}>
            {g.label}
          </button>
        ))}
      </div>
      {game === "ludo" ? <Ludo lang={lang} /> : game === "run" ? <ChefRun lang={lang} /> : null}
    </Sheet>
  );
}

/** "Waiting for your food?" card with the two games. */
export function GamesCard({ onGame, lang }: { onGame: (g: GameId) => void; lang: GuestLang }) {
  return (
    <div className="rounded-[18px] bg-surface p-4 ring-1 ring-line/70">
      <div className="text-[15px] font-bold">{tx(lang, "Food on its way? Play a game 🎮", "जेवण येतंय? तोपर्यंत खेळा 🎮")}</div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button onClick={() => onGame("ludo")} className="rounded-[14px] bg-[#FCF0CC] px-3 py-3 text-left active:scale-[.98]">
          <span className="block text-[22px]">🎲</span>
          <span className="block text-[14.5px] font-bold">{tx(lang, "Ludo", "लुडो")}</span>
          <span className="block text-[12px] text-ink/60">{tx(lang, "2–4 players, one phone", "2–4 जण, एक फोन")}</span>
        </button>
        <button onClick={() => onGame("run")} className="rounded-[14px] bg-[#DDF3E8] px-3 py-3 text-left active:scale-[.98]">
          <span className="block text-[22px]">👨‍🍳</span>
          <span className="block text-[14.5px] font-bold">{tx(lang, "Chef Run", "शेफ रन")}</span>
          <span className="block text-[12px] text-ink/60">{tx(lang, "Jump, grab samosas", "उडी मारा, समोसे पकडा")}</span>
        </button>
      </div>
    </div>
  );
}
