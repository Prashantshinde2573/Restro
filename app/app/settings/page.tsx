"use client";

import { L, dateLocale } from "@/lib/i18n";
import { Camera, Check, ChevronRight, CreditCard, Database, Download, KeyRound, LogOut, MessageCircle, QrCode, Receipt, ShieldCheck, Stamp as StampIcon, Store } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Avatar, Button, Field, Hint, Page, PageHeader, Pill, Segmented, Sheet, Toggle, inputCls } from "@/components/ui";
import { UpiPayCard, isValidUpi } from "@/components/upi";
import { openPlanSheet, teamWhatsApp, usePlatform } from "@/components/plan-sheet";
import { dateIN, planStatus } from "@/lib/plan-status";
import { ChangePassword } from "@/components/owner-auth";
import { StampSettings } from "@/components/stamps";
import { OnlinePayments } from "@/components/online-payments";
import { WhatsAppApi } from "@/components/whatsapp-api";
import { useToast } from "@/components/toast";
import {
  billOf,
  memberActions,
  niceTime,
  paymentsText,
  settingsActions,
  useAccount,
  useCan,
  useAllCategories,
  useCategories,
  useCurrentOutlet,
  useFeature,
  useAllFeedback,
  useAllGuests,
  useMe,
  useAllMenu,
  useOrders,
  useOutlets,
  useSettings,
} from "@/lib/live";
import { useAllTables } from "@/lib/tables";
import { cloudSignOut, signOutEverywhere, uploadProfilePhoto, useCloud } from "@/lib/cloud";
import { RENEW_WARN_DAYS, daysLeft, isMixed, isOwner } from "@/lib/access";
import { plans } from "@/lib/plans";
import { inr } from "@/lib/format";
import type { OutletSettings } from "@/lib/types";
import type { Member } from "@/lib/access";

type Panel = "restaurant" | "payments" | "ordering" | "stamps" | "whatsapp" | "security" | "data" | null;

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

const leave = async () => {
  await cloudSignOut();
  window.location.href = "/login";
};

