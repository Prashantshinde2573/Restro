import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import type { ReactNode } from "react";
import { MobileCta, SiteFooter, SiteNav } from "@/components/site/chrome";
import { HelpChat } from "@/components/site/chat";
import { SiteMotion } from "@/components/site/motion";
import { DEFAULT_CONTACT_EMAIL } from "@/lib/config";

export const metadata: Metadata = pageMeta("/privacy", "Privacy policy", "How Restropi collects, uses and protects personal data, and how we use cookies.");

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL;
const UPDATED = "5 November 2026";

const cookies: { name: string; who: string; why: string; kind: string; lasts: string }[] = [
  { name: "restropi.consent", who: "Restropi", why: "Remembers whether you accepted or rejected cookies, so we don't ask again.", kind: "Necessary", lasts: "Until you clear it" },
  { name: "restropi.splash", who: "Restropi", why: "Shows the welcome animation only once per visit.", kind: "Necessary", lasts: "Until you close the tab" },
  { name: "restropi.lang", who: "Restropi", why: "Remembers the language you chose (English, मराठी or हिंदी).", kind: "Necessary", lasts: "Until you clear it" },
  { name: "restropi.auth and app data", who: "Restropi", why: "Keeps restaurant owners and staff signed in, and keeps the app quick.", kind: "Necessary", lasts: "Until you sign out" },
  { name: "_ga, _ga_*", who: "Google Analytics", why: "Counts visits and shows which pages are useful, so we can improve the website.", kind: "Analytics", lasts: "Up to 2 years" },
  { name: "Tags set by Google Tag Manager", who: "Google and ad partners", why: "Measures our advertising and shows more relevant offers.", kind: "Marketing", lasts: "Varies by tag" },
];

