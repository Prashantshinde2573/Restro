"use client";

// The demo request: a full form (in the "Book a free demo" dialog) and a one-field call-back.
import clsx from "clsx";
import { useState } from "react";
import { sb } from "@/lib/cloud";
import { CONTACT_WA } from "./chrome";
import { IconArrow } from "./icons";

type Lead = { name: string; phone: string; restaurant: string | null; city: string | null; kind: string; email?: string | null };

/**
 * Saves the request through our server (which then emails sales@ and sends the customer a confirmation).
 * If the server route isn't set up, saves it straight to the leads table; failing that, hands it to WhatsApp.
 */
export async function sendLead(row: Lead, honeypot = ""): Promise<boolean> {
  try {
    const r = await fetch("/api/enquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...row, website: honeypot, page: window.location.pathname }),
    });
    if (r.ok) return true;
    if (r.status !== 503 && r.status !== 404) return false; // a real problem (bad number, too many tries): show the error
  } catch {}
  try {
    const { error } = await sb().from("leads").insert(row as Record<string, unknown>);
    if (error) throw error;
    return true;
  } catch {
    if (CONTACT_WA) {
      const msg = `Hi, I'd like a Restropi demo.\nName: ${row.name}\nPhone: ${row.phone}${row.restaurant ? `\nRestaurant: ${row.restaurant}` : ""}${row.city ? `\nCity: ${row.city}` : ""}\nType: ${row.kind}`;
      window.open(`https://wa.me/${CONTACT_WA}?text=${encodeURIComponent(msg)}`, "_blank");
      return true;
    }
    return false;
  }
}

const kindsOf = ["Café", "Restaurant", "Cloud kitchen", "Other"];

export function LeadForm({ flat = false }: { flat?: boolean }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", restaurant: "", city: "", kind: "Restaurant" });
  const [trap, setTrap] = useState(""); // hidden from people; bots fill it
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const phone = f.phone.replace(/[^0-9+]/g, "");
  const emailOk = !f.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
  const ok = f.name.trim().length > 1 && phone.replace(/\D/g, "").length >= 10 && emailOk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || state === "sending") return;
    setState("sending");
    const row = { name: f.name.trim().slice(0, 80), phone: phone.slice(0, 16), email: f.email.trim().toLowerCase().slice(0, 160) || null, restaurant: f.restaurant.trim().slice(0, 120) || null, city: f.city.trim().slice(0, 60) || null, kind: f.kind };
    setState((await sendLead(row, trap)) ? "done" : "error");
  };

  if (state === "done")
    return (
      <div className={clsx("rounded-[28px] bg-white p-8 text-center text-ink", !flat && "shadow-[0_40px_80px_-40px_rgb(0_0_0/.5)]")}>
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </span>
        <h3 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">Thank you, {f.name.split(" ")[0]}!</h3>
        <p className="mt-2 text-[15.5px] text-ink/70">We will call you on {phone} within one working day.{f.email.trim() ? ` A confirmation is on its way to ${f.email.trim()}.` : ""}</p>
      </div>
    );

  const input = "h-12 w-full rounded-[14px] bg-[#f4f5f3] px-4 text-[15.5px] text-ink outline-none ring-1 ring-transparent transition placeholder:text-ink/35 focus:bg-white focus:ring-jade/40";
  return (
    <form onSubmit={submit} className={clsx("rounded-[28px] bg-white p-6 text-ink sm:p-8", !flat && "shadow-[0_40px_80px_-40px_rgb(0_0_0/.5)]")}>
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Book a free demo</h3>
      <p className="mt-1 text-[14.5px] text-ink/70">Takes 30 seconds. We call you back.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {kindsOf.map((k) => (
          <button type="button" key={k} onClick={() => setF({ ...f, kind: k })} className={clsx("rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition", f.kind === k ? "bg-ink text-white" : "bg-[#f4f5f3] text-ink/70 hover:bg-[#ebede9]")}>
            {k}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        <input className={input} placeholder="Your name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={80} />
        <input className={input} placeholder="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required maxLength={16} />
        <input className={input} placeholder="Email (optional, for a confirmation)" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} maxLength={160} aria-invalid={!emailOk} />
        <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input className={input} placeholder="Restaurant" value={f.restaurant} onChange={(e) => setF({ ...f, restaurant: e.target.value })} maxLength={120} />
          <input className={input} placeholder="City" autoComplete="address-level2" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} maxLength={60} />
        </div>
      </div>
      <button type="submit" disabled={!ok || state === "sending"} className="group mt-5 flex h-[52px] w-full items-center justify-between rounded-full bg-jade pl-6 pr-2 text-[16px] font-semibold text-white transition hover:bg-jade-deep disabled:opacity-50">
        {state === "sending" ? "Sending…" : "Book my free demo"}
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform duration-500 group-hover:-rotate-45"><IconArrow size={16} /></span>
      </button>
      {state === "error" && <p className="mt-3 text-center text-[13.5px] text-rose">Could not send right now. Please try again in a minute.</p>}
      <p className="mt-3 text-center text-[12.5px] text-ink/65">We only use your details to contact you about Restropi.</p>
    </form>
  );
}

/** Footer: just a phone number. */
export function CallBack() {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const clean = phone.replace(/[^0-9+]/g, "");
  const ok = clean.replace(/\D/g, "").length >= 10;
  if (state === "done") return <p className="rounded-full bg-jade-soft px-5 py-3.5 text-[15px] font-medium text-jade-deep">Thanks! We will call you on {clean} soon.</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || state === "sending") return;
        setState("sending");
        setState((await sendLead({ name: "Call back request", phone: clean.slice(0, 16), restaurant: null, city: null, kind: "Call back" })) ? "done" : "error");
      }}
    >
      <div className="flex items-center rounded-full bg-[#f4f5f3] p-1.5 pl-5 ring-1 ring-black/[.06] focus-within:ring-jade/40">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Your mobile number"
          maxLength={16}
          className="min-w-0 flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-ink/65"
          aria-label="Your mobile number"
        />
        <button type="submit" disabled={!ok || state === "sending"} className="h-11 rounded-full bg-ink px-5 text-[14.5px] font-semibold text-white transition hover:bg-jade-deep disabled:opacity-40">
          {state === "sending" ? "…" : "Call me"}
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-[13px] text-rose">Could not send right now. Please try again.</p>}
    </form>
  );
}
