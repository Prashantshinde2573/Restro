"use client";

// Super admin: every restaurant on Restropi. Add a restaurant (with its owner
// login), change plan and renewal, suspend, reset the owner's password, delete.
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, BarChart3, CalendarClock, Check, Copy, KeyRound, LogOut, Mail, MessageCircle, Plus, RefreshCw, Search, Store, Ticket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Spinner, Wordmark } from "@/components/shell";
import { Button, Chips, Field, Pill, Segmented, Sheet, Toggle, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { isValidUpi } from "@/components/upi";
import { ChangePassword, PasswordInput } from "@/components/owner-auth";
import { PlanCouponField, PlanCouponsSheet, PlatformSheet, couponOffFor, planListPrice, type CouponPick } from "@/components/admin-extras";
import { planStatus } from "@/lib/plan-status";
import { fitLogo } from "@/lib/fit-logo";
import { AdminReportsSheet, eventText } from "@/components/admin-reports";
import { STATE_TONE, daysTo, monthlyRevenue, planState, stateText, type PlanState } from "@/lib/admin-plan";
import { ErrorsSheet } from "@/components/admin-errors";
import { BackupsSheet } from "@/components/admin-backups";
import {
  adminCreate,
  adminDelete,
  adminList,
  adminResetOwnerPassword,
  adminUpdate,
  cloudSignOut,
  useCloud,
  sendWelcomeEmail,
  adminSetLogo,
  adminRemoveLogo,
  adminSyncOwner,
  adminPlanEmail,
  verifyMyPassword,
  adminErrors,
  adminPlanPayment,
  adminPlanEventsFor,
  adminTrial,
  type PlanEvent,
  adminPlanCouponUses,
  type AdminRestaurant,
  type PlanCouponUse,
} from "@/lib/cloud";
import { plans } from "@/lib/plans";
import { inr, timeAgo } from "@/lib/format";
import { OUTLET_LIMIT, RENEW_WARN_DAYS } from "@/lib/access";

type PlanId = AdminRestaurant["plan"];
type Filter = "all" | "paying" | "trial" | "due" | "ended" | "paused";

const DAY = 86_400_000;
const ERRORS_SEEN = "restropi.admin.errorsSeen";
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

function renewState(r: AdminRestaurant): { tone: "jade" | "saffron" | "rose" | "neutral" | "sky"; text: string } {
  return { tone: STATE_TONE[planState(r)], text: stateText(r) };
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
  const [reportsOpen, setReportsOpen] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  // errors that came in since the super admin last opened the list (a red count on the button)
  const [newErrors, setNewErrors] = useState(0);
  useEffect(() => {
    let live = true;
    const check = () => {
      let seen = 0;
      try { seen = Number(localStorage.getItem(ERRORS_SEEN) ?? 0) || 0; } catch {}
      adminErrors().then((rows) => live && setNewErrors(rows.filter((r) => new Date(r.at).getTime() > seen).length)).catch(() => {});
    };
    check();
    const id = window.setInterval(check, 60_000);
    return () => { live = false; window.clearInterval(id); };
  }, []);
  const markErrorsSeen = () => {
    try { localStorage.setItem(ERRORS_SEEN, String(Date.now())); } catch {}
    setNewErrors(0);
  };
  const [backupsOpen, setBackupsOpen] = useState(false);
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
  const groups: Record<Filter, PlanState[]> = {
    all: [], paying: ["paying", "ending", "grace"], trial: ["trial"], due: ["ending", "grace", "trial"], ended: ["ended", "trial_ended"], paused: ["paused"],
  };
  const is = (r: AdminRestaurant, k: Filter) => {
    if (k === "all") return true;
    const st = planState(r);
    // "Renew soon": paid plans ending, or a trial in its last days
    if (k === "due") return st === "ending" || st === "grace" || (st === "trial" && daysTo(r.renewsAt) <= RENEW_WARN_DAYS);
    return groups[k].includes(st);
  };
  const shown = useMemo(
    () => all.filter((r) => is(r, f) && (!q || `${r.name} ${r.city} ${r.owner} ${r.ownerEmail} ${r.phone}`.toLowerCase().includes(q.toLowerCase()))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, f, q],
  );
  const paying = all.filter((r) => is(r, "paying"));
  const trials = all.filter((r) => is(r, "trial"));
  const mrr = all.reduce((t, r) => t + monthlyRevenue(r), 0);
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
            <Button variant="tinted" onClick={() => setReportsOpen(true)}><BarChart3 size={17} /> Reports & revenue</Button>
            <Button variant="tinted" onClick={() => { setErrorsOpen(true); markErrorsSeen(); }}>
              <AlertTriangle size={17} /> App errors
              {newErrors > 0 && <span className="ml-1 rounded-full bg-[#D92D20] px-1.5 py-0.5 text-[11.5px] font-bold leading-none text-white tnum">{newErrors > 99 ? "99+" : newErrors}</span>}
            </Button>
            <Button variant="tinted" onClick={() => setBackupsOpen(true)}><Archive size={17} /> Backups</Button>
            <Button variant="tinted" onClick={() => setPlatformOpen(true)}><MessageCircle size={17} /> Payments & reminders</Button>
            <Button variant="tinted" onClick={() => setCouponsOpen(true)}><Ticket size={17} /> Plan coupons</Button>
            <Button onClick={() => setAdding(true)}><Plus size={18} /> Add restaurant</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            ["Restaurants", String(all.length), `${paying.length} paying · ${trials.length} on free trial`],
            ["Monthly revenue", inr(mrr), "paying plans only · free trials not counted"],
            ["Renew soon", String(all.filter((r) => is(r, "due")).length), `plans and trials ending in ${RENEW_WARN_DAYS} days`],
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
                ["paying", "Paying"],
                ["trial", "Free trial"],
                ["due", "Renew soon"],
                ["ended", "Ended"],
                ["paused", "Paused"],
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
                  <span className="flex flex-wrap items-center gap-1">
                    <Pill tone={r.plan === "pro" || r.plan === "chain" ? "sky" : "neutral"}>{planName(r.plan)}</Pill>
                    {r.allowGateway && <span title="Online payments allowed" className="rounded-full bg-jade-soft px-1.5 py-0.5 text-[11px] font-semibold text-jade-deep">₹ online</span>}
                    {r.allowWaApi && <span title="WhatsApp API allowed" className="rounded-full bg-jade-soft px-1.5 py-0.5 text-[11px] font-semibold text-jade-deep">WA API</span>}
                  </span>
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
      <AdminReportsSheet open={reportsOpen} onClose={() => setReportsOpen(false)} list={list ?? []} onOpen={(id) => { setReportsOpen(false); setOpenId(id); }} />
      <BackupsSheet open={backupsOpen} onClose={() => setBackupsOpen(false)} />
      <ErrorsSheet open={errorsOpen} onClose={() => setErrorsOpen(false)} names={Object.fromEntries((list ?? []).map((r) => [r.id, r.name]))} />

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
  start: "trial" as "trial" | "paid",
  months: 1,
  trialDays: 14,
  notes: "",
};

function AddRestaurant({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: { rid: string; ownerEmail: string; tempPassword: string }, name: string) => void }) {
  const [d, setD] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [coupon, setCoupon] = useState<CouponPick>(null);
  const toast = useToast();
  useEffect(() => {
    if (open) { setD(blank); setErr(""); setCoupon(null); }
  }, [open]);
  const paid = d.start === "paid";
  const list = paid ? planListPrice(d.plan, d.months) : null;
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setD((x) => ({ ...x, [k]: v }));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.ownerEmail.trim());
  const upiOk = !d.upi.trim() || isValidUpi(d.upi.trim());
  const problem =
    d.name.trim().length < 2 ? "Add the restaurant name" :
    d.ownerName.trim().length < 2 ? "Add the owner's name" :
    !emailOk ? "Add the owner's email" :
    !upiOk ? "UPI ID looks wrong" : "";
  const ends = new Date(Date.now() + (paid ? d.months * 30 : d.trialDays) * DAY).toISOString();

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
        months: paid ? d.months : 0,
        trialDays: paid ? 0 : d.trialDays,
        tables: d.type === "cafe" ? Math.min(d.tables, 50) : d.tables,
        outlet: { name: d.outletName.trim() || d.city.trim() || "Main", address: d.address.trim(), businessType: d.type, upi: d.upi.trim(), payFirst: d.payFirst },
      });
      // the restaurant is made: keep its trial and what it paid in the plan history (a problem here doesn't undo the restaurant)
      if (!paid) await adminTrial(res.rid, "start", d.trialDays).catch((e) => toast(`Restaurant made, but the trial wasn't marked: ${(e as Error).message}`));
      if (paid && list != null) {
        await adminPlanPayment(res.rid, "new", d.months, list, coupon?.code)
          .then((u) => toast(u.code ? `Coupon ${u.code} · ${inr(u.off)} off · owner pays ${inr(u.pay)}` : `Payment noted · ${inr(u.pay)}`))
          .catch((e) => toast(`Restaurant made, but the payment wasn't noted: ${(e as Error).message}`));
      }
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
          <Field label="How does it start?">
            <Segmented className="w-full" value={d.start} onChange={(v) => set("start", v)} options={[{ value: "trial", label: "Free trial" }, { value: "paid", label: "Paid plan" }]} />
          </Field>
          {paid ? (
            <>
              <Field label="Paid for">
                <Segmented className="w-full" value={String(d.months)} onChange={(v) => set("months", Number(v))} options={[1, 3, 6, 12].map((m) => ({ value: String(m), label: m === 12 ? "1 year" : `${m} month${m > 1 ? "s" : ""}` }))} />
              </Field>
              {list != null && <PlanCouponField plan={d.plan} list={list} value={coupon} onChange={setCoupon} />}
              <div className="rounded-group bg-surface p-4 text-[14px]">
                Paid plan till <b>{dateText(ends)}</b>.
                {list != null ? <> Owner pays <b>{inr(list - couponOffFor(coupon, list))}</b>. It goes in Reports as collected.</> : " Chain is priced by hand: note the price when you renew."}
              </div>
            </>
          ) : (
            <>
              <Field label="Trial length">
                <Segmented className="w-full" value={String(d.trialDays)} onChange={(v) => set("trialDays", Number(v))} options={[7, 14, 30].map((n) => ({ value: String(n), label: `${n} days` }))} />
              </Field>
              <div className="rounded-group bg-sky-soft p-4 text-[14px] text-ink">
                Free till <b>{dateText(ends)}</b>. Shown as <b>Free trial</b> and not counted as revenue. When they pay, open the restaurant → <b>Start paid plan</b>.
              </div>
            </>
          )}
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

