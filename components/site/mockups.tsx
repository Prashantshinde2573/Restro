// Product pictures for the website, drawn in HTML/CSS (sharp at any size,
// no image downloads). They show Restro's real screens in miniature.
import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";

export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="11" fill="rgb(var(--jade))" />
      <path d="M8 17V7.5h4.6a3 3 0 0 1 .4 6L16 17" stroke="white" strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Brand({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <Logo />
      Restro
    </span>
  );
}

const Veg = ({ non = false }: { non?: boolean }) => (
  <span className={clsx("flex h-[11px] w-[11px] shrink-0 items-center justify-center rounded-[2px] border", non ? "border-rose" : "border-jade")}>
    <span className={clsx("h-[5px] w-[5px] rounded-full", non ? "bg-rose" : "bg-jade")} />
  </span>
);

/** A dish "photo": soft gradient plate, so no stock photos are needed. */
export function Plate({ hue, className }: { hue: number; className?: string }) {
  return (
    <span
      className={clsx("relative block overflow-hidden", className)}
      style={{ background: `radial-gradient(circle at 50% 55%, hsl(${hue} 70% 62%) 0 34%, hsl(${hue} 55% 42%) 35% 40%, #f7f5f0 41% 58%, hsl(${hue} 25% 88%) 59%)` }}
    >
      <span className="absolute left-[28%] top-[30%] h-[18%] w-[22%] rounded-full bg-white/40 blur-[2px]" />
    </span>
  );
}

