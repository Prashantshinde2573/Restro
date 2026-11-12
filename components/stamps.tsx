"use client";

// Stamp card screens: the card itself, the owner's settings, and the box on
// the Charge sheet where a stamp is given or the reward is used.
import clsx from "clsx";
import { Check, Gift, Stamp as StampIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Segmented, Toggle, inputCls } from "./ui";
import { useMenu, settingsActions, useSettings } from "@/lib/live";
import { DEFAULT_PROGRAM, WHO_LABEL, programOf, rewardText } from "@/lib/stamps";
import type { StampProgram } from "@/lib/types";

/** The card: one circle per stamp, the last one is the reward. */
export function StampCard({ have, needed, reward, title, note, className, dark }: { have: number; needed: number; reward: string; title?: ReactNode; note?: ReactNode; className?: string; dark?: boolean }) {
  const full = have >= needed;
  return (
    <div className={clsx("rounded-[18px] p-4", dark ? "bg-ink text-canvas" : "bg-[linear-gradient(135deg,#0e7a5f,#0b5e49)] text-white", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14.5px] font-bold">{title ?? "Stamp card"}</span>
        <span className="text-[13px] font-semibold tnum opacity-85">{Math.min(have, needed)}/{needed}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`${Math.min(have, needed)} of ${needed} stamps`}>
        {Array.from({ length: needed }).map((_, i) => (
          <span key={i} className={clsx("flex h-7 w-7 items-center justify-center rounded-full border-2 text-[13px]", i < have ? "border-white bg-white text-[#0b5e49]" : "border-white/35 border-dashed")}>
            {i < have ? <Check size={15} strokeWidth={3} /> : null}
          </span>
        ))}
        <span className={clsx("flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold", full ? "bg-[#ffd25e] text-ink" : "bg-white/15")}>
          <Gift size={13} /> {reward}
        </span>
      </div>
      <div className="mt-2.5 text-[12.5px] opacity-80">
        {note ?? (full ? "Card full · the reward goes on the next bill" : `${needed - have} more to go`)}
      </div>
    </div>
  );
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <div>
    <div className="mb-1.5 text-[13px] font-medium text-muted">{title}</div>
    {children}
    {hint && <div className="mt-1 text-[12px] text-faint">{hint}</div>}
  </div>
);

const Stepper = ({ value, onChange, min, max, suffix }: { value: number; onChange: (n: number) => void; min: number; max: number; suffix?: string }) => (
  <div className="flex items-center gap-3">
    <button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-[20px] font-semibold">−</button>
    <span className="min-w-[64px] text-center text-[18px] font-bold tnum">{value}{suffix}</span>
    <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-[20px] font-semibold">+</button>
  </div>
);

