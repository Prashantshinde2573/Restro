import type { Metadata } from "next";
import { JsonLd } from "@/components/site/json-ld";
import { pageMeta } from "@/lib/site";
import { PricingTable } from "@/components/pricing";
import { SiteFooter, SiteNav } from "@/components/site/chrome";
import { HelpChat } from "@/components/site/chat";
import { SiteMotion } from "@/components/site/motion";
import { SectionHead } from "@/components/site/head";
import { MobileCta } from "@/components/site/chrome";
import { plans } from "@/lib/plans";

export const metadata: Metadata = pageMeta(
  "/pricing",
  "Pricing · plans from ₹699 a month per outlet",
  "Restropi plans for cafés, restaurants and chains: Starter ₹699, Growth ₹1,999 and Pro ₹2,999 a month per outlet. Unlimited bills, free updates, WhatsApp support. Change or cancel any time.",
);

/** Each plan includes everything in the one before it, plus its own list. */
function comparison() {
  const rows: { f: string; from: number }[] = [];
  plans.forEach((p, i) =>
    p.features.forEach((f) => {
      if (!/^Everything in /i.test(f)) rows.push({ f, from: i });
    }),
  );
  return rows;
}

export default function PricingPage() {
  const rows = comparison();
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <JsonLd page="pricing" />
        <SiteNav />
        <main>
          <section className="relative isolate overflow-hidden pb-14 pt-28 lg:pb-28 lg:pt-40">
            <div className="relative mx-auto max-w-[1240px] px-5 text-center lg:px-8">
              <SectionHead as="h1" eyebrow="Pricing" title="Pick a *plan.*" sub="Change or cancel any time. Prices are per outlet." />
              <div className="mt-6 text-left lg:mt-8">
                <PricingTable />
              </div>
            </div>
          </section>

          <section id="compare" className="scroll-mt-24 pb-14 lg:pb-28">
            <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
              <SectionHead eyebrow="Side by side" title="Compare *plans.*" />
              <div data-reveal className="glass mt-8 overflow-x-auto rounded-[28px] lg:mt-12">
                <table className="w-full min-w-[720px] text-left text-[14.5px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-6 py-5 font-medium text-muted">What you get</th>
                      {plans.map((p) => (
                        <th key={p.id} className={`px-4 py-5 text-center ${p.highlight ? "bg-jade/[0.06]" : ""}`}>
                          <div className="text-[20px] font-semibold leading-none tracking-tight">{p.name}</div>
                          <div className="mt-1 text-[12.5px] font-normal text-muted">{p.outlets}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.f} className="border-b border-line/70 last:border-0">
                        <td className="px-6 py-3.5">{r.f}</td>
                        {plans.map((p, i) => (
                          <td key={p.id} className={`px-4 py-3.5 text-center ${p.highlight ? "bg-jade/[0.04]" : ""}`}>
                            {i >= r.from ? (
                              <svg width="20" height="20" viewBox="0 0 20 20" className="inline text-jade" aria-label="Included"><path d="M5 10.5l3.2 3.2L15 6.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            ) : (
                              <span className="text-faint" aria-label="Not included">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-center text-[12px] text-ink/65">* Prices are per outlet. Plans and offerings are indicative and subject to change.</p>
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
