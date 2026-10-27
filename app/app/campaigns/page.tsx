"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Field, Group, Page, PageHeader, Pill, Segmented, Sheet, SwitchRow, inputCls, LocalSegmented } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";

const coupons = [
  { code: "DIWALI15", rule: "15% off above ₹1,500", used: 42, ends: "3 Nov" },
  { code: "FIRSTDIRECT", rule: "₹150 off first direct order", used: 118, ends: "Always on" },
  { code: "LUNCH99", rule: "Lunch thali ₹99 off, Mon–Fri 12–3", used: 64, ends: "Always on" },
];

export default function CampaignsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"campaigns" | "auto" | "offers">("campaigns");
  const [compose, setCompose] = useState(false);
  const [msg, setMsg] = useState("Hi {name}! Diwali at Saffron Lane 🪔 Our family thali is back this week — ₹1,299 for 4. Show this message for a free Sitaphal Basundi. Book: wa.me/restro");
  const list = repo.campaigns();
  const sent = list.filter((c) => c.status === "sent");

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle={`${inr(sent.reduce((s, c) => s + (c.revenue ?? 0), 0))} brought back this month`}
        actions={<Button size="sm" onClick={() => setCompose(true)}><Plus size={16} /> New</Button>}
      >
        <Segmented value={tab} onChange={setTab} options={[{ value: "campaigns", label: "Messages" }, { value: "auto", label: "Automatic" }, { value: "offers", label: "Offers" }]} />
      </PageHeader>
      <Page>
        {tab === "campaigns" && (
          <Group flush>
            {list.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3.5 last:border-0 lg:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium">{c.name}</span>
                    <Pill tone={c.status === "sent" ? "neutral" : c.status === "scheduled" ? "sky" : "saffron"}>{c.status === "sent" ? "Sent" : c.status === "scheduled" ? "Scheduled" : "Draft"}</Pill>
                  </div>
                  <div className="truncate text-[13px] text-muted">{c.channel} · {c.audience} · {c.when}</div>
                </div>
                {c.status === "sent" && (
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-jade tnum">{inr(c.revenue ?? 0)}</div>
                    <div className="text-[12.5px] text-muted tnum">{c.visits} visits from {c.sent}</div>
                  </div>
                )}
              </div>
            ))}
          </Group>
        )}

        {tab === "auto" && (
          <div className="space-y-6">
            <div className="space-y-px overflow-hidden rounded-group">
              <SwitchRow label="Birthday treat" hint="WhatsApp 3 days before with a free dessert" initial />
              <SwitchRow label="Win back regulars" hint="Guests who usually come every 2 weeks but haven't in 30 days" initial />
              <SwitchRow label="Thank-you after first visit" hint="With a ₹100 voucher for the second visit" initial />
              <SwitchRow label="Review request" hint="Sent with every e-bill — happy guests go to Google" initial />
              <SwitchRow label="Festival greetings" hint="Diwali, Gudi Padwa, Eid, Christmas — written for you" />
            </div>
            <p className="px-1 text-[13px] text-muted">Automatic messages respect opt-outs and never send more than one message a week to the same guest.</p>
          </div>
        )}

        {tab === "offers" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Group title="Coupon codes" flush>
              {coupons.map((c) => (
                <div key={c.code} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                  <span className="rounded-[8px] bg-ink px-2 py-1 text-[12.5px] font-bold tracking-wide text-canvas">{c.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px]">{c.rule}</div>
                    <div className="text-[12.5px] text-muted">Used {c.used} times · {c.ends}</div>
                  </div>
                </div>
              ))}
            </Group>
            <Group title="Happy hours">
              <div className="space-y-3">
                {[["Weekday lull", "Mon–Thu · 3–6 pm", "20% off drinks + starters"], ["Late night", "Fri–Sat · 10:30–11:30 pm", "Desserts at ₹99"]].map(([n, w, d]) => (
                  <div key={n} className="flex items-start justify-between gap-3 rounded-ctl bg-sunken/60 p-3">
                    <div>
                      <div className="text-[15px] font-medium">{n}</div>
                      <div className="text-[13px] text-muted">{w} · {d}</div>
                    </div>
                    <Pill tone="jade">On</Pill>
                  </div>
                ))}
                <div className="flex items-start gap-2 text-[13px] text-muted">
                  <Sparkles size={14} className="mt-0.5 shrink-0 text-saffron" />
                  Tuesdays 3–6 pm are your quietest hours (avg 7 guests). A happy hour there could add about ₹9,000 a month.
                </div>
              </div>
            </Group>
          </div>
        )}
      </Page>

      <Sheet open={compose} onClose={() => setCompose(false)} title="New campaign" wide footer={<Button size="lg" className="w-full" onClick={() => { setCompose(false); toast("Scheduled · 412 guests on 29 Oct, 11 am"); }}>Schedule for 412 guests</Button>}>
        <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <Field label="Who gets it">
              <select className={inputCls} defaultValue="gold">
                <option value="gold">Regulars (Gold + Inner circle) · 412</option>
                <option>Not seen in 30 days · 186</option>
                <option>Ordered biryani in the last 60 days · 540</option>
                <option>Everyone who opted in · 1,920</option>
              </select>
            </Field>
            <Field label="Send by">
              <LocalSegmented className="w-full" initial="WhatsApp" options={["WhatsApp", "SMS", "Email"].map((v) => ({ value: v, label: v }))} />
            </Field>
            <Field label="Message" hint="{name} becomes each guest's first name.">
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} className="w-full rounded-ctl bg-surface p-4 text-[15px] outline-none ring-1 ring-line focus:ring-2 focus:ring-jade" />
            </Field>
            <button onClick={() => setMsg("नमस्कार {name}! दिवाळीनिमित्त Saffron Lane मध्ये फॅमिली थाळी फक्त ₹1,299 (4 जणांसाठी). हा मेसेज दाखवा आणि सीताफळ बासुंदी मोफत मिळवा 🪔")} className="flex items-center gap-1.5 text-[14px] font-semibold text-jade">
              <Sparkles size={15} /> Rewrite in Marathi
            </button>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-muted">Preview</div>
            <div className="rounded-[22px] bg-[#E7DED3] p-3">
              <div className="ml-auto max-w-[95%] rounded-[14px] rounded-tr-[4px] bg-white p-3 text-[13.5px] leading-snug text-[#111] shadow-sm">
                {msg.replace("{name}", "Neha")}
                <div className="mt-1 text-right text-[10.5px] text-[#667]">11:00</div>
              </div>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  );
}
