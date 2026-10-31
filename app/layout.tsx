import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Restropi", template: "%s · Restropi" },
  description: "Run your restaurant or café from one calm screen — billing, kitchen, stock, team and guests.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Restropi", statusBarStyle: "default" },
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
