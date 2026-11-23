import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin, MessageCircle, Zap } from "lucide-react";
import { MobileCta, SiteFooter, SiteNav } from "@/components/site/chrome";
import { HelpChat } from "@/components/site/chat";
import { IconArrow } from "@/components/site/icons";
import { SiteMotion } from "@/components/site/motion";
import { INSTAGRAM_URL, SITE_NAME, SITE_URL, pageMeta } from "@/lib/site";

const TITLE = "About us · restaurant software from Pune";
const DESCRIPTION =
  "Restropi is restaurant and café management software from Pune, Maharashtra: billing, KOT, QR ordering, stock, staff and guests in one app, in English, Marathi and Hindi.";

export const metadata: Metadata = pageMeta("/about", TITLE, DESCRIPTION);

// real restaurant photos (no app screens), warm-graded WebP, 25–60 KB each
const strip = [
  { src: "/site/about/cafe.webp", alt: "A bright café with wooden tables", w: 640, h: 800, cls: "mt-10 sm:mt-14" },
  { src: "/site/about/guest-menu.webp", alt: "A guest reading the menu at a restaurant table", w: 720, h: 540, cls: "mt-20 sm:mt-24" },
  { src: "/site/about/qr-table.webp", alt: "A restaurant table with a Restropi QR stand", w: 640, h: 800, cls: "" },
  { src: "/site/about/interior.webp", alt: "A warm restaurant dining room with woven lamps", w: 720, h: 540, cls: "mt-16 sm:mt-20" },
];

const values = [
  { icon: MapPin, t: "Made in Pune", d: "A local team. We visit restaurants in Pune, Satara and Kolhapur." },
  { icon: Zap, t: "Built for busy nights", d: "Orders go straight to the kitchen, bills close in seconds." },
  { icon: MessageCircle, t: "With you on WhatsApp", d: "Real people, quick replies, in your language." },
];

/** little brand doodles, like hand-drawn sparkles */
function Sparkle({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 2c.6 5.2 3.4 8.6 10 10-6.6 1.4-9.4 4.8-10 10-.6-5.2-3.4-8.6-10-10 6.6-1.4 9.4-4.8 10-10Z" />
    </svg>
  );
}
const Ring = ({ className }: { className: string }) => <span aria-hidden className={`absolute rounded-full border-2 border-current ${className}`} />;

