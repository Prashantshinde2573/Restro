import { PricingTable } from "@/components/pricing";
import { SiteFooter, SiteNav } from "@/components/site/chrome";
import { Hero, MadeFor, Mesh } from "@/components/site/hero";
import { RiseText, SiteMotion } from "@/components/site/motion";
import { Contact, Features, Modules, Only, Statement, Story } from "@/components/site/sections";

export default function Landing() {
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <SiteNav onVideo />
        <main>
          <Hero />
          <MadeFor />
          <Modules />
          <Statement />
          <Features />
          <Story />
          <Only />

          <section id="pricing" className="relative isolate scroll-mt-20 overflow-hidden py-24 lg:py-32">
            <Mesh />
            <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <div data-reveal className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jade">Pricing</div>
                <RiseText as="h2" onScroll text="Simple pricing, *per outlet.*" className="mt-4 text-[42px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[60px] lg:text-[72px]" />
                <p data-reveal className="mx-auto mt-5 max-w-xl text-[17px] text-ink/60">Every plan includes unlimited bills, free updates and WhatsApp support in Marathi, Hindi and English.</p>
              </div>
              <div className="mt-12 lg:mt-16">
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
