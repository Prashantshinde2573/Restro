"use client";

// Discount coupons the restaurant gives to guests. A guest shows the code at the
// counter (or the staff types it at checkout) and the bill is reduced.
import clsx from "clsx";
import { Copy, Plus, Share2, Ticket, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Empty, Field, Segmented, Sheet, Toggle, inputCls } from "./ui";
import { useToast } from "./toast";
import { couponActions, couponLabel, couponWorksIn, normCode, useAccount, useCoupons, useCurrentOutlet, useMe, useOutlets } from "@/lib/live";
import { inOutlet } from "@/lib/access";
import type { Coupon } from "@/lib/types";

type Draft = Omit<Coupon, "id" | "uses" | "createdAt"> & { id?: string };
const blank = (): Draft => ({ code: "", kind: "percent", value: 10, active: true });

const today = () => new Date().toISOString().slice(0, 10);
export function couponState(c: Coupon): { label: string; tone: "jade" | "muted" | "rose" } {
  if (!c.active) return { label: "Off", tone: "muted" };
  if (c.validTo && c.validTo < today()) return { label: "Expired", tone: "rose" };
  if (c.maxUses && c.uses >= c.maxUses) return { label: "Used up", tone: "rose" };
  return { label: "Active", tone: "jade" };
}

/** Message a guest receives with the coupon. */
export function couponMessage(c: Coupon, restaurant: string) {
  const until = c.validTo ? ` till ${new Date(c.validTo).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "";
  return [
    `🎁 *A treat from ${restaurant || "us"}*`,
    "",
    `Enjoy *${couponLabel(c)}* on your next visit.`,
    `Code: *${c.code}*`,
    `Show this code when you pay${until}.`,
    "",
    "See you soon! 🙏",
  ].join("\n");
}

export function CouponsPanel() {
  const allCoupons = useCoupons();
  const account = useAccount();
  const toast = useToast();
  const me = useMe();
  const outlets = useOutlets();
  const outlet = useCurrentOutlet();
  const owner = me?.role === "owner";
  const many = outlets.length > 1;
  // the owner sees every coupon; others the ones that work in their outlet
  const coupons = owner ? allCoupons : allCoupons.filter((c) => couponWorksIn(c, outlet.id));
  // someone else changes only coupons made for their own outlets (not brand-wide ones)
  const canEdit = (c: Coupon) => owner || (!!c.outletIds?.length && c.outletIds.every((id) => inOutlet(me, id)));
  const where = (c: Coupon) => (!many ? "" : !c.outletIds?.length ? "All outlets" : c.outletIds.map((id) => outlets.find((o) => o.id === id)?.name ?? id).join(", "));
  const newDraft = (): Draft => ({ ...blank(), ...(owner ? {} : { outletIds: [outlet.id] }) });
  const [edit, setEdit] = useState<Draft | null>(null);

  const share = async (c: Coupon) => {
    const text = couponMessage(c, account.name);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* cancelled */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  const copy = (c: Coupon) => {
    navigator.clipboard?.writeText(couponMessage(c, account.name)).then(() => toast("Copied"), () => toast("Couldn't copy"));
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-muted">Guests show the code when paying. Staff type it at checkout.</p>
        {coupons.length > 0 && <Button size="sm" className="w-full shrink-0 whitespace-nowrap sm:w-auto" onClick={() => setEdit(newDraft())}><Plus size={16} /> New coupon</Button>}
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-group bg-surface">
          <Empty icon={<Ticket size={22} />} title="No coupons yet" body="Make a code like WELCOME10 and send it to your guests on WhatsApp." action={<Button onClick={() => setEdit(newDraft())}><Plus size={16} /> New coupon</Button>} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {coupons.map((c) => {
            const st = couponState(c);
            return (
              <div key={c.id} className="rounded-group bg-surface p-4">
                <button onClick={() => (canEdit(c) ? setEdit({ ...c }) : toast("The owner made this coupon for all outlets · only they can change it"))} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-[8px] border-2 border-dashed border-jade/50 px-2.5 py-1 font-mono text-[16px] font-bold tracking-wider text-jade-deep">{c.code}</span>
                    <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", st.tone === "jade" ? "bg-jade-soft text-jade-deep" : st.tone === "rose" ? "bg-rose-soft text-rose" : "bg-sunken text-muted")}>{st.label}</span>
                  </div>
                  <div className="mt-3 text-[16px] font-semibold">{couponLabel(c)}</div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    Used {c.uses ?? 0}{c.maxUses ? ` of ${c.maxUses}` : ""} time{(c.uses ?? 0) === 1 ? "" : "s"}
                    {c.validTo ? ` · till ${new Date(c.validTo).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                  </div>
                  {c.note && <div className="mt-1 truncate text-[13px] text-faint">{c.note}</div>}
                  {where(c) && <div className="mt-1 truncate text-[12.5px] font-medium text-jade">📍 {where(c)}</div>}
                </button>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1 !bg-[#25D366] hover:!bg-[#1fb757]" onClick={() => share(c)}><Share2 size={15} /> Send</Button>
                  <Button size="sm" variant="tinted" onClick={() => copy(c)} aria-label="Copy message"><Copy size={15} /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CouponSheet draft={edit} onClose={() => setEdit(null)} taken={(code, id) => allCoupons.some((x) => x.code === code && x.id !== id)} />
    </>
  );
}

function CouponSheet({ draft, onClose, taken }: { draft: Draft | null; onClose: () => void; taken: (code: string, id?: string) => boolean }) {
  const [d, setD] = useState<Draft>(blank());
  const [seen, setSeen] = useState<Draft | null>(null);
  if (draft !== seen) {
    setSeen(draft);
    if (draft) setD(draft);
  }
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const code = normCode(d.code);
  const err =
    code.length < 3 ? "Code needs 3 or more letters or numbers" : taken(code, d.id) ? "You already have this code" : !(d.value > 0) ? "Enter the discount" : d.kind === "percent" && d.value > 100 ? "Can't be more than 100%" : null;
  const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v)));
  const me = useMe();
  const outlets = useOutlets();
  const owner = me?.role === "owner";

  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      title={d.id ? "Edit coupon" : "New coupon"}
      footer={
        <div className="flex gap-2">
          {d.id && (
            <Button variant="danger" aria-label="Delete coupon" onClick={() => { couponActions.remove(d.id!); onClose(); }}><Trash2 size={16} /></Button>
          )}
          <Button size="lg" className="flex-1" disabled={!!err} onClick={() => { couponActions.save({ ...d, code }); onClose(); }}>{err ?? "Save coupon"}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Code" hint="Letters and numbers, like WELCOME10">
          <input className={clsx(inputCls, "font-mono uppercase tracking-wider")} value={d.code} onChange={(e) => set({ code: normCode(e.target.value) })} placeholder="WELCOME10" autoFocus={!d.id} />
        </Field>
        <Field label="Discount">
          <div className="flex gap-2">
            <Segmented value={d.kind} onChange={(kind) => set({ kind })} options={[{ value: "percent", label: "% off" }, { value: "flat", label: "₹ off" }]} className="shrink-0" />
            <input className={inputCls} type="number" inputMode="numeric" min={1} value={d.value || ""} onChange={(e) => set({ value: Number(e.target.value) })} placeholder={d.kind === "percent" ? "10" : "100"} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {d.kind === "percent" && (
            <Field label="Max ₹ off (optional)">
              <input className={inputCls} type="number" inputMode="numeric" value={d.maxOff ?? ""} onChange={(e) => set({ maxOff: num(e.target.value) })} placeholder="No limit" />
            </Field>
          )}
          <Field label="Min bill ₹ (optional)">
            <input className={inputCls} type="number" inputMode="numeric" value={d.minBill ?? ""} onChange={(e) => set({ minBill: num(e.target.value) })} placeholder="Any bill" />
          </Field>
          <Field label="Valid till (optional)">
            <input className={inputCls} type="date" min={today()} value={d.validTo ?? ""} onChange={(e) => set({ validTo: e.target.value || undefined })} />
          </Field>
          <Field label="Max uses (optional)">
            <input className={inputCls} type="number" inputMode="numeric" value={d.maxUses ?? ""} onChange={(e) => set({ maxUses: num(e.target.value) || undefined })} placeholder="No limit" />
          </Field>
        </div>
        {outlets.length > 1 && (
          <Field label="Works at">
            {owner ? (
              <div className="flex flex-wrap gap-2">
                {[{ id: "", name: "All outlets" }, ...outlets].map((o) => {
                  const on = o.id ? d.outletIds?.length === 1 && d.outletIds[0] === o.id : !d.outletIds?.length;
                  return (
                    <button key={o.id || "all"} type="button" aria-pressed={on} onClick={() => set({ outletIds: o.id ? [o.id] : undefined })} className={clsx("rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ring-1", on ? "bg-ink text-canvas ring-ink" : "bg-surface ring-line")}>
                      {o.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-ctl bg-surface px-4 py-3 text-[14px] text-muted">{(d.outletIds ?? []).map((id) => outlets.find((o) => o.id === id)?.name ?? id).join(", ") || "Your outlet"} only</p>
            )}
          </Field>
        )}
        <Field label="Note (optional)">
          <input className={inputCls} value={d.note ?? ""} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="Diwali offer for regulars" />
        </Field>
        <div className="rounded-ctl bg-surface px-4 py-3">
          <Toggle checked={d.active} onChange={(active) => set({ active })} label="Coupon is on" />
        </div>
      </div>
    </Sheet>
  );
}
