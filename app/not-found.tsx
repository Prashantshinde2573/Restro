import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/site/mockups";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <Link href="/" aria-label="Restropi home">
        <Brand className="h-9" />
      </Link>
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-tight">This page isn&apos;t here</h1>
        <p className="mx-auto max-w-sm text-[15px] text-ink/70">The link may be old or typed wrong. If you scanned a table QR, ask a staff member for help.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-jade px-6 text-[15px] font-semibold text-white hover:bg-jade-deep">
          Go to home page
        </Link>
        <Link href="/login" className="inline-flex h-11 items-center rounded-full bg-white px-6 text-[15px] font-semibold ring-1 ring-black/10 hover:bg-white/80">
          Sign in
        </Link>
      </div>
    </main>
  );
}
