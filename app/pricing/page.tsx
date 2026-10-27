import Link from "next/link";
import { Wordmark } from "@/components/shell";
import { PricingTable } from "@/components/pricing";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-4 lg:px-6">
        <Link href="/"><Wordmark className="text-[19px]" /></Link>
        <Link href="/app/settings" className="ml-auto text-[14.5px] font-semibold text-jade">Back to settings</Link>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 lg:px-6">
        <h1 className="text-center text-[36px] font-semibold tracking-tight lg:text-[44px]">Pick a plan</h1>
        <p className="mx-auto mt-2 max-w-lg text-center text-[16px] text-muted">Change or cancel any time. Prices are per outlet.</p>
        <div className="mt-10"><PricingTable /></div>
      </main>
    </div>
  );
}
