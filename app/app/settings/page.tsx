"use client";

import { Bike, Check, ChevronRight, CreditCard, KeyRound, LogOut, MessageCircle, Printer, QrCode, Receipt, ShieldCheck, Store, Users, Database } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Avatar, Button, Field, Page, PageHeader, Pill, Segmented, Sheet, SwitchRow, Toggle, inputCls, LocalSegmented } from "@/components/ui";
import { UpiPayCard, isValidUpi } from "@/components/upi";
import { accountActions, resetSavedData, settingsActions, useAccount, useCan, useCurrentOutlet, useMe, useOutlets, useSettings } from "@/lib/live";
import { useCloud } from "@/lib/cloud";
import { OUTLET_LIMIT, RENEW_WARN_DAYS, daysLeft, isOwner } from "@/lib/access";
import clsx from "clsx";
import type { OutletSettings } from "@/lib/types";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { inr } from "@/lib/format";

type Panel = "restaurant" | "tax" | "payments" | "ordering" | "printers" | "security" | "data" | null;

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

export default function SettingsPage() {
  const toast = useToast();
  const r = repo.restaurant();
  const me = useMe();
  const owner = isOwner(me);
  const canOutlet = useCan("outletSettings");
  const account = useAccount();
  const outlets = useOutlets();
  const outlet = useCurrentOutlet();
  const plans = repo.plans();
  const plan = plans.find((p) => p.id === account.plan)!;
  const days = daysLeft(account.renewsAt);
  const renewDate = new Date(account.renewsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const [planOpen, setPlanOpen] = useState(false);
  useEffect(() => {
    if (owner && window.location.hash === "#plan") setPlanOpen(true);
  }, [owner]);
  const [panel, setPanelRaw] = useState<Panel>(null);
  const settings = useSettings();
  const cloud = useCloud();
  const [draft, setDraft] = useState<OutletSettings>(settings);
  const setPanel = (p: Panel) => {
    setDraft(settings);
    setPanelRaw(p);
  };
  const upiOk = isValidUpi(draft.upi);

  const titles: Record<Exclude<Panel, null>, string> = {
    restaurant: "Restaurant details",
    tax: "Bills and GST",
    payments: `Payments · ${outlet.name}`,
    ordering: `Ordering · ${outlet.name}`,
    printers: "Printers and screens",
    security: "Sign-in and security",
    data: "Backups and export",
  };

  return (
    <>
      <PageHeader title="Settings" />
      <Page className="mx-auto max-w-2xl space-y-6 lg:mx-0">
        {me && (
          <div className="flex items-center gap-4 rounded-group bg-surface p-4">
            <Avatar name={me.name} hue={me.hue} size={52} />
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold">{me.name}</div>
              <div className="text-[14px] text-muted">{owner ? "Owner · admin" : `${me.title} · ${outlet.name}`}</div>
            </div>
          </div>
        )}

        {/* Subscription — owner only */}
        {owner && (
          <section id="plan" className="overflow-hidden rounded-group bg-ink p-5 text-canvas">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] text-canvas/60">Your plan</div>
                <div className="text-[24px] font-semibold tracking-tight">{plan.name}</div>
                <div className="text-[14px] text-canvas/70">{plan.monthly ? `${inr(plan.monthly)} per outlet / month · ` : ""}{outlets.length} outlets</div>
              </div>
              <Pill tone={days <= 0 ? "rose" : days <= RENEW_WARN_DAYS ? "saffron" : "jade"}>{days <= 0 ? "Ended" : days <= RENEW_WARN_DAYS ? `${days} days left` : "Active"}</Pill>
            </div>
            <div className="mt-4 text-[13px] text-canvas/70">
              {days <= 0 ? `Ended on ${renewDate}` : `Renews on ${renewDate}`}
              {plan.monthly ? ` · ${inr(plan.monthly * outlets.length)}` : ""}
            </div>
            {cloud.rid ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" className="!text-canvas/80 hover:!bg-white/10" onClick={() => setPlanOpen(true)}>See plans</Button>
                <span className="text-[12.5px] text-canvas/60">To renew or change plan, contact Restro on WhatsApp.</span>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" className="!bg-canvas !text-ink hover:!bg-canvas/90" onClick={() => { accountActions.renew(); toast("Renewed for 1 month"); }}>Renew now</Button>
                <Button size="sm" variant="ghost" className="!text-canvas/80 hover:!bg-white/10" onClick={() => setPlanOpen(true)}>Change plan</Button>
              </div>
            )}
          </section>
        )}

        {owner && (
          <div className="overflow-hidden rounded-group bg-surface">
            <Item icon={<Store size={16} />} tint="#0E7A5F" title="Restaurant details" value={settings.name} onClick={() => setPanel("restaurant")} />
            <Link href="/app/access" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/40">
              <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#2C6EC8] text-white"><Users size={16} /></span>
              <span className="flex-1 text-[15px]">Outlets, members & access</span>
              <span className="text-[14px] text-muted">{outlets.length} outlets</span>
              <ChevronRight size={17} className="text-faint" />
            </Link>
          </div>
        )}

        {(owner || canOutlet) && (
          <div>
            <div className="mb-1.5 px-1 text-[13px] font-medium text-muted">{outlet.name} · {outlet.businessType === "cafe" ? "Café" : "Restaurant"}</div>
            <div className="overflow-hidden rounded-group bg-surface">
              <Item icon={<CreditCard size={16} />} tint="#0E7A5F" title="Payments" value={settings.upi} onClick={() => setPanel("payments")} />
              <Item icon={<QrCode size={16} />} tint="#2C6EC8" title="Ordering" value={settings.businessType === "cafe" ? "Café · pay first" : settings.payFirst ? "Pay first" : "Pay at the end"} onClick={() => setPanel("ordering")} />
              <Item icon={<Receipt size={16} />} tint="#DE9122" title="Bills and GST" value="5%" onClick={() => setPanel("tax")} />
              <Item icon={<Printer size={16} />} tint="#68716D" title="Printers and screens" onClick={() => setPanel("printers")} />
            </div>
          </div>
        )}

        {owner && (
          <div className="overflow-hidden rounded-group bg-surface">
            <Item icon={<ShieldCheck size={16} />} tint="#D24242" title="Sign-in and security" onClick={() => setPanel("security")} />
            <Item icon={<Database size={16} />} tint="#68716D" title="Backups and export" onClick={() => setPanel("data")} />
          </div>
        )}

        <Link href="/login"><Button variant="danger" className="w-full"><LogOut size={16} /> Sign out</Button></Link>
      </Page>

      {/* ---------- change plan ---------- */}
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Plans" wide>
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const cur = p.id === account.plan;
            const tooSmall = OUTLET_LIMIT[p.id] < outlets.length;
            return (
              <div key={p.id} className={clsx("rounded-group bg-surface p-4", cur && "ring-2 ring-jade")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[17px] font-semibold">{p.name}</span>
                  <span className="text-[15px] font-semibold tnum">{p.monthly ? `${inr(p.monthly)}/outlet` : "Custom"}</span>
                </div>
                <div className="text-[13px] text-muted">{p.outlets}</div>
                <ul className="mt-2 space-y-1 text-[13.5px]">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-jade" />{f}</li>)}
                </ul>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  variant={cur ? "plain" : "primary"}
                  disabled={cur || tooSmall || !!cloud.rid}
                  onClick={() => { accountActions.setPlan(p.id); setPlanOpen(false); toast(`Now on ${p.name}`); }}
                >
                  {cur ? "Current plan" : tooSmall ? `Allows ${OUTLET_LIMIT[p.id]} outlet` : `Switch to ${p.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </Sheet>

      <Sheet
        open={!!panel}
        onClose={() => setPanel(null)}
        title={panel ? titles[panel] : ""}
        footer={
          panel ? (
            <Button
              size="lg"
              className="w-full"
              disabled={panel === "payments" && !upiOk}
              onClick={() => {
                settingsActions.update(draft);
                setPanel(null);
                toast(panel === "payments" ? "Saved · every new bill QR uses this UPI ID" : "Saved");
              }}
            >
              Save
            </Button>
          ) : undefined
        }
      >
        {panel === "restaurant" && (
          <div className="space-y-4">
            <Field label="Name on bills and the guest menu"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
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
              <SwitchRow label="Ask guests for an optional tip" hint="Never added automatically." initial />
              <SwitchRow label="Print FSSAI number on bill" initial />
            </div>
            <Field label="Message at the bottom of the bill"><input className={inputCls} defaultValue="Thank you! See you again 🙏" /></Field>
          </div>
        )}
        {panel === "payments" && (
          <div className="space-y-4">
            <Field label="UPI ID for QR payments" hint="Each bill gets a QR for its exact amount.">
              <input className={inputCls} autoCapitalize="none" value={draft.upi} onChange={(e) => setDraft({ ...draft, upi: e.target.value.replace(/\s/g, "") })} />
            </Field>
            {!upiOk && <p className="-mt-2 text-[13.5px] font-medium text-rose">Enter a UPI ID like name@bank.</p>}
            {upiOk && (
              <div className="rounded-group bg-surface p-4">
                <div className="mb-2 text-center text-[13.5px] font-semibold">Test QR · scan with your UPI app</div>
                <UpiPayCard upi={draft.upi} payee={draft.name} amount={1} note="Restro test" size={140} compact />
              </div>
            )}
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
            <Field label="How guests are served">
              <Segmented
                className="w-full"
                value={draft.businessType}
                onChange={(v) => setDraft({ ...draft, businessType: v, payFirst: v === "cafe" ? true : draft.payFirst })}
                options={[{ value: "restaurant", label: "Restaurant · table service" }, { value: "cafe", label: "Café · counter + token" }]}
              />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
              <div>
                <div className="text-[15px]">Guests pay before the kitchen starts</div>
                <div className="text-[12.5px] text-muted">Order → pay (UPI, cash, or both) → token. Usual for cafés. Off: guests pay at the end.</div>
              </div>
              <Toggle checked={draft.payFirst} onChange={(v) => setDraft({ ...draft, payFirst: v })} label="Guests pay first" />
            </div>
            {draft.businessType === "cafe" && (
              <Link href={`/order/counter${cloud.rid ? `?r=${cloud.rid}` : ""}`} className="block rounded-group bg-surface px-4 py-3 text-[14px] font-semibold text-jade">Preview the counter QR menu →</Link>
            )}
            <div className="space-y-px overflow-hidden rounded-group">
              <SwitchRow label="Table QR ordering" hint="Guests order and pay from their phone" initial />
              <SwitchRow label="Staff accept a new group's first order" hint="Stops orders from a photo of the QR." initial />
              <SwitchRow label="Take QR orders only during opening hours" hint="Outside your hours the QR shows the menu but ordering is off." initial />
              <SwitchRow label="Check the phone is at the restaurant" hint="Asked once, at the first order." />
              <SwitchRow label="Ask for mobile number + OTP" hint="Asked once, before the first order." initial />
              <SwitchRow label="WhatsApp ordering" hint="Guests message your number and get a menu link" initial />
            </div>
            <div className="mb-1 px-1 text-[13px] font-medium text-muted">Shared tables</div>
            <div className="space-y-px overflow-hidden rounded-group">
              <SwitchRow label="Allow table sharing" hint="Seat strangers at one table, each party with its own order and bill" initial />
              <SwitchRow label="Each new phone starts its own bill" hint="Friends join one bill with a group code shared from the first phone" initial />
              <SwitchRow label="Group codes expire after 10 minutes" hint="An old code passed around can't be used to add to someone's bill" initial />
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
            <p className="text-[14px] text-muted">Backed up every night, kept for 30 days.</p>
            <Button variant="plain" className="w-full" onClick={() => toast("Export started · link on email")}>Download all data</Button>
            {!cloud.rid && <Button variant="danger" className="w-full" onClick={resetSavedData}>Demo only: reset to sample data</Button>}
          </div>
        )}
      </Sheet>
    </>
  );
}
