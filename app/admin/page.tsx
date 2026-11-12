"use client";

// Super admin: every restaurant on Restropi. Add a restaurant (with its owner
// login), change plan and renewal, suspend, reset the owner's password, delete.
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, CalendarClock, Check, Copy, KeyRound, LogOut, Mail, MessageCircle, Plus, RefreshCw, Search, Store, Ticket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Spinner, Wordmark } from "@/components/shell";
import { Button, Chips, Field, Pill, Segmented, Sheet, Toggle, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { isValidUpi } from "@/components/upi";
import { ChangePassword, PasswordInput } from "@/components/owner-auth";
import { PlanCouponsSheet, PlatformSheet } from "@/components/admin-extras";
import { RevenueSheet } from "@/components/admin-revenue";
import {
  adminCreate,
  adminDelete,
  adminList,
  adminResetOwnerPassword,
  adminUpdate,
  cloudSignOut,
  useCloud,
  sendWelcomeEmail,
  verifyMyPassword,
  type AdminRestaurant,
} from "@/lib/cloud";
import { plans } from "@/lib/plans";
import { inr, timeAgo } from "@/lib/format";
import { RENEW_WARN_DAYS } from "@/lib/access";

type PlanId = AdminRestaurant["plan"];
type Filter = "all" | "active" | "due" | "expired" | "suspended";

const DAY = 86_400_000;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;
const planPrice = (id: string) => plans.find((p) => p.id === id)?.monthly ?? 0;

function renewState(r: AdminRestaurant): { tone: "jade" | "saffron" | "rose" | "neutral"; text: string } {
  if (r.status === "suspended") return { tone: "neutral", text: "Suspended" };
  const d = daysLeft(r.renewsAt);
  if (d < 0) return { tone: "rose", text: `Expired ${-d}d ago` };
  if (d <= RENEW_WARN_DAYS) return { tone: "saffron", text: d === 0 ? "Ends today" : `${d}d left` };
  return { tone: "jade", text: "Active" };
}

export default function AdminPage() {
  const cloud = useCloud();
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<AdminRestaurant[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ title: string; email: string; password: string; welcome?: "sending" | "sent" | "off" | "failed" } | null>(null);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (cloud.status === "signedOut") router.replace("/login");
    else if (cloud.status === "ready" && cloud.mustChangePassword) router.replace("/login");
    else if (cloud.status === "ready" && (cloud.role === "owner" || cloud.role === "staff")) router.replace("/app");
  }, [cloud, router]);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      setList(await adminList());
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (cloud.status === "ready" && cloud.role === "superadmin" && !cloud.mustChangePassword) void load();
  }, [cloud.status, cloud.role, cloud.mustChangePassword, load]);

  const all = list ?? [];
  const is = (r: AdminRestaurant, k: Filter) => {
    const d = daysLeft(r.renewsAt);
    if (k === "all") return true;
    if (k === "suspended") return r.status === "suspended";
    if (r.status === "suspended") return false;
    if (k === "expired") return d < 0;
    if (k === "due") return d >= 0 && d <= RENEW_WARN_DAYS;
    return d >= 0;
  };
  const shown = useMemo(
    () => all.filter((r) => is(r, f) && (!q || `${r.name} ${r.city} ${r.owner} ${r.ownerEmail} ${r.phone}`.toLowerCase().includes(q.toLowerCase()))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, f, q],
  );
  const live = all.filter((r) => is(r, "active"));
  const mrr = live.reduce((s, r) => s + planPrice(r.plan) * Math.max(1, r.outlets), 0);
  const open = all.find((r) => r.id === openId) ?? null;

  if (cloud.status === "off")
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
        <h1 className="text-[22px] font-semibold">Setup needed</h1>
        <p className="mt-2 text-[15px] text-muted">The app isn&apos;t connected to Supabase.</p>
      </div>
    );
  if (cloud.status !== "ready" || cloud.role !== "superadmin" || cloud.mustChangePassword) {
    if (cloud.status === "needsOnboarding")
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
          <h1 className="text-[22px] font-semibold">Not a super admin login</h1>
          <p className="mt-2 text-[15px] text-muted">This account can&apos;t open the admin panel.</p>
          <Button className="mt-6" onClick={async () => { await cloudSignOut(); router.replace("/login"); }}>Sign out</Button>
        </div>
      );
    return <Spinner />;
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:px-6">
          <Wordmark className="h-7" />
          <Pill tone="saffron">Super admin</Pill>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 hidden text-[13.5px] text-muted sm:inline">{cloud.email}</span>
            <button onClick={() => setPwOpen(true)} className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium hover:bg-sunken" aria-label="Change password">
              <KeyRound size={16} /> <span className="hidden sm:inline">Password</span>
            </button>
            <button
              onClick={async () => { await cloudSignOut(); window.location.href = "/login"; }}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium text-rose hover:bg-sunken"
            >
              <LogOut size={16} /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-8 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="large-title">Restaurants</h1>
            <p className="mt-1 text-[15px] text-muted">Everyone using Restropi. Add a restaurant to give its owner a login.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="tinted" onClick={() => setRevenueOpen(true)}><BarChart3 size={17} /> Revenue</Button>
            <Button variant="tinted" onClick={() => setPlatformOpen(true)}><MessageCircle size={17} /> Payments & WhatsApp</Button>
            <Button variant="tinted" onClick={() => setCouponsOpen(true)}><Ticket size={17} /> Plan coupons</Button>
            <Button onClick={() => setAdding(true)}><Plus size={18} /> Add restaurant</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            ["Restaurants", String(all.length), `${live.length} active`],
            ["Monthly revenue", inr(mrr), "from active plans"],
            ["Renewals due", String(all.filter((r) => is(r, "due")).length), `in the next ${RENEW_WARN_DAYS} days`],
            ["Orders", all.reduce((s, r) => s + r.orders30, 0).toLocaleString("en-IN"), "last 30 days"],
          ].map(([l, v, n]) => (
            <div key={l} className="bg-surface p-4">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="mt-1 text-[24px] font-semibold tracking-tight tnum">{list ? v : "—"}</div>
              <div className="text-[12.5px] text-muted">{n}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input className={clsx(inputCls, "h-11 pl-10")} placeholder="Search name, city, owner, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Chips
            value={f}
            onChange={setF}
            options={(
              [
                ["all", "All"],
                ["active", "Active"],
                ["due", "Renew soon"],
                ["expired", "Expired"],
                ["suspended", "Suspended"],
              ] as [Filter, string][]
            ).map(([value, label]) => ({ value, label, count: all.filter((r) => is(r, value)).length }))}
          />
          <button onClick={() => void load()} className="flex h-9 items-center gap-1.5 self-start rounded-full px-3 text-[13.5px] font-medium text-muted hover:bg-sunken lg:ml-auto lg:self-auto">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {loadErr ? (
          <div className="rounded-group bg-rose-soft p-4 text-[14px] text-rose">Couldn&apos;t load restaurants: {loadErr}</div>
        ) : !list ? (
          <div className="py-16 text-center text-muted">Loading…</div>
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center rounded-group bg-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-jade-soft text-jade"><Store size={26} /></span>
            <h2 className="mt-4 text-[19px] font-semibold">No restaurants yet</h2>
            <p className="mt-1 max-w-sm text-[14.5px] text-muted">Add the first one. You&apos;ll get a login for its owner to share with them.</p>
            <Button className="mt-5" onClick={() => setAdding(true)}><Plus size={18} /> Add restaurant</Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="py-12 text-center text-muted">Nothing matches.</div>
        ) : (
          <div className="overflow-hidden rounded-group bg-surface">
            <div className="hidden grid-cols-[1.6fr_1.3fr_.7fr_.9fr_.6fr] gap-3 border-b border-line px-5 py-2.5 text-[12.5px] font-medium text-muted lg:grid">
              <span>Restaurant</span><span>Owner</span><span>Plan</span><span>Renews</span><span className="text-right">Orders 30d</span>
            </div>
            {shown.map((r) => {
              const s = renewState(r);
              return (
                <button key={r.id} onClick={() => setOpenId(r.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line/80 px-4 py-3.5 text-left last:border-0 hover:bg-sunken/50 lg:grid-cols-[1.6fr_1.3fr_.7fr_.9fr_.6fr] lg:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-[15.5px] font-semibold">{r.name}</span>
                    <span className="block truncate text-[13px] text-muted">{[r.city, `${r.outlets} outlet${r.outlets === 1 ? "" : "s"}`, `${r.members} people`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="min-w-0 text-right lg:text-left">
                    <span className="block truncate text-[14px]">{r.owner}</span>
                    <span className="block truncate text-[13px] text-muted">{r.ownerEmail}</span>
                  </span>
                  <span><Pill tone={r.plan === "pro" || r.plan === "chain" ? "sky" : "neutral"}>{planName(r.plan)}</Pill></span>
                  <span className="text-right lg:text-left">
                    <Pill tone={s.tone}>{s.text}</Pill>
                    <span className="ml-2 text-[12.5px] text-muted lg:ml-0 lg:block">{dateText(r.renewsAt)}</span>
                  </span>
                  <span className="hidden text-right text-[15px] font-semibold tnum lg:block">{r.orders30.toLocaleString("en-IN")}</span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <AddRestaurant
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(res, name) => {
          setAdding(false);
          setCreds({ title: `${name} is ready`, email: res.ownerEmail, password: res.tempPassword, welcome: "sending" });
          void load();
          // the restaurant is saved: now email the owner a welcome with a "set your password" link (no password in it)
          sendWelcomeEmail(res.rid)
            .then((r) => setCreds((c) => (c && c.email === res.ownerEmail ? { ...c, welcome: r ? "sent" : "off" } : c)))
            .catch(() => setCreds((c) => (c && c.email === res.ownerEmail ? { ...c, welcome: "failed" } : c)));
        }}
      />

      {open && (
        <RestaurantSheet
          r={open}
          onClose={() => setOpenId(null)}
          onChanged={(msg) => { toast(msg); void load(); }}
          onDeleted={() => { setOpenId(null); toast("Restaurant deleted"); void load(); }}
          onCreds={(email, password) => setCreds({ title: "New temporary password", email, password })}
        />
      )}

      <Sheet open={!!creds} onClose={() => setCreds(null)} title={creds?.title ?? ""}>
        {creds && <Credentials email={creds.email} password={creds.password} welcome={creds.welcome} />}
      </Sheet>

      <PlatformSheet open={platformOpen} onClose={() => setPlatformOpen(false)} />
      <PlanCouponsSheet open={couponsOpen} onClose={() => setCouponsOpen(false)} />
      <RevenueSheet open={revenueOpen} onClose={() => setRevenueOpen(false)} list={list ?? []} />

      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change password">
        <ChangePassword title="" onDone={() => { setPwOpen(false); toast("Password changed"); }} />
      </Sheet>
    </div>
  );
}

/* ---------------- owner login to hand over ---------------- */
function Credentials({ email, password, welcome }: { email: string; password: string; welcome?: "sending" | "sent" | "off" | "failed" }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  const text = `Your Restropi login\n${url}\nEmail: ${email}\nTemporary password: ${password}\nYou'll be asked to set your own password the first time.`;
  return (
    <div className="space-y-4">
      {welcome && (
        <p className={clsx("flex items-start gap-2 rounded-group p-3 text-[14px]", welcome === "sent" ? "bg-jade-soft text-ink" : welcome === "sending" ? "bg-surface text-muted" : "bg-saffron-soft text-ink")}>
          <Mail size={17} className="mt-0.5 shrink-0" />
          {welcome === "sent"
            ? `Welcome email sent to ${email} with a link to set their password.`
            : welcome === "sending"
              ? "Sending the welcome email…"
              : welcome === "off"
                ? "Welcome emails aren't set up yet (email keys missing). Share the details below instead."
                : "The welcome email couldn't be sent. Share the details below, or send it again from the restaurant's page."}
        </p>
      )}
      <p className="text-[14.5px] text-muted">Send this to the owner. The password is shown only now — they&apos;ll set their own when they first sign in.</p>
      <div className="space-y-2 rounded-group bg-surface p-4 font-mono text-[14px]">
        <div className="break-all"><span className="text-muted">Link </span>{url}</div>
        <div className="break-all"><span className="text-muted">Email </span>{email}</div>
        <div className="break-all"><span className="text-muted">Password </span><b>{password}</b></div>
      </div>
      <Button
        size="lg"
        className="w-full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {}
        }}
      >
        {copied ? <><Check size={18} /> Copied</> : <><Copy size={18} /> Copy login details</>}
      </Button>
      <a
        className="block text-center text-[14px] font-semibold text-jade"
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
      >
        Share on WhatsApp
      </a>
    </div>
  );
}

/* ---------------- add restaurant ---------------- */
const blank = {
  name: "",
  type: "restaurant" as "restaurant" | "cafe",
  outletName: "",
  address: "",
  city: "",
  ownerName: "",
  ownerEmail: "",
  phone: "",
  upi: "",
  payFirst: false,
  tables: 10,
  plan: "growth" as PlanId,
  months: 1,
  trialDays: 14,
  notes: "",
};

function AddRestaurant({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: { rid: string; ownerEmail: string; tempPassword: string }, name: string) => void }) {
  const [d, setD] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (open) { setD(blank); setErr(""); }
  }, [open]);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setD((x) => ({ ...x, [k]: v }));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.ownerEmail.trim());
  const upiOk = !d.upi.trim() || isValidUpi(d.upi.trim());
  const problem =
    d.name.trim().length < 2 ? "Add the restaurant name" :
    d.ownerName.trim().length < 2 ? "Add the owner's name" :
    !emailOk ? "Add the owner's email" :
    !upiOk ? "UPI ID looks wrong" : "";
  const ends = new Date(Date.now() + (d.months * 30 + d.trialDays) * DAY).toISOString();

  const save = async () => {
    if (problem || busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await adminCreate({
        name: d.name.trim(),
        ownerName: d.ownerName.trim(),
        ownerEmail: d.ownerEmail.trim(),
        phone: d.phone.trim(),
        city: d.city.trim(),
        notes: d.notes.trim(),
        plan: d.plan,
        months: d.months,
        trialDays: d.trialDays,
        tables: d.type === "cafe" ? Math.min(d.tables, 50) : d.tables,
        outlet: { name: d.outletName.trim() || d.city.trim() || "Main", address: d.address.trim(), businessType: d.type, upi: d.upi.trim(), payFirst: d.payFirst },
      });
      onCreated(res, d.name.trim());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add restaurant"
      wide
      footer={
        <>
          {err && <p className="mb-2 text-center text-[14px] font-medium text-rose">{err}</p>}
          <Button size="lg" className="w-full" disabled={!!problem || busy} onClick={save}>
            {busy ? "Creating…" : problem || "Create restaurant and owner login"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Section title="Restaurant">
          <Field label="Name"><input className={inputCls} placeholder="e.g. Saffron Lane" value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Type">
            <Segmented
              className="w-full"
              value={d.type}
              onChange={(v) => setD((x) => ({ ...x, type: v, payFirst: v === "cafe" }))}
              options={[{ value: "restaurant", label: "Restaurant" }, { value: "cafe", label: "Café / counter" }]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First outlet / area"><input className={inputCls} placeholder="e.g. Baner" value={d.outletName} onChange={(e) => set("outletName", e.target.value)} /></Field>
            <Field label="City"><input className={inputCls} placeholder="e.g. Pune" value={d.city} onChange={(e) => set("city", e.target.value)} /></Field>
          </div>
          <Field label="Address" hint="Optional"><input className={inputCls} value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="UPI ID for payments" hint="Optional now — the owner can add it in Settings.">
              <input className={clsx(inputCls, !upiOk && "ring-rose")} placeholder="name@okaxis" autoCapitalize="none" value={d.upi} onChange={(e) => set("upi", e.target.value)} />
            </Field>
            <Field label="Tables to start with" hint="The owner can add or remove tables later.">
              <input className={inputCls} type="number" min={0} max={200} inputMode="numeric" value={d.tables} onChange={(e) => set("tables", Math.max(0, Math.min(200, Number(e.target.value) || 0)))} />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-group bg-surface px-4 py-3">
            <span>
              <span className="block text-[15px] font-medium">Guests pay first</span>
              <span className="block text-[13px] text-muted">Order, pay, pick up by token (usual for cafés).</span>
            </span>
            <Toggle checked={d.payFirst} onChange={(v) => set("payFirst", v)} label="Guests pay first" />
          </div>
        </Section>

        <Section title="Owner login">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name"><input className={inputCls} autoComplete="off" value={d.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
            <Field label="Phone" hint="Optional"><input className={inputCls} inputMode="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          </div>
          <Field label="Owner email" hint="They sign in with this. A temporary password is made for you to share.">
            <input className={inputCls} type="email" autoComplete="off" autoCapitalize="none" value={d.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} />
          </Field>
        </Section>

        <Section title="Plan">
          <PlanPicker value={d.plan} onChange={(v) => set("plan", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Free trial">
              <Segmented className="w-full" value={String(d.trialDays)} onChange={(v) => set("trialDays", Number(v))} options={["0", "7", "14", "30"].map((v) => ({ value: v, label: v === "0" ? "None" : `${v} days` }))} />
            </Field>
            <Field label="Paid for">
              <Segmented className="w-full" value={String(d.months)} onChange={(v) => set("months", Number(v))} options={["0", "1", "3", "12"].map((v) => ({ value: v, label: v === "0" ? "—" : v === "12" ? "1 yr" : `${v} mo` }))} />
            </Field>
          </div>
          <p className="text-[13.5px] text-muted">Plan runs until <b className="text-ink">{dateText(ends)}</b>. The owner sees a reminder {RENEW_WARN_DAYS} days before.</p>
          <Field label="Notes" hint="Only you see these."><input className={inputCls} value={d.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </Section>
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function PlanPicker({ value, onChange }: { value: PlanId; onChange: (v: PlanId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {plans.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={clsx("rounded-group p-3 text-left transition", value === p.id ? "bg-ink text-canvas" : "bg-surface hover:bg-sunken")}
        >
          <span className="block text-[15px] font-semibold">{p.name}</span>
          <span className={clsx("block text-[12.5px]", value === p.id ? "text-canvas/70" : "text-muted")}>{p.monthly ? `${inr(p.monthly)}/mo` : "Custom"}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- one restaurant ---------------- */
function RestaurantSheet({
  r,
  onClose,
  onChanged,
  onDeleted,
  onCreds,
}: {
  r: AdminRestaurant;
  onClose: () => void;
  onChanged: (msg: string) => void;
  onDeleted: () => void;
  onCreds: (email: string, password: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState({ name: r.name, owner: r.owner, phone: r.phone, city: r.city, notes: r.notes });
  const [date, setDate] = useState(r.renewsAt.slice(0, 10));
  const [del, setDel] = useState(false);
  const [confirm, setConfirm] = useState("");
  useEffect(() => {
    setInfo({ name: r.name, owner: r.owner, phone: r.phone, city: r.city, notes: r.notes });
    setDate(r.renewsAt.slice(0, 10));
  }, [r]);

  // every change to a client asks "are you sure?" and the super admin's password first
  const [pending, setPending] = useState<{ what: string; go: () => Promise<void> } | null>(null);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");
  const confirmThen = (what: string, go: () => Promise<void>) => {
    setPw("");
    setPwErr("");
    setPending({ what, go });
  };
  const run = (fn: () => Promise<unknown>, msg: string) =>
    confirmThen(msg, async () => {
      setBusy(true);
      setErr("");
      try {
        await fn();
        onChanged(msg);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    });
  const extend = (months: number) => {
    const from = Math.max(Date.now(), new Date(r.renewsAt).getTime());
    const iso = new Date(from + months * 30 * DAY).toISOString();
    return run(() => adminUpdate(r.id, { renewsAt: iso }), `Renewed till ${dateText(iso)}`);
  };
  const s = renewState(r);
  const infoChanged = info.name !== r.name || info.owner !== r.owner || info.phone !== r.phone || info.city !== r.city || info.notes !== r.notes;

  return (
    <>
    <Sheet open onClose={onClose} title={r.name} wide>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={s.tone}>{s.text}</Pill>
          <Pill>{planName(r.plan)}</Pill>
          <span className="text-[13px] text-muted">Added {dateText(r.createdAt)} · ID {r.id}</span>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 sm:grid-cols-4">
          {[
            ["Outlets", r.outlets],
            ["People", r.members],
            ["Dishes", r.menuItems],
            ["Orders 30d", r.orders30],
          ].map(([l, v]) => (
            <div key={l} className="bg-surface p-3">
              <div className="text-[12.5px] text-muted">{l}</div>
              <div className="text-[20px] font-semibold tnum">{Number(v).toLocaleString("en-IN")}</div>
            </div>
          ))}
        </div>
        <p className="-mt-3 text-[13px] text-muted">{r.lastOrderAt ? `Last order ${timeAgo(r.lastOrderAt)}` : "No orders yet"}</p>

        {err && <p className="rounded-group bg-rose-soft p-3 text-[14px] text-rose">{err}</p>}

        <Section title="Plan">
          <PlanPicker value={r.plan} onChange={(v) => v !== r.plan && run(() => adminUpdate(r.id, { plan: v }), `Plan changed to ${planName(v)}`)} />
        </Section>

        <Section title="Renewal">
          <div className="flex items-center gap-2 text-[14.5px]">
            <CalendarClock size={18} className="text-muted" />
            Runs until <b>{dateText(r.renewsAt)}</b>
            <span className="text-muted">({daysLeft(r.renewsAt) >= 0 ? `${daysLeft(r.renewsAt)} days left` : "expired"})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 3, 6, 12].map((m) => (
              <Button key={m} variant="plain" className="!bg-surface" disabled={busy} onClick={() => extend(m)}>+{m === 12 ? "1 year" : `${m} month${m > 1 ? "s" : ""}`}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" className={clsx(inputCls, "flex-1")} value={date} onChange={(e) => setDate(e.target.value)} />
            <Button
              disabled={busy || !date || date === r.renewsAt.slice(0, 10)}
              onClick={() => run(() => adminUpdate(r.id, { renewsAt: new Date(`${date}T23:59:00+05:30`).toISOString() }), "Renewal date saved")}
            >
              Set date
            </Button>
          </div>
        </Section>

        <Section title="Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Restaurant name"><input className={inputCls} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
            <Field label="City"><input className={inputCls} value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></Field>
            <Field label="Owner name"><input className={inputCls} value={info.owner} onChange={(e) => setInfo({ ...info, owner: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></Field>
          </div>
          <Field label="Owner email" hint="Sign-in email. To move a restaurant to another email, delete and add it again.">
            <input className={clsx(inputCls, "text-muted")} value={r.ownerEmail} readOnly />
          </Field>
          <Field label="Notes"><input className={inputCls} value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} /></Field>
          <Button disabled={busy || !infoChanged || info.name.trim().length < 2} onClick={() => run(() => adminUpdate(r.id, info), "Details saved")}>Save details</Button>
        </Section>

        <Section title="Access">
          <div className="overflow-hidden rounded-group bg-surface">
            <div className="flex items-center justify-between border-b border-line/80 px-4 py-3">
              <span>
                <span className="block text-[15px] font-medium">{r.status === "suspended" ? "Suspended" : "Active"}</span>
                <span className="block text-[13px] text-muted">Suspended: owner, staff and the QR menu stop working. Nothing is deleted.</span>
              </span>
              <Toggle
                checked={r.status === "active"}
                label="Restaurant active"
                onChange={(v) => run(() => adminUpdate(r.id, { status: v ? "active" : "suspended" }), v ? "Restaurant active again" : "Restaurant suspended")}
              />
            </div>
            <button
              disabled={busy}
              onClick={() =>
                confirmThen(`Reset ${r.name}'s owner password`, async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    const res = await adminResetOwnerPassword(r.id);
                    onCreds(res.ownerEmail, res.tempPassword);
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                })
              }
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-medium"
            >
              <KeyRound size={18} className="text-jade" /> Reset owner password
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr("");
                try {
                  const res = await sendWelcomeEmail(r.id, true);
                  if (!res) setErr("Email isn't set up yet (add the Resend keys in Vercel).");
                  else onChanged(`Welcome email sent to ${res.to ?? "the owner"}`);
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left text-[15px] font-medium"
            >
              <Mail size={18} className="text-jade" /> Email the owner a sign-in link
            </button>
          </div>
        </Section>

        <Section title="Danger zone">
          {!del ? (
            <button onClick={() => setDel(true)} className="flex items-center gap-2 text-[14.5px] font-semibold text-rose">
              <Trash2 size={17} /> Delete restaurant
            </button>
          ) : (
            <div className="space-y-3 rounded-group bg-rose-soft p-4">
              <p className="flex gap-2 text-[14px] text-rose"><AlertTriangle size={18} className="shrink-0" /> This deletes the restaurant, its menu, orders, guests, staff logins and the owner login. It can&apos;t be undone.</p>
              <Field label={`Type "${r.name}" to confirm`}>
                <input className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button variant="plain" className="!bg-surface" onClick={() => { setDel(false); setConfirm(""); }}>Cancel</Button>
                <Button
                  variant="danger"
                  disabled={busy || confirm.trim().toLowerCase() !== r.name.trim().toLowerCase()}
                  onClick={async () => {
                    setBusy(true);
                    setErr("");
                    try {
                      await adminDelete(r.id, confirm);
                      onDeleted();
                    } catch (e) {
                      setErr((e as Error).message);
                      setBusy(false);
                    }
                  }}
                >
                  Delete for good
                </Button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </Sheet>
      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="Confirm the change"
        footer={
          <Button
            size="lg"
            className="w-full"
            disabled={!pw || busy}
            onClick={async () => {
              try {
                await verifyMyPassword(pw);
              } catch (e) {
                return setPwErr((e as Error).message);
              }
              const p = pending;
              setPending(null);
              await p?.go();
            }}
          >
            Confirm
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-[15px]"><b>{pending?.what}</b> for <b>{r.name}</b>?</p>
          <Field label="Your super admin password"><PasswordInput value={pw} onChange={(v) => { setPw(v); setPwErr(""); }} autoComplete="current-password" autoFocus /></Field>
          {pwErr && <p className="text-[13.5px] text-rose">{pwErr}</p>}
        </div>
      </Sheet>
    </>
  );
}

