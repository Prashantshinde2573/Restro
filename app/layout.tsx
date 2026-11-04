import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { CookieConsent } from "@/components/cookie-consent";

// Analytics: set these in .env.local / your host's environment to switch them on.
// Google Analytics 4 Measurement ID (public, it shows in every page). NEXT_PUBLIC_GA_ID on Vercel overrides it.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-DCQPV9HT7T";
// Google Tag Manager container (public). NEXT_PUBLIC_GTM_ID on Vercel overrides it.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-PVZ25CCF";
const GSC = process.env.NEXT_PUBLIC_GSC_VERIFICATION; // Search Console "HTML tag" code

export const metadata: Metadata = {
  title: { default: "Restropi", template: "%s · Restropi" },
  description: "Run your restaurant or café from one calm screen — billing, kitchen, stock, team and guests.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Restropi", statusBarStyle: "default" },
  ...(GSC ? { verification: { google: GSC } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F3F4F1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Consent Mode v2: nothing is stored until the visitor agrees (components/cookie-consent.tsx).
            Runs before Tag Manager / Analytics load, and re-applies a saved choice. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});try{var c=JSON.parse(localStorage.getItem('restropi.consent')||'null');if(c){var g=function(v){return v?'granted':'denied'};gtag('consent','update',{analytics_storage:g(c.analytics),ad_storage:g(c.marketing),ad_user_data:g(c.marketing),ad_personalization:g(c.marketing)})}}catch(e){}",
          }}
        />
        {/* Public pages animate in. Hide those elements before the first paint only if motion is
            allowed; if the page scripts never start, show everything after 3 s.
            First visit to the home or pricing page in a tab: show the loader for one turn (1.5 s). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('motion-ok');setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.remove('motion-ok')},3000);var p=location.pathname;if((p==='/'||p==='/pricing')&&!sessionStorage.getItem('restropi.splash')){sessionStorage.setItem('restropi.splash','1');d.classList.add('splash');window.__splashUntil=performance.now()+1500}}}catch(e){}",
          }}
        />
      </head>
      <body>
        {GTM_ID && (
          <>
            <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
            <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript>
          </>
        )}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};gtag('js',new Date());gtag('config','${GA_ID}');`}</Script>
          </>
        )}
        <Providers>{children}</Providers>
        {/* Vercel Web Analytics: page views on the Vercel dashboard (no cookies) */}
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
