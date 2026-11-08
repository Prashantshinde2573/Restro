// The public website: its address and how it describes itself to search engines and link previews.
// NEXT_PUBLIC_SITE_URL on Vercel can change the address (e.g. a preview domain); no trailing slash.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.restropi.com").replace(/\/$/, "");
export const SITE_NAME = "Restropi";
export const SITE_TITLE = "Restropi · Restaurant billing, KOT & QR ordering app";
export const SITE_DESCRIPTION =
  "Restropi is a restaurant and café management app for India: billing with UPI QR and GST, kitchen orders (KOT), tables, QR ordering and payment from the table, stock, staff and guests, in English, मराठी and हिंदी.";
export const SITE_KEYWORDS = [
  "restaurant billing software",
  "restaurant POS India",
  "café billing app",
  "KOT app",
  "QR code ordering",
  "table ordering app",
  "restaurant management software",
  "cloud kitchen software",
  "UPI billing",
  "GST billing restaurant",
  "restaurant inventory",
  "Restropi",
];
/** Public pages, for the sitemap. Add a page here when the site gets one. */
export const PUBLIC_PAGES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];
/** Not for search engines: the app, guest QR pages, sign-in, admin and print pages.
 *  "/app$" + "/app/" rather than "/app", which would also block /apple-icon.png. */
export const PRIVATE_PATHS = ["/app$", "/app/", "/admin", "/order/", "/login", "/print/", "/api/"];

/** Link-preview tags for one page (a page's openGraph replaces the site-wide one, so repeat the basics). */
export function pageMeta(path: string, title: string, description: string) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website" as const, url: path, siteName: SITE_NAME, locale: "en_IN", title, description, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_TITLE }] },
    twitter: { card: "summary_large_image" as const, title, description, images: ["/opengraph-image"] },
  };
}
