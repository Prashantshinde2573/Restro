import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ChefHat,
  LayoutGrid,
  Mic,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  UserRound,
  CalendarRange,
  QrCode,
  MessageCircle,
  WifiOff,
} from "lucide-react";
import { Wordmark } from "@/components/shell";
import { PricingTable } from "@/components/pricing";

const included = [
  { icon: ReceiptText, t: "Billing", d: "GST bills, UPI QR for the exact amount, cash, card, discounts, KOTs." },
  { icon: LayoutGrid, t: "Tables and QR", d: "Live floor, waitlist, bookings, and guests ordering from their phone." },
  { icon: ChefHat, t: "Kitchen screen", d: "Tickets by station, timers, and a ‘to cook’ count for the chef." },
  { icon: Boxes, t: "Stock", d: "Recipes deduct stock as you sell. Purchase orders go out on WhatsApp." },
  { icon: UserRound, t: "Team", d: "PIN clock-in, rota, payroll from real hours, and tip sharing." },
  { icon: Users, t: "Guests", d: "Who comes back, what they order, birthdays, loyalty points." },
  { icon: BarChart3, t: "Reports and GST", d: "Profit and loss, day close, GSTR-1 and 3B files for your CA." },
];

const only = [
  { icon: Sparkles, t: "A morning note, not a dashboard", d: "Restro Pulse tells you in two sentences what happened yesterday and the three things to do today." },
  { icon: Mic, t: "Take orders by voice", d: "Captains say the order in Marathi, Hindi or English. Restro turns it into a KOT." },
  { icon: QrCode, t: "Every guest pays their own share", d: "Split-by-guest UPI from the table QR. No calculator, no arguments at the counter." },
  { icon: CalendarRange, t: "Know tomorrow's rush today", d: "A prep list and supplier orders based on your sales, the day, festivals and weather." },
  { icon: ShieldCheck, t: "Leak guard", d: "Flags voids after KOT, cash shortfalls, discount spikes and stock used beyond the recipe." },
  { icon: Star, t: "More Google reviews, fewer bad ones", d: "Happy guests get a review link. Unhappy ones reach you privately first." },
  { icon: MessageCircle, t: "WhatsApp everything", d: "E-bills, waitlist alerts, supplier orders, payslips and win-back offers." },
  { icon: WifiOff, t: "Keeps billing when the internet drops", d: "Orders and bills keep working offline and sync when you are back." },
];

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[300px] rounded-[48px] bg-ink p-3 shadow-[0_40px_80px_-30px_rgb(16_24_20/0.45)] lg:w-[330px]">
      <div className="overflow-hidden rounded-[38px] bg-canvas">
        <div className="flex justify-center pt-2"><span className="h-6 w-24 rounded-full bg-ink" /></div>
        <div className="px-4 pb-5 pt-3">
          <div className="text-[22px] font-semibold tracking-tight">Good evening</div>
          <div className="text-[12px] text-muted">Tuesday · Baner, Pune</div>
          <div className="relative mt-3 overflow-hidden rounded-[20px] bg-ink p-4 text-canvas">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-saffron/30 blur-2xl" />
            <div className="relative text-[11px] font-semibold text-saffron">Restro Pulse</div>
            <p className="relative mt-1.5 text-[14px] font-medium leading-snug">
              Lunch beat a normal Tuesday by 14%. Order paneer before 5 — you&apos;ll run out around 8:30.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[16px] bg-line/70">
            {[["Sales", "₹38,650"], ["Orders", "64"]].map(([l, v]) => (
              <div key={l} className="bg-surface p-3">
                <div className="text-[11px] text-muted">{l}</div>
                <div className="text-[18px] font-semibold tnum">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 overflow-hidden rounded-[16px] bg-surface">
            {[["Table T4", "Wants the bill", "bg-saffron"], ["Swiggy #88213", "New order", "bg-sky"], ["Table R1", "Cooking · 14 min", "bg-jade"]].map(([a, b, c]) => (
              <div key={a} className="flex items-center gap-2.5 border-b border-line/80 px-3 py-2.5 last:border-0">
                <span className={`h-2 w-2 rounded-full ${c}`} />
                <span className="flex-1 text-[13px] font-medium">{a}</span>
                <span className="text-[11.5px] text-muted">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 lg:px-6">
          <Link href="/"><Wordmark className="text-[19px]" /></Link>
          <nav className="hidden flex-1 gap-6 text-[14.5px] text-muted md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <Link href="/order/T3" className="hover:text-ink">Guest QR demo</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-ctl px-3 py-2 text-[14.5px] font-semibold hover:bg-sunken">Sign in</Link>
            <Link href="/onboarding" className="rounded-ctl bg-jade px-4 py-2 text-[14.5px] font-semibold text-white hover:bg-jade-deep">Try free</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 lg:grid-cols-[1.15fr_1fr] lg:px-6 lg:pb-24 lg:pt-20">
        <div>
          <h1 className="text-[42px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[56px] lg:text-[68px]">
            Run the whole restaurant from one calm screen.
          </h1>
          <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-muted">
            Billing, kitchen, tables, stock, staff and guests — for cafés, restaurants and cloud kitchens. Every morning Restro tells you what to fix, in plain words.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboarding" className="flex h-14 items-center rounded-[14px] bg-jade px-6 text-[17px] font-semibold text-white hover:bg-jade-deep">Start 14-day free trial</Link>
            <Link href="/app" className="flex h-14 items-center rounded-[14px] bg-surface px-6 text-[17px] font-semibold hover:bg-sunken">See the live demo</Link>
          </div>
          <p className="mt-4 text-[13.5px] text-muted">Set up in 20 minutes. Works on the phone, tablet and laptop you already have.</p>
        </div>
        <PhoneMock />
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <h2 className="max-w-2xl text-[32px] font-semibold leading-tight tracking-tight lg:text-[40px]">One app instead of five.</h2>
        <p className="mt-3 max-w-2xl text-[17px] text-muted">Everything your billing software, kitchen printer, stock register, attendance book and WhatsApp groups do today — in one place, talking to each other.</p>
        <div className="mt-10 overflow-hidden rounded-[24px] bg-surface">
          <div className="grid md:grid-cols-2">
            {included.map((f) => (
              <div key={f.t} className="flex gap-4 border-b border-line/80 p-5 md:[&:nth-child(odd)]:border-r lg:p-6">
                <f.icon size={22} className="mt-0.5 shrink-0 text-jade" />
                <div>
                  <div className="text-[16px] font-semibold">{f.t}</div>
                  <div className="mt-0.5 text-[14.5px] text-muted">{f.d}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 border-b border-line/80 bg-jade-soft/60 p-5 lg:p-6">
              <span className="text-[15px] font-medium text-jade-deep">Plus Swiggy and Zomato orders on the same screen, multiple outlets, and English, मराठी, हिंदी.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink py-20 text-canvas">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <h2 className="max-w-2xl text-[32px] font-semibold leading-tight tracking-tight lg:text-[40px]">Things your current software doesn&apos;t do.</h2>
          <div className="mt-12 grid gap-x-10 gap-y-9 md:grid-cols-2">
            {only.map((f) => (
              <div key={f.t} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[.08] text-saffron">
                  <f.icon size={20} />
                </span>
                <div>
                  <div className="text-[17px] font-semibold">{f.t}</div>
                  <div className="mt-1 text-[15px] leading-relaxed text-canvas/65">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
        <h2 className="text-center text-[32px] font-semibold tracking-tight lg:text-[40px]">Simple pricing, per outlet.</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[17px] text-muted">Every plan includes unlimited bills, free updates and WhatsApp support in Marathi, Hindi and English.</p>
        <div className="mt-10">
          <PricingTable />
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-[14px] text-muted sm:flex-row sm:items-center lg:px-6">
          <Wordmark className="text-[16px] text-ink" />
          <span className="sm:ml-auto">Made in Pune for Indian restaurants.</span>
          <Link href="/admin" className="hover:text-ink">Admin</Link>
        </div>
      </footer>
    </div>
  );
}