function H2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[40px] ${className}`}>{children}</h2>;
}

export default function About() {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "AboutPage", "@id": `${SITE_URL}/about#page`, url: `${SITE_URL}/about`, name: TITLE, description: DESCRIPTION, about: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en-IN" },
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/brand/icon-512.png`, sameAs: [INSTAGRAM_URL] },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, { "@type": "ListItem", position: 2, name: "About", item: `${SITE_URL}/about` }] },
    ],
  };
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
        <SiteNav />
        <main>
          {/* hero: brand band with the title; the photo row sits half on the band, half below */}
          <section className="relative">
            <div className="absolute inset-x-0 top-0 h-[450px] bg-jade-soft sm:h-[500px] lg:h-[560px]" aria-hidden />
            <div className="relative mx-auto max-w-[1180px] px-5 pt-32 text-center lg:px-8 lg:pt-40">
              <Sparkle className="absolute left-[24%] top-[150px] hidden text-saffron sm:block" size={26} />
              <Ring className="right-[27%] top-[156px] hidden h-3 w-3 text-jade sm:block" />
              <Ring className="right-[24%] top-[180px] hidden h-4 w-4 text-saffron sm:block" />
              <Sparkle className="absolute right-[10%] top-[220px] hidden text-jade/60 sm:block" size={18} />
              <h1 className="text-[44px] font-semibold leading-none tracking-[-0.045em] sm:text-[60px]">
                About <span className="text-jade">Restropi</span>
              </h1>
              <p className="mx-auto mt-4 max-w-[520px] text-[16.5px] leading-relaxed text-ink/70 sm:text-[17.5px]">
                Restaurant software made in Pune. Billing, kitchen, tables and QR ordering in one calm app.
              </p>
              <div className="mt-8 grid grid-cols-2 items-start gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-4">
                {strip.map((p, i) => (
                  <div key={p.src} className={`${p.cls} ${i > 1 ? "hidden sm:block" : ""} overflow-hidden rounded-[22px] shadow-[0_30px_50px_-30px_rgb(16_24_20/.45)] ring-1 ring-black/[.04]`}>
                    <Image src={p.src} alt={p.alt} width={p.w} height={p.h} sizes="(min-width: 640px) 25vw, 50vw" priority={i < 2} className="h-auto w-full" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* story: heading, then two short columns */}
          <section className="mx-auto max-w-[1180px] px-5 pt-16 lg:px-8 lg:pt-24">
            <H2 className="max-w-[620px]">We make sure your restaurant runs calm, even on a full night.</H2>
            <div className="mt-6 grid gap-5 text-[15.5px] leading-relaxed text-ink/65 sm:grid-cols-2 sm:gap-12">
              <p>Restropi puts billing, the kitchen, tables and QR ordering on the phone, tablet or laptop you already have. No new hardware, nothing to install.</p>
              <p>We set it up with you the same day, show your team how it works in English, मराठी or हिंदी, and stay on WhatsApp whenever you need us.</p>
            </div>
          </section>

          {/* photo with a quote card + empower text */}
          <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 pt-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pt-24">
            <div className="relative pb-8">
              <div className="overflow-hidden rounded-[26px] shadow-[0_40px_60px_-36px_rgb(16_24_20/.5)]">
                <Image src="/site/about/team.webp" alt="A restaurant counter with warm lamps" width={900} height={719} sizes="(min-width: 1024px) 560px, 100vw" className="h-auto w-full" />
              </div>
              <div className="absolute bottom-0 left-4 max-w-[78%] rounded-[16px] bg-white px-4 py-3 text-center shadow-[0_24px_40px_-20px_rgb(16_24_20/.4)] ring-1 ring-black/[.04] sm:left-8 sm:max-w-none sm:rounded-[18px] sm:px-5 sm:py-3.5">
                <div className="text-[13.5px] font-semibold sm:text-[15px]">“One calm screen for the whole restaurant.”</div>
                <div className="mt-0.5 text-[12px] text-ink/55 sm:text-[12.5px]">Team Restropi</div>
              </div>
              <Sparkle className="absolute -right-2 -top-4 hidden text-saffron sm:block" size={30} />
            </div>
            <div>
              <H2>We help small restaurant owners do more.</H2>
              <p className="mt-5 text-[15.5px] leading-relaxed text-ink/65">
                Most of our restaurants run with a small team. Restropi takes over the paper work: KOTs, bills, stock and staff attendance, so the team can look after guests.
              </p>
              <blockquote className="mt-6 border-l-[3px] border-saffron pl-5 text-[16px] font-medium italic leading-relaxed text-ink/80">
                “Your team should be serving guests, not chasing paper KOTs and bills.”
              </blockquote>
            </div>
          </section>

          {/* values */}
          <section className="relative mx-auto max-w-[1180px] px-5 py-20 text-center lg:px-8 lg:py-28">
            <Sparkle className="absolute right-[18%] top-14 hidden text-jade/70 sm:block lg:top-20" size={22} />
            <Ring className="right-[14%] top-10 hidden h-3 w-3 text-saffron sm:block lg:top-16" />
            <Sparkle className="absolute left-[16%] top-24 hidden text-saffron/80 sm:block" size={16} />
            <H2 className="mx-auto max-w-[560px]">
              We help restaurants grow <span className="text-jade">faster and calmer</span>
            </H2>
            <p className="mx-auto mt-4 max-w-[460px] text-[15.5px] text-ink/60">Three things we promise every restaurant we work with.</p>
            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-6">
              {values.map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex flex-col items-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-[44%_56%_52%_48%/52%_44%_56%_48%] bg-saffron-soft text-saffron">
                    <Icon size={26} strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 text-[18px] font-semibold tracking-tight">{t}</h3>
                  <p className="mt-1.5 max-w-[260px] text-[14.5px] leading-relaxed text-ink/60">{d}</p>
                </div>
              ))}
            </div>
            <Link href="/#contact" className="group mx-auto mt-12 inline-flex h-[52px] items-center gap-3 rounded-full bg-ink pl-6 pr-2 text-[15px] font-semibold text-white">
              Book a free demo
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-jade transition-transform duration-500 group-hover:-rotate-45"><IconArrow size={16} /></span>
            </Link>
          </section>
        </main>
        <SiteFooter />
        <MobileCta />
        <HelpChat />
      </div>
    </SiteMotion>
  );
}
