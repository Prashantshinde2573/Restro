"use client";

// Super admin: where owners pay and message (WhatsApp, UPI), and coupons that
// take money off the Restropi plan price.
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Field, Segmented, Sheet, Toggle, inputCls } from "./ui";
import { useToast } from "./toast";
import { isValidUpi } from "./upi";
import { deletePlanCoupon, getPlatformSettings, listPlanCoupons, savePlanCoupon, savePlatformSettings, type PlanCoupon, type PlatformSettings } from "@/lib/cloud";
import { plans } from "@/lib/plans";
import { inr } from "@/lib/format";

const errText = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong");

/* ---------------- contact and payments ---------------- */
export function PlatformSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [p, setP] = useState<PlatformSettings>({ whatsapp: "", upi: "", payee: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) getPlatformSettings().then(setP).catch(() => {});
  }, [open]);
  const digits = p.whatsapp.replace(/\D/g, "");
  const err = digits && digits.length < 10 ? "WhatsApp number looks short" : p.upi && !isValidUpi(p.upi) ? "UPI ID looks wrong (like name@bank)" : null;

  const save = async () => {
    setBusy(true);
    try {
      // 10 digits = Indian number: add the country code wa.me needs
      await savePlatformSettings({ ...p, whatsapp: digits.length === 10 ? `91${digits}` : digits, upi: p.upi.trim() });
      toast("Saved");
      onClose();
    } catch (e) {
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Payments & WhatsApp"
      footer={<Button size="lg" className="w-full" disabled={busy || !!err} onClick={save}>{err ?? (busy ? "Saving…" : "Save")}</Button>}
    >
      <div className="space-y-4">
        <p className="text-[14px] text-muted">Owners see these when they renew or change their plan. They pay by UPI and send the request on WhatsApp to this number.</p>
        <Field label="WhatsApp number" hint="With country code, like 919876543210. A 10-digit number gets +91.">
          <input className={inputCls} inputMode="tel" value={p.whatsapp} onChange={(e) => setP({ ...p, whatsapp: e.target.value })} placeholder="919876543210" />
        </Field>
        <Field label="UPI ID for plan payments" hint="Leave empty to share payment details on WhatsApp instead.">
          <input className={inputCls} value={p.upi} onChange={(e) => setP({ ...p, upi: e.target.value })} placeholder="restropi@okaxis" autoCapitalize="off" />
        </Field>
        <Field label="Name shown on UPI">
          <input className={inputCls} value={p.payee} onChange={(e) => setP({ ...p, payee: e.target.value })} placeholder="Restropi" />
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------------- plan coupons ---------------- */
type Draft = Omit<PlanCoupon, "uses"> & { uses: number; isNew?: boolean };
const blank = (): Draft => ({ code: "", kind: "percent", value: 10, plans: [], valid_to: null, max_uses: null, uses: 0, active: true, note: null, isNew: true });
const label = (c: Pick<PlanCoupon, "kind" | "value">) => (c.kind === "percent" ? `${c.value}% off` : `${inr(c.value)} off`);
function state(c: PlanCoupon) {
  if (!c.active) return { t: "Off", tone: "muted" };
  if (c.valid_to && c.valid_to < new Date().toISOString().slice(0, 10)) return { t: "Expired", tone: "rose" };
  if (c.max_uses && c.uses >= c.max_uses) return { t: "Used up", tone: "rose" };
  return { t: "Active", tone: "jade" };
}

export function PlanCouponsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<PlanCoupon[] | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const load = useCallback(() => listPlanCoupons().then(setList).catch((e) => { toast(errText(e)); setList([]); }), [toast]);
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const used = async (c: PlanCoupon) => {
    try {
      await savePlanCoupon({ ...c, uses: c.uses + 1 });
      void load();
    } catch (e) {
      toast(errText(e));
    }
  };

  return (
    <>
      <Sheet open={open && !edit} onClose={onClose} title="Plan coupons" wide footer={<Button size="lg" className="w-full" onClick={() => setEdit(blank())}><Plus size={18} /> New plan coupon</Button>}>
        <p className="mb-4 text-[14px] text-muted">Owners type the code when renewing or changing plan. The discount shows in their total. When you turn on a plan that used a code, tap +1.</p>
        {list === null ? (
          <p className="py-8 text-center text-[14px] text-muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-muted">No plan coupons yet.</p>
        ) : (
          <div className="overflow-hidden rounded-group bg-surface">
            {list.map((c) => {
              const s = state(c);
              return (
                <div key={c.code} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEdit({ ...c })}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-bold tracking-wider">{c.code}</span>
                      <span className={clsx("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", s.tone === "jade" ? "bg-jade-soft text-jade-deep" : s.tone === "rose" ? "bg-rose-soft text-rose" : "bg-sunken text-muted")}>{s.t}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-muted">
                      {label(c)} · {c.plans.length ? c.plans.map((id) => plans.find((p) => p.id === id)?.name ?? id).join(", ") : "All plans"} · used {c.uses}{c.max_uses ? `/${c.max_uses}` : ""}
                      {c.valid_to ? ` · till ${new Date(c.valid_to).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                    </div>
                  </button>
                  <Button size="sm" variant="tinted" onClick={() => used(c)} aria-label={`Count one use of ${c.code}`}>+1</Button>
                </div>
              );
            })}
          </div>
        )}
      </Sheet>
      <PlanCouponEdit draft={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} taken={(code) => !!list?.some((x) => x.code === code)} />
    </>
  );
}

function PlanCouponEdit({ draft, onClose, onSaved, taken }: { draft: Draft | null; onClose: () => void; onSaved: () => void; taken: (code: string) => boolean }) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(blank());
  const [seen, setSeen] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  if (draft !== seen) {
    setSeen(draft);
    if (draft) setD(draft);
  }
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const err =
    !/^[A-Z0-9]{3,20}$/.test(d.code) ? "Code: 3–20 letters or numbers" : d.isNew && taken(d.code) ? "This code already exists" : !(d.value > 0) ? "Enter the discount" : d.kind === "percent" && d.value > 100 ? "Can't be more than 100%" : null;

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(msg);
      onSaved();
    } catch (e) {
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const { isNew, ...row } = d;

  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      title={isNew ? "New plan coupon" : d.code}
      footer={
        <div className="flex gap-2">
          {!isNew && <Button variant="danger" disabled={busy} aria-label="Delete coupon" onClick={() => run(() => deletePlanCoupon(d.code), "Coupon deleted")}><Trash2 size={16} /></Button>}
          <Button size="lg" className="flex-1" disabled={busy || !!err} onClick={() => run(() => savePlanCoupon(row), "Coupon saved")}>{err ?? (busy ? "Saving…" : "Save coupon")}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Code">
          <input className={clsx(inputCls, "font-mono uppercase tracking-wider")} value={d.code} disabled={!isNew} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) })} placeholder="LAUNCH20" />
        </Field>
        <Field label="Discount on the plan price">
          <div className="flex gap-2">
            <Segmented value={d.kind} onChange={(kind) => set({ kind })} options={[{ value: "percent", label: "% off" }, { value: "flat", label: "₹ off" }]} className="shrink-0" />
            <input className={inputCls} type="number" inputMode="numeric" min={1} value={d.value || ""} onChange={(e) => set({ value: Number(e.target.value) })} />
          </div>
        </Field>
        <Field label="Works on" hint="Pick none for all plans.">
          <div className="flex flex-wrap gap-2">
            {plans.filter((p) => p.monthly).map((p) => {
              const on = d.plans.includes(p.id);
              return (
                <button key={p.id} onClick={() => set({ plans: on ? d.plans.filter((x) => x !== p.id) : [...d.plans, p.id] })} className={clsx("rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold", on ? "bg-ink text-canvas" : "bg-surface text-ink ring-1 ring-line")}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valid till (optional)">
            <input className={inputCls} type="date" value={d.valid_to ?? ""} onChange={(e) => set({ valid_to: e.target.value || null })} />
          </Field>
          <Field label="Max uses (optional)">
            <input className={inputCls} type="number" inputMode="numeric" value={d.max_uses ?? ""} onChange={(e) => set({ max_uses: e.target.value ? Math.max(1, Number(e.target.value)) : null })} placeholder="No limit" />
          </Field>
        </div>
        <Field label="Note (optional)">
          <input className={inputCls} value={d.note ?? ""} onChange={(e) => set({ note: e.target.value || null })} placeholder="Diwali offer" />
        </Field>
        <div className="rounded-ctl bg-surface px-4 py-3">
          <Toggle checked={d.active} onChange={(active) => set({ active })} label="Coupon is on" />
        </div>
      </div>
    </Sheet>
  );
}
