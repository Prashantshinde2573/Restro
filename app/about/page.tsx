import type { Metadata } from "next";
import Link from "next/link";
import { MobileCta, SiteFooter, SiteNav } from "@/components/site/chrome";
import { SiteMotion } from "@/components/site/motion";
import { ABOUT, SEO_PAGES } from "@/lib/seo-pages";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, SITE_NAME, SITE_URL, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta("/about", ABOUT.title, ABOUT.description);

export default function About() {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "AboutPage", "@id": `${SITE_URL}/about#page`, url: `${SITE_URL}/about`, name: ABOUT.title, description: ABOUT.description, about: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en-IN" },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, { "@type": "ListItem", position: 2, name: "About", item: `${SITE_URL}/about` }] },
    ],
  };
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
        <SiteNav />
        <main className="mx-auto max-w-[820px] px-5 pb-16 pt-28 lg:px-8 lg:pb-24 lg:pt-40">
          <h1 className="text-[38px] font-semibold leading-[1.05] tracking-tight sm:text-[52px]">About {SITE_NAME}</h1>
          <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-ink/75">
            <p><b className="text-ink">{SITE_NAME}</b> is restaurant and café management software from Pune, Maharashtra. It puts billing with GST and UPI QR, kitchen orders (KOT), tables and QR ordering, stock with recipes, staff attendance and salary, guests and reports into one app.</p>
            <p>It runs in the browser on the phone, tablet or laptop a restaurant already has, in English, मराठी and हिंदी. We set it up with each restaurant on the same day and support them on WhatsApp.</p>
            <p>Restropi is used by cafés, restaurants, bakeries and cloud kitchens. We visit restaurants in Pune, Satara and Kolhapur, and work with restaurants across India online.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#contact" className="inline-flex h-12 items-center rounded-full bg-jade px-6 text-[15.5px] font-semibold text-white">Book a free demo</Link>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15.5px] font-semibold ring-1 ring-black/[.06]">Instagram {INSTAGRAM_HANDLE}</a>
          </div>
          <h2 className="mt-14 text-[22px] font-semibold tracking-tight">What Restropi does</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SEO_PAGES.map((o) => (
              <li key={o.slug}><Link href={`/${o.slug}`} className="inline-flex rounded-full bg-white px-4 py-2 text-[14.5px] ring-1 ring-black/[.06] hover:text-jade">{o.label}</Link></li>
            ))}
            <li><Link href="/pricing" className="inline-flex rounded-full bg-white px-4 py-2 text-[14.5px] ring-1 ring-black/[.06] hover:text-jade">Pricing</Link></li>
          </ul>
        </main>
        <SiteFooter />
        <MobileCta />
      </div>
    </SiteMotion>
  );
}
