import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileCta, SiteFooter, SiteNav } from "@/components/site/chrome";
import { SiteMotion } from "@/components/site/motion";
import { SEO_PAGES, seoPage } from "@/lib/seo-pages";
import { INSTAGRAM_URL, SITE_NAME, SITE_URL, pageMeta } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return SEO_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = seoPage((await params).slug);
  return p ? pageMeta(`/${p.slug}`, p.title, p.description) : {};
}

export default async function SeoLanding({ params }: { params: Promise<{ slug: string }> }) {
  const p = seoPage((await params).slug);
  if (!p) notFound();
  const url = `${SITE_URL}/${p.slug}`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/brand/icon-512.png`, sameAs: [INSTAGRAM_URL] },
      { "@type": "WebPage", "@id": `${url}#page`, url, name: p.title, description: p.description, isPartOf: { "@id": `${SITE_URL}/#website` }, about: { "@id": `${SITE_URL}/#app` }, inLanguage: "en-IN" },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, { "@type": "ListItem", position: 2, name: p.label, item: url }] },
      { "@type": "FAQPage", mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  const others = SEO_PAGES.filter((x) => x.slug !== p.slug);
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
        <SiteNav />
        <main className="mx-auto max-w-[920px] px-5 pb-16 pt-28 lg:px-8 lg:pb-24 lg:pt-40">
          <nav aria-label="Breadcrumb" className="text-[13.5px] text-ink/60">
            <Link href="/" className="hover:text-jade">Restropi</Link> <span aria-hidden>›</span> <span>{p.label}</span>
          </nav>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/65 ring-1 ring-black/[.06]">
            <span className="h-1.5 w-1.5 rounded-full bg-jade" /> {p.eyebrow}
          </div>
          <h1 className="mt-4 text-balance text-[36px] font-semibold leading-[1.05] tracking-tight sm:text-[52px]">{p.h1}</h1>
          <p className="mt-5 max-w-[680px] text-[17px] leading-relaxed text-ink/75 lg:text-[18.5px]">{p.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/#contact" className="inline-flex h-12 items-center rounded-full bg-jade px-6 text-[15.5px] font-semibold text-white">Book a free demo</Link>
            <Link href="/pricing" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15.5px] font-semibold ring-1 ring-black/[.06]">See pricing</Link>
          </div>

          <section className="mt-14 grid gap-4 sm:grid-cols-2">
            {p.points.map((x) => (
              <div key={x.t} className="rounded-[22px] bg-white p-6 ring-1 ring-black/[.05]">
                <h2 className="text-[19px] font-semibold tracking-tight">{x.t}</h2>
                <p className="mt-2 text-[15.5px] leading-relaxed text-ink/70">{x.d}</p>
              </div>
            ))}
          </section>

          <section className="mt-14">
            <h2 className="text-[26px] font-semibold tracking-tight">Questions</h2>
            <div className="mt-4 divide-y divide-black/[.06] rounded-[22px] bg-white ring-1 ring-black/[.05]">
              {p.faqs.map((f) => (
                <details key={f.q} className="group px-6 py-4">
                  <summary className="cursor-pointer list-none text-[16px] font-semibold">{f.q}</summary>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-ink/70">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="text-[20px] font-semibold tracking-tight">More from Restropi</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map((o) => (
                <li key={o.slug}><Link href={`/${o.slug}`} className="inline-flex rounded-full bg-white px-4 py-2 text-[14.5px] ring-1 ring-black/[.06] hover:text-jade">{o.label}</Link></li>
              ))}
              <li><Link href="/about" className="inline-flex rounded-full bg-white px-4 py-2 text-[14.5px] ring-1 ring-black/[.06] hover:text-jade">About Restropi</Link></li>
            </ul>
          </section>
        </main>
        <SiteFooter />
        <MobileCta />
      </div>
    </SiteMotion>
  );
}