const toc = [
  ["who", "Who we are"],
  ["what", "What we collect"],
  ["why", "How we use it"],
  ["share", "Who we share it with"],
  ["cookies", "Cookie policy"],
  ["keep", "How long we keep it"],
  ["safe", "How we keep it safe"],
  ["rights", "Your rights"],
  ["children", "Children"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact us"],
] as const;

function Sec({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-black/[.06] pt-8">
      <h2 className="text-[22px] font-semibold tracking-tight sm:text-[24px]">
        <span className="mr-2 text-jade tnum">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15.5px] leading-[1.7] text-ink/75 [&_b]:font-semibold [&_b]:text-ink [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <SiteMotion>
      <div className="min-h-dvh overflow-x-clip bg-canvas">
        <SiteNav />
        <main className="mx-auto max-w-[1240px] px-5 pb-16 pt-28 lg:px-8 lg:pb-24 lg:pt-40">
          <div className="max-w-3xl">
            <h1 className="text-[38px] font-semibold leading-[1.05] tracking-tight sm:text-[52px]">Privacy policy</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-ink/65">
              This policy explains what personal data Restropi collects when you visit our website or use the Restropi app, why we collect it, and the choices you have. It also contains our cookie policy.
            </p>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
            <nav className="hidden lg:block" aria-label="On this page">
              <div className="sticky top-28 space-y-1 text-[14px]">
                {toc.map(([id, label], i) => (
                  <a key={id} href={`#${id}`} className="block rounded-[10px] px-3 py-1.5 text-ink/60 transition hover:bg-white hover:text-ink">
                    <span className="mr-2 text-ink/35 tnum">{String(i + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                ))}
              </div>
            </nav>

            <article className="max-w-3xl space-y-10">
              <Sec id="who" n={1} title="Who we are">
                <p>
                  Restropi is software for cafés and restaurants in India: billing with GST and UPI QR, orders to the kitchen, tables and QR ordering, stock, staff and reports. In this policy, <b>&ldquo;Restropi&rdquo;, &ldquo;we&rdquo; and &ldquo;us&rdquo;</b> mean the Restropi team, based in Pune, Maharashtra.
                </p>
                <p>There are two kinds of data in Restropi, and we treat them differently:</p>
                <ul>
                  <li><b>Data about you</b>: visitors to our website, people who ask us for a demo or call back, and restaurant owners who hold a Restropi account. We decide how this data is used.</li>
                  <li><b>Data a restaurant keeps in Restropi</b>: its staff, its guests, their orders and bills. The restaurant decides how this is used, and we process it on the restaurant&apos;s behalf. If you are a guest of a restaurant, that restaurant is responsible for your data; you can also contact us and we will help.</li>
                </ul>
              </Sec>

              <Sec id="what" n={2} title="What we collect">
                <ul>
                  <li><b>When you contact us</b> (book a demo, ask for a call back): your name, phone number, restaurant name and city, and what you tell us.</li>
                  <li><b>Restaurant owners</b>: name, email address, phone number, business details (restaurant name, address, GSTIN, FSSAI, UPI ID) and plan and payment records for your Restropi subscription.</li>
                  <li><b>Restaurant staff</b>: name, mobile number, role and access. Staff sign in with a 4-digit PIN, which is stored only as a secure code, never as the PIN itself.</li>
                  <li><b>Guests who order from a table or counter QR</b>: name and mobile number, the orders placed, the bill and how it was paid, an optional rating and comment, and whether they agreed to receive offers.</li>
                  <li><b>Orders and bills</b> taken by restaurant staff, which may include a guest&apos;s name and mobile number if the staff add them.</li>
                  <li><b>Menu photos</b> a restaurant uploads to create its menu automatically.</li>
                  <li><b>Technical data</b>: device and browser type, pages visited and approximate location (city level), collected through cookies and similar technologies, as described in the cookie policy below.</li>
                </ul>
                <p>
                  <b>Payments:</b> guests pay restaurants directly by UPI, cash or card. Money goes straight to the restaurant&apos;s own UPI ID or card machine. Restropi does not receive, hold or process these payments, and we never collect card numbers, UPI PINs or bank passwords.
                </p>
              </Sec>

              <Sec id="why" n={3} title="How we use it">
                <ul>
                  <li>To run the Restropi service: billing, sending orders to the kitchen, tables, QR ordering, stock, reports and staff access.</li>
                  <li>To sign people in securely and keep each restaurant&apos;s data separate.</li>
                  <li>To reply to demo and call-back requests, and to give support.</li>
                  <li>To send service messages, for example a plan renewal reminder.</li>
                  <li>To let a restaurant send offers on WhatsApp to guests who agreed to receive them. These messages are sent from the restaurant&apos;s own WhatsApp.</li>
                  <li>To understand how the website and app are used so we can improve them, only with your consent where cookies are involved.</li>
                  <li>To meet our legal obligations, such as tax and accounting records, and to prevent fraud and misuse.</li>
                </ul>
                <p>We do not sell personal data, and we do not use a restaurant&apos;s guest data for our own marketing.</p>
              </Sec>

              <Sec id="share" n={4} title="Who we share it with">
                <p>We share data only with service providers that help us run Restropi, and only what they need:</p>
                <ul>
                  <li><b>Supabase</b>: secure database, sign-in and file storage.</li>
                  <li><b>Vercel</b>: website and app hosting, and privacy-friendly visit statistics (Vercel Web Analytics, which uses no cookies).</li>
                  <li><b>Google</b>: Google Analytics and Google Tag Manager on our website (only with your consent), and Google&apos;s AI service to read menu photos that a restaurant uploads.</li>
                  <li><b>WhatsApp</b>: when you tap a WhatsApp button, the message opens in your own WhatsApp app and is sent by you.</li>
                </ul>
                <p>
                  Some of these providers may store data on servers outside India. We may also share data when the law requires it, or to protect the rights and safety of our users and the public.
                </p>
              </Sec>

              <Sec id="cookies" n={5} title="Cookie policy">
                <p>
                  Cookies are small text files a website saves in your browser. Your browser&apos;s local storage works in a similar way. We use them so the website and app work properly, to remember your choices and, only with your consent, to understand how the website is used.
                </p>
                <ul>
                  <li><b>Necessary</b>: needed for the website and app to work, for example keeping you signed in and remembering your cookie choice. Always on.</li>
                  <li><b>Analytics</b>: help us understand how visitors use the website (Google Analytics). Used only if you tap <b>Accept</b>.</li>
                  <li><b>Marketing</b>: help us measure our ads and show more relevant content (tags in Google Tag Manager). Used only if you tap <b>Accept</b>.</li>
                </ul>
                <p>We also use Vercel Web Analytics to count page views. It does not use cookies and does not identify you.</p>
                <div className="overflow-x-auto rounded-[18px] bg-white ring-1 ring-black/[.06]">
                  <table className="w-full min-w-[620px] text-left text-[14px] leading-snug">
                    <thead className="bg-[#f4f5f3] text-ink">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Set by</th>
                        <th className="px-4 py-3 font-semibold">Purpose</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">How long</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[.06] align-top">
                      {cookies.map((r) => (
                        <tr key={r.name}>
                          <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                          <td className="px-4 py-3">{r.who}</td>
                          <td className="px-4 py-3">{r.why}</td>
                          <td className="px-4 py-3">{r.kind}</td>
                          <td className="px-4 py-3">{r.lasts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  When you first visit, we ask whether you accept cookies. If you tap <b>Reject</b>, we use only the necessary ones, and Google Analytics and Google Tag Manager store nothing on your device. To change your choice later, clear this website&apos;s cookies and site data in your browser settings and we will ask you again. If you block necessary cookies, parts of the website and the Restropi app may not work.
                </p>
                <p>
                  Google Analytics and Google Tag Manager are provided by Google, which handles the data they collect under its own privacy policy at{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="font-semibold text-jade underline-offset-4 hover:underline">policies.google.com/privacy</a>.
                </p>
              </Sec>

              <Sec id="keep" n={6} title="How long we keep it">
                <ul>
                  <li>Account, restaurant, order and bill data: for as long as the restaurant&apos;s account is active, and then as long as tax and accounting law requires.</li>
                  <li>Demo and call-back requests: up to 24 months, unless you become a customer.</li>
                  <li>Analytics data: as set in our Google Analytics account, at most 14 months.</li>
                </ul>
                <p>A restaurant can download its data at any time from Settings → Export your data, and can ask us to delete its account.</p>
              </Sec>

              <Sec id="safe" n={7} title="How we keep it safe">
                <ul>
                  <li>All data travels over encrypted connections (HTTPS).</li>
                  <li>Each restaurant can see only its own data, and staff see only the outlets and screens the owner allows.</li>
                  <li>Owner passwords are encrypted. Staff PINs are stored as secure codes and lock after repeated wrong attempts.</li>
                  <li>Payment confirmation, an activity log and password checks protect restaurants against mistakes and misuse.</li>
                </ul>
                <p>No system is perfectly secure. If we learn of a breach that affects your data, we will inform you and the authorities as the law requires.</p>
              </Sec>

              <Sec id="rights" n={8} title="Your rights">
                <p>Under India&apos;s Digital Personal Data Protection Act, 2023 and other applicable law, you can:</p>
                <ul>
                  <li>ask what personal data we hold about you and get a copy;</li>
                  <li>ask us to correct or complete it;</li>
                  <li>ask us to delete it, where we don&apos;t need to keep it by law;</li>
                  <li>withdraw your consent at any time (for cookies, see the cookie policy above);</li>
                  <li>raise a complaint with us, and with the Data Protection Board of India.</li>
                </ul>
                <p>To use any of these rights, write to <a href={`mailto:${EMAIL}`} className="font-semibold text-jade underline-offset-4 hover:underline">{EMAIL}</a>. If your request is about a restaurant&apos;s guest data, we will pass it to that restaurant and help them answer it.</p>
              </Sec>

              <Sec id="children" n={9} title="Children">
                <p>Restropi is meant for businesses and adults. We do not knowingly collect personal data from children under 18. If you believe a child has given us personal data, contact us and we will delete it.</p>
              </Sec>

              <Sec id="changes" n={10} title="Changes to this policy">
                <p>We may update this policy when our service or the law changes. The date at the top shows the latest version. If a change is important, we will tell restaurant owners inside the app or by email.</p>
              </Sec>

              <Sec id="contact" n={11} title="Contact us">
                <p>
                  For any question about privacy or this policy, write to <a href={`mailto:${EMAIL}`} className="font-semibold text-jade underline-offset-4 hover:underline">{EMAIL}</a>. We reply within 7 working days.
                </p>
                <p className="text-[13.5px] text-ink/50">Last updated: {UPDATED}</p>
              </Sec>
            </article>
          </div>
        </main>
        <SiteFooter />
        <MobileCta />
        <HelpChat />
      </div>
    </SiteMotion>
  );
}
