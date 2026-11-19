"use client";

// Renew, change or restart a plan. When Restropi's Razorpay is set up the owner pays right here and
// the plan renews by itself (the server confirms with Razorpay). Otherwise, or if they prefer, they
// pay by UPI and send it on WhatsApp; the super admin then turns the plan on in /admin.
import clsx from "clsx";
import { Check, CheckCircle2, Lock, MessageCircle, Ticket, X } from "lucide-react";
import { useEffect, useState } from "react";
import { checkPlanCoupon, getPlatformSettings, useCloud, type PlatformSettings } from "@/lib/cloud";
import { createStore } from "@/lib/store";
import { useAccount, useOutlets } from "@/lib/live";
import { CYCLES, cyclePrice, plans, type Cycle, PLAN_GST_RATE } from "@/lib/plans";
import { PLAN_NAME } from "@/lib/access";
import { inr } from "@/lib/format";
import { Button, Sheet, inputCls } from "./ui";
import { payPlan, planPayConfig, type PlanPayConfig, type PlanPayResult } from "@/lib/plan-pay";
import { UpiPayCard, isValidUpi } from "./upi";

type PlanId = (typeof plans)[number]["id"];
const sheet = createStore<{ open: boolean; plan?: PlanId }>({ open: false });
/** Open the plan sheet from anywhere (renew banner, locked screens, settings). */
export const openPlanSheet = (plan?: PlanId) => sheet.set({ open: true, plan });


/** WhatsApp link to the Restropi team with a ready-made message. */
export function teamWhatsApp(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** Restropi team's WhatsApp number (loaded once). */
export function usePlatform() {
  const [p, setP] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    let on = true;
    getPlatformSettings().then((x) => on && setP(x)).catch(() => on && setP({ whatsapp: "", upi: "", payee: "" }));
    return () => {
      on = false;
    };
  }, []);
  return p;
}

