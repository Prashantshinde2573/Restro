// The layout of /about: dark hero with the real app,
// a bento of small pictures, three steps, short FAQ.
import clsx from "clsx";
import Link from "next/link";
import { BentoReveal } from "@/components/site/bento-reveal";
import { MobileCta, SiteFooter, SiteNav } from "@/components/site/chrome";
import { HelpChat } from "@/components/site/chat";
import { Eyebrow, SectionHead } from "@/components/site/head";
import { Mesh } from "@/components/site/hero";
import { IconArrow } from "@/components/site/icons";
import { RiseText, SiteMotion } from "@/components/site/motion";
import { HeroVisual, VizArt } from "@/components/site/seo-viz";
import type { SeoPage } from "@/lib/seo-pages";
import { INSTAGRAM_URL, SITE_NAME, SITE_URL } from "@/lib/site";

// big + small on the first row, three small on the second
const spans = ["lg:col-span-4", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2"];

export function SeoLanding({ p, kind = "WebPage" }: { p: SeoPage; kind?: "WebPage" | "AboutPage" }) {
  const url = `${SITE_URL}/${p.slug}`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/brand/icon-512.png`, sameAs: [INSTAGRAM_URL] },
      { "@type": kind, "@id": `${url}#page`, url, name: p.title, description: p.description, isPartOf: { "@id": `${SITE_URL}/#website` }, about: { "@id": `${SITE_URL}/#app` }, inLanguage: "en-IN" },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, { "@type": "ListItem", position: 2, name: kind === "AboutPage" ? "About" : p.label, item: url }] },
      { "@type": "FAQPage", mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  const others = [{ href: "/pricing", label: "Pricing" }, { href: "/#features", label: "Features" }];
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
        <SiteNav onVideo />
        <main>
          {/* hero: short words left, the real app right */}
          <section className="relative isolate overflow-hidden bg-ink text-white">
            <Mesh tone="dark" />
            <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-14 pt-28 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:px-8 lg:pb-20 lg:pt-36">
              <div>
                <nav aria-label="Breadcrumb" className="mb-5 text-[13px] text-white/55">
                  <Link href="/" className="hover:text-white">Restropi</Link> <span aria-hidden>›</span> <span className="text-white/80">{kind === "AboutPage" ? "About" : p.label}</span>
                </nav>
                <Eyebrow dark>{p.eyebrow}</Eyebrow>
                <RiseText as="h1" text={p.h1} className="mt-5 max-w-[14ch] text-[42px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[56px] lg:text-[64px] [&_.text-jade]:text-[#7be0c0]" />
                <p className="mt-5 max-w-[440px] text-[17px] leading-relaxed text-white/70 lg:text-[18px]">{p.sub}</p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href="/#contact" className="group inline-flex h-[52px] items-center gap-3 rounded-full bg-white pl-6 pr-2 text-[15.5px] font-semibold text-ink transition hover:bg-jade-soft">
                    Book a free demo
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-jade text-white transition-transform duration-500 group-hover:-rotate-45"><IconArrow size={16} /></span>
                  </Link>
                  <Link href="/pricing" className="hidden h-[52px] sm:inline-flex items-center rounded-full px-5 text-[15px] font-semibold text-white/85 ring-1 ring-white/20 transition hover:bg-white/10">From ₹699/mo</Link>
                </div>
                <ul className="mt-8 flex flex-wrap gap-2">
                  {p.chips.map((c) => (
                    <li key={c} className="inline-flex items-center gap-2 rounded-full bg-white/[.07] py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium text-white/85 ring-1 ring-white/10">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7be0c0]/20 text-[#7be0c0]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <HeroVisual art={p.art} />
            </div>
          </section>

          {/* bento: one picture per card, a few words each */}
          <section className="bg-[#f4f5f3] py-14 lg:py-24">
            <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
              <SectionHead eyebrow="What you get" title={p.bentoTitle} />
              <BentoReveal className="mt-8 grid gap-3 sm:grid-cols-2 lg:mt-12 lg:grid-cols-6 lg:gap-4">
                {p.bento.map((b, i) => (
                  <div key={b.t} className={clsx("bento-card flex min-w-0 flex-col overflow-hidden rounded-[28px] bg-white ring-1 ring-black/[.04] shadow-[0_30px_60px_-40px_rgb(16_24_20/.25)]", spans[i], i === 0 && "sm:col-span-2")}>
                    <div className="px-6 pt-6 lg:px-7 lg:pt-7">
                      <h2 className="text-[21px] font-semibold leading-tight tracking-[-0.03em] lg:text-[23px]">{b.t}</h2>
                      <p className="mt-1 text-[15px] text-ink/60">{b.d}</p>
                    </div>
                    <div className={clsx("flex flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_60%,rgb(var(--jade)/.07),transparent_65%)] px-5 py-7", i === 0 ? "min-h-[280px] lg:min-h-[320px]" : "min-h-[240px]")}>
                      <VizArt viz={b.viz} />
                    </div>
                  </div>
                ))}
              </BentoReveal>
            </div>
          </section>

          {/* how it works: three steps */}
          <section className="py-14 lg:py-20">
            <div className="mx-auto max-w-[1040px] px-5 lg:px-8">
              <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                {p.steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-4 rounded-[22px] bg-white p-5 ring-1 ring-black/[.05] sm:flex-col sm:items-start sm:p-6">
                    <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold", i === 2 ? "bg-jade text-white" : "bg-jade-soft text-jade-deep")}>{i + 1}</span>
                    <span className="text-[18px] font-semibold tracking-tight">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* questions + other pages */}
          <section className="pb-16 lg:pb-24">
            <div className="mx-auto grid max-w-[1040px] gap-8 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
              <div>
                <SectionHead eyebrow="FAQ" title="Quick *answers.*" align="left" />
              </div>
              <div className="divide-y divide-black/[.06] rounded-[24px] bg-white ring-1 ring-black/[.05]">
                {p.faqs.map((f) => (
                  <details key={f.q} className="group px-6 py-4">
                    <summary className="flex cursor-pointer list-none items-center gap-3 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f4f5f3] text-[18px] leading-none transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 pr-8 text-[15px] leading-relaxed text-ink/65">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <div className="mx-auto mt-12 max-w-[1040px] px-5 lg:px-8">
              <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink/45">Also in Restropi</div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {others.map((o) => (
                  <li key={o.href}>
                    <Link href={o.href} className="group inline-flex h-10 items-center gap-2 rounded-full bg-white pl-4 pr-1.5 text-[14px] font-medium ring-1 ring-black/[.06] transition hover:ring-jade/40">
                      {o.label}<span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4f5f3] transition group-hover:bg-jade group-hover:text-white"><IconArrow size={13} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>
        <SiteFooter />
        <MobileCta />
        <HelpChat />
      </div>
    </SiteMotion>
  );
}