/* ---------------- guest phone: the QR menu ---------------- */
export function PhoneMenu({ className, style }: { className?: string; style?: CSSProperties }) {
  const dishes: [string, string, number, boolean][] = [
    ["Paneer Tikka", "₹280", 28, false],
    ["Butter Chicken", "₹360", 14, true],
    ["Dal Makhani", "₹240", 32, false],
    ["Butter Naan", "₹60", 40, false],
  ];
  return (
    <div className={clsx("w-[230px] rounded-[40px] bg-ink p-[9px] shadow-[0_50px_80px_-30px_rgb(16_24_20/.55)]", className)} style={style}>
      <div className="overflow-hidden rounded-[32px] bg-canvas">
        <div className="flex justify-center pt-2"><span className="h-[18px] w-[72px] rounded-full bg-ink" /></div>
        <div className="px-3 pb-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">Saffron Lane</span>
            <span className="rounded-full bg-jade-soft px-2 py-0.5 text-[9.5px] font-semibold text-jade-deep">Table T4</span>
          </div>
          <div className="mt-2 flex h-7 items-center rounded-full bg-surface px-3 text-[10px] text-faint ring-1 ring-line">Search menu</div>
          <div className="mt-2 flex gap-2">
            <div className="flex w-[52px] shrink-0 flex-col gap-1.5 text-[9px] font-medium">
              {["Starters", "Mains", "Breads", "Drinks"].map((c, i) => (
                <span key={c} className={clsx("rounded-lg px-1.5 py-1.5 text-center", i === 0 ? "bg-ink text-canvas" : "bg-surface text-muted")}>{c}</span>
              ))}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden rounded-xl bg-surface">
              {dishes.map(([n, p, h, non]) => (
                <div key={n} className="flex items-center gap-2 border-b border-line/70 px-2 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Veg non={non} />
                    <div className="mt-1 truncate text-[10.5px] font-semibold leading-tight">{n}</div>
                    <div className="text-[10px] font-semibold tnum">{p}</div>
                  </div>
                  <div className="relative pb-2">
                    <Plate hue={h} className="h-11 w-11 rounded-lg" />
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-md bg-surface px-2 py-[2px] text-[8.5px] font-bold text-jade shadow ring-1 ring-line">ADD</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-2xl bg-jade px-3 py-2.5 text-white">
            <span className="text-[10px] font-medium">3 items · ₹980</span>
            <span className="text-[10.5px] font-semibold">Send order →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- counter tablet: the POS ---------------- */
export function TabletPOS({ className, style }: { className?: string; style?: CSSProperties }) {
  const tiles: [string, string, number][] = [
    ["Paneer Tikka", "₹280", 28], ["Veg Thali", "₹220", 46], ["Butter Chicken", "₹360", 14],
    ["Dal Makhani", "₹240", 32], ["Masala Chaas", "₹60", 160], ["Butter Naan", "₹60", 40],
  ];
  return (
    <div className={clsx("w-[560px] rounded-[30px] bg-ink p-[11px] shadow-[0_60px_100px_-40px_rgb(16_24_20/.6)]", className)} style={style}>
      <div className="grid grid-cols-[1fr_170px] overflow-hidden rounded-[21px] bg-canvas">
        <div className="p-3.5">
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span className="text-[12px] font-semibold">New order</span>
            <span className="ml-auto flex gap-1 text-[9.5px] font-medium">
              {["Dine-in", "Takeaway", "Delivery"].map((t, i) => (
                <span key={t} className={clsx("rounded-full px-2 py-0.5", i === 0 ? "bg-ink text-canvas" : "bg-surface text-muted")}>{t}</span>
              ))}
            </span>
          </div>
          <div className="mt-2.5 flex gap-1.5 text-[9.5px] font-medium">
            {["All", "Starters", "Mains", "Breads", "Drinks"].map((c, i) => (
              <span key={c} className={clsx("rounded-full px-2.5 py-1", i === 1 ? "bg-jade text-white" : "bg-surface")}>{c}</span>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {tiles.map(([n, p, h]) => (
              <div key={n} className="overflow-hidden rounded-xl bg-surface">
                <Plate hue={h} className="h-14 w-full" />
                <div className="px-2 py-1.5">
                  <div className="truncate text-[10px] font-semibold">{n}</div>
                  <div className="text-[9.5px] text-muted tnum">{p}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col border-l border-line bg-surface p-3">
          <div className="text-[11px] font-semibold">Table T4</div>
          <div className="text-[9px] text-muted">Party A · 2 guests</div>
          <div className="mt-2 flex-1 space-y-1.5 text-[9.5px]">
            {[["2× Paneer Tikka", "₹560"], ["1× Butter Chicken", "₹360"], ["4× Butter Naan", "₹240"], ["2× Masala Chaas", "₹120"]].map(([a, b]) => (
              <div key={a} className="flex justify-between"><span>{a}</span><span className="tnum text-muted">{b}</span></div>
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-[11px] font-semibold"><span>Total</span><span className="tnum">₹1,344</span></div>
          <div className="mt-2 rounded-lg bg-jade-soft py-1.5 text-center text-[10px] font-semibold text-jade-deep">Send to kitchen</div>
          <div className="mt-1.5 rounded-lg bg-jade py-1.5 text-center text-[10px] font-semibold text-white">Charge ₹1,344</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- paper bill ---------------- */
export function Receipt({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx("w-[170px] drop-shadow-[0_30px_30px_rgb(16_24_20/.22)]", className)} style={style}>
      <div className="bg-white px-3.5 pb-3 pt-3.5 font-mono text-[9px] leading-[1.45] text-ink">
        <div className="text-center text-[10.5px] font-bold">SAFFRON LANE</div>
        <div className="text-center text-[8px] text-muted">Baner, Pune · GSTIN 27ABCDE1234F1Z5</div>
        <div className="my-1.5 border-t border-dashed border-ink/40" />
        {[["Paneer Tikka ×2", "560.00"], ["Butter Chicken", "360.00"], ["Butter Naan ×4", "240.00"], ["Masala Chaas ×2", "120.00"]].map(([a, b]) => (
          <div key={a} className="flex justify-between"><span>{a}</span><span>{b}</span></div>
        ))}
        <div className="my-1.5 border-t border-dashed border-ink/40" />
        <div className="flex justify-between"><span>CGST 2.5%</span><span>32.00</span></div>
        <div className="flex justify-between"><span>SGST 2.5%</span><span>32.00</span></div>
        <div className="mt-1 flex justify-between text-[11px] font-bold"><span>TOTAL</span><span>₹1,344</span></div>
        <div className="mt-1.5 text-center text-[8.5px]">Paid · UPI ✓</div>
      </div>
      <div className="h-2.5 w-full" style={{ background: "linear-gradient(-45deg, transparent 33%, white 33% 66%, transparent 66%), linear-gradient(45deg, transparent 33%, white 33% 66%, transparent 66%)", backgroundSize: "10px 20px", backgroundPosition: "0 -10px" }} />
    </div>
  );
}

/* ---------------- UPI QR card ---------------- */
/** A QR-looking 21×21 grid (finder squares + fixed pattern) for the picture. */
const QR_BITS = (() => {
  const n = 21;
  const out: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const finder = (r: number, c: number) => {
    for (const [fr, fc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      const y = r - fr, x = c - fc;
      if (y >= 0 && y < 7 && x >= 0 && x < 7) return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) ? 1 : 0;
      if (y >= -1 && y <= 7 && x >= -1 && x <= 7) return 0;
    }
    return -1;
  };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const f = finder(r, c);
    out.push(f >= 0 ? f : rnd() > 0.52 ? 1 : 0);
  }
  return out.join("");
})();
export function UpiCard({ className, style, amount = "₹1,344" }: { className?: string; style?: CSSProperties; amount?: string }) {
  return (
    <div className={clsx("w-[150px] rounded-[22px] bg-surface p-3 shadow-[0_30px_50px_-20px_rgb(16_24_20/.35)] ring-1 ring-line", className)} style={style}>
      <div className="text-[9.5px] font-semibold text-muted">Scan to pay</div>
      <div className="text-[18px] font-semibold tracking-tight tnum">{amount}</div>
      <div className="mt-2 grid aspect-square grid-cols-[repeat(21,1fr)] gap-0 rounded-lg bg-white p-1.5 ring-1 ring-line">
        {QR_BITS.split("").map((b, i) => (
          <span key={i} className={b === "1" ? "bg-ink" : ""} />
        ))}
      </div>
      <div className="mt-2 text-center text-[8.5px] text-muted">Any UPI app · exact amount</div>
    </div>
  );
}

/* ---------------- kitchen ticket ---------------- */
export function KotTicket({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx("w-[160px] rounded-[18px] bg-surface p-3 shadow-[0_30px_50px_-20px_rgb(16_24_20/.35)] ring-1 ring-line", className)} style={style}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold">T4 · KOT</span>
        <span className="rounded-full bg-saffron-soft px-1.5 py-0.5 text-[8.5px] font-bold text-saffron">7 min</span>
      </div>
      <div className="mt-1.5 space-y-1 text-[10px]">
        <div><b>2×</b> Paneer Tikka <span className="text-saffron">· less spicy</span></div>
        <div><b>1×</b> Butter Chicken</div>
        <div><b>4×</b> Butter Naan</div>
      </div>
      <div className="mt-2 rounded-lg bg-jade py-1 text-center text-[9.5px] font-semibold text-white">Ready</div>
    </div>
  );
}

/* ---------------- the morning note ---------------- */
export function PulseNote({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={clsx("relative w-[250px] overflow-hidden rounded-[22px] bg-ink p-4 text-canvas shadow-[0_30px_60px_-24px_rgb(16_24_20/.6)]", className)} style={style}>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-saffron/30 blur-2xl" />
      <div className="relative flex items-center gap-1.5 text-[10px] font-semibold text-saffron">
        <span className="h-1.5 w-1.5 rounded-full bg-saffron" /> Restro Pulse
      </div>
      <p className="relative mt-1.5 text-[12.5px] font-medium leading-snug">
        {children ?? <>Lunch beat a normal Tuesday by 14%. Order paneer before 5 — you&apos;ll run out around 8:30.</>}
      </p>
    </div>
  );
}

/* ---------------- phone with the owner's day ---------------- */
export function PhoneOwner({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={clsx("w-[230px] rounded-[40px] bg-ink p-[9px] shadow-[0_50px_80px_-30px_rgb(16_24_20/.55)]", className)} style={style}>
      <div className="overflow-hidden rounded-[32px] bg-canvas">
        <div className="flex justify-center pt-2"><span className="h-[18px] w-[72px] rounded-full bg-ink" /></div>
        <div className="px-3 pb-4 pt-2">
          <div className="text-[16px] font-semibold tracking-tight">Good evening</div>
          <div className="text-[9.5px] text-muted">Tuesday · Baner, Pune</div>
          <PulseNote className="mt-2 !w-full !rounded-2xl !p-3 [&_p]:!text-[10.5px]" />
          <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line/70">
            {[["Sales", "₹38,650"], ["Orders", "64"]].map(([l, v]) => (
              <div key={l} className="bg-surface p-2">
                <div className="text-[9px] text-muted">{l}</div>
                <div className="text-[14px] font-semibold tnum">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 overflow-hidden rounded-xl bg-surface">
            {[["Table T4", "Wants the bill", "bg-saffron"], ["Table T7", "New QR order", "bg-sky"], ["Table R1", "Cooking · 14 min", "bg-jade"]].map(([a, b, c]) => (
              <div key={a} className="flex items-center gap-2 border-b border-line/80 px-2.5 py-2 last:border-0">
                <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
                <span className="flex-1 text-[10.5px] font-medium">{a}</span>
                <span className="text-[9px] text-muted">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
