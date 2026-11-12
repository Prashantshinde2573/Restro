// Website enquiry ("Book a free demo" / "Call me"): save it first, then email sales@ and the customer.
import { env, FROM_SALES, log, mask } from "@/lib/server/env";
import { cleanEmail, json, sameSite } from "@/lib/server/http";
import { allow, clientIp } from "@/lib/server/limit";
import { sendEmail } from "@/lib/server/resend";
import { admin } from "@/lib/server/supabase-admin";
import { enquiryConfirm, enquiryToSales, type Enquiry } from "@/lib/server/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["Café", "Restaurant", "Cloud kitchen", "Other", "Call back"];
const text = (v: unknown, max: number) => {
  const s = String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return s || null;
};

export async function POST(req: Request) {
  if (!env.serviceKey) return json({ error: "not_configured" }, 503); // the page falls back to saving directly
  if (!sameSite(req)) return json({ error: "Forbidden" }, 403);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.website) return json({ ok: true }); // honeypot: bots fill every field

  const name = text(b.name, 80);
  const phone = String(b.phone ?? "").replace(/[^0-9+ ]/g, "").trim().slice(0, 16);
  const rawEmail = String(b.email ?? "").trim();
  const email = rawEmail ? cleanEmail(rawEmail) : null;
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : "Other";
  if (!name || name.length < 2) return json({ error: "Please add your name" }, 400);
  if (!/^[0-9+ ]{8,16}$/.test(phone) || phone.replace(/\D/g, "").length < 10) return json({ error: "Please add a valid mobile number" }, 400);
  if (rawEmail && !email) return json({ error: "That email looks wrong" }, 400);

  if (!(await allow("enquiry:ip", clientIp(req), 6, 60))) return json({ error: "Too many requests. Please try again later." }, 429);

  const row = { name, phone, email, restaurant: text(b.restaurant, 120), city: text(b.city, 60), kind };
  const { data, error } = await admin().from("leads").insert(row).select("created_at").single();
  if (error) {
    log("enquiry.save_failed", { reason: error.message.slice(0, 120) });
    return json({ error: "Could not send right now. Please try again in a minute." }, 500);
  }

  // saved — now the emails. A failed email never loses the enquiry: it's in the admin's leads list either way.
  const e: Enquiry = { ...row, at: data?.created_at ?? new Date().toISOString(), page: text(b.page, 200) };
  const [toSales, toCustomer] = await Promise.all([
    env.resendKey ? sendEmail({ from: FROM_SALES, to: env.salesEmail, replyTo: email ?? undefined, tag: "enquiry_sales", ...enquiryToSales(e) }) : null,
    env.resendKey && email ? sendEmail({ from: FROM_SALES, to: email, replyTo: env.salesEmail, tag: "enquiry_confirm", ...enquiryConfirm(e) }) : null,
  ]);
  log("enquiry.saved", { sales: !!toSales?.ok, customer: email ? !!toCustomer?.ok : "none", to: email ? mask(email) : undefined });
  return json({ ok: true, confirmation: !!toCustomer?.ok });
}
