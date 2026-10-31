"use client";

import { Check, ChevronRight, CreditCard, Database, Download, KeyRound, LogOut, QrCode, Receipt, ShieldCheck, Store, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Avatar, Button, Field, Page, PageHeader, Pill, Segmented, Sheet, Toggle, inputCls } from "@/components/ui";
import { UpiPayCard, isValidUpi } from "@/components/upi";
import { openPlanSheet } from "@/components/plan-sheet";
import { ChangePassword } from "@/components/owner-auth";
import { useToast } from "@/components/toast";
import {
  billOf,
  paymentsText,
  settingsActions,
  useAccount,
  useCan,
  useCategories,
  useCurrentOutlet,
  useFeedback,
  useGuests,
  useMe,
  useMenu,
  useOrders,
  useOutlets,
  useSettings,
} from "@/lib/live";
import { useAllTables } from "@/lib/tables";
import { cloudSignOut, signOutEverywhere, useCloud } from "@/lib/cloud";
import { RENEW_WARN_DAYS, daysLeft, isOwner } from "@/lib/access";
import { plans } from "@/lib/plans";
import { inr } from "@/lib/format";
import type { OutletSettings } from "@/lib/types";

type Panel = "restaurant" | "payments" | "ordering" | "security" | "data" | null;

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
  const account = useAccount();
  const outlets = useOutlets();
  const outlet = useCurrentOutlet();
  const cloud = useCloud();
  const plan = plans.find((p) => p.id === account.plan) ?? plans[1];
  const days = daysLeft(account.renewsAt);
  const renewDate = new Date(account.renewsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const [planOpen, setPlanOpen] = useState(false);
  useEffect(() => {
    if (owner && window.location.hash === "#plan") setPlanOpen(true);
  }, [owner]);
  const [panel, setPanelRaw] = useState<Panel>(null);
  const settings = useSettings();
  const [draft, setDraft] = useState<OutletSettings>(settings);
  const setPanel = (p: Panel) => {
    setDraft(settings);
    setPanelRaw(p);
  };
  const upiOk = isValidUpi(draft.upi);
  const saves = panel === "restaurant" || panel === "payments" || panel === "ordering";

  const titles: Record<Exclude<Panel, null>, string> = {
    restaurant: `Details on bills · ${outlet.name}`,
    payments: `Payments · ${outlet.name}`,
    ordering: `Ordering · ${outlet.name}`,
    security: "Password and sign-in",
    data: "Export your data",
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
              <div className="truncate text-[14px] text-muted">{owner ? `Owner · ${cloud.email ?? ""}` : `${me.title} · ${outlet.name}`}</div>
            </div>
          </div>
        )}

        {/* Subscription: set by the Restropi team; owner sees it */}
        {owner && (
          <section id="plan" className="overflow-hidden rounded-group bg-ink p-5 text-canvas">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] text-canvas/60">Your plan</div>
                <div className="text-[24px] font-semibold tracking-tight">{plan.name}</div>
                <div className="text-[14px] text-canvas/70">{plan.monthly ? `${inr(plan.monthly)} per outlet / month · ` : ""}{outlets.length} outlet{outlets.length === 1 ? "" : "s"}</div>
              </div>
              <Pill tone={days < 0 ? "rose" : days <= RENEW_WARN_DAYS ? "saffron" : "jade"}>{days < 0 ? "Ended" : days <= RENEW_WARN_DAYS ? `${days} days left` : "Active"}</Pill>
            </div>
            <div className="mt-4 text-[13px] text-canvas/70">{days < 0 ? `Ended on ${renewDate}` : `Runs until ${renewDate}`}</div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" className="!bg-canvas !text-ink hover:!bg-canvas/90" onClick={() => openPlanSheet()}>{days < 0 ? "Restart plan" : "Renew"}</Button>
              <Button size="sm" variant="ghost" className="!text-canvas/80 hover:!bg-white/10" onClick={() => setPlanOpen(true)}>Change plan</Button>
            </div>
          </section>
        )}

        {owner && (
          <div className="overflow-hidden rounded-group bg-surface">
            <Link href="/app/access" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/40">
              <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#2C6EC8] text-white"><Users size={16} /></span>
              <span className="flex-1 text-[15px]">Outlets, members & access</span>
              <span className="text-[14px] text-muted">{outlets.length} outlet{outlets.length === 1 ? "" : "s"}</span>
              <ChevronRight size={17} className="text-faint" />
            </Link>
          </div>
        )}

        {(owner || canOutlet) && (
          <div>
            <div className="mb-1.5 px-1 text-[13px] font-medium text-muted">{outlet.name} · {outlet.businessType === "cafe" ? "Café" : "Restaurant"}</div>
            <div className="overflow-hidden rounded-group bg-surface">
              <Item icon={<CreditCard size={16} />} tint="#0E7A5F" title="Payments" value={settings.upi || "Add UPI ID"} onClick={() => setPanel("payments")} />
              <Item icon={<QrCode size={16} />} tint="#2C6EC8" title="Ordering" value={settings.businessType === "cafe" ? "Café · pay first" : settings.payFirst ? "Pay first" : "Pay at the end"} onClick={() => setPanel("ordering")} />
              <Item icon={<Receipt size={16} />} tint="#DE9122" title="Details on bills" value={settings.gstin || "GSTIN, FSSAI, address"} onClick={() => setPanel("restaurant")} />
            </div>
          </div>
        )}

        {owner && (
          <div className="overflow-hidden rounded-group bg-surface">
            <Item icon={<ShieldCheck size={16} />} tint="#D24242" title="Password and sign-in" onClick={() => setPanel("security")} />
            <Item icon={<Database size={16} />} tint="#68716D" title="Export your data" onClick={() => setPanel("data")} />
          </div>
        )}

        <Button variant="danger" className="w-full" onClick={leave}><LogOut size={16} /> Sign out</Button>
      </Page>

      {/* ---------- plans (read only) ---------- */}
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Plans" wide>
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const cur = p.id === account.plan;
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
                <Button size="sm" variant={cur ? "tinted" : "primary"} className="mt-3 w-full" onClick={() => { setPlanOpen(false); openPlanSheet(p.id); }}>{cur ? "Renew this plan" : p.monthly ? `Switch to ${p.name}` : "Talk to us"}</Button>
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
              disabled={(panel === "payments" && !!draft.upi && !upiOk) || (panel === "restaurant" && draft.name.trim().length < 2)}
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
            <Field label="Outlet address"><input className={inputCls} value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone"><input className={inputCls} inputMode="tel" value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
              <Field label="Opening hours"><input className={inputCls} placeholder="11:00 am – 11:00 pm" value={draft.hours ?? ""} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} /></Field>
              <Field label="GSTIN" hint="Leave empty if not GST-registered."><input className={inputCls} autoCapitalize="characters" value={draft.gstin ?? ""} onChange={(e) => setDraft({ ...draft, gstin: e.target.value.toUpperCase() })} /></Field>
              <Field label="FSSAI licence"><input className={inputCls} inputMode="numeric" value={draft.fssai ?? ""} onChange={(e) => setDraft({ ...draft, fssai: e.target.value })} /></Field>
            </div>
            <Field label="Message at the bottom of the bill"><input className={inputCls} placeholder="Thank you! Visit again" value={draft.billFooter ?? ""} onChange={(e) => setDraft({ ...draft, billFooter: e.target.value })} /></Field>
            <p className="text-[13px] text-muted">GST of 5% is added to every bill.</p>
          </div>
        )}
        {panel === "payments" && (
          <div className="space-y-4">
            <Field label="UPI ID for QR payments" hint="Each bill gets a QR for its exact amount.">
              <input className={inputCls} autoCapitalize="none" placeholder="name@okaxis" value={draft.upi} onChange={(e) => setDraft({ ...draft, upi: e.target.value.replace(/\s/g, "") })} />
            </Field>
            {!!draft.upi && !upiOk && <p className="-mt-2 text-[13.5px] font-medium text-rose">Enter a UPI ID like name@bank.</p>}
            {upiOk && (
              <div className="rounded-group bg-surface p-4">
                <div className="mb-2 text-center text-[13.5px] font-semibold">Test QR · scan with your UPI app</div>
                <UpiPayCard upi={draft.upi} payee={draft.name} amount={1} note="Restropi test" size={140} compact />
              </div>
            )}
            <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
              <div>
                <div className="text-[15px]">Card machine at the counter</div>
                <div className="text-[12.5px] text-muted">Shows Card as a payment option.</div>
              </div>
              <Toggle checked={draft.acceptCard ?? true} onChange={(v) => setDraft({ ...draft, acceptCard: v })} label="Card machine" />
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
            <Link href="/app/tables" className="block rounded-group bg-surface px-4 py-3 text-[14px] font-semibold text-jade">Tables and their QR codes →</Link>
            {draft.businessType === "cafe" && cloud.rid && (
              <Link href={`/order/counter?r=${cloud.rid}`} className="block rounded-group bg-surface px-4 py-3 text-[14px] font-semibold text-jade">Preview the counter QR menu →</Link>
            )}
          </div>
        )}
        {panel === "security" && <Security onDone={() => { setPanel(null); toast("Password changed"); }} />}
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
            <div className="text-[15px] font-medium">Sign out on every device</div>
            <div className="text-[13px] text-muted">Use this if a phone with your login was lost. Staff PIN logins aren&apos;t affected.</div>
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
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}

const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
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
  const menu = useMenu();
  const categories = useCategories();
  const guests = useGuests();
  const feedback = useFeedback();
  const tables = useAllTables();
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (account.name || "restropi").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted">Your data is stored safely on the server. Download a copy any time.</p>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-group bg-line/70 text-center">
        {[["Orders", orders.length], ["Dishes", menu.length], ["Guests", guests.length]].map(([l, v]) => (
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
            o.lines.map((l) => `${l.qty} × ${l.name}`).join("; "), billOf(o), paymentsText(o.payments), o.staff,
          ]);
          download(`${slug}-orders-${stamp}.csv`, [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv");
        }}
      >
        <Download size={17} /> Orders (Excel / CSV)
      </Button>
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
        <Store size={17} /> Everything (backup file)
      </Button>
    </div>
  );
}
