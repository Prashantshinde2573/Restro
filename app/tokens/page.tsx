"use client";

// "Now serving": the token screen for a TV or tablet at the counter (self-service outlets).
// Two columns for the outlet on screen: Preparing and Ready. A token moves to Ready when the
// kitchen marks it ready (with a sound), and leaves when staff tap Picked up (here, on the
// Orders screen, or by tapping it on this screen when it's a touch screen).
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCloud } from "@/lib/cloud";
import { orderActions, useAccount, useCan, useCurrentOutlet, useOrders } from "@/lib/live";
import { playSound, unlockSound } from "@/components/sound";
import type { Order } from "@/lib/types";

const HOURS_12 = 12 * 3600_000;

export default function TokensScreen() {
  const cloud = useCloud();
  const router = useRouter();
  const account = useAccount();
  const outlet = useCurrentOutlet();
  const all = useOrders();
  const canServe = useCan("orders");
  const [, tick] = useState(0);

  useEffect(() => {
    if (cloud.status === "signedOut") router.replace("/login");
  }, [cloud.status, router]);
  // keep "today" fresh on a screen that stays open all day
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // counter tokens of this outlet (no table), from the last 12 hours
  const tokens = useMemo(() => {
    const since = Date.now() - HOURS_12;
    return all
      .filter((o) => (!outlet.id || o.outletId === outlet.id) && !o.tableId && !o.tableName && new Date(o.createdAt).getTime() > since)
      .sort((a, b) => (a.number || 0) - (b.number || 0));
  }, [all, outlet.id]);
  const preparing = tokens.filter((o) => o.status === "accepted" || o.status === "preparing");
  const ready = tokens.filter((o) => o.status === "ready");

  // a sound when a token turns ready
  const seen = useRef<Set<string> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    const ids = new Set(ready.map((o) => o.id));
    if (seen.current === null) {
      seen.current = ids;
      return;
    }
    const fresh = ready.filter((o) => !seen.current!.has(o.id));
    seen.current = ids;
    if (fresh.length) {
      playSound("bell");
      setFlash(fresh[fresh.length - 1].id);
      const t = window.setTimeout(() => setFlash(null), 6000);
      return () => window.clearTimeout(t);
    }
  }, [ready]);

  const pickedUp = (o: Order) => {
    if (!canServe) return;
    orderActions.setStatus(o.id, "served");
  };
  const fullScreen = () => {
    unlockSound();
    void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const big = ready.length + preparing.length <= 12;

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0f0d] text-white" onPointerDown={() => unlockSound()}>
      <header className="flex items-center gap-3 px-5 py-4 lg:px-8">
        <Link href="/app/orders" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10"><ChevronLeft size={22} /></Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[20px] font-bold lg:text-[26px]">{account.name || "Restropi"}{outlet.name ? ` · ${outlet.name}` : ""}</div>
          <div className="text-[13px] text-white/60 lg:text-[15px]">Now serving · आता देत आहोत</div>
        </div>
        <button onClick={fullScreen} className="flex h-10 items-center gap-2 rounded-full px-3 text-[14px] font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/10">
          <Maximize2 size={16} /> Full screen
        </button>
      </header>
      <main className="grid flex-1 grid-cols-1 gap-4 px-5 pb-6 md:grid-cols-[1fr_1.3fr] lg:px-8">
        <section className="rounded-[28px] bg-white/[0.06] p-5 lg:p-7">
          <h2 className="mb-4 text-[18px] font-bold uppercase tracking-wider text-white/70 lg:text-[24px]">Preparing <span className="text-white/40">· तयार होत आहे</span></h2>
          {!preparing.length ? (
            <p className="text-[16px] text-white/40">No tokens</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {preparing.map((o) => (
                <span key={o.id} className={clsx("flex items-center justify-center rounded-[18px] bg-white/10 font-extrabold tnum text-white/85", big ? "h-20 min-w-[96px] px-4 text-[44px] lg:h-28 lg:min-w-[130px] lg:text-[64px]" : "h-14 min-w-[70px] px-3 text-[30px]")}>{o.number || "…"}</span>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-[28px] bg-[#0e7a5f]/25 p-5 ring-2 ring-[#19c08f]/40 lg:p-7">
          <h2 className="mb-4 text-[18px] font-bold uppercase tracking-wider text-[#5ef0c2] lg:text-[24px]">Ready <span className="text-[#5ef0c2]/60">· तयार आहे, काउंटरवरून घ्या</span></h2>
          {!ready.length ? (
            <p className="text-[16px] text-white/40">No tokens</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {ready.map((o) => (
                <button
                  key={o.id}
                  onClick={() => pickedUp(o)}
                  title={canServe ? "Tap when picked up" : undefined}
                  className={clsx(
                    "flex items-center justify-center rounded-[20px] bg-[#19c08f] font-extrabold tnum text-[#04241b] transition",
                    big ? "h-24 min-w-[120px] px-5 text-[56px] lg:h-36 lg:min-w-[170px] lg:text-[88px]" : "h-16 min-w-[84px] px-4 text-[36px]",
                    flash === o.id && "animate-pulse ring-8 ring-white/70",
                  )}
                >
                  {o.number || "…"}
                </button>
              ))}
            </div>
          )}
          {ready.length > 0 && canServe && <p className="mt-4 text-[13px] text-white/50">Tap a token when it is picked up.</p>}
        </section>
      </main>
    </div>
  );
}
