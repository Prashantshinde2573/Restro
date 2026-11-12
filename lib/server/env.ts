// Server-only settings for email. Read from Vercel environment variables — never NEXT_PUBLIC_, never sent to the browser.
import { SITE_URL } from "@/lib/site";

export const env = {
  resendKey: process.env.RESEND_API_KEY ?? "",
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "",
  notifyEmail: process.env.NOTIFY_EMAIL ?? "uddhavjagtap2000@gmail.com",
  supportEmail: process.env.SUPPORT_EMAIL ?? "support@restropi.com",
  salesEmail: process.env.SALES_EMAIL ?? "sales@restropi.com",
};

export const FROM_SUPPORT = `Restropi <${env.supportEmail}>`;
export const FROM_SALES = `Restropi Sales <${env.salesEmail}>`;

export const emailReady = () => !!env.resendKey && !!env.serviceKey;

/** Where links in emails point. Local dev and Vercel previews use their own address; everything else the real site. */
export function siteOrigin(req: Request): string {
  try {
    const o = new URL(req.url).origin;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
    if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL && o === `https://${process.env.VERCEL_URL}`) return o;
  } catch {}
  return SITE_URL;
}

/** Log without personal data: emails are masked, codes / links / tokens are never passed in. */
export function log(event: string, data: Record<string, string | number | boolean | undefined> = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}
export const mask = (email: string) => {
  const [u, d] = email.split("@");
  return d ? `${u.slice(0, 2)}***@${d}` : "***";
};
