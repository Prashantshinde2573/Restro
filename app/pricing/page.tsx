import { PricingTable } from "@/components/pricing";
import { SiteFooter, SiteNav } from "@/components/site/chrome";
import { RiseText, SiteMotion } from "@/components/site/motion";
import { plans } from "@/lib/plans";

export const metadata = { title: "Pricing" };

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
        <SiteNav />
        <main>
          <section className="relative overflow-hidden pb-16 pt-36 lg:pb-24 lg:pt-44">
            <div aria-hidden className="absolute -left-40 top-0 -z-0 h-[480px] w-[480px] rounded-full bg-jade/[0.10] blur-[110px]" />
            <div aria-hidden className="absolute -right-32 top-32 h-[380px] w-[380px] rounded-full bg-saffron/[0.10] blur-[110px]" />
            <div className="relative mx-auto max-w-[1240px] px-5 text-center lg:px-8">
              <div data-reveal className="text-[13px] font-semibold uppercase tracking-[0.18em] text-jade">Pricing</div>
              <RiseText text="Pick a *plan.*" className="mt-4 text-[52px] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-[76px] lg:text-[96px]" />
              <p data-reveal className="mx-auto mt-5 max-w-lg text-[17.5px] text-muted">Change or cancel any time. Prices are per outlet.</p>
              <div className="mt-16 text-left">
                <PricingTable />
              </div>
            </div>
          </section>

          <section className="pb-24 lg:pb-36">
            <div className="mx-auto max-w-[1240px] px-5 lg:px-8">
              <RiseText as="h2" onScroll text="Compare *plans.*" className="text-[40px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[56px]" />
              <div data-reveal className="mt-10 overflow-x-auto rounded-[28px] bg-surface ring-1 ring-line">
                <table className="w-full min-w-[720px] text-left text-[14.5px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-6 py-5 font-medium text-muted">What you get</th>
                      {plans.map((p) => (
                        <th key={p.id} className={`px-4 py-5 text-center ${p.highlight ? "bg-jade-soft/60" : ""}`}>
                          <div className="font-display text-[26px] font-normal leading-none">{p.name}</div>
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
                          <td key={p.id} className={`px-4 py-3.5 text-center ${p.highlight ? "bg-jade-soft/40" : ""}`}>
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
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </SiteMotion>
  );
}
