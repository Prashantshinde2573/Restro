import { PricingTable } from "@/components/pricing";
import { MobileCta, SiteFooter, SiteNav } from "@/components/site/chrome";
import { Hero, MadeFor } from "@/components/site/hero";
import { HelpChat } from "@/components/site/chat";
import { SiteMotion } from "@/components/site/motion";
import { SectionHead } from "@/components/site/head";
import { Features, Only, Statement, Story, WhyRestropi } from "@/components/site/sections";

export default function Landing() {
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <SiteNav onVideo />
        <main>
          <Hero />
          <MadeFor />
          <Statement />
          <WhyRestropi />
          <Features />
          <Story />
          <Only />

          <section id="pricing" className="relative isolate scroll-mt-20 overflow-hidden py-14 lg:py-28">
            <div className="relative mx-auto max-w-[1240px] px-5 lg:px-8">
              <SectionHead eyebrow="Pricing" title="Simple pricing, *per outlet.*" sub="Every plan includes unlimited bills, free updates and WhatsApp support in Marathi, Hindi and English." />
              <div className="mt-6 lg:mt-8">
                <PricingTable />
              </div>
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
