"use client";

import Link from "next/link";
import { Bike, Building2, ChevronRight, CreditCard, KeyRound, LogOut, MessageCircle, Printer, QrCode, Receipt, ShieldCheck, Store, Users, Database, Languages } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, Button, Field, Page, PageHeader, Pill, Sheet, SwitchRow, inputCls, LocalSegmented } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";

type Panel = "restaurant" | "tax" | "payments" | "ordering" | "printers" | "roles" | "outlets" | "security" | "data" | null;

function Item({ icon, tint, title, value, onClick }: { icon: ReactNode; tint: string; title: string; value?: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40">
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] text-white" style={{ background: tint }}>{icon}</span>
      <span className="flex-1 whitespace-nowrap text-[15px]">{title}</span>
      {value && <span className="max-w-[45%] truncate text-[14px] text-muted">{value}</span>}
      <ChevronRight size={17} className="text-faint" />
    </button>
  );
}

const roles = [
  { r: "Owner", can: "Everything, including payouts and deleting data" },
  { r: "Manager", can: "Refunds, discounts above 10%, day close, staff rota" },
  { r: "Captain", can: "Take orders, move tables, request bill" },
  { r: "Cashier", can: "Charge bills, small discounts, print receipts" },
  { r: "Chef", can: "Kitchen screen, stock counts, waste" },
];