export function PlanSheet() {
  const { open, plan: wanted } = sheet.use();
  const account = useAccount();
  const outlets = useOutlets();
  const cloud = useCloud();
  const platform = usePlatform();
  const [plan, setPlan] = useState<PlanId>(account.plan);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const cyc = CYCLES.find((c) => c.id === cycle)!;
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; kind: "percent" | "flat"; value: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [pay, setPay] = useState<PlanPayConfig | null>(null);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<PlanPayResult | null>(null);
  const [payErr, setPayErr] = useState("");
  const [otherWay, setOtherWay] = useState(false);
  useEffect(() => { if (open) planPayConfig().then(setPay); }, [open]);

  useEffect(() => {
    if (open) {
      setPlan(wanted ?? account.plan);
      setCoupon(null);
      setCode("");
      setCodeMsg("");
      setResult(null);
      setPayErr("");
      setOtherWay(false);
    }
  }, [open, wanted, account.plan]);
  // a coupon may only be good for some plans: check again when the plan changes
  useEffect(() => setCoupon(null), [plan]);

  const p = plans.find((x) => x.id === plan)!;
  const count = Math.max(1, outlets.length);
  const each = cyclePrice(p, cycle);
  const base = each ?? 0; // one price for the restaurant: its outlets are included
  const off = coupon ? Math.min(base, Math.round(coupon.kind === "percent" ? (base * coupon.value) / 100 : coupon.value)) : 0;
  const gst = Math.round((base - off) * PLAN_GST_RATE);
  const total = base - off + gst;
  const custom = !p.monthly;
  const renewing = plan === account.plan;
  const ended = new Date(account.renewsAt).getTime() < Date.now();
  const action = account.status === "suspended" ? "Restart" : renewing ? (ended ? "Restart" : "Renew") : "Change to";
  const online = !!pay?.online && !custom && account.status !== "suspended" && cloud.role === "owner";
  // when the new period ends: a running plan continues from its end date, an ended one starts today
  const startAt = ended ? Date.now() : new Date(account.renewsAt).getTime();
  const runsTill = (() => { const d = new Date(startAt); d.setMonth(d.getMonth() + cyc.months); return d; })();
  const dateText = (d: Date | string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const payNow = async () => {
    setPaying(true);
    setPayErr("");
    try {
      const r = await payPlan({ plan, cycle, coupon: coupon?.code ?? null, description: `${p.name} plan · ${cyc.short}` });
      if (r.status === "cancelled") return;
      if (r.status === "failed") setPayErr(r.message || "The payment didn't go through. No money was taken.");
      else setResult(r);
    } catch (e) {
      setPayErr((e as Error).message);
    } finally {
      setPaying(false);
    }
  };

  const message = [
    `Hi Restropi team, I want to ${action.toLowerCase()} ${renewing ? "my" : "the"} ${p.name} plan.`,
    "",
    `Restaurant: ${account.name || "-"}`,
    `Restaurant ID: ${cloud.rid ?? "-"}`,
    `Login: ${cloud.email ?? "-"}`,
    `Current plan: ${PLAN_NAME[account.plan]} (runs until ${new Date(account.renewsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})`,
    `New plan: ${p.name}${custom ? "" : `, ${cyc.short}`}, ${count} outlet${count === 1 ? "" : "s"}`,
    ...(coupon ? [`Coupon: ${coupon.code} (−${inr(off)})`] : []),
    ...(custom ? ["Please share the price."] : [`Amount: ${inr(total)}${PLAN_GST_RATE ? " incl. GST" : ""}`, platform?.upi ? "I have paid by UPI. Screenshot attached." : "Please share how to pay."]),
  ].join("\n");

  const apply = async () => {
    if (!code.trim()) return;
    setChecking(true);
    try {
      const c = await checkPlanCoupon(code, plan);
      if (c) {
        setCoupon(c);
        setCodeMsg("");
      } else setCodeMsg(`This code doesn't work for the ${p.name} plan.`);
    } catch {
      setCodeMsg("Could not check the code right now.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => sheet.set({ open: false })}
      title={`${action === "Change to" ? "Change" : action} plan`}
      wide
      footer={
        result ? (
          <Button size="lg" className="w-full" onClick={() => window.location.reload()}>Done</Button>
        ) : online && !otherWay ? (
          <div className="space-y-2">
            <Button size="lg" className="w-full" disabled={paying} onClick={payNow}>
              <Lock size={16} /> {paying ? "Opening secure payment…" : `Pay ${inr(total)} now`}
            </Button>
            {platform?.whatsapp && (
              <button type="button" className="block w-full text-center text-[13px] font-semibold text-muted underline" onClick={() => setOtherWay(true)}>
                {platform.upi ? "Or pay by UPI and send it on WhatsApp" : "Or send a request on WhatsApp"}
              </button>
            )}
          </div>
        ) : platform?.whatsapp ? (
          <a href={teamWhatsApp(platform.whatsapp, message)} target="_blank" rel="noreferrer" className="block">
            <Button size="lg" className="w-full !bg-[#25D366] hover:!bg-[#1fb757]">
              <MessageCircle size={18} /> {custom ? "Ask for a price on WhatsApp" : platform.upi ? "Paid? Send it on WhatsApp" : "Send request on WhatsApp"}
            </Button>
          </a>
        ) : (
          <p className="py-1 text-center text-[13.5px] text-muted">
            {platform ? "The Restropi team hasn't added their WhatsApp number yet. Please call your Restropi contact." : "Loading…"}
          </p>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 size={56} className={result.status === "paid" ? "text-jade" : "text-saffron"} />
          <h3 className="mt-3 text-[22px] font-semibold tracking-tight">{result.status === "paid" ? "Payment received" : "Payment is being confirmed"}</h3>
          <p className="mt-2 max-w-sm text-[15px] text-muted">
            {result.status === "paid"
              ? <>Your {p.name} plan now runs till <b className="text-ink">{result.renewsTo ? dateText(result.renewsTo) : dateText(runsTill)}</b>. A receipt is on its way to your email.</>
              : result.message || "Your plan updates by itself as soon as the bank confirms. You can close this."}
          </p>
        </div>
      ) : (
      <div className="space-y-5">
        {/* 1. plan */}
        <div className="grid gap-2 sm:grid-cols-2">
          {plans.map((x) => (
            <button
              key={x.id}
              onClick={() => setPlan(x.id)}
              className={clsx("rounded-group bg-surface p-3.5 text-left ring-2 transition", plan === x.id ? "ring-jade" : "ring-transparent hover:ring-line")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-semibold">{x.name}</span>
                <span className="text-[13.5px] font-semibold tnum">{x.monthly ? `${inr(x.monthly)}/mo` : "Custom"}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
                {x.outlets}
                {x.id === account.plan && <span className="rounded-full bg-jade-soft px-2 py-0.5 text-[11px] font-semibold text-jade-deep">Current</span>}
              </div>
            </button>
          ))}
        </div>

        {!custom && (
          <>
            {/* 2. how long */}
            <div className="grid grid-cols-3 gap-2">
              {CYCLES.map(({ id: c, short }) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={clsx("rounded-ctl px-1 py-3 text-[13px] font-semibold leading-tight", cycle === c ? "bg-ink text-canvas" : "bg-surface text-ink")}
                >
                  {short}
                </button>
              ))}
            </div>

            {/* 3. coupon */}
            {coupon ? (
              <div className="flex items-center gap-2 rounded-ctl bg-jade-soft px-3 py-2.5 text-[14px] text-jade-deep">
                <Ticket size={16} />
                <span className="flex-1"><b>{coupon.code}</b> · {coupon.kind === "percent" ? `${coupon.value}% off` : `${inr(coupon.value)} off`}</span>
                <button aria-label="Remove coupon" onClick={() => setCoupon(null)} className="p-1"><X size={15} /></button>
              </div>
            ) : (
              <div>
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void apply(); }}>
                  <input className={clsx(inputCls, "uppercase placeholder:normal-case")} placeholder="Have a coupon code?" value={code} onChange={(e) => { setCode(e.target.value); setCodeMsg(""); }} aria-label="Coupon code" />
                  <Button type="submit" variant="tinted" className="!h-12 shrink-0" disabled={!code.trim() || checking}>{checking ? "…" : "Apply"}</Button>
                </form>
                {codeMsg && <p className="mt-1.5 text-[12.5px] text-rose">{codeMsg}</p>}
              </div>
            )}

            {/* 4. total */}
            <dl className="space-y-1.5 rounded-group bg-surface p-4 text-[14px]">
              <div className="flex justify-between"><dt className="text-muted">{p.name} · {cyc.short} · {p.outlets}</dt><dd className="tnum">{inr(base)}</dd></div>
              {off > 0 && <div className="flex justify-between text-jade"><dt>Coupon {coupon?.code}</dt><dd className="tnum">−{inr(off)}</dd></div>}
              {PLAN_GST_RATE > 0 && <div className="flex justify-between"><dt className="text-muted">GST {Math.round(PLAN_GST_RATE * 100)}%</dt><dd className="tnum">{inr(gst)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-[17px] font-semibold"><dt>To pay</dt><dd className="tnum">{inr(total)}</dd></div>
            </dl>

            {online && (
              <p className="-mt-2 rounded-ctl bg-surface px-3.5 py-2.5 text-[13.5px] text-muted">
                {ended ? "Starts today" : `Continues after ${dateText(account.renewsAt)}`} · runs till <b className="text-ink">{dateText(runsTill)}</b>
              </p>
            )}
            {payErr && <p className="rounded-ctl bg-rose-soft px-3.5 py-2.5 text-[13.5px] font-medium text-rose">{payErr}</p>}
            {pay?.test && online && !otherWay && <p className="text-center text-[12.5px] font-semibold text-saffron">Test mode: no real money is taken.</p>}

            {/* 5. pay (by UPI + WhatsApp, when not paying online) */}
            {(!online || otherWay) && platform?.upi && isValidUpi(platform.upi) ? (
              <div className="rounded-group bg-surface p-5">
                <UpiPayCard upi={platform.upi} payee={platform.payee || "Restropi"} amount={total} note={`Restropi ${p.name} ${cyc.short}`} size={180} />
              </div>
            ) : null}
          </>
        )}

        <ol className="space-y-2 text-[13.5px] text-muted">
          {(online && !otherWay
            ? ["Pay securely with UPI, card or netbanking (Razorpay).", "Your plan renews right away — no need to message anyone.", "You get a receipt by email."]
            : custom
            ? ["Send the request on WhatsApp.", "The Restropi team shares the price for your outlets.", "Your plan is turned on as soon as it's paid."]
            : platform?.upi
              ? ["Pay the exact amount with any UPI app.", "Tap the green button and send the payment screenshot on WhatsApp.", "The Restropi team checks it and turns on your plan, usually within the hour."]
              : ["Send the request on WhatsApp.", "The Restropi team shares how to pay.", "Your plan is turned on as soon as it's paid."]
          ).map((t, i) => (
            <li key={t} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-jade-soft text-[11px] font-bold text-jade-deep">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-1.5 text-[12.5px] text-faint"><Check size={13} /> Your data and settings stay as they are.</p>
      </div>
      )}
    </Sheet>
  );
}
