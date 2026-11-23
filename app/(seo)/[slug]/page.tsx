import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLanding } from "@/components/site/seo-landing";
import { SEO_PAGES, seoPage } from "@/lib/seo-pages";
import { pageMeta } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return SEO_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = seoPage((await params).slug);
  return p ? pageMeta(`/${p.slug}`, p.title, p.description) : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = seoPage((await params).slug);
  if (!p) notFound();
  return <SeoLanding p={p} />;
}
