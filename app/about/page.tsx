import type { Metadata } from "next";
import { SeoLanding } from "@/components/site/seo-landing";
import { ABOUT, type SeoPage } from "@/lib/seo-pages";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta("/about", ABOUT.title, ABOUT.description);

const about: SeoPage = {
  slug: "about",
  label: "About Restropi",
  title: ABOUT.title,
  description: ABOUT.description,
  eyebrow: "About us",
  h1: "Restropi, *from Pune.*",
  sub: "One calm app for cafés, restaurants and cloud kitchens across India.",
  chips: ["Made in Pune", "मराठी · हिंदी · English", "Same-day setup"],
  art: "pune",
  bentoTitle: "What we *build.*",
  bento: [
    { t: "Everything in one app", d: "Billing, kitchen, tables, stock, staff.", viz: "allinone" },
    { t: "Your language", d: "Staff and guests choose.", viz: "lang" },
    { t: "Live the same day", d: "We set it up with you.", viz: "setup" },
    { t: "We visit", d: "Pune, Satara and Kolhapur.", viz: "map" },
    { t: "Help on WhatsApp", d: "Real people, quick replies.", viz: "support" },
  ],
  steps: ["Book a demo", "We set it up", "Start billing today"],
  faqs: [
    { q: "What is Restropi?", a: "Restaurant and café management software from Pune, Maharashtra: billing with GST and UPI QR, kitchen orders (KOT), tables and QR ordering, stock with recipes, staff attendance and salary, guests and reports in one app." },
    { q: "Who uses Restropi?", a: "Cafés, restaurants, bakeries and cloud kitchens across India. We visit restaurants in Pune, Satara and Kolhapur." },
    { q: "Which languages does it support?", a: "English, Marathi and Hindi, for staff and for guests." },
  ],
};

export default function About() {
  return <SeoLanding p={about} kind="AboutPage" />;
}