export default function SettingsPage() {
  const toast = useToast();
  const r = repo.restaurant();
  const plan = repo.plans().find((p) => p.name === r.plan)!;
  const [panel, setPanel] = useState<Panel>(null);

  const titles: Record<Exclude<Panel, null>, string> = {
    restaurant: "Restaurant details",
    tax: "Bills and GST",
    payments: "Payments",
    ordering: "Online ordering",
    printers: "Printers and screens",
    roles: "Who can do what",
    outlets: "Outlets",
    security: "Sign-in and security",
    data: "Backups and export",
  };

  return (
    <>
      <PageHeader title="Settings" />
      <Page className="mx-auto max-w-2xl space-y-6 lg:mx-0">
        <div className="flex items-center gap-4 rounded-group bg-surface p-4">
          <Avatar name={r.owner} hue={160} size={52} />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">{r.owner}</div>
            <div className="text-[14px] text-muted">Owner · owner@saffronlane.in</div>
          </div>
        </div>

        {/* Subscription */}
        <section className="overflow-hidden rounded-group bg-ink p-5 text-canvas">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] text-canvas/60">Your plan</div>
              <div className="text-[24px] font-semibold tracking-tight">{plan.name}</div>
              <div className="text-[14px] text-canvas/70">{inr(plan.monthly!)} per outlet / month · {r.outlets.length} outlets</div>
            </div>
            <Pill tone="jade">Active</Pill>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-canvas/70">
            <span>Next bill {inr(plan.monthly! * r.outlets.length)} on 1 Nov</span>
            <span>Paid by UPI AutoPay</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/pricing"><Button size="sm" className="!bg-canvas !text-ink hover:!bg-canvas/90">Compare plans</Button></Link>
            <Button size="sm" variant="ghost" className="!text-canvas/80 hover:!bg-white/10" onClick={() => toast("Invoices downloaded")}>Invoices</Button>
          </div>
        </section>

        <div className="overflow-hidden rounded-group bg-surface">
          <Item icon={<Store size={16} />} tint="#0E7A5F" title="Restaurant details" value={r.name} onClick={() => setPanel("restaurant")} />
          <Item icon={<Building2 size={16} />} tint="#2C6EC8" title="Outlets" value={`${r.outlets.length} outlets`} onClick={() => setPanel("outlets")} />
          <Item icon={<Users size={16} />} tint="#7A5AF8" title="Who can do what" value="5 roles" onClick={() => setPanel("roles")} />
        </div>

        <div className="overflow-hidden rounded-group bg-surface">
          <Item icon={<Receipt size={16} />} tint="#DE9122" title="Bills and GST" value="5% · prices exclude GST" onClick={() => setPanel("tax")} />
          <Item icon={<CreditCard size={16} />} tint="#0E7A5F" title="Payments" value={r.upi} onClick={() => setPanel("payments")} />
          <Item icon={<QrCode size={16} />} tint="#2C6EC8" title="Online ordering" value="QR, WhatsApp, Swiggy, Zomato" onClick={() => setPanel("ordering")} />
          <Item icon={<Printer size={16} />} tint="#68716D" title="Printers and screens" value="3 connected" onClick={() => setPanel("printers")} />
        </div>

        <div className="overflow-hidden rounded-group bg-surface">
          <Item icon={<ShieldCheck size={16} />} tint="#D24242" title="Sign-in and security" value="2-step on" onClick={() => setPanel("security")} />
          <Item icon={<Database size={16} />} tint="#68716D" title="Backups and export" value="Daily, automatic" onClick={() => setPanel("data")} />
          <Item icon={<Languages size={16} />} tint="#7A5AF8" title="Language" value="English, मराठी, हिंदी" onClick={() => toast("Change language from the menu")} />
        </div>

        <Button variant="danger" className="w-full" onClick={() => toast("Signed out")}><LogOut size={16} /> Sign out</Button>
        <p className="text-center text-[12px] text-faint">Restro 0.1 · prototype</p>
      </Page>

      <Sheet
        open={!!panel}
        onClose={() => setPanel(null)}
        title={panel ? titles[panel] : ""}
        footer={panel && panel !== "roles" ? <Button size="lg" className="w-full" onClick={() => { setPanel(null); toast("Saved"); }}>Save</Button> : undefined}
      >
        {panel === "restaurant" && (
          <div className="space-y-4">
            <Field label="Name on bills"><input className={inputCls} defaultValue={r.name} /></Field>
            <Field label="GSTIN"><input className={inputCls} defaultValue={r.gstin} /></Field>
            <Field label="FSSAI licence"><input className={inputCls} defaultValue="11521999000123" /></Field>
            <Field label="Address"><input className={inputCls} defaultValue="Baner Road, Pune 411045" /></Field>
            <Field label="Opening hours"><input className={inputCls} defaultValue="11:00 am – 11:30 pm" /></Field>
          </div>
        )}
        {panel === "tax" && (
          <div className="space-y-4">
            <Field label="GST on food">
              <LocalSegmented className="w-full" initial="5" options={[{ value: "5", label: "5%" }, { value: "18", label: "18% (hotel)" }, { value: "0", label: "Not registered" }]} />
            </Field>
            <div className="space-y-px overflow-hidden rounded-group">
              <SwitchRow label="Menu prices include GST" />
              <SwitchRow label="Round bills to nearest rupee" initial />
              <SwitchRow label="Ask for service charge" hint="Optional for guests, as per CCPA guidelines" />
              <SwitchRow label="Print FSSAI number on bill" initial />
            </div>
            <Field label="Message at the bottom of the bill"><input className={inputCls} defaultValue="Thank you! See you again 🙏" /></Field>
          </div>
        )}
        {panel === "payments" && (
          <div className="space-y-4">
            <Field label="UPI ID for QR payments" hint="Money goes straight to this account. No gateway fees."><input className={inputCls} defaultValue={r.upi} /></Field>
            <div className="space-y-px overflow-hidden rounded-group">
              <SwitchRow label="Cash" initial />
              <SwitchRow label="Card machine" initial />
              <SwitchRow label="Split by guest" hint="Each guest pays their share from the table QR" initial />
              <SwitchRow label="Pay later (credit for regulars)" />
            </div>
          </div>
        )}
        {panel === "ordering" && (
          <div className="space-y-4">
            <div className="space-y-px overflow-hidden rounded-group">
              <SwitchRow label="Table QR ordering" hint="Guests order and pay from their phone" initial />
              <SwitchRow label="Orders need captain approval" hint="Turn off to send QR orders straight to the kitchen" initial />
              <SwitchRow label="WhatsApp ordering" hint="Guests message your number and get a menu link" initial />
            </div>
            <div className="overflow-hidden rounded-group bg-surface">
              {[["Swiggy", "Connected", "#E2620C"], ["Zomato", "Connected", "#D24242"], ["ONDC", "Not connected", "#2C6EC8"]].map(([n, s, c]) => (
                <div key={n} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[9px] text-white" style={{ background: c }}><Bike size={16} /></span>
                  <span className="flex-1 text-[15px]">{n}</span>
                  <Pill tone={s === "Connected" ? "jade" : "neutral"}>{s}</Pill>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-muted"><MessageCircle size={14} /> Aggregator orders land on the same order screen and kitchen display.</div>
          </div>
        )}
        {panel === "printers" && (
          <div className="overflow-hidden rounded-group bg-surface">
            {[["Counter printer", "Bills · 80 mm · Wi-Fi", true], ["Kitchen printer", "KOTs · Kitchen + Tandoor", true], ["Bar printer", "KOTs · Bar", false], ["Kitchen screen", "Tablet · Online", true]].map(([n, d, ok]) => (
              <div key={String(n)} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                <Printer size={18} className="text-muted" />
                <span className="flex-1"><span className="block text-[15px]">{n}</span><span className="text-[12.5px] text-muted">{d}</span></span>
                <Pill tone={ok ? "jade" : "rose"}>{ok ? "Online" : "Offline"}</Pill>
              </div>
            ))}
          </div>
        )}
        {panel === "roles" && (
          <div className="overflow-hidden rounded-group bg-surface">
            {roles.map((x) => (
              <div key={x.r} className="border-b border-line/80 px-4 py-3 last:border-0">
                <div className="text-[15px] font-medium">{x.r}</div>
                <div className="text-[13px] text-muted">{x.can}</div>
              </div>
            ))}
          </div>
        )}
        {panel === "outlets" && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-group bg-surface">
              {r.outlets.map((o) => (
                <div key={o} className="flex items-center justify-between border-b border-line/80 px-4 py-3 last:border-0">
                  <span className="text-[15px]">{o}</span>
                  <Pill tone="jade">Live</Pill>
                </div>
              ))}
            </div>
            <Button variant="tinted" className="w-full" onClick={() => toast("New outlet wizard")}>Add outlet · {inr(plan.monthly!)}/month</Button>
          </div>
        )}
        {panel === "security" && (
          <div className="space-y-px overflow-hidden rounded-group">
            <SwitchRow label="2-step sign-in for owner" hint="Code on WhatsApp when signing in on a new device" initial />
            <SwitchRow label="Manager PIN for refunds and voids" initial />
            <SwitchRow label="Log out tills after 30 min idle" initial />
            <div className="flex items-center gap-3 bg-surface px-4 py-3"><KeyRound size={17} className="text-muted" /><span className="text-[15px]">Signed-in devices · 6</span></div>
          </div>
        )}
        {panel === "data" && (
          <div className="space-y-4">
            <p className="text-[14px] text-muted">Your data is backed up every night and kept for 30 days. You can download everything at any time — it&apos;s yours.</p>
            <Button variant="plain" className="w-full" onClick={() => toast("Export started · link on email")}>Download all data</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
