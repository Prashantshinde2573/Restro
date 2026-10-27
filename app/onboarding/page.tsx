"use client";

import clsx from "clsx";
import Link from "next/link";
import { Camera, Check, ChevronLeft, FileSpreadsheet, LayoutTemplate, Minus, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/shell";
import { Button, DietMark, Field, LocalSegmented, inputCls } from "@/components/ui";

const steps = ["Your place", "Bills", "Menu", "Tables", "Team", "Ready"];
const kinds = ["Restaurant", "Café", "Quick service", "Bar", "Cloud kitchen", "Bakery", "Food court"];

const extracted = [
  { n: "Misal Pav", p: 120, d: "veg" as const, c: "Breakfast" },
  { n: "Sabudana Vada", p: 90, d: "veg" as const, c: "Breakfast" },
  { n: "Chicken Thali", p: 280, d: "nonveg" as const, c: "Thalis" },
  { n: "Veg Thali", p: 220, d: "veg" as const, c: "Thalis" },
  { n: "Egg Bhurji Pav", p: 110, d: "egg" as const, c: "All day" },
  { n: "Masala Chai", p: 30, d: "veg" as const, c: "Drinks" },
];

function Counter({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-group bg-surface px-4 py-3">
      <span className="text-[15px] font-medium">{label}</span>
      <div className="flex items-center gap-1 rounded-full bg-sunken p-1">
        <button aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Minus size={16} /></button>
        <span className="w-8 text-center text-[17px] font-semibold tnum">{value}</span>
        <button aria-label={`More ${label}`} onClick={() => onChange(value + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Plus size={16} /></button>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState("Restaurant");
  const [name, setName] = useState("");
  const [menuMode, setMenuMode] = useState<null | "scanning" | "done">(null);
  const [indoor, setIndoor] = useState(10);
  const [outdoor, setOutdoor] = useState(4);

  useEffect(() => {
    if (menuMode !== "scanning") return;
    const id = window.setTimeout(() => setMenuMode("done"), 2200);
    return () => window.clearTimeout(id);
  }, [menuMode]);

  const next = () => setStep((s) => Math.min(steps.length - 1, s + 1));

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-5 pt-5">
        {step > 0 && step < steps.length - 1 ? (
          <button aria-label="Back" onClick={() => setStep((s) => s - 1)} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunken"><ChevronLeft size={22} /></button>
        ) : (
          <Wordmark className="text-[18px]" />
        )}
        <div className="ml-auto text-[13px] font-medium text-muted tnum">{step < steps.length - 1 ? `Step ${step + 1} of ${steps.length - 1}` : ""}</div>
      </header>
      <div className="mx-auto mt-4 flex w-full max-w-xl gap-1.5 px-5">
        {steps.slice(0, -1).map((s, i) => (
          <span key={s} className={clsx("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-jade" : "bg-line")} />
        ))}
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-32 pt-8">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="large-title">Tell us about your place</h1>
              <p className="mt-1 text-[15px] text-muted">We&apos;ll set up the right screens for how you work.</p>
            </div>
            <Field label="Name on the board"><input className={inputCls} placeholder="e.g. Saffron Lane" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="What kind of place is it?">
              <div className="flex flex-wrap gap-2">
                {kinds.map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={clsx("rounded-full px-4 py-2.5 text-[15px] font-medium transition", kind === k ? "bg-ink text-canvas" : "bg-surface")}>{k}</button>
                ))}
              </div>
            </Field>
            <Field label="City"><input className={inputCls} placeholder="Pune" /></Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="large-title">Bills and payments</h1>
              <p className="mt-1 text-[15px] text-muted">You can change all of this later in Settings.</p>
            </div>
            <Field label="GSTIN" hint="Leave empty if you're not GST-registered yet."><input className={inputCls} placeholder="27ABCDE1234F1Z5" /></Field>
            <Field label="GST on food">
              <LocalSegmented className="w-full" initial="5" options={[{ value: "5", label: "5%" }, { value: "18", label: "18%" }, { value: "0", label: "None" }]} />
            </Field>
            <Field label="UPI ID for payments" hint="Guests pay straight to this UPI ID. No gateway, no fees."><input className={inputCls} placeholder="yourname@okhdfc" /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="large-title">Add your menu</h1>
              <p className="mt-1 text-[15px] text-muted">The fastest way: take a photo of your printed menu.</p>
            </div>
            {menuMode === null && (
              <div className="space-y-3">
                <button onClick={() => setMenuMode("scanning")} className="flex w-full items-center gap-4 rounded-group bg-ink p-5 text-left text-canvas">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-saffron"><Camera size={22} /></span>
                  <span className="flex-1">
                    <span className="block text-[16px] font-semibold">Snap your menu card</span>
                    <span className="block text-[13.5px] text-canvas/65">Restro reads dish names, prices and veg/non-veg for you.</span>
                  </span>
                </button>
                <button className="flex w-full items-center gap-4 rounded-group bg-surface p-5 text-left">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-jade-soft text-jade"><FileSpreadsheet size={22} /></span>
                  <span><span className="block text-[16px] font-semibold">Upload an Excel sheet</span><span className="block text-[13.5px] text-muted">Or export from your old billing software.</span></span>
                </button>
                <button className="flex w-full items-center gap-4 rounded-group bg-surface p-5 text-left">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft text-sky"><LayoutTemplate size={22} /></span>
                  <span><span className="block text-[16px] font-semibold">Start from a sample {kind.toLowerCase()} menu</span><span className="block text-[13.5px] text-muted">Edit names and prices after.</span></span>
                </button>
              </div>
            )}
            {menuMode === "scanning" && (
              <div className="flex flex-col items-center rounded-group bg-surface py-14 text-center">
                <Sparkles size={28} className="animate-pulse text-saffron" />
                <div className="mt-3 text-[16px] font-semibold">Reading your menu…</div>
                <div className="text-[14px] text-muted">Finding dishes, prices and categories</div>
              </div>
            )}
            {menuMode === "done" && (
              <div className="animate-fade-in space-y-3">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-jade"><Check size={18} /> Found 48 dishes in 7 categories</div>
                <div className="overflow-hidden rounded-group bg-surface">
                  {extracted.map((e) => (
                    <div key={e.n} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                      <DietMark diet={e.d} />
                      <span className="flex-1 text-[15px]">{e.n}<span className="block text-[12.5px] text-muted">{e.c}</span></span>
                      <span className="text-[15px] font-medium tnum">₹{e.p}</span>
                    </div>
                  ))}
                  <div className="px-4 py-3 text-[13.5px] text-muted">and 42 more · check them on the Menu screen any time</div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="large-title">Your tables</h1>
              <p className="mt-1 text-[15px] text-muted">Each table gets its own QR code for ordering and paying.</p>
            </div>
            <div className="space-y-2">
              <Counter label="Indoor tables" value={indoor} onChange={setIndoor} />
              <Counter label="Outdoor or rooftop" value={outdoor} onChange={setOutdoor} />
            </div>
            <p className="text-[14px] text-muted">Takeaway or cloud kitchen only? Set both to 0 — you&apos;ll get a counter-style screen instead.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="large-title">Invite your team</h1>
              <p className="mt-1 text-[15px] text-muted">They get a WhatsApp link to set a 4-digit PIN. No email needed.</p>
            </div>
            {[["Kavya", "Manager"], ["Rohit", "Captain"], ["", "Chef"]].map(([n, r], i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-2">
                <input className={inputCls} placeholder="Name" defaultValue={n} />
                <input className={inputCls} placeholder={`${r} phone`} inputMode="tel" />
              </div>
            ))}
            <button className="flex items-center gap-1.5 text-[15px] font-semibold text-jade"><Plus size={17} /> Add another</button>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col items-center pt-10 text-center">
            <div className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-jade text-white"><Check size={40} strokeWidth={2.5} /></div>
            <h1 className="large-title mt-6">{name || "Your restaurant"} is ready</h1>
            <p className="mt-2 max-w-sm text-[15px] text-muted">Your 14-day trial of Growth has started. Take your first order — it takes about 10 seconds.</p>
            <div className="mt-8 w-full overflow-hidden rounded-group bg-surface text-left">
              {["48 dishes added", `${indoor + outdoor} tables with QR codes`, "3 team invites sent", "UPI payments switched on"].map((t) => (
                <div key={t} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                  <Check size={17} className="text-jade" />
                  <span className="text-[15px]">{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="pb-safe fixed inset-x-0 bottom-0 border-t border-line/70 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto max-w-xl px-5 py-4">
          {step < steps.length - 1 ? (
            <Button size="lg" className="w-full" onClick={next} disabled={step === 2 && menuMode === "scanning"}>
              {step === 2 && menuMode !== "done" ? "Skip for now" : "Continue"}
            </Button>
          ) : (
            <Link href="/app/pos"><Button size="lg" className="w-full">Take the first order</Button></Link>
          )}
        </div>
      </footer>
    </div>
  );
}
