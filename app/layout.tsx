import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";

// Analytics: set these in .env.local / your host's environment to switch them on.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID; // Google Analytics 4, e.g. G-XXXXXXX
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID; // Google Tag Manager, e.g. GTM-XXXXXX
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
            <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}</Script>
          </>
        )}
        <Providers>{children}</Providers>
        {/* Vercel Web Analytics: page views on the Vercel dashboard (no cookies) */}
        <Analytics />
      </body>
    </html>
  );
}
