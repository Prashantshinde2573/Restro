"use client";

import { useEffect, useState } from "react";
import { ThankYou } from "@/components/guest-pay";
import { FullLoader } from "@/components/loader";
import { tx, type GuestLang as Lang } from "@/lib/guest-lang";
import { cloudConfigured, feedbackActions } from "@/lib/live";
import { guestUpsert } from "@/lib/cloud";
import { useParams } from "next/navigation";
import { QrCode } from "lucide-react";
import type { Payment } from "@/lib/types";

type Saved = { place: string; logo: string; name: string; payments: Payment[]; orderNo: number; lang: Lang; rid: string; at: number };

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
      onRate={(stars, text) => {
        const f = { customer: saved.name || "Guest", stars, text: text || (stars >= 4 ? "Loved it" : "Not happy"), routed: (stars >= 4 ? "google" : "private") as "google" | "private" };
        if (cloudConfigured && saved.rid) {
          const id = `f${Date.now()}`;
          guestUpsert(saved.rid, id, { ...f, id, at: new Date().toISOString() }, "feedback");
        } else feedbackActions.add(f);
      }}
    />
  );
}