export default function SettingsPage() {
  const toast = useToast();
  const me = useMe();
  const owner = isOwner(me);
  const canOutlet = useCan("outletSettings");
  const stampsFeature = useFeature("stamps");
  const waApi = useFeature("waApi");
  const account = useAccount();
  const outlets = useOutlets();
  const outlet = useCurrentOutlet();
  const cloud = useCloud();
  const plan = plans.find((p) => p.id === account.plan) ?? plans[1];
  const days = daysLeft(account.renewsAt);
  const renewDate = new Date(account.renewsAt).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
  const [planOpen, setPlanOpen] = useState(false);
  const pst = planStatus(account);
  useEffect(() => {
    if (owner && window.location.hash === "#plan") setPlanOpen(true);
  }, [owner]);
  const [panel, setPanelRaw] = useState<Panel>(null);
  const settings = useSettings();
  const [draft, setDraft] = useState<OutletSettings>(settings);
  // opening hours: the times decide table QR ordering, and the bill prints them
  const setHours = (from: string, to: string) =>
    setDraft((d) => ({ ...d, orderFrom: from, orderTo: to, hours: from && to ? `${niceTime(from)} – ${niceTime(to)}` : from || to ? d.hours : "" }));
  const setPanel = (p: Panel) => {
    setDraft(settings);
    setPanelRaw(p);
  };
  const upiOk = isValidUpi(draft.upi);
  const saves = panel === "restaurant" || panel === "payments";
  // Ordering switches take effect the moment they're flipped (no Save button to miss).
  const saveNow = (patch: Partial<OutletSettings>, msg: string) => {
    setDraft((d) => ({ ...d, ...patch }));
    settingsActions.update(patch);
    toast(msg);
  };

  const titles: Record<Exclude<Panel, null>, string> = {
    restaurant: `Details on bills · ${outlet.name}`,
    payments: `Payments · ${outlet.name}`,
    ordering: `Ordering · ${outlet.name}`,
    stamps: `Stamp card · ${outlet.name}`,
    whatsapp: "WhatsApp API",
    security: "Password and sign-in",
    data: "Export your data",
  };

  return (
    <>
      <PageHeader title={L("Settings")} />
      <Page className="mx-auto max-w-2xl space-y-6 lg:mx-0">
        {me && <ProfileCard me={me} subtitle={owner ? L("Owner · {0}", cloud.email ?? "") : `${me.title} · ${outlet.name}`} />}

        {/* Subscription: set by the Restropi team; owner sees it */}
        {owner && (
          <section id="plan" className="overflow-hidden rounded-group bg-ink p-5 text-canvas">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] text-canvas/60">{L("Your plan")}</div>
                <div className="text-[24px] font-semibold tracking-tight">{plan.name}</div>
                <div className="text-[14px] text-canvas/70">{plan.monthly ? L("{0} / month · ", inr(plan.monthly)) : ""}{outlets.length} {L("outlet")}{outlets.length === 1 ? "" : "s"}</div>
              </div>
              <Pill tone={pst.inGrace || days < 0 ? "rose" : days <= RENEW_WARN_DAYS ? "saffron" : "jade"}>{pst.inGrace ? L("Grace period") : days < 0 ? L("Ended") : days <= RENEW_WARN_DAYS ? L("{0} days left", days) : L("Active")}</Pill>
            </div>
            <div className="mt-4 text-[13px] text-canvas/70">{days < 0 ? L("Ended on {0}", renewDate) : L("Runs until {0}", renewDate)}</div>
            {pst.inGrace && account.graceUntil && (
              <div className="mt-2 rounded-[12px] bg-white/10 px-3 py-2 text-[13px] text-canvas">
                {L("Your store is running on a grace period until")} <b>{dateIN(account.graceUntil)}</b> ({pst.daysLeft <= 0 ? L("ends today") : L("{0} day{1} left", pst.daysLeft, pst.daysLeft === 1 ? "" : "s")}{L("). Please renew to keep it on.")}</div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" className="!bg-canvas !text-ink hover:!bg-canvas/90" onClick={() => openPlanSheet()}>{days < 0 ? L("Restart plan") : L("Renew")}</Button>
              <Button size="sm" variant="ghost" className="!text-canvas/80 hover:!bg-white/10" onClick={() => setPlanOpen(true)}>{L("Change plan")}</Button>
            </div>
          </section>
        )}

        {(owner || canOutlet) && (
          <div>
            <div className="mb-1.5 px-1 text-[13px] font-medium text-muted">{outlet.name} · {outlet.businessType === "cafe" ? L("Café") : L("Restaurant")}{isMixed(outlet) ? L(" · tables + counter") : ""}</div>
            <div className="overflow-hidden rounded-group bg-surface">
              <Item icon={<CreditCard size={16} />} tint="#0E7A5F" title={L("Payments")} value={settings.upi || "Add UPI ID"} onClick={() => setPanel("payments")} />
              <Item icon={<QrCode size={16} />} tint="#2C6EC8" title={L("Ordering")} value={settings.ordersPaused ? "QR orders paused" : settings.orderFrom && settings.orderTo && settings.orderFrom !== settings.orderTo ? `Table QR ${niceTime(settings.orderFrom)} – ${niceTime(settings.orderTo)}` : settings.mixed ? `Tables + counter · ${settings.payFirst ? "pay first" : "pay at the end"}` : settings.businessType === "cafe" ? "Counter · pay first" : settings.payFirst ? "Tables · pay first" : "Tables · pay at the end"} onClick={() => setPanel("ordering")} />
              <Item icon={<Receipt size={16} />} tint="#DE9122" title={L("Details on bills")} value={settings.gstin || "GSTIN, FSSAI, address"} onClick={() => setPanel("restaurant")} />
              {(owner || me?.role === "subadmin") && stampsFeature === "ok" && (
                <Item icon={<StampIcon size={16} />} tint="#8A4FD1" title={L("Stamp card")} value={settings.stamps?.on ? `${settings.stamps.needed} stamps → ${settings.stamps.reward}` : "Off"} onClick={() => setPanel("stamps")} />
              )}
            </div>
          </div>
        )}

        {owner && (
          <div className="overflow-hidden rounded-group bg-surface">
            {cloud.rid && account.allowWaApi && <Item icon={<MessageCircle size={16} />} tint="#25D366" title={L("WhatsApp API")} value={waApi === "ok" ? undefined : "Pro plan"} onClick={() => setPanel("whatsapp")} />}
            <Item icon={<ShieldCheck size={16} />} tint="#D24242" title={L("Password and sign-in")} onClick={() => setPanel("security")} />
            <Item icon={<Database size={16} />} tint="#68716D" title={L("Export your data")} onClick={() => setPanel("data")} />
          </div>
        )}

        <Button variant="danger" className="w-full" onClick={leave}><LogOut size={16} /> {L("Sign out")}</Button>
      </Page>

      {/* ---------- plans (read only) ---------- */}
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title={L("Plans")} wide>
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const cur = p.id === account.plan;
            return (
              <div key={p.id} className={clsx("rounded-group bg-surface p-4", cur && "ring-2 ring-jade")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[17px] font-semibold">{p.name}</span>
                  <span className="text-[15px] font-semibold tnum">{p.monthly ? L("{0}/mo", inr(p.monthly)) : L("Custom")}</span>
                </div>
                <div className="text-[13px] text-muted">{p.outlets}</div>
                <ul className="mt-2 space-y-1 text-[13.5px]">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-jade" />{f}</li>)}
                </ul>
                <Button size="sm" variant={cur ? "tinted" : "primary"} className="mt-3 w-full" onClick={() => { setPlanOpen(false); window.setTimeout(() => openPlanSheet(p.id), 350); }}>{cur ? L("Renew this plan") : p.monthly ? L("Switch to {0}", p.name) : L("Talk to us")}</Button>
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
          saves ? (
            <Button
              size="lg"
              className="w-full"
              disabled={panel === "payments" && !!draft.upi && !upiOk}
              onClick={() => {
                const { name: _name, logo: _logo, ...rest } = draft; // name + logo come from the Restropi team
                settingsActions.update(rest);
                setPanel(null);
                toast(panel === "payments" ? "Saved · every new bill QR uses this UPI ID" : "Saved");
              }}
            >
              {L("Save")}</Button>
          ) : undefined
        }
      >
        {panel === "restaurant" && (
          <div className="space-y-4">
            {owner ? <BrandField /> : <Field label={L("Name on bills and the guest menu")}><input className={inputCls} value={settings.name} readOnly /></Field>}
            <Field label={L("Outlet address")}><input className={inputCls} value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={L("Phone")}><input className={inputCls} inputMode="tel" value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
              <Field label="GSTIN" hint={L("Leave empty if not GST-registered.")}><input className={inputCls} autoCapitalize="characters" value={draft.gstin ?? ""} onChange={(e) => setDraft({ ...draft, gstin: e.target.value.toUpperCase() })} /></Field>
              <Field label={L("FSSAI licence")}><input className={inputCls} inputMode="numeric" value={draft.fssai ?? ""} onChange={(e) => setDraft({ ...draft, fssai: e.target.value })} /></Field>
            </div>
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={L("Opens at")}><input type="time" className={inputCls} value={draft.orderFrom ?? ""} onChange={(e) => setHours(e.target.value, draft.orderTo ?? "")} /></Field>
                <Field label={L("Closes at")}><input type="time" className={inputCls} value={draft.orderTo ?? ""} onChange={(e) => setHours(draft.orderFrom ?? "", e.target.value)} /></Field>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted">
                {draft.orderFrom && draft.orderTo && draft.orderFrom !== draft.orderTo
                  ? L("Table QR orders work only from {0} to {1}{2}. The counter QR works any time. Staff can always take orders.", niceTime(draft.orderFrom), niceTime(draft.orderTo), draft.orderTo < draft.orderFrom ? " (closes after midnight)" : "")
                  : L("Set both times to take table QR orders only while you're open. The counter QR works any time.")}
              </p>
              {(draft.orderFrom || draft.orderTo) && (
                <button type="button" onClick={() => setHours("", "")} className="mt-1 text-[13px] font-semibold text-muted underline underline-offset-4">{L("Clear opening hours")}</button>
              )}
            </div>
            <Field label={L("Message at the bottom of the bill")}><input className={inputCls} placeholder={L("Thank you! Visit again")} value={draft.billFooter ?? ""} onChange={(e) => setDraft({ ...draft, billFooter: e.target.value })} /></Field>
            <Field label={L("GST on bills")} hint={L("Most restaurants and cafés charge 5%. Choose 0% if this outlet isn't GST-registered.")}>
              <Segmented
                className="w-full"
                value={String(draft.gstRate ?? 0.05)}
                onChange={(v) => setDraft({ ...draft, gstRate: Number(v) })}
                options={[{ value: "0", label: "0%" }, { value: "0.05", label: "5%" }, { value: "0.12", label: "12%" }, { value: "0.18", label: "18%" }]}
              />
            </Field>
          </div>
        )}
        {panel === "payments" && (
          <div className="space-y-4">
            <Field label={L("UPI ID for QR payments")} hint={L("Each bill gets a QR for its exact amount. Use a business UPI ID (GPay for Business, PhonePe Business, Paytm Business): UPI apps often decline “Pay with a UPI app” to a personal UPI ID.")}>
              <input className={inputCls} autoCapitalize="none" placeholder={L("name@okaxis")} value={draft.upi} onChange={(e) => setDraft({ ...draft, upi: e.target.value.replace(/\s/g, "") })} />
            </Field>
            {!!draft.upi && !upiOk && <p className="-mt-2 text-[13.5px] font-medium text-rose">{/@[^@]*\./.test(draft.upi) ? L("This looks like an email address, not a UPI ID. Open your UPI app (GPay, PhonePe, Paytm…) → Profile to see your UPI ID, like name@okaxis or 98xxxxxx@ybl.") : L("Enter a UPI ID like name@okaxis.")}</p>}
            {upiOk && (
              <div className="rounded-group bg-surface p-4">
                <div className="mb-2 text-center text-[13.5px] font-semibold">{L("Test QR · scan with your UPI app")}</div>
                <UpiPayCard upi={draft.upi} payee={draft.name} amount={1} note={L("Restropi test")} size={140} compact />
              </div>
            )}
            <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
              <div>
                <div className="text-[15px]">{L("Card machine at the counter")}</div>
                <div className="text-[12.5px] text-muted">{L("Shows Card as a payment option.")}</div>
              </div>
              <Toggle checked={draft.acceptCard ?? true} onChange={(v) => setDraft({ ...draft, acceptCard: v })} label={L("Card machine")} />
            </div>
            {owner && cloud.rid && outlet.id && account.allowGateway && <OnlinePayments outletId={outlet.id} outletName={outlet.name} />}
          </div>
        )}
        {panel === "ordering" && (
          <div className="space-y-4">
            <Field label={L("How guests are served")}>
              <Segmented
                className="w-full"
                value={draft.businessType}
                onChange={(v) => saveNow({ businessType: v, payFirst: v === "cafe" ? true : draft.payFirst }, v === "cafe" ? "Saved · café" : "Saved · restaurant")}
                options={[{ value: "restaurant", label: "Restaurant · table service" }, { value: "cafe", label: "Café · counter + token" }]}
              />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
              <div>
                <div className="text-[15px]">{draft.businessType === "cafe" ? L("Also serve at tables") : L("Also take counter orders")}</div>
                <div className="text-[12.5px] text-muted">
                  {draft.businessType === "cafe"
                    ? L("Some guests sit at tables: table QR codes, dine-in orders and split bills, along with the counter.")
                    : L("Some guests order at the counter: a counter QR and token orders, along with your tables.")}
                </div>
              </div>
              <Toggle checked={isMixed(draft)} onChange={(v) => saveNow({ mixed: v }, v ? "Tables and counter both · on" : "Tables and counter both · off")} label={L("Tables and counter both")} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
              <div>
                <div className="text-[15px]">{L("Guests pay before the kitchen starts")}</div>
                <div className="text-[12.5px] text-muted">{draft.payFirst ? L("On · pay first, then the kitchen starts") : L("Off · guests pay at the end")}</div>
              </div>
              <Toggle checked={!!draft.payFirst} onChange={(v) => saveNow({ payFirst: v }, v ? "Guests now pay before the kitchen starts" : "Guests now pay at the end")} label={L("Guests pay first")} />
            </div>
            {(draft.businessType === "cafe" || draft.mixed) && (
              <div className="overflow-hidden rounded-group bg-surface">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-1 text-[15px]">
                      {L("Self-service")}<Hint align="left">{L("Guests order from the QR and collect at the counter when it's ready (they get a “ready” message). No waiter calls. With “pay before the kitchen starts” on, they pay first; off, they pay at the end.")}</Hint>
                    </div>
                    <div className="text-[12.5px] text-muted">{draft.payFirst ? L("Order → pay → collect") : L("Order → collect → pay")}</div>
                  </div>
                  <Toggle checked={!!draft.selfService} onChange={(v) => saveNow({ selfService: v }, v ? "Self-service on" : "Self-service off")} label={L("Self-service")} />
                </div>
              </div>
            )}
            <div className="overflow-hidden rounded-group bg-surface">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-[15px]">{L("Pause QR orders now")}</div>
                  <div className="text-[12.5px] text-muted">{L("Guests can still see the menu but can't order from their phone. Staff can still take orders.")}</div>
                </div>
                <Toggle checked={!!draft.ordersPaused} onChange={(v) => saveNow({ ordersPaused: v }, v ? "QR orders paused" : "QR orders are back on")} label={L("Pause QR orders")} />
              </div>
              <button type="button" onClick={() => setPanel("restaurant")} className="flex w-full items-center justify-between gap-4 border-t border-line/80 px-4 py-3 text-left">
                <div>
                  <div className="text-[15px]">{L("Table QR ordering hours")}</div>
                  <div className="text-[12.5px] text-muted">
                    {draft.orderFrom && draft.orderTo && draft.orderFrom !== draft.orderTo ? L("{0} – {1}, your opening hours. Counter QR works any time.", niceTime(draft.orderFrom), niceTime(draft.orderTo)) : L("Any time. Set your opening hours in Details on bills.")}
                  </div>
                </div>
                <span className="shrink-0 text-[14px] font-semibold text-jade">{L("Change")}</span>
              </button>
            </div>
            <Link href="/app/tables" className="block rounded-group bg-surface px-4 py-3 text-[14px] font-semibold text-jade">{L("Tables and their QR codes →")}</Link>
            {(draft.businessType === "cafe" || draft.mixed) && cloud.rid && (
              <a href={`/order/counter?r=${cloud.rid}${outlet.id ? `&o=${encodeURIComponent(outlet.id)}` : ""}`} target="_blank" rel="noopener noreferrer" className="block rounded-group bg-surface px-4 py-3 text-[14px] font-semibold text-jade">{L("Preview the counter QR menu ↗")}</a>
            )}
          </div>
        )}
        {panel === "stamps" && <StampSettings onDone={(msg) => { setPanel(null); toast(msg); }} />}
        {panel === "whatsapp" && <WhatsAppApi />}
        {panel === "security" && <Security onDone={() => { setPanel(null); toast(L("Password changed")); }} />}
        {panel === "data" && <Export />}
      </Sheet>
    </>
  );
}

function Security({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <ChangePassword title="" onDone={onDone} />
      <div className="border-t border-line pt-5">
        <div className="flex items-start gap-3">
          <KeyRound size={18} className="mt-0.5 text-muted" />
          <div className="flex-1">
            <div className="text-[15px] font-medium">{L("Sign out on every device")}</div>
            <div className="text-[13px] text-muted">{L("Use this if a phone with your login was lost. Staff PIN logins aren't affected.")}</div>
          </div>
        </div>
        <Button
          variant="danger"
          className="mt-3 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOutEverywhere().catch(() => {});
            window.location.href = "/login";
          }}
        >
          {L("Sign out everywhere")}</Button>
      </div>
    </div>
  );
}

const download = (name: string, text: string, type: string) => {
  // CSV: start with a byte-order mark so Excel reads ₹ and Marathi/Hindi text correctly
  const url = URL.createObjectURL(new Blob([type === "text/csv" ? "\uFEFF" + text : text], { type: type === "text/csv" ? "text/csv;charset=utf-8" : type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function Export() {
  const account = useAccount();
  const outlets = useOutlets();
  const orders = useOrders();
  const menu = useAllMenu(); // every outlet's dishes
  const categories = useAllCategories();
  const guests = useAllGuests();
  const feedback = useAllFeedback();
  const tables = useAllTables();
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (account.name || "restropi").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted">{L("Your data is stored safely on the server. Download a copy any time.")}</p>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-group bg-line/70 text-center">
        {[[L("Orders"), orders.length], [L("Dishes"), menu.length], [L("Guests"), guests.length]].map(([l, v]) => (
          <div key={l} className="bg-surface p-3"><div className="text-[20px] font-semibold tnum">{v}</div><div className="text-[12.5px] text-muted">{l}</div></div>
        ))}
      </div>
      <Button
        variant="plain"
        className="w-full"
        onClick={() => {
          const head = ["Order", "Date", "Type", "Table", "Status", "Items", "Bill (₹, with GST)", "Paid by", "Staff"];
          const rows = orders.map((o) => [
            o.number, new Date(o.createdAt).toLocaleString("en-IN"), o.type, o.tableName ?? "", o.status,
            o.lines.map((l) => `${l.qty} x ${l.name}`).join("; "), billOf(o), paymentsText(o.payments).replace(/₹/g, "Rs "), o.staff,
          ]);
          download(`${slug}-orders-${stamp}.csv`, [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv");
        }}
      >
        <Download size={17} /> {L("Orders (Excel / CSV)")}</Button>
      <Button
        variant="plain"
        className="w-full"
        onClick={() =>
          download(
            `${slug}-backup-${stamp}.json`,
            JSON.stringify({ exportedAt: new Date().toISOString(), account, outlets, categories, menu, tables, orders, guests, feedback }, null, 2),
            "application/json",
          )
        }
      >
        <Store size={17} /> {L("Everything (backup file)")}</Button>
    </div>
  );
}

/* ---------------- your profile photo ---------------- */
/** Crop to a square in the middle and shrink, so a profile photo stays small. */
async function squarePhoto(file: File, side = 320): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = Math.min(side, s);
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't read the photo"))), "image/jpeg", 0.85));
}

/** Shrink a logo to fit 400 × 400, keeping its shape and transparent background. */
/** Name and logo are set by the Restropi team (super admin). The owner asks for a change on WhatsApp. */
function BrandField() {
  const account = useAccount();
  const cloud = useCloud();
  const platform = usePlatform();
  const [newName, setNewName] = useState("");
  const [logoToo, setLogoToo] = useState(false);
  const msg = [
    "Hi Restropi team, please change our restaurant details.",
    "",
    `Restaurant: ${account.name || "-"}`,
    `Restaurant ID: ${cloud.rid ?? "-"}`,
    `Login: ${cloud.email ?? "-"}`,
    ...(newName.trim() ? [`New name: ${newName.trim()}`] : []),
    ...(logoToo ? ["New logo: I'm sending the logo image in this chat."] : []),
  ].join("\n");
  const ready = !!newName.trim() || logoToo;
  return (
    <div className="space-y-3 rounded-group bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white ring-1 ring-line">
          {account.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.logo} alt={L("{0} logo", account.name)} className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-[22px] font-bold text-muted">{account.name.trim().charAt(0).toUpperCase() || "R"}</span>
          )}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold">{account.name}</div>
          <div className="text-[12.5px] text-muted">{L("Name and logo on the guest menu and bills. Set by the Restropi team.")}</div>
        </div>
      </div>
      <div className="border-t border-line/80 pt-3">
        <div className="mb-2 text-[14px] font-semibold">{L("Want to change them?")}</div>
        <input className={inputCls} placeholder={L("New name (leave empty to keep it)")} value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 80))} aria-label={L("New restaurant name")} />
        <label className="mt-2 flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={logoToo} onChange={(e) => setLogoToo(e.target.checked)} className="h-4 w-4 accent-[var(--jade,#0e7a5f)]" />
          {L("I want a new logo (I'll send the image on WhatsApp)")}</label>
        {platform?.whatsapp ? (
          <a href={ready ? teamWhatsApp(platform.whatsapp, msg) : undefined} target="_blank" rel="noreferrer" aria-disabled={!ready} className={clsx("mt-3 block", !ready && "pointer-events-none opacity-50")}>
            <Button className="w-full !bg-[#25D366] hover:!bg-[#1fb757]"><MessageCircle size={17} /> {L("Send the request on WhatsApp")}</Button>
          </a>
        ) : (
          <p className="mt-3 text-[13px] text-muted">{platform ? L("The Restropi team hasn't added their WhatsApp number yet.") : L("Loading…")}</p>
        )}
      </div>
    </div>
  );
}

function ProfileCard({ me, subtitle }: { me: Member; subtitle: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // only the owner and sub admins can change team records (staff ask the owner)
  const canEdit = me.role !== "staff";
  const pick = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast(L("Choose a photo (JPG or PNG)"));
    setBusy(true);
    try {
      const url = await uploadProfilePhoto(await squarePhoto(f), me.id);
      memberActions.setPhoto(me.id, url);
      toast(L("Profile photo updated"));
    } catch (e) {
      toast(L("Couldn't upload the photo: {0}", (e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-4 rounded-group bg-surface p-4">
      <label className={clsx("relative shrink-0", canEdit && "cursor-pointer")} aria-label={canEdit ? L("Change profile photo") : undefined}>
        <Avatar name={me.name} hue={me.hue} photo={me.photo} size={56} />
        {canEdit && (
          <>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white ring-2 ring-surface">
              {busy ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Camera size={12} />}
            </span>
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </>
        )}
      </label>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-semibold">{me.name}</div>
        <div className="truncate text-[14px] text-muted">{subtitle}</div>
        {canEdit ? (
          <div className="mt-1.5 flex gap-3 text-[13.5px] font-semibold">
            <label className="cursor-pointer text-jade hover:underline">
              {me.photo ? L("Change photo") : L("Add a photo")}
              <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {me.photo && <button onClick={() => { memberActions.setPhoto(me.id, undefined); toast(L("Photo removed")); }} className="text-muted hover:text-rose">{L("Remove")}</button>}
          </div>
        ) : (
          <div className="mt-1 text-[12.5px] text-faint">{L("Ask the owner to change your photo.")}</div>
        )}
      </div>
    </div>
  );
}
