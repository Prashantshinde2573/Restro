// Restropi email templates: one responsive, table-based layout (works in Gmail, Outlook, Apple Mail),
// plus a plain-text version of every email.
import { SITE_URL } from "@/lib/site";
import { env } from "./env";

const C = { jade: "#0e7a5f", jadeDeep: "#095442", jadeSoft: "#e2f1eb", ink: "#18211e", muted: "#5d6763", line: "#e6e8e4", canvas: "#f3f4f1" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Mail = { subject: string; html: string; text: string };

function layout(o: { preheader: string; title: string; body: string; footer?: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only">
<title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas}"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 20px"><a href="${SITE_URL}" style="text-decoration:none"><img src="${SITE_URL}/brand/restropi-logo-dark.png" width="120" height="36" alt="Restropi" style="display:block;border:0;height:36px;width:auto"></a></td></tr>
    <tr><td style="background:#ffffff;border-radius:20px;padding:32px 28px;font-family:${FONT};color:${C.ink};font-size:16px;line-height:1.55">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${C.ink}">${esc(o.title)}</h1>
      ${o.body}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.muted};text-align:center">
      ${o.footer ?? `Restropi · Restaurant billing, KOT &amp; QR ordering<br>Questions? Write to <a href="mailto:${env.supportEmail}" style="color:${C.jade}">${env.supportEmail}</a>`}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;
const muted = (html: string) => `<p style="margin:16px 0 0;font-size:13.5px;color:${C.muted}">${html}</p>`;
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="border-radius:999px;background:${C.jade}">
  <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
const fallbackLink = (href: string) => muted(`If the button doesn't work, copy this link into your browser:<br><a href="${esc(href)}" style="color:${C.jade};word-break:break-all">${esc(href)}</a>`);
const rows = (pairs: [string, string | null | undefined][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border:1px solid ${C.line};border-radius:14px;border-collapse:separate">${pairs
    .filter(([, v]) => v)
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:10px 14px;font-size:13.5px;color:${C.muted};width:30%;white-space:nowrap;vertical-align:top${i ? `;border-top:1px solid ${C.line}` : ""}">${esc(k)}</td><td style="padding:10px 14px;font-size:15px;color:${C.ink}${i ? `;border-top:1px solid ${C.line}` : ""}">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
const txtRows = (pairs: [string, string | null | undefined][]) => pairs.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");

/* ---------------- account emails (from support@) ---------------- */

export function welcomeEmail(o: { name: string; restaurant: string; email: string; link: string; loginUrl: string }): Mail {
  const first = o.name.split(" ")[0] || "there";
  return {
    subject: `Welcome to Restropi — ${o.restaurant} is ready`,
    html: layout({
      preheader: `Set your password and open ${o.restaurant} on Restropi.`,
      title: `Welcome to Restropi, ${first}!`,
      body:
        p(`Your restaurant <b>${esc(o.restaurant)}</b> is set up and ready to take orders.`) +
        rows([["Sign-in email", o.email], ["Sign in at", o.loginUrl]]) +
        p(`To get started, set your own password with the button below.`) +
        button(o.link, "Set my password") +
        `<p style="margin:0 0 8px;font-weight:600">Next steps</p>
         <ol style="margin:0 0 6px;padding-left:20px;color:${C.ink}">
           <li style="margin-bottom:6px">Set your password and sign in.</li>
           <li style="margin-bottom:6px">Add your menu (or snap a photo of your printed menu).</li>
           <li style="margin-bottom:6px">Print table QR codes and add your staff with PINs.</li>
         </ol>` +
        muted(`This link works once and expires in 1 hour. If it has expired, use “Forgot password?” on the sign-in page with this email.`) +
        fallbackLink(o.link),
    }),
    text: `Welcome to Restropi, ${first}!\n\n${o.restaurant} is set up and ready.\n\nSign-in email: ${o.email}\nSign in at: ${o.loginUrl}\n\nSet your password: ${o.link}\n(The link works once and expires in 1 hour. If it expired, use "Forgot password?" on the sign-in page.)\n\nQuestions? ${env.supportEmail}`,
  };
}

export function resetEmail(o: { link: string }): Mail {
  return {
    subject: "Reset your Restropi password",
    html: layout({
      preheader: "A link to set a new password for your Restropi login.",
      title: "Reset your password",
      body:
        p("We got a request to reset the password for your Restropi login. Tap the button to choose a new one.") +
        button(o.link, "Set a new password") +
        muted("This link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email — your password stays the same.") +
        fallbackLink(o.link),
    }),
    text: `Reset your Restropi password\n\nOpen this link to choose a new password (works once, expires in 1 hour):\n${o.link}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

export function otpEmail(o: { code: string }): Mail {
  return {
    subject: `${o.code} is your Restropi sign-in code`,
    html: layout({
      preheader: "Your one-time sign-in code for Restropi.",
      title: "Your sign-in code",
      body:
        p("Enter this code on the Restropi sign-in page:") +
        `<div style="margin:18px 0;padding:18px;border-radius:16px;background:${C.jadeSoft};text-align:center;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;white-space:nowrap;color:${C.jadeDeep}">${esc(o.code)}</div>` +
        muted("The code expires in 1 hour and works once. Never share it — Restropi staff will never ask for it. If you didn't try to sign in, ignore this email."),
    }),
    text: `Your Restropi sign-in code: ${o.code}\n\nIt expires in 1 hour and works once. Never share it. If you didn't try to sign in, ignore this email.`,
  };
}

/* ---------------- website enquiries ---------------- */

export type Enquiry = { name: string; phone: string; email: string | null; restaurant: string | null; city: string | null; kind: string; at: string; page?: string | null };

const enquiryPairs = (e: Enquiry): [string, string | null][] => [
  ["Name", e.name],
  ["Phone", e.phone],
  ["Email", e.email],
  ["Restaurant", e.restaurant],
  ["City", e.city],
  ["Type", e.kind],
  ["Page", e.page ?? null],
  ["Received", new Date(e.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })],
];

export function enquiryToSales(e: Enquiry): Mail {
  const phone = e.phone.replace(/[^0-9+]/g, "");
  const wa = phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1");
  return {
    subject: `New enquiry: ${e.name}${e.restaurant ? ` · ${e.restaurant}` : ""}${e.city ? ` (${e.city})` : ""}`,
    html: layout({
      preheader: `${e.kind} enquiry from ${e.name}, ${e.phone}`,
      title: "New website enquiry",
      body:
        p(`Someone asked for a demo on restropi.com.`) +
        rows(enquiryPairs(e)) +
        `<p style="margin:18px 0 0"><a href="tel:${esc(phone)}" style="color:${C.jade};font-weight:600">Call ${esc(e.phone)}</a> &nbsp;·&nbsp; <a href="https://wa.me/${esc(wa)}" style="color:${C.jade};font-weight:600">WhatsApp</a>${e.email ? ` &nbsp;·&nbsp; <a href="mailto:${esc(e.email)}" style="color:${C.jade};font-weight:600">Reply by email</a>` : ""}</p>`,
      footer: "Sent by the restropi.com enquiry form.",
    }),
    text: `New website enquiry\n\n${txtRows(enquiryPairs(e))}`,
  };
}

export function enquiryConfirm(e: Enquiry): Mail {
  const first = e.name.split(" ")[0];
  return {
    subject: "We got your Restropi demo request",
    html: layout({
      preheader: "Thanks! We'll call you within one working day.",
      title: `Thanks, ${first}!`,
      body:
        p(`We got your request for a free Restropi demo. Someone from our team will call you on <b>${esc(e.phone)}</b> within one working day.`) +
        rows([["Name", e.name], ["Phone", e.phone], ["Restaurant", e.restaurant], ["City", e.city], ["Type", e.kind]]) +
        p(`Meanwhile, you can see the plans at <a href="${SITE_URL}/pricing" style="color:${C.jade}">restropi.com/pricing</a>.`) +
        muted(`Something to add? Just reply to this email — it reaches our sales team.`),
      footer: `Restropi · <a href="mailto:${env.salesEmail}" style="color:${C.jade}">${env.salesEmail}</a>`,
    }),
    text: `Thanks, ${first}!\n\nWe got your Restropi demo request and will call you on ${e.phone} within one working day.\n\n${txtRows([["Restaurant", e.restaurant], ["City", e.city], ["Type", e.kind]])}\n\nReply to this email to reach our sales team.`,
  };
}

/* ---------------- inbound forward (to the owner's personal inbox) ---------------- */

const stripHtml = (h: string) =>
  h.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();

export function inboundForward(m: { from: string; to: string[]; cc?: string[]; subject: string; text: string | null; html: string | null; at: string; attachments?: { filename?: string; size?: number }[] }): Mail {
  const body = (m.text?.trim() || (m.html ? stripHtml(m.html) : "") || "(no message text)").slice(0, 20_000);
  const files = (m.attachments ?? []).map((a) => `${a.filename ?? "file"}${a.size ? ` (${Math.round(a.size / 1024)} KB)` : ""}`).join(", ");
  const pairs: [string, string | null][] = [
    ["From", m.from],
    ["To", m.to.join(", ")],
    ["Cc", m.cc?.length ? m.cc.join(", ") : null],
    ["Subject", m.subject || "(no subject)"],
    ["Received", new Date(m.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })],
    ["Attachments", files || null],
  ];
  const inbox = m.to.find((t) => /@/.test(t))?.replace(/.*<|>.*/g, "") ?? "Restropi";
  return {
    subject: `[${inbox}] ${m.subject || "(no subject)"}`,
    html: layout({
      preheader: `New email from ${m.from}`,
      title: "New email received",
      body:
        rows(pairs) +
        `<div style="margin-top:16px;padding:16px;border-radius:14px;background:${C.canvas};font-size:14.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word">${esc(body)}</div>` +
        muted("Reply to this email to answer the sender directly."),
      footer: "Forwarded automatically by Restropi from a restropi.com inbox.",
    }),
    text: `New email received\n\n${txtRows(pairs)}\n\n${body}`,
  };
}
