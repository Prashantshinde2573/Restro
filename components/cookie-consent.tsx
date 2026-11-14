"use client";

// Cookie consent for the website, wired to Google Consent Mode v2.
// The head script in app/layout.tsx sets everything to "denied" before Google Tag Manager /
// Analytics load (and re-applies a saved choice). This banner asks once and updates consent.
// To change the choice later, the visitor clears this site's data (see the cookie policy in /privacy).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const CONSENT_KEY = "restropi.consent";
type Choice = { analytics: boolean; marketing: boolean; at: number };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function applyConsent(c: { analytics: boolean; marketing: boolean }) {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  const gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
  const g = (v: boolean) => (v ? "granted" : "denied");
  gtag("consent", "update", {
    analytics_storage: g(c.analytics),
    ad_storage: g(c.marketing),
    ad_user_data: g(c.marketing),
    ad_personalization: g(c.marketing),
  });
  window.dataLayer.push({ event: "consent_update", consent_analytics: c.analytics, consent_marketing: c.marketing });
}

// The banner shows on the public website only — not inside the restaurant app, the login
// screen (owners and staff sign in there every day) or the guest QR menu.
const isAppPath = (p: string) => /^\/(app|order|admin|print|login)(\/|$)/.test(p);

export function CookieConsent() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let saved: Choice | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    } catch {}
    if (!saved && !isAppPath(path)) {
      // let the page settle first, so the banner doesn't fight the first-load animation
      const t = window.setTimeout(() => setOpen(true), 1200);
      return () => window.clearTimeout(t);
    }
  }, [path]);

  const save = (c: { analytics: boolean; marketing: boolean }) => {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...c, at: Date.now() })); } catch {}
    applyConsent(c);
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="pb-safe fixed inset-x-0 bottom-0 z-[80] animate-[sheet-in_.45s_cubic-bezier(.2,.8,.2,1)] border-t border-white/70 bg-white/70 text-ink shadow-[0_-24px_60px_-28px_rgb(16_24_20/.45)] backdrop-blur-2xl backdrop-saturate-150 [--safe-pb:0px]"
      style={{ backgroundImage: "linear-gradient(180deg, rgb(255 255 255 / .55), rgb(255 255 255 / .35))", boxShadow: "inset 0 1px 0 rgb(255 255 255 / .9), 0 -24px 60px -28px rgb(16 24 20 / .45)" }}
    >
      <div className="mx-auto max-w-[1240px] px-4 py-3 sm:px-5 sm:py-5 lg:px-8">
        <div className="flex items-center gap-3 lg:gap-8">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span aria-hidden className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-[20px] shadow-[0_4px_14px_-6px_rgb(16_24_20/.35)] ring-1 ring-black/[.04] sm:flex">🍪</span>
            <div className="min-w-0">
              <div className="hidden text-[15.5px] font-semibold sm:block">Cookie Settings</div>
              <p className="text-[13px] leading-snug text-ink/75 sm:mt-0.5 sm:text-[13.5px] sm:leading-relaxed">
                <span className="sm:hidden">We use cookies to improve the site. </span>
                <span className="hidden sm:inline">We use cookies to enhance your experience, analyze site traffic and deliver personalized content. Read our{" "}</span>
                <Link href="/privacy#cookies" className="font-semibold text-jade underline underline-offset-4 hover:text-jade-deep">Cookie policy</Link>
                <span className="hidden sm:inline">
                  {" "}and{" "}
                  <Link href="/privacy" className="font-semibold text-jade underline underline-offset-4 hover:text-jade-deep">privacy policy</Link>.
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => save({ analytics: false, marketing: false })} className="h-10 rounded-full bg-white/80 px-4 text-[14px] font-semibold ring-1 ring-black/[.08] backdrop-blur hover:bg-white sm:h-11 sm:px-5 sm:text-[14.5px]">
              Reject
            </button>
            <button onClick={() => save({ analytics: true, marketing: true })} className="h-10 rounded-full bg-jade px-4 text-[14px] font-semibold text-white shadow-[0_10px_24px_-12px_rgb(var(--jade)/.9)] transition hover:bg-jade-deep sm:h-11 sm:px-6 sm:text-[14.5px]">
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
