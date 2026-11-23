// Small pictures for the search pages (lib/seo-pages.ts), drawn in HTML/CSS so they stay
// sharp and cost almost nothing to load. Real app screenshots are the only images.
import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";
import type { HeroArt, Viz } from "@/lib/seo-pages";
import { IconBill, IconKitchen, IconReports, IconStock, IconTable, IconTeam } from "./icons";
import { KotTicket, Receipt, UpiCard } from "./mockups";

/* ---------- shared bits ---------- */
const Pill = ({ children, on = false, className }: { children: ReactNode; on?: boolean; className?: string }) => (
  <span className={clsx("inline-flex h-8 items-center rounded-full px-3.5 text-[12.5px] font-semibold", on ? "bg-ink text-white" : "bg-white text-ink/70 ring-1 ring-black/[.07]", className)}>{children}</span>
);
const Tick = () => (
  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-jade text-white">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
  </span>
);
const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={clsx("rounded-[20px] bg-white p-4 shadow-[0_24px_40px_-24px_rgb(16_24_20/.35)] ring-1 ring-black/[.05]", className)}>{children}</div>
);

/** A real Restropi screen inside a phone frame. */
export function Phone({ shot, alt, className, priority = false }: { shot: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={clsx("w-[250px] rounded-[42px] bg-ink p-[8px] shadow-[0_50px_80px_-30px_rgb(0_0_0/.6)] ring-1 ring-white/10", className)}>
      <Image src={`/site/app/${shot}.webp`} alt={alt} width={585} height={996} sizes="260px" priority={priority} className="block h-auto w-full rounded-[34px]" />
    </div>
  );
}

const Bars = ({ v, hi = -1, className }: { v: number[]; hi?: number; className?: string }) => (
  <div className={clsx("flex h-28 items-end gap-2", className)}>
    {v.map((h, i) => (
      <span key={i} className={clsx("bento-bar w-full rounded-full", i === hi ? "bg-saffron" : "bg-gradient-to-t from-jade/15 to-jade/70")} style={{ height: `${h}%`, animationDelay: `${i * 0.07}s` }} />
    ))}
  </div>
);

