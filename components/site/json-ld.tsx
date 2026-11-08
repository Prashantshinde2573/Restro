// Structured data (schema.org) so Google understands who we are and what we sell.
import { plans } from "@/lib/plans";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/config";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const org = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/brand/icon-512.png`,
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL,
  areaServed: "IN",
};

const app = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Restaurant point of sale",
  operatingSystem: "Web, Android, iOS, Windows, macOS",
  inLanguage: ["en", "mr", "hi"],
  publisher: { "@id": `${SITE_URL}/#organization` },
  offers: plans
    .filter((p) => p.monthly != null)
    .map((p) => ({
      "@type": "Offer",
      name: `${p.name} plan`,
      description: p.blurb,
      price: p.monthly,
      priceCurrency: "INR",
      url: `${SITE_URL}/pricing`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: p.monthly, priceCurrency: "INR", unitText: "MONTH", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
    })),
};

const site = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE_NAME,
  inLanguage: "en-IN",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export function JsonLd({ page }: { page: "home" | "pricing" }) {
  const graph =
    page === "home"
      ? [org, site, app]
      : [
          org,
          app,
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Pricing", item: `${SITE_URL}/pricing` },
            ],
          },
        ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c") }} />;
}