/** Renewal, one step: how long → (coupon) → see the new dates and the price → renew. */
function RenewBox({ r, months, setMonths, from, till, coupon, setCoupon, typed, setTyped, busy, onRenew, customPrice, setCustomPrice, onTrial, onTrialAct }: {
  r: AdminRestaurant; months: number; setMonths: (m: number) => void; from: number; till: string;
  coupon: CouponPick; setCoupon: (c: CouponPick) => void; typed: string; setTyped: (t: string) => void; busy: boolean; onRenew: () => void;
  customPrice: number; setCustomPrice: (n: number) => void;
  onTrial: boolean; onTrialAct: (a: "extend" | "end", days?: number) => void;
}) {
  const p = plans.find((x) => x.id === r.plan);
  const outlets = Math.max(1, r.outlets);
  // whole calendar days (India time) between today and the last paid day
  const day = (t: number) => Math.floor((t + 5.5 * 3600_000) / DAY);
  const left = day(new Date(r.renewsAt).getTime()) - day(Date.now());
  const ended = left < 0;
  const full = p?.monthly ? p.monthly * months : null;
  const list = planListPrice(r.plan, months);
  const offer = full != null && list != null ? full - list : 0;
  const off = list != null ? couponOffFor(coupon, list) : 0;
  const pay = list != null ? list - off : null;
  const waiting = !!typed && !coupon;
  const Row = ({ l, v, strong, tone }: { l: ReactNode; v: ReactNode; strong?: boolean; tone?: string }) => (
    <div className={clsx("flex items-baseline justify-between gap-3 py-1.5", strong ? "text-[16px] font-semibold" : "text-[14px]", tone)}>
      <span className={strong ? "" : "text-muted"}>{l}</span>
      <span className="tnum">{v}</span>
    </div>
  );
  return (
    <div className="space-y-4">
      {/* where the plan stands now */}
      {onTrial ? (
        <div className="rounded-group bg-sky-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[15px] font-semibold">Free trial · {planName(r.plan)}</div>
            <Pill tone={ended ? "rose" : "sky"}>{ended ? `Ended ${-left} day${left === -1 ? "" : "s"} ago` : left === 0 ? "Ends today" : `${left} day${left === 1 ? "" : "s"} left`}</Pill>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-[14px]">
            <div><div className="text-[12.5px] text-muted">Customer since</div><b>{dateText(r.createdAt)}</b></div>
            <div><div className="text-[12.5px] text-muted">{ended ? "Was free till" : "Free till"}</div><b className={ended ? "text-rose" : ""}>{dateText(r.renewsAt)}</b></div>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Not paying yet, so not counted as revenue.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[7, 14].map((n) => <Button key={n} variant="plain" className="!bg-surface" disabled={busy} onClick={() => onTrialAct("extend", n)}>+{n} days free</Button>)}
            <Button variant="plain" className="!bg-surface !text-rose" disabled={busy} onClick={() => onTrialAct("end")}>End trial now</Button>
          </div>
        </div>
      ) : (
      <div className="rounded-group bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[15px] font-semibold">{planName(r.plan)} plan{p?.monthly ? ` · ${inr(p.monthly)} a month` : " · custom price"}</div>
          <Pill tone={ended ? "rose" : left <= RENEW_WARN_DAYS ? "saffron" : "jade"}>{ended ? `Ended ${-left} day${left === -1 ? "" : "s"} ago` : left === 0 ? "Ends today" : `${left} day${left === 1 ? "" : "s"} left`}</Pill>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-[14px]">
          <div><div className="text-[12.5px] text-muted">Customer since</div><b>{dateText(r.createdAt)}</b></div>
          <div><div className="text-[12.5px] text-muted">{ended ? "Was paid till" : "Paid till"}</div><b className={ended ? "text-rose" : ""}>{dateText(r.renewsAt)}</b></div>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">{outlets} outlet{outlets === 1 ? "" : "s"} of {OUTLET_LIMIT[r.plan] === Infinity ? "any number" : OUTLET_LIMIT[r.plan]} in this plan · one price for the restaurant.</p>
      </div>
      )}
      {onTrial && <h4 className="pt-1 text-[16px] font-semibold">Start the paid plan</h4>}

      {/* 1. how long */}
      <Field label={onTrial ? "1 · Paid for" : "1 · Renew for"}>
        <Segmented className="w-full" value={String(months)} onChange={(v) => setMonths(Number(v))} options={[1, 3, 6, 12].map((m) => ({ value: String(m), label: m === 12 ? "1 year" : `${m} month${m > 1 ? "s" : ""}` }))} />
      </Field>

      {/* 2. coupon */}
      {list != null && <PlanCouponField plan={r.plan} list={null} value={coupon} onChange={setCoupon} onDraft={setTyped} label="2 · Coupon (optional)" />}
      {list == null && (
        <Field label="2 · Price agreed for this renewal (₹)" hint="Chain is priced by hand. It goes in the reports as what was paid.">
          <input className={inputCls} inputMode="numeric" value={customPrice || ""} placeholder="e.g. 9000" onChange={(e) => setCustomPrice(Math.min(10000000, Number(e.target.value.replace(/\D/g, "")) || 0))} />
        </Field>
      )}

      {/* 3. what happens */}
      <div className="rounded-group bg-surface p-4">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{list != null ? "3 · " : ""}{onTrial ? "Paid plan" : "New plan period"}</div>
        <div className="mt-1 text-[17px] font-semibold">
          {dateText(new Date(from).toISOString())} → {dateText(till)}
        </div>
        <p className="text-[12.5px] text-muted">{onTrial ? "The free trial ends now and the paid plan starts today." : ended ? "The old plan has ended, so the new one starts today." : `Starts after the paid days end (${dateText(r.renewsAt)}), so no day is lost.`}</p>
        {list != null && full != null && (
          <div className="mt-3 border-t border-line/70 pt-2">
            <Row l={`${planName(r.plan)} ${inr(p!.monthly!)} × ${months} month${months === 1 ? "" : "s"}`} v={inr(full)} />
            {offer > 0 && <Row l={months === 12 ? "1-year price (2 months free)" : "6-month price (1 month free)"} v={`−${inr(offer)}`} tone="text-jade-deep" />}
            {coupon && <Row l={`Coupon ${coupon.code} (${coupon.kind === "percent" ? `${coupon.value}% off` : `${inr(coupon.value)} off`})`} v={`−${inr(off)}`} tone="text-jade-deep" />}
            <Row l="Owner pays" v={inr(pay!)} strong />
          </div>
        )}
      </div>
      {waiting && <p className="-mt-2 text-[13px] font-medium text-saffron">Tap “Check” to apply the coupon “{typed.toUpperCase()}”, or clear it.</p>}
      <Button size="lg" className="w-full" disabled={busy || waiting} onClick={onRenew}>
        <RefreshCw size={16} /> {onTrial ? "Start paid plan" : "Renew"} till {dateText(till)}{pay != null ? ` · ${inr(pay)}` : customPrice > 0 ? ` · ${inr(customPrice)}` : ""}
      </Button>
      <p className="-mt-2 text-center text-[12.5px] text-muted">The owner gets a “plan renewed” email.{coupon ? ` Coupon ${coupon.code} is counted once.` : ""}</p>
    </div>
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
  const sheetToast = useToast();
  // tell the owner by email; say so here when it didn't go (it is also listed in App errors)
  const mailOwner = (event: "renewed" | "grace" | "plan") =>
    adminPlanEmail(r.id, event).then((m) => {
      if (!m.ok && !m.later) sheetToast(`Saved, but the email to the owner didn't go: ${m.error}`);
    });
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
  // a plan coupon for this renewal (counted when a +months button is used)
  const [coupon, setCoupon] = useState<CouponPick>(null);
  const [uses, setUses] = useState<PlanCouponUse[]>([]);
  const [history, setHistory] = useState<PlanEvent[]>([]);
  const [allHistory, setAllHistory] = useState(false);
  const loadUses = useCallback(() => {
    adminPlanCouponUses(r.id).then(setUses).catch(() => setUses([]));
    adminPlanEventsFor(r.id).then(setHistory).catch(() => setHistory([]));
  }, [r.id]);
  useEffect(() => { loadUses(); }, [loadUses, r.renewsAt, r.plan, r.status, r.graceUntil]);
  // renew: the new period starts where the paid one ends (or today, if it has already ended)
  // on a free trial the paid plan starts today (the trial ends); otherwise after the paid days
  const trialState = planState(r);
  const onTrial = trialState === "trial" || trialState === "trial_ended";
  const renewFrom = () => (onTrial ? Date.now() : Math.max(Date.now(), new Date(r.renewsAt).getTime()));
  const trialAct = (action: "extend" | "end" | "start", days?: number) =>
    run(() => adminTrial(r.id, action, days), action === "end" ? "End the free trial now (the restaurant stops until it pays)" : action === "extend" ? `Extend the free trial by ${days} days` : `Start a ${days}-day free trial (not counted as revenue)`);
  const renewTill = (months: number) => {
    const d = new Date(renewFrom());
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
  };
  const extend = (months: number, c: CouponPick) => {
    const iso = renewTill(months);
    const list = planListPrice(r.plan, months) ?? (customPrice > 0 ? customPrice : null);
    const use = c && list != null ? c : null;
    const pay = list == null ? null : list - couponOffFor(use, list);
    const msg = `${onTrial ? "Start the paid plan" : "Renew"} till ${dateText(iso)}${pay != null ? ` · owner pays ${inr(pay)}` : ""}${use ? ` (coupon ${use.code})` : ""}`;
    return run(async () => {
      await adminUpdate(r.id, { renewsAt: iso });
      await mailOwner("renewed");
      // what was paid goes in the plan history (and the coupon is counted)
      try {
        await adminPlanPayment(r.id, onTrial ? "new" : "renew", months, list ?? 0, use?.code, onTrial ? "Free trial → paid plan" : undefined);
        setCoupon(null);
        setCustomPrice(0);
        loadUses();
      } catch (e) {
        throw new Error(`Renewed till ${dateText(iso)}, but the payment wasn't noted: ${(e as Error).message}`);
      }
    }, msg);
  };
  const [months, setMonths] = useState(1);
  const [customPrice, setCustomPrice] = useState(0); // Chain: the price agreed for this renewal
  const [typed, setTyped] = useState("");
  const [fixDate, setFixDate] = useState(false);
  const [giveTrial, setGiveTrial] = useState(false);
  // grace counts from the plan's end (or from today if that has already passed), or adds to a running grace
  const [graceDate, setGraceDate] = useState("");
  // logo: picked here, shrunk in the browser, stored by our server
  const [logo, setLogo] = useState<string | null>(r.logo ?? null);
  useEffect(() => setLogo(r.logo ?? null), [r.logo]);
  const [logoBusy, setLogoBusy] = useState(false);
  const pickLogo = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Choose an image (PNG or JPG)");
    const png = await fitLogo(f).catch(() => null);
    if (!png) return setErr("Couldn't read that image");
    confirmThen("Change the logo", async () => {
      setLogoBusy(true);
      setErr("");
      try {
        setLogo(await adminSetLogo(r.id, png));
        onChanged("Logo saved · guests and bills show it now");
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLogoBusy(false);
      }
    });
  };
  const giveGrace = (days: number) => {
    const base = Math.max(Date.now(), new Date(r.renewsAt).getTime(), r.graceUntil ? new Date(r.graceUntil).getTime() : 0);
    const iso = new Date(base + days * DAY).toISOString();
    return run(() => adminUpdate(r.id, { graceUntil: iso }).then(() => mailOwner("grace")), graceMsg(iso));
  };
  // the owner hears about grace only when it starts (the plan has ended), not while the plan still runs
  const graceMsg = (iso: string) =>
    `Grace period till ${dateText(iso)} · ${new Date(r.renewsAt).getTime() > Date.now() ? `the owner gets the email when the plan ends (${dateText(r.renewsAt)})` : "the owner is emailed now"}`;
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
          <PlanPicker value={r.plan} onChange={(v) => v !== r.plan && run(() => adminUpdate(r.id, { plan: v }).then(() => mailOwner("plan")), `Plan changed to ${planName(v)}`)} />
        </Section>

        <Section title="Plan & renewal">
          <RenewBox
            r={r}
            months={months}
            setMonths={setMonths}
            from={renewFrom()}
            till={renewTill(months)}
            coupon={coupon}
            setCoupon={setCoupon}
            setTyped={setTyped}
            typed={typed}
            busy={busy}
            customPrice={customPrice}
            setCustomPrice={setCustomPrice}
            onTrial={onTrial}
            onTrialAct={trialAct}
            onRenew={() => extend(months, coupon)}
          />
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <button type="button" className="text-[13.5px] font-semibold text-muted underline" onClick={() => setFixDate((v) => !v)}>
              {fixDate ? "Hide" : "Correct the end date by hand"}
            </button>
            {!onTrial && (
              <button type="button" className="text-[13.5px] font-semibold text-muted underline" onClick={() => setGiveTrial((v) => !v)}>
                {giveTrial ? "Hide" : "Put on a free trial"}
              </button>
            )}
          </div>
          {giveTrial && !onTrial && (
            <div className="space-y-2 rounded-group bg-surface p-3">
              <p className="text-[13px] text-muted">Free from today. It shows as Free trial and is not counted as revenue. The current end date is replaced.</p>
              <div className="flex flex-wrap gap-2">
                {[7, 14, 30].map((n) => <Button key={n} variant="plain" className="!bg-canvas" disabled={busy} onClick={() => trialAct("start", n)}>{n} days free</Button>)}
              </div>
            </div>
          )}
          {fixDate && (
            <div className="space-y-2 rounded-group bg-surface p-3">
              <p className="text-[13px] text-muted">Only to fix a wrong date. No price and no coupon; the owner gets the &quot;plan renewed&quot; email.</p>
              <div className="flex gap-2">
                <input type="date" aria-label="Plan paid till" className={clsx(inputCls, "flex-1")} value={date} onChange={(e) => setDate(e.target.value)} />
                <Button
                  disabled={busy || !date || date === r.renewsAt.slice(0, 10)}
                  onClick={() => run(() => adminUpdate(r.id, { renewsAt: new Date(`${date}T23:59:00+05:30`).toISOString() }).then(() => mailOwner("renewed")), `Plan paid till ${dateText(`${date}T23:59:00+05:30`)}`)}
                >
                  Save date
                </Button>
              </div>
            </div>
          )}
          {uses.length > 0 && (
            <div className="rounded-group bg-surface px-4 py-2">
              <div className="py-1 text-[12.5px] font-semibold uppercase tracking-wide text-muted">Plan coupons used</div>
              {uses.map((u, i) => (
                <div key={i} className="flex items-center gap-2 border-t border-line/70 py-2 text-[13.5px] first:border-0">
                  <span className="font-mono font-bold">{u.code}</span>
                  <span className="flex-1 text-muted">{u.event === "new" ? "New" : "Renewal"} · {planName(u.plan as PlanId)} · {u.months} mo · {dateText(u.at)}</span>
                  <span className="tnum">−{inr(u.off)} <span className="text-muted">of {inr(u.list_price)}</span></span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Plan history">
          {history.length === 0 ? (
            <p className="text-[13.5px] text-muted">Nothing yet.</p>
          ) : (
            <div className="rounded-group bg-surface px-4 py-1">
              {(allHistory ? history : history.slice(0, 8)).map((e) => (
                <div key={e.id} className="flex gap-3 border-t border-line/70 py-2.5 text-[13.5px] first:border-0">
                  <span className="w-[92px] shrink-0 text-muted tnum">{dateText(e.at)}</span>
                  <span className={clsx("flex-1", e.kind === "payment" && "font-semibold text-jade-deep")}>{eventText(e)}</span>
                </div>
              ))}
            </div>
          )}
          {history.length > 8 && <button type="button" className="text-[13px] font-semibold text-jade underline" onClick={() => setAllHistory((v) => !v)}>{allHistory ? "Show fewer" : `Show all ${history.length}`}</button>}
          <p className="text-[12.5px] text-muted">
            Total paid: <b className="text-ink">{inr(history.filter((e) => e.kind === "payment").reduce((t, e) => t + (e.amount ?? 0), 0))}</b>
            {" · "}{history.filter((e) => e.kind === "payment").length} payment{history.filter((e) => e.kind === "payment").length === 1 ? "" : "s"}. History is kept from 19 Nov 2026.
          </p>
        </Section>

        <Section title="Grace period">
          <p className="text-[13.5px] text-muted">
            After the plan ends the store stops (billing and the QR menu). A grace period keeps it running a few more days. The owner gets one email and sees a banner in the app every day until it ends.
          </p>
          {r.graceUntil && new Date(r.graceUntil).getTime() > Date.now() ? (
            <div className="flex flex-wrap items-center gap-2 text-[14.5px]">
              <Pill tone="saffron">Grace till {dateText(r.graceUntil)}</Pill>
              <Button variant="plain" className="!bg-surface" disabled={busy} onClick={() => run(() => adminUpdate(r.id, { graceUntil: null }), "Grace period removed")}>Remove grace</Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[3, 7, 15].map((n) => (
              <Button key={n} variant="plain" className="!bg-surface" disabled={busy} onClick={() => giveGrace(n)}>
                +{n} days
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="date" className={clsx(inputCls, "flex-1")} value={graceDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setGraceDate(e.target.value)} aria-label="Grace period until" />
            <Button disabled={busy || !graceDate} onClick={() => run(() => adminUpdate(r.id, { graceUntil: new Date(`${graceDate}T23:59:00+05:30`).toISOString() }).then(() => mailOwner("grace")), graceMsg(`${graceDate}T23:59:00+05:30`))}>
              Set grace
            </Button>
          </div>
        </Section>

        <Section title="Logo">
          <p className="text-[13.5px] text-muted">Shown next to the restaurant&apos;s name on the guest QR menu and on printed bills. Owners can&apos;t change it; they send you a request on WhatsApp.</p>
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-white ring-1 ring-line">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={`${r.name} logo`} className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-[24px] font-bold text-muted">{r.name.trim().charAt(0).toUpperCase() || "R"}</span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <label className={clsx("inline-flex h-11 cursor-pointer items-center rounded-ctl bg-surface px-4 text-[15px] font-semibold", logoBusy && "pointer-events-none opacity-60")}>
                {logoBusy ? "Uploading…" : logo ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/*" className="sr-only" disabled={logoBusy} onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {logo && !logoBusy && (
                <Button variant="plain" className="!bg-surface" onClick={() => confirmThen("Remove the logo", async () => { setLogoBusy(true); setErr(""); try { await adminRemoveLogo(r.id); setLogo(null); onChanged("Logo removed"); } catch (e) { setErr((e as Error).message); } finally { setLogoBusy(false); } })}>
                  Remove
                </Button>
              )}
            </div>
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
          <Button
            disabled={busy || !infoChanged || info.name.trim().length < 2}
            onClick={() => run(() => adminUpdate(r.id, info).then(() => (info.owner !== r.owner ? adminSyncOwner(r.id) : undefined)), "Details saved")}
          >
            Save details
          </Button>
        </Section>

        <Section title="Extra features">
          <div className="overflow-hidden rounded-group bg-surface">
            {(
              [
                ["allowGateway", "Online payments (own gateway)", "The owner can connect their own Razorpay / Cashfree; guests see “Pay online”.", r.gatewayOn],
                ["allowWaApi", "WhatsApp API", "The owner can connect their own WhatsApp number (Pro plan and up): e-bills and offers go out by themselves.", r.waOn],
              ] as const
            ).map(([k, label, hint, connected]) => (
              <div key={k} className="flex items-center justify-between gap-4 border-b border-line/80 px-4 py-3 last:border-0">
                <span>
                  <span className="block text-[15px] font-medium">
                    {label}
                    {connected && <span className="ml-2 rounded-full bg-jade-soft px-2 py-0.5 text-[11.5px] font-semibold text-jade-deep">Connected</span>}
                  </span>
                  <span className="block text-[13px] text-muted">{hint} Off: hidden from the client and refused by the server.</span>
                </span>
                <Toggle
                  checked={r[k]}
                  label={label}
                  onChange={(v) => run(() => adminUpdate(r.id, { [k]: v }), `${label} ${v ? "turned on" : "turned off"} for ${r.name}`)}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Access">
          <div className="overflow-hidden rounded-group bg-surface">
            <div className="flex items-center justify-between gap-4 border-b border-line/80 px-4 py-3">
              <span>
                <span className="block text-[15px] font-medium">Restaurant is {r.status === "suspended" ? <b className="text-rose">paused</b> : <b className="text-jade-deep">on</b>}</span>
                <span className="block text-[13px] text-muted">
                  An on/off switch for the whole restaurant, separate from the plan dates. Turn it off to stop a restaurant at once (for example, it doesn&apos;t pay or asks to stop): the owner and staff can&apos;t use the app and guests can&apos;t order from the QR menu. Menu, orders and guests stay saved; turn it on again and everything is back.
                </span>
              </span>
              <Toggle
                checked={r.status === "active"}
                label="Restaurant on"
                onChange={(v) => run(() => adminUpdate(r.id, { status: v ? "active" : "suspended" }), v ? "Turn the restaurant on again" : "Pause the restaurant (owner, staff and the QR menu stop)")}
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

