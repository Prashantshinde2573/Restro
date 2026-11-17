"use client";

import { useEffect, useState } from "react";
import { ThankYou } from "@/components/guest-pay";
import { FullLoader } from "@/components/loader";
import { tx, type GuestLang as Lang } from "@/lib/guest-lang";
import { cloudConfigured, feedbackActions } from "@/lib/live";
import { guestStampsFor, guestUpsert } from "@/lib/cloud";
import { StampCard } from "@/components/stamps";
import { liveStamps } from "@/lib/stamps";
import type { Stamp, StampProgram } from "@/lib/types";
import { useParams } from "next/navigation";
import { QrCode } from "lucide-react";
import type { Payment } from "@/lib/types";

type Saved = { place: string; logo: string; name: string; payments: Payment[]; orderNo: number; lang: Lang; rid: string; at: number; stampProg?: StampProgram; stampsHave?: number | null; outletId?: string };

/**
 * After the bill is paid the guest lands here, on its own page. The menu is closed for this visit:
 * going back brings them here again, and ordering again needs a fresh scan of the table QR.
 */
export default function GuestThanks() {
  const params = useParams<{ table: string }>();
  const table = decodeURIComponent(params?.table ?? "").toUpperCase();
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`restropi.thanks.${table}`);
      setSaved(raw ? (JSON.parse(raw) as Saved) : null);
    } catch {
      setSaved(null);
    }
  }, [table]);

  // the stamp for this bill is added when the restaurant takes the money: look a few times
  const [have, setHave] = useState<number | null>(null);
  useEffect(() => {
    const prog = saved?.stampProg;
    if (!saved || !prog) return;
    if (saved.stampsHave != null) setHave(saved.stampsHave);
    let live = true;
    const load = () =>
      guestStampsFor(saved.rid).then((r) => {
        if (live && r) setHave(r.stamps.length ? liveStamps({ stamps: r.stamps as Stamp[] }, prog).length : r.rewards ? 0 : null);
      }).catch(() => {});
    void load();
    const ts = [2500, 7000, 15000, 30000].map((ms) => window.setTimeout(load, ms));
    return () => {
      live = false;
      ts.forEach((t) => window.clearTimeout(t));
    };
  }, [saved]);

  if (saved === undefined) return <FullLoader label="Thank you" />;

  if (!saved) {
    let lang: Lang = "en";
    try {
      const l = localStorage.getItem("restropi.guestLang");
      if (l === "mr" || l === "hi") lang = l;
    } catch {}
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-jade-soft text-jade-deep"><QrCode size={30} /></span>
        <h1 className="mt-5 text-[26px] font-semibold tracking-tight">{tx(lang, "Thank you!", "धन्यवाद!")}</h1>
        <p className="mt-2 text-[15px] text-muted">{tx(lang, "Want to order again? Scan the QR on your table.", "पुन्हा ऑर्डर करायची आहे? टेबलवरचा QR पुन्हा स्कॅन करा.")}</p>
      </main>
    );
  }

  return (
    <ThankYou
      closed
      name={saved.name || undefined}
      place={saved.place}
      payments={saved.payments ?? []}
      orderNo={saved.orderNo || undefined}
      lang={saved.lang ?? "en"}
      stamp={saved.stampProg && have != null ? (
        <StampCard
          compact
          className="mt-4"
          have={have}
          needed={saved.stampProg.needed}
          reward={saved.stampProg.reward}
          title={tx(saved.lang ?? "en", "Your stamp card", "तुमचं स्टॅम्प कार्ड")}
          note={have >= saved.stampProg.needed ? tx(saved.lang ?? "en", "Card full! Use it on your next bill.", "कार्ड भरलं! पुढच्या बिलावर वापरा.") : tx(saved.lang ?? "en", `${saved.stampProg.needed - have} more for ${saved.stampProg.reward}`, `${saved.stampProg.reward} साठी अजून ${saved.stampProg.needed - have}`)}
        />
      ) : undefined}
      onRate={(stars, text) => {
        const f = { customer: saved.name || "Guest", stars, text: text || (stars >= 4 ? "Loved it" : "Not happy"), routed: (stars >= 4 ? "google" : "private") as "google" | "private", ...(saved.outletId ? { outletId: saved.outletId } : {}) };
        if (cloudConfigured && saved.rid) {
          const id = `f${Date.now()}`;
          guestUpsert(saved.rid, id, { ...f, id, at: new Date().toISOString() }, "feedback");
        } else feedbackActions.add(f);
      }}
    />
  );
}