/** Settings → Stamp card (owner only). */
export function StampSettings({ onDone }: { onDone: (msg: string) => void }) {
  const settings = useSettings();
  const menu = useMenu();
  const [p, setP] = useState<StampProgram>(programOf(settings.stamps));
  const set = (patch: Partial<StampProgram>) => setP((x) => ({ ...x, ...patch }));
  const reward = rewardText({ ...p, reward: p.reward }, menu);
  const valid = p.needed >= 2 && (p.rewardKind === "item" ? !!p.rewardItemId : (p.rewardValue ?? 0) > 0) && (p.reward.trim() || p.rewardKind !== "item" || !!p.rewardItemId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-group bg-surface p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jade-soft text-jade-deep"><StampIcon size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">Stamp card</div>
          <div className="text-[12.5px] text-muted">{p.on ? "On · guests collect stamps on their bills" : "Off · nobody collects stamps"}</div>
        </div>
        <Toggle checked={p.on} onChange={(v) => set({ on: v })} label="Stamp card on" />
      </div>

      <StampCard have={Math.max(0, p.needed - 3)} needed={p.needed} reward={reward} title="What guests see" />

      <div className={clsx("space-y-5", !p.on && "opacity-60")}>
        <Section title="Stamps to fill the card" hint={`After ${p.needed} stamps, the ${p.needed + 1}th bill gets the reward.`}>
          <Stepper value={p.needed} onChange={(n) => set({ needed: n })} min={2} max={20} />
        </Section>

        <Section title="Reward">
          <Segmented
            className="w-full"
            value={p.rewardKind}
            onChange={(k) => set({ rewardKind: k })}
            options={[
              { value: "item", label: "A free dish" },
              { value: "flat", label: "₹ off" },
              { value: "pct", label: "% off" },
            ]}
          />
          <div className="mt-2.5 space-y-2.5">
            {p.rewardKind === "item" ? (
              <select aria-label="Free dish" value={p.rewardItemId ?? ""} onChange={(e) => set({ rewardItemId: e.target.value, reward: p.reward || `Free ${menu.find((m) => m.id === e.target.value)?.name ?? ""}` })} className={inputCls}>
                <option value="">Choose the dish…</option>
                {menu.map((m) => <option key={m.id} value={m.id}>{m.name} · ₹{m.price}</option>)}
              </select>
            ) : (
              <div className="flex gap-2.5">
                <input aria-label={p.rewardKind === "flat" ? "Rupees off" : "Percent off"} inputMode="numeric" value={p.rewardValue ?? ""} onChange={(e) => set({ rewardValue: Number(e.target.value.replace(/\D/g, "")) || 0 })} placeholder={p.rewardKind === "flat" ? "₹ off, e.g. 100" : "% off, e.g. 20"} className={inputCls} />
                {p.rewardKind === "pct" && <input aria-label="Up to (₹)" inputMode="numeric" value={p.rewardCap || ""} onChange={(e) => set({ rewardCap: Number(e.target.value.replace(/\D/g, "")) || undefined })} placeholder="Up to ₹ (optional)" className={inputCls} />}
              </div>
            )}
            <input aria-label="Reward name" value={p.reward} onChange={(e) => set({ reward: e.target.value })} placeholder="What guests see, e.g. Free coffee" className={inputCls} maxLength={40} />
          </div>
        </Section>

        <Section title="Who can collect">
          <Segmented className="w-full" value={p.who} onChange={(w) => set({ who: w })} options={[{ value: "everyone", label: "Every guest with a number" }, { value: "optin", label: "Only guests OK with offers" }]} />
        </Section>

        <Section title="A bill earns a stamp if it's at least" hint="Items before GST. 0 = every bill.">
          <input aria-label="Minimum bill" inputMode="numeric" value={p.minBill || ""} onChange={(e) => set({ minBill: Number(e.target.value.replace(/\D/g, "")) || 0 })} placeholder="₹0" className={inputCls} />
        </Section>

        <Section title="Stamps per guest per day">
          <Segmented className="w-full" value={String(p.perDay)} onChange={(v) => set({ perDay: Number(v) })} options={[{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "0", label: "No limit" }]} />
        </Section>

        <Section title="Stamps expire after">
          <Segmented className="w-full" value={String(p.expiryDays)} onChange={(v) => set({ expiryDays: Number(v) })} options={[{ value: "0", label: "Never" }, { value: "90", label: "3 months" }, { value: "180", label: "6 months" }, { value: "365", label: "1 year" }]} />
        </Section>

        <div className="overflow-hidden rounded-group bg-surface">
          <div className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">Give the stamp by itself</div>
              <div className="text-[12.5px] text-muted">{p.auto ? "When a bill is charged with the guest's number, the stamp is ticked already." : "The cashier ticks “Give a stamp” on each bill."}</div>
            </div>
            <Toggle checked={p.auto} onChange={(v) => set({ auto: v })} label="Give the stamp by itself" />
          </div>
        </div>

        <Section title="Who can give stamps">
          <select aria-label="Who can give stamps" value={p.givers} onChange={(e) => set({ givers: e.target.value as StampProgram["givers"] })} className={inputCls}>
            {(Object.keys(WHO_LABEL) as StampProgram["givers"][]).map((k) => <option key={k} value={k}>{WHO_LABEL[k]}</option>)}
          </select>
        </Section>
        <Section title="Who can give the reward">
          <select aria-label="Who can give the reward" value={p.redeemers} onChange={(e) => set({ redeemers: e.target.value as StampProgram["redeemers"] })} className={inputCls}>
            {(Object.keys(WHO_LABEL) as StampProgram["redeemers"][]).map((k) => <option key={k} value={k}>{WHO_LABEL[k]}</option>)}
          </select>
        </Section>

        <Section title="Rules guests see (optional)">
          <textarea aria-label="Rules guests see" value={p.terms ?? ""} onChange={(e) => set({ terms: e.target.value })} rows={2} maxLength={200} placeholder="e.g. Dine-in only. Not with other offers." className="w-full rounded-ctl bg-surface p-4 text-[15px] outline-none ring-1 ring-line focus:ring-1 focus:ring-jade/40" />
        </Section>
      </div>

      <div className="flex gap-2.5">
        <Button size="lg" variant="plain" onClick={() => setP({ ...DEFAULT_PROGRAM, on: p.on })}>Reset</Button>
        <Button
          size="lg"
          className="flex-1"
          disabled={p.on && !valid}
          onClick={() => {
            settingsActions.update({ stamps: { ...p, reward: p.reward.trim() || reward } });
            onDone(p.on ? `Stamp card on · ${p.needed} stamps → ${p.reward.trim() || reward}` : "Stamp card off");
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/** On the Charge sheet: the guest's card, "Give a stamp", and "Use the reward". */
export function StampBox({
  phoneOk,
  name,
  have,
  program: p,
  rewardAmt,
  canRedeem,
  useReward,
  onUseReward,
  mayGive,
  whyNot,
  give,
  onGive,
}: {
  phoneOk: boolean;
  name?: string;
  have: number;
  program: StampProgram;
  rewardAmt: number;
  canRedeem: boolean;
  useReward: boolean;
  onUseReward: (v: boolean) => void;
  mayGive: boolean;
  whyNot: string | null;
  give: boolean;
  onGive: (v: boolean) => void;
}) {
  if (!phoneOk) {
    return (
      <div className="flex items-center gap-3 rounded-group bg-surface px-4 py-3 text-[13.5px] text-muted">
        <StampIcon size={17} className="shrink-0 text-jade" />
        Add the guest&apos;s mobile above to give a stamp ({p.needed} stamps → {p.reward}).
      </div>
    );
  }
  const full = have >= p.needed;
  const after = useReward ? have - p.needed + (give ? 1 : 0) : have + (give ? 1 : 0);
  return (
    <div className="overflow-hidden rounded-group bg-surface">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <StampIcon size={17} className="shrink-0 text-jade" />
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">Stamp card{name ? ` · ${name}` : ""}</span>
        <span className="text-[13px] font-semibold tnum text-muted">{Math.min(have, p.needed)}/{p.needed}</span>
      </div>
      <div className="flex flex-wrap gap-1 px-4 pb-3 pt-2">
        {Array.from({ length: p.needed }).map((_, i) => (
          <span key={i} className={clsx("h-4 w-4 rounded-full", i < have ? "bg-jade" : "border border-dashed border-line")} />
        ))}
      </div>
      {full && (
        <div className="flex items-center gap-3 border-t border-line/80 bg-[#fff7e0] px-4 py-3">
          <Gift size={18} className="shrink-0 text-saffron" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Card full · {p.reward}</div>
            <div className="text-[12.5px] text-muted">{canRedeem ? `Takes ₹${rewardAmt} off this bill` : "Ask the owner to give the reward"}</div>
          </div>
          {canRedeem && <Toggle checked={useReward} onChange={onUseReward} label="Use the reward on this bill" />}
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-line/80 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">Give a stamp for this bill</div>
          <div className="text-[12.5px] text-muted">{whyNot ?? (!mayGive ? "Only the owner can give stamps" : give ? `Card will show ${Math.max(0, after)}/${p.needed}` : "No stamp on this bill")}</div>
        </div>
        <Toggle checked={give} onChange={(v) => !whyNot && mayGive && onGive(v)} label="Give a stamp for this bill" />
      </div>
    </div>
  );
}