/* ---------- bento pictures ---------- */
export function VizArt({ viz }: { viz: Viz }) {
  switch (viz) {
    case "gst":
      return <Receipt className="mx-auto rotate-[-3deg] scale-[1.15]" />;
    case "upi":
      return <UpiCard className="bento-bob mx-auto" amount="₹1,218" />;
    case "split":
      return (
        <Panel className="mx-auto w-[230px]">
          <div className="text-[12px] font-semibold text-ink/55">Bill ₹1,218</div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full">
            <span className="bento-fill w-[55%] bg-jade" /><span className="bento-fill w-[30%] bg-saffron" style={{ animationDelay: ".2s" }} /><span className="bento-fill w-[15%] bg-ink/70" style={{ animationDelay: ".35s" }} />
          </div>
          {[["UPI", "₹670", "bg-jade"], ["Cash", "₹365", "bg-saffron"], ["Card", "₹183", "bg-ink/70"]].map(([a, b, c]) => (
            <div key={a} className="mt-2.5 flex items-center gap-2 text-[13px]"><span className={clsx("h-2.5 w-2.5 rounded-full", c)} /> {a}<b className="ml-auto tnum">{b}</b></div>
          ))}
        </Panel>
      );
    case "discount":
      return (
        <div className="mx-auto flex w-[240px] flex-col items-center gap-2.5">
          <div className="flex gap-2"><Pill>No discount</Pill><Pill on>10% off</Pill></div>
          <div className="flex w-full items-center rounded-full bg-white p-1 pl-4 ring-1 ring-black/[.07]"><span className="font-mono text-[12.5px] tracking-widest">WELCOME50</span><span className="ml-auto rounded-full bg-jade px-3 py-1.5 text-[11.5px] font-semibold text-white">Applied</span></div>
          <Stamps n={4} />
        </div>
      );
    case "reports":
      return (
        <Panel className="mx-auto w-full max-w-[420px]">
          <div className="flex items-end justify-between">
            <div><div className="text-[11.5px] font-semibold text-ink/50">Today</div><div className="text-[26px] font-semibold tracking-tight tnum">₹18,574</div></div>
            <span className="rounded-full bg-jade-soft px-2.5 py-1 text-[11.5px] font-semibold text-jade-deep">+14%</span>
          </div>
          <Bars v={[38, 52, 44, 70, 58, 86, 64]} hi={5} className="mt-3 h-24" />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-ink/55">
            <div><b className="block text-[14px] text-ink">41</b>bills</div><div><b className="block text-[14px] text-ink">₹453</b>avg</div><div><b className="block text-[14px] text-ink">₹884</b>GST</div>
          </div>
        </Panel>
      );
    case "print":
      return <Receipt className="mx-auto" />;
    case "qrtent":
      return (
        <div className="bento-bob mx-auto w-[170px] rounded-[22px] bg-ink p-3.5 text-center text-white shadow-[0_30px_50px_-22px_rgb(16_24_20/.6)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Table 4</div>
          <div className="mt-2 rounded-[14px] bg-white p-2"><Image src="/site/app/qr.webp" alt="Restropi table QR code" width={480} height={480} sizes="140px" className="h-auto w-full" /></div>
          <div className="mt-2 text-[13px] font-semibold">Scan to order</div>
        </div>
      );
    case "multi":
      return (
        <div className="mx-auto flex w-[250px] flex-col items-center">
          <div className="flex -space-x-3">
            {[["A", "bg-saffron"], ["R", "bg-jade"], ["S", "bg-rose"], ["K", "bg-ink"]].map(([l, c]) => (
              <span key={l} className={clsx("flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-semibold text-white ring-4 ring-white", c)}>{l}</span>
            ))}
          </div>
          <svg width="120" height="34" viewBox="0 0 120 34" className="text-ink/25" aria-hidden><path d="M12 2 60 30M44 2l16 28M76 2 60 30M108 2 60 30" stroke="currentColor" strokeWidth="1.6" fill="none" strokeDasharray="3 4" /></svg>
          <Panel className="w-full text-center"><div className="text-[11.5px] font-semibold text-ink/50">Table 4 · one bill</div><div className="text-[24px] font-semibold tracking-tight tnum">₹2,140</div></Panel>
        </div>
      );
    case "menu":
      return (
        <div className="mx-auto grid w-full max-w-[360px] grid-cols-2 gap-3">
          {[["Paneer Tikka", "₹240", 20, true], ["Chicken 65", "₹260", 42, false], ["Veg Biryani", "₹220", 90, true], ["Cold Coffee", "₹140", 30, true]].map(([n, p, h, veg]) => (
            <div key={n as string} className="overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[.05]">
              <div className="aspect-[4/3]" style={{ background: `radial-gradient(circle at 50% 55%, hsl(${h} 70% 60%) 0 30%, hsl(${h} 45% 88%) 31%)` }} />
              <div className="flex items-center gap-1.5 px-2.5 py-2 text-[12px] font-semibold">
                <span className={clsx("h-2.5 w-2.5 rounded-[2px] border-[1.5px]", veg ? "border-jade" : "border-rose")} />
                <span className="truncate">{n}</span><span className="ml-auto text-ink/55">{p}</span>
              </div>
            </div>
          ))}
        </div>
      );
    case "accept":
      return (
        <Panel className="mx-auto w-[250px]">
          <div className="text-[13px] font-semibold">New QR order · T4</div>
          <div className="mt-1 text-[12px] text-ink/55">2 dishes · ₹520</div>
          <div className="mt-3 grid grid-cols-2 gap-2"><span className="rounded-full py-2 text-center text-[12.5px] font-semibold ring-1 ring-black/10">Reject</span><span className="rounded-full bg-jade py-2 text-center text-[12.5px] font-semibold text-white">Accept</span></div>
        </Panel>
      );
    case "lang":
      return (
        <div className="relative mx-auto h-[190px] w-[250px]">
          <span className="bento-bob absolute left-0 top-2 rounded-[20px] rounded-bl-md bg-white px-5 py-3 text-[20px] font-semibold shadow-[0_20px_30px_-20px_rgb(16_24_20/.4)] ring-1 ring-black/[.05]">English</span>
          <span className="bento-bob absolute right-0 top-[64px] rounded-[20px] rounded-br-md bg-jade px-5 py-3 text-[22px] font-semibold text-white shadow-[0_20px_30px_-20px_rgb(16_24_20/.5)]" style={{ animationDelay: "-1.6s" }}>मराठी</span>
          <span className="bento-bob absolute bottom-0 left-8 rounded-[20px] rounded-bl-md bg-saffron px-5 py-3 text-[22px] font-semibold text-white shadow-[0_20px_30px_-20px_rgb(16_24_20/.5)]" style={{ animationDelay: "-3.2s" }}>हिंदी</span>
        </div>
      );
    case "payfirst":
      return (
        <Panel className="mx-auto w-[250px] space-y-3">
          {[["Pay first", true], ["Pay at the end", false]].map(([t, on]) => (
            <div key={t as string} className="flex items-center text-[13.5px] font-semibold">
              {t}
              <span className={clsx("ml-auto flex h-6 w-11 items-center rounded-full p-0.5", on ? "justify-end bg-jade" : "bg-black/10")}><span className="h-5 w-5 rounded-full bg-white shadow" /></span>
            </div>
          ))}
        </Panel>
      );
    case "columns":
      return (
        <div className="mx-auto grid w-full max-w-[420px] grid-cols-3 gap-2.5">
          {[["New", "border-t-saffron", 2], ["Cooking", "border-t-jade", 3], ["Ready", "border-t-ink", 1]].map(([t, c, n]) => (
            <div key={t as string} className={clsx("rounded-[16px] border-t-4 bg-white p-2.5 ring-1 ring-black/[.05]", c)}>
              <div className="text-[11.5px] font-semibold">{t} <span className="text-ink/40">{n}</span></div>
              {Array.from({ length: n as number }).map((_, i) => (
                <div key={i} className="mt-2 rounded-[10px] bg-[#f4f5f3] p-2"><div className="h-1.5 w-[70%] rounded-full bg-ink/25" /><div className="mt-1.5 h-1.5 w-[45%] rounded-full bg-ink/15" /></div>
              ))}
            </div>
          ))}
        </div>
      );
    case "stations":
      return (
        <div className="mx-auto flex max-w-[260px] flex-wrap justify-center gap-2">
          {[["Kitchen", 4], ["Tandoor", 2], ["Bar", 3], ["Desserts", 1]].map(([s, n], i) => (
            <span key={s as string} className={clsx("inline-flex h-10 items-center gap-2 rounded-full pl-4 pr-1.5 text-[13.5px] font-semibold", i === 1 ? "bg-ink text-white" : "bg-white ring-1 ring-black/[.07]")}>
              {s}<span className={clsx("flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[12px]", i === 1 ? "bg-white/15" : "bg-jade-soft text-jade-deep")}>{n}</span>
            </span>
          ))}
        </div>
      );
    case "voice":
      return (
        <div className="mx-auto w-[250px]">
          <div className="flex h-20 items-center justify-center gap-1.5">
            {[30, 60, 90, 50, 75, 100, 55, 80, 40, 65, 30].map((h, i) => (
              <span key={i} className="bento-bar w-2 rounded-full bg-jade" style={{ height: `${h}%`, animationDelay: `${i * 0.06}s` }} />
            ))}
          </div>
          <Panel className="mt-3 py-3 text-center text-[13.5px] font-semibold">“Table 6 — 2 Paneer Tikka”</Panel>
        </div>
      );
    case "timer":
      return (
        <div className="relative mx-auto w-[220px]">
          <KotTicket className="mx-auto w-[200px]" />
          <span className="bento-bob absolute -right-1 -top-4 rounded-full bg-rose px-3 py-1.5 text-[13px] font-bold text-white shadow-lg">24′</span>
        </div>
      );
    case "anyscreen":
      return (
        <div className="mx-auto flex items-end justify-center gap-4">
          <div className="h-[150px] w-[230px] rounded-[16px] bg-ink p-1.5"><div className="h-full rounded-[11px] bg-[linear-gradient(180deg,#1f2a25,#0f1512)] p-2"><div className="grid h-full grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <div key={i} className="rounded-md bg-white/10" />)}</div></div></div>
          <div className="h-[110px] w-[150px] rounded-[14px] bg-ink p-1.5"><div className="h-full rounded-[9px] bg-white/10" /></div>
          <div className="h-[90px] w-[50px] rounded-[12px] bg-ink p-1"><div className="h-full rounded-[8px] bg-white/10" /></div>
        </div>
      );
    case "token":
      return (
        <Panel className="mx-auto w-[200px] text-center">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink/50">Your token</div>
          <div className="mt-1 text-[64px] font-semibold leading-none tracking-tighter text-jade tnum">42</div>
          <div className="mt-2 text-[12px] text-ink/55">We’ll tell you when it’s ready</div>
        </Panel>
      );
    case "ready":
      return (
        <div className="mx-auto w-[260px] space-y-2.5">
          <div className="bento-bob flex items-center gap-3 rounded-[20px] bg-ink p-3.5 text-white shadow-[0_24px_40px_-20px_rgb(16_24_20/.6)]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-jade"><Tick /></span>
            <div><div className="text-[14px] font-semibold">Order #42 is ready!</div><div className="text-[12px] text-white/60">Collect at the counter</div></div>
          </div>
          <div className="mx-3 rounded-[16px] bg-white/80 p-2.5 text-center text-[13px] font-semibold ring-1 ring-black/[.05]">ऑर्डर तयार आहे!</div>
        </div>
      );
    case "stamps":
      return <Stamps n={5} big />;
    case "recipe":
      return (
        <Panel className="mx-auto w-[260px]">
          <div className="flex items-center gap-2.5"><span className="h-10 w-10 rounded-full" style={{ background: "radial-gradient(circle,hsl(28 70% 60%) 0 45%,hsl(28 40% 88%) 46%)" }} /><div><div className="text-[14px] font-semibold">Paneer Tikka</div><div className="text-[11.5px] text-ink/50">1 plate uses</div></div></div>
          {[["Paneer", "150 g"], ["Curd", "40 g"], ["Butter", "15 g"]].map(([a, b]) => (
            <div key={a} className="mt-2 flex items-center rounded-[10px] bg-[#f4f5f3] px-3 py-2 text-[13px]">{a}<b className="ml-auto tnum">− {b}</b></div>
          ))}
        </Panel>
      );
    case "count":
      return (
        <Panel className="mx-auto w-[250px]">
          <div className="text-[13px] font-semibold">Paneer · count</div>
          <div className="mt-3 space-y-2.5 text-[12.5px]">
            <div><div className="flex justify-between"><span className="text-ink/55">Recipes said</span><b>2.4 kg</b></div><div className="mt-1 h-2 rounded-full bg-jade/15"><div className="bento-fill h-full w-[80%] rounded-full bg-jade/50" /></div></div>
            <div><div className="flex justify-between"><span className="text-ink/55">Counted</span><b>2.1 kg</b></div><div className="mt-1 h-2 rounded-full bg-saffron/15"><div className="bento-fill h-full w-[70%] rounded-full bg-saffron" style={{ animationDelay: ".2s" }} /></div></div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-jade-deep"><Tick /> Learned. Forecast updated.</div>
        </Panel>
      );
    case "forecast":
      return (
        <Panel className="mx-auto w-[260px]">
          <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold">Paneer</span><span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[11px] font-bold text-saffron">Lasts 2 days</span></div>
          <Bars v={[40, 55, 48, 62, 70, 92, 80]} hi={6} className="mt-3 h-24" />
          <div className="mt-1.5 flex justify-between text-[10.5px] text-ink/45"><span>Mon</span><span>Sat</span><b className="text-saffron">Tomorrow</b></div>
        </Panel>
      );
    case "buylist":
      return (
        <div className="mx-auto w-[260px] rounded-[20px] bg-[#e7f7ee] p-3 shadow-[0_24px_40px_-24px_rgb(16_24_20/.35)]">
          <div className="ml-auto w-[88%] rounded-[16px] rounded-br-md bg-white p-3 text-[12.5px] leading-relaxed shadow-sm">
            <b>To buy · Sharma Dairy</b>
            <div>Paneer — 3 kg</div><div>Curd — 2 kg</div><div>Butter — 1 kg</div>
            <div className="mt-1 text-right text-[10px] text-ink/40">9:40 ✓✓</div>
          </div>
        </div>
      );
    case "map":
      return (
        <div className="relative mx-auto h-[200px] w-[260px]">
          <svg viewBox="0 0 260 200" className="absolute inset-0 h-full w-full" aria-hidden>
            <path className="bento-line" pathLength={1} d="M70 40 C 110 70, 120 90, 140 110 S 180 160, 200 168" fill="none" stroke="rgb(var(--jade))" strokeWidth="2.5" strokeDasharray="1" strokeLinecap="round" />
          </svg>
          {[["Pune", "left-[46px] top-[22px]", true], ["Satara", "left-[120px] top-[92px]", false], ["Kolhapur", "left-[176px] top-[150px]", false]].map(([n, pos, main]) => (
            <span key={n as string} className={clsx("absolute flex items-center gap-1.5", pos as string)}>
              <span className={clsx("h-4 w-4 rounded-full ring-4", main ? "bg-saffron ring-saffron/25" : "bg-jade ring-jade/20")} />
              <span className="rounded-full bg-white px-2.5 py-1 text-[12.5px] font-semibold shadow-sm ring-1 ring-black/[.05]">{n}</span>
            </span>
          ))}
        </div>
      );
    case "setup":
      return (
        <Panel className="mx-auto w-[240px] space-y-2.5">
          {["Menu added", "Tables & QR", "Staff PINs", "First bill"].map((t) => (
            <div key={t} className="flex items-center gap-2.5 text-[13.5px] font-semibold"><Tick />{t}</div>
          ))}
        </Panel>
      );
    case "support":
      return (
        <div className="mx-auto w-[250px] space-y-2 rounded-[20px] bg-[#e7f7ee] p-3">
          <div className="w-[80%] rounded-[14px] rounded-bl-md bg-white px-3 py-2 text-[12.5px] shadow-sm">नवीन डिश कशी add करायची?</div>
          <div className="ml-auto w-[80%] rounded-[14px] rounded-br-md bg-jade px-3 py-2 text-[12.5px] text-white shadow-sm">Menu → + Dish. मी दाखवतो 👍</div>
        </div>
      );
    case "allinone":
      return (
        <div className="mx-auto grid w-full max-w-[420px] grid-cols-3 gap-2.5">
          {[[IconBill, "Billing"], [IconKitchen, "Kitchen"], [IconTable, "Tables"], [IconStock, "Stock"], [IconTeam, "Staff"], [IconReports, "Reports"]].map(([I, t]) => {
            const Ico = I as typeof IconBill;
            return (
              <div key={t as string} className="group flex flex-col items-center gap-1.5 rounded-[16px] bg-white py-3.5 text-[12.5px] font-semibold ring-1 ring-black/[.05]">
                <Ico size={28} className="text-jade" />{t as string}
              </div>
            );
          })}
        </div>
      );
  }
}

