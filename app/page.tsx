import { PricingTable } from "@/components/pricing";
import { SiteFooter, SiteNav } from "@/components/site/chrome";
import { Hero } from "@/components/site/hero";
import { RiseText, SiteMotion } from "@/components/site/motion";
import { Contact, Features, Marquee, Only, Story } from "@/components/site/sections";

export default function Landing() {
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <SiteNav />
        <main>
          <Hero />
          <Marquee />
          <Features />
          <Story />
          <div className="h-16 lg:h-24" />
          <Only />

          <section id="pricing" className="scroll-mt-20 py-24 lg:py-36">
            <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
              <div className="text-center">
                <div data-reveal className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jade">Pricing</div>
                <RiseText as="h2" onScroll text="Simple pricing, *per outlet.*" className="mt-4 text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[60px] lg:text-[72px]" />
                <p data-reveal className="mx-auto mt-5 max-w-xl text-[17px] text-muted">Every plan includes unlimited bills, free updates and WhatsApp support in Marathi, Hindi and English.</p>
              </div>
              <div className="mt-14">
                <PricingTable />
              </div>
            </div>
          </section>

          <Contact />
        </main>
        <SiteFooter />
      </div>
    </SiteMotion>
  );
}
