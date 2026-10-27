"use client";

import clsx from "clsx";
import { useParams } from "next/navigation";
import { BellRing, Check, ChefHat, Minus, Plus, ReceiptText, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, DietMark, DishArt, Sheet } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";

type Stage = "menu" | "placed";

const desc: Record<string, string> = {
  m1: "Cottage cheese, hung-curd marinade, charred in the tandoor.",
  m5: "Our most-ordered. Smoky tomato-butter gravy, tender chicken.",
  m13: "Slow-cooked under dough seal, served with raita.",
  m3: "Crisp coriander-gram flour squares, a Pune favourite.",
  m6: "Black lentils cooked overnight with butter and cream.",
  m18: "Seasonal. Custard-apple folded into reduced milk.",
  m20: "Konkan kokum, chilled. Good for the heat.",
};

export default function GuestOrder() {
  const params = useParams<{ table: string }>();
  const table = (params?.table ?? "T3").toString().toUpperCase();
  const toast = useToast();
  const r = repo.restaurant();
  const menu = repo.menu().filter((m) => m.available);
  const cats = repo.categories();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("menu");
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<"equal" | "mine">("equal");
  const [mine, setMine] = useState<string[]>([]);
  const [paid, setPaid] = useState(false);
  const [stars, setStars] = useState(0);
  const [lang, setLang] = useState<"en" | "mr">("en");

  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([id, q]) => ({ item: menu.find((m) => m.id === id)!, q }));
  const count = lines.reduce((s, l) => s + l.q, 0);
  const subtotal = lines.reduce((s, l) => s + l.q * l.item.price, 0);
  const total = Math.round(subtotal * 1.05);
  const myShare = payMode === "equal" ? Math.ceil(total / 3) : Math.round(lines.filter((l) => mine.includes(l.item.id)).reduce((s, l) => s + l.q * l.item.price, 0) * 1.05);
  const grouped = useMemo(() => cats.map((c) => ({ c, items: menu.filter((m) => m.categoryId === c.id) })).filter((g) => g.items.length), [cats, menu]);

  const set = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-canvas pb-32">
      <header className="px-5 pb-2 pt-6">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-surface px-3 py-1 text-[13px] font-semibold">Table {table}</span>
          <button onClick={() => setLang(lang === "en" ? "mr" : "en")} className="rounded-full bg-surface px-3 py-1 text-[13px] font-semibold">{lang === "en" ? "मराठी" : "English"}</button>
        </div>
        <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-tight">{r.name}</h1>
        <p className="text-[14px] text-muted">{lang === "en" ? "Order from your phone. We'll bring it to your table." : "तुमच्या फोनवरून ऑर्डर करा. आम्ही टेबलवर आणू."}</p>
      </header>

      {stage === "placed" && (
        <section className="mx-4 mt-3 rounded-[22px] bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Your order</span>
            <span className="text-[13px] text-muted">about 15 min</span>
          </div>
          <div className="mt-4 flex items-center">
            {[["Received", Check], ["Cooking", ChefHat], ["At your table", ReceiptText]].map(([l, I], i) => {
              const Icon = I as typeof Check;
              const active = i <= 1;
              return (
                <div key={String(l)} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full items-center">
                    <span className={clsx("h-0.5 flex-1", i === 0 ? "bg-transparent" : active ? "bg-jade" : "bg-line")} />
                    <span className={clsx("flex h-9 w-9 items-center justify-center rounded-full", active ? "bg-jade text-white" : "bg-sunken text-faint", i === 1 && "animate-pulse")}><Icon size={17} /></span>
                    <span className={clsx("h-0.5 flex-1", i === 2 ? "bg-transparent" : i < 1 ? "bg-jade" : "bg-line")} />
                  </div>
                  <span className={clsx("text-[12px] font-medium", active ? "text-ink" : "text-faint")}>{String(l)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="plain" className="!bg-sunken" onClick={() => toast("A waiter is on the way")}><BellRing size={16} /> Call waiter</Button>
            <Button onClick={() => setPayOpen(true)}><Users size={16} /> Pay my share</Button>
          </div>
        </section>
      )}

      <nav className="no-scrollbar sticky top-0 z-20 flex gap-2 overflow-x-auto bg-canvas/90 px-4 py-3 backdrop-blur-xl">
        {grouped.map(({ c }) => (
          <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-[14px] font-medium">{c.name}</a>
        ))}
      </nav>

      <main className="space-y-6 px-4">
        {grouped.map(({ c, items }) => (
          <section key={c.id} id={c.id} className="scroll-mt-16">
            <h2 className="mb-2 px-1 text-[19px] font-semibold tracking-tight">{c.name}</h2>
            <div className="overflow-hidden rounded-[22px] bg-surface">
              {items.map((m) => {
                const q = cart[m.id] ?? 0;
                return (
                  <div key={m.id} className="flex gap-3 border-b border-line/80 p-4 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><DietMark diet={m.diet} />{m.tags?.[0] && <span className="text-[12px] font-semibold text-saffron">{m.tags[0]}</span>}</div>
                      <div className="mt-1 text-[16px] font-semibold leading-tight">{m.name}</div>
                      <div className="mt-0.5 text-[14px] font-medium tnum">{inr(m.price)}</div>
                      {desc[m.id] && <p className="mt-1 text-[13px] leading-snug text-muted">{desc[m.id]}</p>}
                    </div>
                    <div className="relative w-[104px] shrink-0">
                      <DishArt hue={m.hue} className="h-[96px] w-[104px] rounded-[16px]" />
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                        {q === 0 ? (
                          <button onClick={() => set(m.id, 1)} className="rounded-[10px] bg-surface px-5 py-1.5 text-[14px] font-bold text-jade shadow-float">ADD</button>
                        ) : (
                          <div className="flex items-center gap-2 rounded-[10px] bg-jade px-1.5 py-1 text-white shadow-float">
                            <button aria-label="Less" onClick={() => set(m.id, -1)} className="p-1"><Minus size={14} /></button>
                            <span className="w-4 text-center text-[14px] font-bold tnum">{q}</span>
                            <button aria-label="More" onClick={() => set(m.id, 1)} className="p-1"><Plus size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {count > 0 && stage === "menu" && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-4">
          <button onClick={() => setCartOpen(true)} className="flex w-full animate-pop items-center gap-3 rounded-[18px] bg-jade px-5 py-4 text-white shadow-float">
            <span className="text-[15px] font-semibold">{count} item{count > 1 ? "s" : ""}</span>
            <span className="text-[15px] tnum opacity-80">{inr(subtotal)}</span>
            <span className="ml-auto text-[16px] font-semibold">View order</span>
          </button>
        </div>
      )}

      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={`Table ${table}`}
        footer={<Button size="lg" className="w-full" onClick={() => { setCartOpen(false); setStage("placed"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Place order · {inr(total)}</Button>}
      >
        <div className="overflow-hidden rounded-group bg-surface">
          {lines.map((l) => (
            <div key={l.item.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
              <DietMark diet={l.item.diet} />
              <span className="flex-1 text-[15px]">{l.item.name}</span>
              <div className="flex items-center gap-1 rounded-full bg-sunken p-0.5">
                <button aria-label="Less" onClick={() => set(l.item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface"><Minus size={13} /></button>
                <span className="w-5 text-center text-[14px] font-semibold tnum">{l.q}</span>
                <button aria-label="More" onClick={() => set(l.item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface"><Plus size={13} /></button>
              </div>
              <span className="w-14 text-right text-[14px] tnum">{inr(l.q * l.item.price)}</span>
            </div>
          ))}
        </div>
        <input className="mt-3 h-12 w-full rounded-ctl bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-jade" placeholder="Anything the kitchen should know? (less spicy, no onion…)" />
        <p className="mt-3 text-[13px] text-muted">Includes 5% GST. You pay at the end — together or one by one.</p>
      </Sheet>

      <Sheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={paid ? "Thank you!" : "Pay my share"}
        footer={!paid ? <Button size="lg" className="w-full" disabled={myShare === 0} onClick={() => setPaid(true)}>Pay {inr(myShare)} with UPI</Button> : undefined}
      >
        {!paid ? (
          <div className="space-y-4">
            <div className="flex rounded-ctl bg-sunken p-[3px]">
              {(["equal", "mine"] as const).map((m) => (
                <button key={m} onClick={() => setPayMode(m)} className={clsx("flex-1 rounded-[9px] py-2 text-[14px] font-semibold", payMode === m ? "bg-surface shadow-float" : "text-muted")}>
                  {m === "equal" ? "Split equally (3)" : "Pay for what I ate"}
                </button>
              ))}
            </div>
            {payMode === "mine" ? (
              <div className="overflow-hidden rounded-group bg-surface">
                {lines.map((l) => {
                  const on = mine.includes(l.item.id);
                  return (
                    <button key={l.item.id} onClick={() => setMine((x) => (on ? x.filter((i) => i !== l.item.id) : [...x, l.item.id]))} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0">
                      <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full border-2", on ? "border-jade bg-jade text-white" : "border-line")}>{on && <Check size={14} strokeWidth={3} />}</span>
                      <span className="flex-1 text-[15px]">{l.q}× {l.item.name}</span>
                      <span className="text-[14px] tnum">{inr(l.q * l.item.price)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-group bg-surface p-5 text-center">
                <div className="text-[14px] text-muted">Bill {inr(total)} ÷ 3 guests</div>
                <div className="mt-1 text-[36px] font-semibold tracking-tight tnum">{inr(myShare)}</div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center text-[13px] font-medium">
              {["GPay", "PhonePe", "Paytm"].map((a) => <div key={a} className="rounded-ctl bg-surface py-3">{a}</div>)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center pt-4 text-center">
            <div className="flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-jade text-white"><Check size={32} strokeWidth={2.5} /></div>
            <p className="mt-3 text-[15px] text-muted">{inr(myShare)} paid. Your e-bill is on WhatsApp.</p>
            <div className="mt-6 text-[17px] font-semibold">How was your meal?</div>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} aria-label={`${s} stars`} onClick={() => setStars(s)}>
                  <Star size={36} className={s <= stars ? "fill-saffron text-saffron" : "text-line"} />
                </button>
              ))}
            </div>
            {stars >= 4 && (
              <div className="mt-6 w-full animate-fade-in">
                <p className="text-[14px] text-muted">Glad you liked it! Would you share that on Google? It helps a small restaurant a lot.</p>
                <Button size="lg" className="mt-3 w-full" onClick={() => toast("Opening Google reviews")}>Write a Google review</Button>
              </div>
            )}
            {stars > 0 && stars < 4 && (
              <div className="mt-6 w-full animate-fade-in text-left">
                <p className="text-[14px] text-muted">Sorry about that. Tell us what went wrong — this goes straight to the owner.</p>
                <textarea rows={3} className="mt-3 w-full rounded-ctl bg-surface p-3 text-[15px] outline-none ring-1 ring-line focus:ring-2 focus:ring-jade" />
                <Button size="lg" className="mt-3 w-full" onClick={() => toast("Sent to the owner")}>Send to the owner</Button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