function Stamps({ n, big = false }: { n: number; big?: boolean }) {
  return (
    <div className={clsx("mx-auto rounded-[18px] bg-white p-3 ring-1 ring-black/[.05]", big ? "w-[250px]" : "w-full")}>
      {big && <div className="mb-2 text-[12.5px] font-semibold">Coffee card · {n}/6</div>}
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={clsx("flex aspect-square items-center justify-center rounded-full text-[11px] font-bold", i < n ? "bg-saffron text-white" : i === 5 ? "bg-jade-soft text-jade-deep ring-1 ring-dashed ring-jade/40" : "bg-black/[.05]")}>
            {i === 5 ? "Free" : i < n ? "✓" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- hero pictures: a real screen + floating cards ---------- */
const Float = ({ children, className, delay = 0 }: { children: ReactNode; className: string; delay?: number }) => (
  <div className={clsx("absolute z-10 origin-center max-sm:scale-[.82]", className)}><div className="bento-bob" style={{ animationDelay: `${delay}s` }}>{children}</div></div>
);
const Toast = ({ children, tone = "jade" }: { children: ReactNode; tone?: "jade" | "saffron" | "ink" }) => (
  <div className={clsx("flex items-center gap-2 whitespace-nowrap rounded-full py-2 pl-2 pr-4 text-[13px] font-semibold shadow-[0_20px_40px_-16px_rgb(0_0_0/.5)]", tone === "ink" ? "bg-ink text-white ring-1 ring-white/10" : "bg-white text-ink")}>
    <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-white", tone === "saffron" ? "bg-saffron" : "bg-jade")}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
    </span>
    {children}
  </div>
);

export function HeroVisual({ art }: { art: HeroArt }) {
  const wrap = "relative mx-auto h-[390px] w-[340px] sm:h-[500px] sm:w-[440px]";
  const phone = "absolute left-1/2 top-0 -translate-x-1/2 w-[220px] sm:w-[260px]";
  switch (art) {
    case "billing":
      return (
        <div className={wrap}>
          <Phone shot="bill" alt="Restropi bill with GST and discount" className={phone} priority />
          <Float className="-left-2 top-16 sm:left-0" delay={-1}><Receipt className="w-[150px] rotate-[-6deg]" /></Float>
          <Float className="-right-2 bottom-6 sm:right-0" delay={-2.5}><UpiCard amount="₹1,218" className="w-[136px]" /></Float>
        </div>
      );
    case "qr":
      return (
        <div className={wrap}>
          <Phone shot="guest" alt="Restropi QR menu on a guest's phone" className={phone} priority />
          <Float className="-left-6 top-28 sm:left-0" delay={-1}><VizArt viz="qrtent" /></Float>
          <Float className="-right-3 bottom-16 sm:right-0" delay={-2.5}><Toast>Sent to kitchen</Toast></Float>
        </div>
      );
    case "kot":
      return (
        <div className={wrap}>
          <Phone shot="kitchen" alt="Restropi kitchen screen with order tickets" className={phone} priority />
          <Float className="-right-3 top-20 sm:right-0" delay={-1}><KotTicket /></Float>
          <Float className="-left-3 bottom-20 sm:left-0" delay={-2.5}><Toast tone="ink">🔊 Read aloud</Toast></Float>
        </div>
      );
    case "cafe":
      return (
        <div className={wrap}>
          <Phone shot="guest" alt="Restropi café menu on a guest's phone" className={phone} priority />
          <Float className="-left-3 top-20 sm:left-0" delay={-1}><Panel className="w-[120px] p-3 text-center"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/50">Token</div><div className="text-[44px] font-semibold leading-none text-jade">42</div></Panel></Float>
          <Float className="-right-3 bottom-16 sm:right-0" delay={-2.5}><Toast tone="saffron">Order #42 is ready!</Toast></Float>
        </div>
      );
    case "stock":
      return (
        <div className="relative mx-auto flex h-[400px] w-[340px] items-center justify-center sm:h-[480px] sm:w-[440px]">
          <div className="w-[290px] rounded-[28px] bg-white p-5 text-ink shadow-[0_50px_80px_-30px_rgb(0_0_0/.6)] sm:w-[320px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/45">Stock</div>
            {[["Paneer", "2.1 kg", "2 days", 30, "bg-saffron"], ["Butter", "4.0 kg", "6 days", 70, "bg-jade"], ["Rice", "18 kg", "9 days", 85, "bg-jade"], ["Curd", "1.2 kg", "1 day", 18, "bg-rose"]].map(([n, q, d, w, c]) => (
              <div key={n as string} className="mt-3.5">
                <div className="flex items-baseline text-[14px] font-semibold">{n}<span className="ml-2 text-[12px] font-normal text-ink/45">{q}</span><span className="ml-auto text-[12px] text-ink/55">lasts {d}</span></div>
                <div className="mt-1.5 h-2 rounded-full bg-black/[.06]"><div className={clsx("h-full rounded-full", c as string)} style={{ width: `${w}%` }} /></div>
              </div>
            ))}
          </div>
          <Float className="-right-2 top-6 sm:right-2" delay={-1.5}><Toast tone="saffron">Order paneer today</Toast></Float>
          <Float className="-left-2 bottom-8 sm:left-2" delay={-3}><Toast>−150 g · Paneer Tikka sold</Toast></Float>
        </div>
      );
    case "pune":
      return (
        <div className={wrap}>
          <Phone shot="tables" alt="Restropi tables screen" className={phone} priority />
          <Float className="-left-3 top-20 sm:left-0" delay={-1}><Toast tone="saffron">Pune · Satara · Kolhapur</Toast></Float>
          <Float className="-right-3 bottom-20 sm:right-0" delay={-2.5}><div className="rounded-[18px] bg-jade px-4 py-2.5 text-[20px] font-semibold text-white shadow-lg">मराठी</div></Float>
        </div>
      );
  }
}
