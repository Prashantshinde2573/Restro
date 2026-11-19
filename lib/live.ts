"use client";

// Live stores shared by the staff screens and the guest QR page.
//
// Every store mirrors a Supabase table for this restaurant (rid), so all
// phones and tablets see the same data live. A new restaurant starts empty.
import { useMemo } from "react";
import { gstRate, setGstRate } from "./format";
import { cloudConfigured, createStore, hydrateStores } from "./store";
import { getCloud, guestAddOn, guestUpsert, isConnected } from "./cloud";
export { cloudConfigured };
import { liveStamps, mayAct, programOf, stampProblem } from "./stamps";
import { canConfirmPay, featureState, hasPerm, inOutlet, isMixed, outletKinds, type Feature, type FeatureState, type Member, type Perm } from "./access";
import type { Account, ActivityEntry, BillDiscount, Category, Customer, Feedback, MenuItem, Order, OrderLine, OrderStatus, Outlet, OutletSettings, PayClaim, Payment, PayMethod, StockItem, StockLog, Coupon } from "./types";

export { hydrateStores };
/* ---------------- account, outlets, members, who is signed in ---------------- */
const blankAccount: Account = { name: "", owner: "", plan: "growth", renewsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(), status: "active" };
const accountStore = createStore<Account>(blankAccount, "account", { kind: "doc", guest: "read" });
export const useAccount = () => accountStore.use();

const outletStore = createStore<Outlet[]>([], "outlets", { kind: "collection", coll: "outlets", guest: "read" });
export const useOutlets = () => outletStore.use();
export const outletActions = {
  add(o: Omit<Outlet, "id">): Outlet {
    const base = o.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outlet";
    const taken = new Set(outletStore.get().map((x) => x.id));
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    // after the others, so the first outlet stays first
    const sort = Math.max(0, ...outletStore.get().map((x) => x.sort ?? 0)) + 1;
    const outlet = { ...o, id, sort: o.sort ?? sort };
    outletStore.set([...outletStore.get(), outlet]);
    logActivity("settings", `Added outlet ${o.name}`, id);
    // the owner works everywhere
    memberStore.set(memberStore.get().map((m) => (m.role === "owner" ? { ...m, outletIds: [...m.outletIds, id] } : m)));
    return outlet;
  },
  update(id: string, patch: Partial<Outlet>) {
    outletStore.set(outletStore.get().map((o) => (o.id === id ? { ...o, ...patch } : o)));
  },
  /** Why this outlet can't be deleted right now, or null. */
  removeProblem(id: string): string | null {
    if (outletStore.get().length <= 1) return "You need at least one outlet.";
    const open = orderStore.get().filter((o) => o.outletId === id && o.status !== "paid" && o.status !== "cancelled").length;
    if (open) return `${open} order${open === 1 ? " is" : "s are"} still open here. Close or cancel ${open === 1 ? "it" : "them"} first.`;
    return null;
  },
  /**
   * Delete an outlet (owner). Its menu, categories, stock and coupons go with it; people who worked only
   * here lose access (their record stays, turned off); past bills stay in reports and exports.
   * The tables are removed by the caller (lib/tables).
   */
  remove(id: string) {
    const o = outletStore.get().find((x) => x.id === id);
    if (!o || outletActions.removeProblem(id)) return false;
    outletStore.set(outletStore.get().filter((x) => x.id !== id));
    memberStore.set(
      memberStore.get().map((m) => {
        if (!m.outletIds.includes(id)) return m;
        const outletIds = m.outletIds.filter((x) => x !== id);
        return { ...m, outletIds, active: m.role === "owner" || outletIds.length > 0 ? m.active : false };
      }),
    );
    menuStore.set(
      menuStore
        .get()
        .filter((m) => !(m.outletIds?.length && m.outletIds.every((x) => x === id)))
        .map((m) => (m.outletIds?.includes(id) || m.offIn?.includes(id) ? { ...m, outletIds: m.outletIds?.filter((x) => x !== id), offIn: m.offIn?.filter((x) => x !== id) } : m)),
    );
    catStore.set(catStore.get().filter((c) => !(c.outletIds?.length && c.outletIds.every((x) => x === id))));
    couponStore.set(
      couponStore
        .get()
        .filter((c) => !(c.outletIds?.length && c.outletIds.every((x) => x === id)))
        .map((c) => (c.outletIds?.includes(id) ? { ...c, outletIds: c.outletIds.filter((x) => x !== id) } : c)),
    );
    stockStore.set(stockStore.get().filter((x) => x.outletId !== id));
    if (sessionStore.get().outletId === id) sessionActions.setOutlet(outletStore.get()[0]?.id ?? "");
    logActivity("settings", `Deleted outlet ${o.name}`, outletStore.get()[0]?.id);
    return true;
  },
};

const memberStore = createStore<Member[]>([], "members", { kind: "collection", coll: "members" });
export const useMembers = () => memberStore.use();
export const memberActions = {
  save(m: Member) {
    const list = memberStore.get();
    const old = list.find((x) => x.id === m.id);
    memberStore.set(old ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]);
    logActivity("team", old ? (old.active && !m.active ? `Turned off access for ${m.name}` : !old.active && m.active ? `Turned on access for ${m.name}` : `Changed access for ${m.name}`) : `Added ${m.name} (${m.title || "staff"}) to the team`);
  },
  /** Profile photo of a member (a link, or undefined to go back to initials). */
  setPhoto(id: string, photo: string | undefined) {
    memberStore.set(memberStore.get().map((x) => (x.id === id ? { ...x, photo } : x)));
  },
  remove(id: string) {
    const m = memberStore.get().find((x) => x.id === id);
    memberStore.set(memberStore.get().filter((m) => m.id !== id));
    if (m) logActivity("team", `Removed ${m.name} from the team`);
  },
};

// Who is using this device, and which outlet they are looking at.
const sessionStore = createStore<{ memberId: string; outletId: string }>({ memberId: "", outletId: "" }, "session");
export const useSession = () => sessionStore.use();
export const sessionActions = {
  /** Cloud sign-in: who this device is now (members may still be loading). */
  setMember(memberId: string) {
    const cur = sessionStore.get();
    // a different person on this device: their outlet, not the last person's
    sessionStore.set({ ...cur, memberId, outletId: cur.memberId && cur.memberId !== memberId ? "" : cur.outletId });
  },
  setOutlet(outletId: string) {
    sessionStore.set({ ...sessionStore.get(), outletId });
  },
};

/** The signed-in member. */
export function useMe(): Member | null {
  const { memberId } = useSession();
  return useMembers().find((m) => m.id === memberId) ?? null;
}
/** The signed-in member, outside React. */
export const currentMember = (): Member | null => memberStore.get().find((m) => m.id === sessionStore.get().memberId) ?? null;
const myName = () => {
  const c = getCloud();
  if (c.role === "guest") return "Guest (QR)";
  const m = currentMember();
  return m ? (m.role === "owner" ? `${m.name} (Owner)` : m.name) : "Staff";
};

/* ---------------- activity log: who did what ---------------- */
const activityStore = createStore<ActivityEntry[]>([], "activity", { kind: "collection", coll: "activity" });
export const useActivity = () => activityStore.use();
/** Add a line to the activity log (owner sees it in Activity). */
export function logActivity(kind: ActivityEntry["kind"], text: string, outletId?: string) {
  const c = getCloud();
  const e: ActivityEntry = {
    id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    by: myName(),
    kind,
    text,
    outletId: outletId ?? currentOutletId(),
    source: c.role === "guest" ? "guest" : "team",
  };
  if (c.role === "guest") {
    if (c.rid) guestUpsert(c.rid, e.id, { ...e }, "activity");
    return;
  }
  activityStore.set([e, ...activityStore.get()]);
}
const where = (o: Pick<Order, "tableName" | "partyId" | "type" | "customer">) =>
  o.tableName && o.tableName !== "Counter" ? `Table ${o.tableName}${o.partyId && o.partyId !== "A" ? ` · ${o.partyId}` : ""}` : o.type === "delivery" ? "Delivery" : o.customer && o.type !== "dine-in" ? o.customer : "Counter";
const rs = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** The outlet on screen (falls back to the first one the member may see). */
/**
 * The outlet this person works in now: the one they picked, if it is theirs; else their first.
 * A sub admin or staff member never lands on an outlet that isn't theirs (the server would refuse
 * every save there). Guests (no member): any outlet (their QR decides).
 */
export function pickOutlet<O extends { id: string }>(all: O[], me: Member | null, want?: string): O | undefined {
  const mine = me ? all.filter((o) => inOutlet(me, o.id)) : all;
  return mine.find((o) => o.id === want) ?? mine[0] ?? (me && me.role !== "owner" ? undefined : all[0]);
}
export function useCurrentOutlet(): Outlet {
  const { outletId } = useSession();
  const outlets = useOutlets();
  const me = useMe();
  const o = pickOutlet(outlets, me, outletId) ?? outlets[0] ?? blankOutlet;
  setGstRate(o.gstRate); // bills, reports and the guest page use this outlet's GST rate
  return o;
}
const blankOutlet: Outlet = { id: "", name: "", address: "", businessType: "restaurant", upi: "", payFirst: false };
/** Is a feature on for this plan and this outlet's type? */
export function useFeature(f: Feature): FeatureState {
  const { plan } = useAccount();
  return featureState(f, plan, outletKinds(useCurrentOutlet()));
}
/** Can the signed-in member do this, in the current outlet? */
export function useCan(p: Perm): boolean {
  const me = useMe();
  const o = useCurrentOutlet();
  return hasPerm(me, p) && inOutlet(me, o.id);
}

/**
 * The stamp card of an outlet. One loyalty card for the brand: an outlet that never set its own
 * uses the card set at another outlet (so a new outlet has it from day one).
 */
export const stampProgramOf = (o: Outlet | undefined, all: Outlet[]) =>
  o?.stamps ?? [...all].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).find((x) => x.stamps?.on)?.stamps;

/** Brand name + current outlet's settings (what the guest QR page needs). */
export function useSettings(): OutletSettings {
  const a = useAccount();
  const o = useCurrentOutlet();
  const outlets = useOutlets();
  return {
    name: a.name, logo: a.logo || "", businessType: o.businessType, mixed: isMixed(o), upi: o.upi, payFirst: o.payFirst,
    address: o.address ?? "", phone: o.phone ?? "", gstin: o.gstin ?? "", fssai: o.fssai ?? "", hours: o.hours ?? "", billFooter: o.billFooter ?? "", acceptCard: o.acceptCard ?? true,
    orderFrom: o.orderFrom ?? "", orderTo: o.orderTo ?? "", ordersPaused: !!o.ordersPaused, selfService: !!o.selfService, gstRate: o.gstRate ?? 0.05,
    stamps: stampProgramOf(o, outlets),
  };
}
export const settingsActions = {
  /** Brand name goes on the account; the rest on the current outlet. */
  update(patch: Partial<OutletSettings>) {
    const { name: _name, logo: _logo, ...rest } = patch; // name + logo: only the Restropi team changes them
    const id = currentOutletId();
    if (!id) return;
    if (Object.keys(rest).length) outletActions.update(id, rest);
    const names: Record<string, string> = { upi: "UPI ID", gstRate: "GST rate", ordersPaused: "QR ordering pause", selfService: "self-service", orderFrom: "QR ordering hours", orderTo: "QR ordering hours", payFirst: "pay first", businessType: "outlet type", mixed: "outlet type", acceptCard: "card payments", stamps: "stamp card", billFooter: "bill footer", address: "address", phone: "phone", gstin: "GSTIN", fssai: "FSSAI", hours: "hours" };
    const what = [...new Set(Object.keys(rest).map((k) => names[k] ?? k))];
    if (what.length) logActivity("settings", `Changed settings: ${what.join(", ")}${rest.gstRate !== undefined ? ` (GST ${Math.round(rest.gstRate * 100)}%)` : ""}${rest.ordersPaused !== undefined ? (rest.ordersPaused ? " (paused)" : " (back on)") : ""}`, id);
  },
};

/* ---------------- orders ---------------- */
export const methodLabel: Record<PayMethod, string> = { upi: "UPI", cash: "Cash", card: "Card" };
/** The way the guest wants to pay at the counter (an unfinished online payment is not one). */
export const counterPref = (os: Pick<Order, "payPreference">[]): PayMethod | undefined =>
  os.map((o) => o.payPreference).find((p): p is PayMethod => !!p && p !== "online");
/** How long a guest has to finish paying on the gateway before staff treat the order as unpaid. */
export const ONLINE_PAY_WAIT_MS = 15 * 60_000;
/** A pay-first order whose guest is paying on the restaurant's gateway right now: staff wait, don't accept it. */
export const payingOnline = (o: Pick<Order, "status" | "payPreference" | "createdAt" | "gateway">, now = Date.now()) =>
  o.status === "new" && o.payPreference === "online" && !o.gateway && now - new Date(o.createdAt).getTime() < ONLINE_PAY_WAIT_MS;
/** A "new" order that staff should accept (not one being paid online). */
export const toAccept = (o: Pick<Order, "status" | "payPreference" | "createdAt" | "gateway">) => o.status === "new" && !payingOnline(o);
export const paymentsText = (p?: Payment[]) => (p?.length ? p.map((x) => `${methodLabel[x.method]} ₹${x.amount.toLocaleString("en-IN")}`).join(" + ") : "—");

export const billOf = (o: Order) => Math.round(o.lines.reduce((s, l) => s + l.qty * l.price, 0) * (1 + gstRate()));
const orderStore = createStore<Order[]>([], "orders", { kind: "collection", coll: "orders", guest: "own" });
export const useOrders = () => orderStore.use();
/** Orders of the outlet on screen (a sub admin's own outlet; the owner switches outlets at the top). */
export function useOutletOrders() {
  const all = orderStore.use();
  const o = useCurrentOutlet();
  return useMemo(() => (o.id ? all.filter((x) => !x.outletId || x.outletId === o.id) : all), [all, o.id]);
}
export const getOrders = () => orderStore.get();

/** The outlet this device is working in (or the first one). */
export const currentOutletId = (): string | undefined => pickOutlet(outletStore.get(), currentMember(), sessionStore.get().outletId)?.id;

const patchOrder = (id: string, fn: (o: Order) => Order) =>
  orderStore.set(orderStore.get().map((o) => (o.id === id ? fn(o) : o)));


/** Split one bill's payments across its orders in proportion to each order's bill. */
function splitPayments(orders: Order[], payments: Payment[]): Map<string, Payment[]> {
  const out = new Map<string, Payment[]>();
  if (orders.length <= 1) {
    orders.forEach((o) => out.set(o.id, payments));
    return out;
  }
  const bills = orders.map((o) => billOf(o));
  const sum = bills.reduce((a, b) => a + b, 0) || orders.length;
  const left = payments.map((p) => p.amount);
  orders.forEach((o, i) => {
    const last = i === orders.length - 1;
    const mine = payments
      .map((p, k) => {
        const amt = last ? left[k] : Math.round((p.amount * (bills[i] || 1)) / sum);
        left[k] -= amt;
        return { ...p, amount: amt };
      })
      .filter((p) => p.amount > 0);
    out.set(o.id, mine);
  });
  return out;
}

/** Orders made on this device (no "new order" ping for your own orders). */
export const createdHere = new Set<string>();
function logOrder(o: Order) {
  createdHere.add(o.id);
  const items = o.lines.reduce((s, l) => s + l.qty, 0);
  logActivity("order", `New order · ${where(o)} · ${items} item${items === 1 ? "" : "s"} · ${rs(o.lines.reduce((s, l) => s + l.qty * l.price, 0))}${o.channel === "qr" ? " · from QR" : ""}`, o.outletId);
}
/** Bills waiting for the owner's OK, one entry per bill. */
export function pendingClaims(orders: Order[]) {
  const map = new Map<string, { claim: PayClaim; orders: Order[] }>();
  for (const o of orders) {
    if (!o.payClaim || o.status === "paid" || o.status === "cancelled") continue;
    const cur = map.get(o.payClaim.id) ?? { claim: o.payClaim, orders: [] };
    cur.orders.push(o);
    map.set(o.payClaim.id, cur);
  }
  return [...map.values()].sort((a, b) => a.claim.at.localeCompare(b.claim.at));
}
/** Can the person on this device confirm payments? */
export const useCanConfirm = () => canConfirmPay(useMe());

/** Older claims kept only the total discount: turn them into labelled discounts. */
export function discountsFrom(x: { discount?: number; coupon?: string; reward?: { name: string; amount: number } }): BillDiscount[] {
  const out: BillDiscount[] = [];
  const total = Math.max(0, Number(x.discount) || 0);
  const reward = x.reward ? Math.min(total || x.reward.amount, Math.max(0, x.reward.amount)) : 0;
  if (reward > 0) out.push({ kind: "reward", label: `Stamp card · ${x.reward!.name}`, amount: reward });
  const rest = Math.max(0, total - reward);
  if (rest > 0) out.push(x.coupon ? { kind: "coupon", label: `Coupon ${x.coupon}`, amount: rest, code: x.coupon } : { kind: "staff", label: "Discount", amount: rest });
  return out;
}
/** The orders paid together with this one (one bill: a table's rounds); just this order when unpaid. */
export function billOrdersOf(o: Order, all: Order[]): Order[] {
  if (o.status !== "paid") return [o];
  const when = (x: Order) => [...(x.paymentLog ?? [])].reverse().find((e) => /^Paid/.test(e.text))?.at;
  const at = when(o);
  if (!at) return [o];
  return all.filter((x) => x.status === "paid" && x.tableName === o.tableName && (x.partyId ?? "A") === (o.partyId ?? "A") && when(x) === at);
}
/** A bill's discounts (on any of its orders). */
export const billDiscounts = (list: Pick<Order, "discounts">[]) => list.flatMap((o) => o.discounts ?? []);
export const discountTotal = (list: Pick<Order, "discounts">[]) => billDiscounts(list).reduce((s, d) => s + d.amount, 0);

export const orderActions = {
  add(o: Omit<Order, "id" | "number">): Order {
    if (isConnected()) {
      // Cloud: the order number comes from a server counter (0 until it arrives).
      const id = `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const order: Order = { ...o, id, number: 0, outletId: o.outletId ?? currentOutletId(), guestUid: getCloud().role === "guest" ? getCloud().uid : undefined };
      orderStore.set([order, ...orderStore.get()]);
      logOrder(order);
      return order;
    }
    const number = Math.max(1000, ...orderStore.get().map((x) => x.number)) + 1;
    const order = { ...o, id: `o${number}`, number };
    orderStore.set([order, ...orderStore.get()]);
    logOrder(order);
    return order;
  },
  /**
   * A guest's next round into the group's open order (one card, one bill). The server checks the
   * dishes and prices like a new order. False when it can't (the bill was asked for, the order
   * closed meanwhile…): then the round goes as a new order.
   */
  async addOn(id: string, lines: OrderLine[]): Promise<boolean> {
    const o = orderStore.get().find((x) => x.id === id);
    if (!o || !lines.length) return false;
    if (isConnected()) {
      if (!o.number) return false; // not on the server yet
      const saved = await guestAddOn(id, lines);
      if (!saved) return false;
      patchOrder(id, (x) => ({ ...x, ...(saved as Partial<Order>), id: x.id, number: x.number }));
      return true;
    }
    if (o.status === "paid" || o.status === "cancelled" || o.payClaim || o.payPreference) return false;
    const round = 1 + Math.max(1, ...o.lines.map((l) => l.round ?? 1));
    const out = o.status === "ready" || o.status === "served";
    const at = new Date().toISOString();
    patchOrder(id, (x) => ({
      ...x,
      status: out ? "accepted" : x.status,
      lines: [...x.lines.map((l) => (out ? { ...l, done: true } : l)), ...lines.map((l) => ({ ...l, round, addOn: true, addedAt: at }))],
    }));
    return true;
  },
  setStatus(id: string, status: OrderStatus) {
    const o = orderStore.get().find((x) => x.id === id);
    // already paid, still in the kitchen: move it along there; the bill stays paid
    if (o && o.status === "paid" && o.kitchenStatus) {
      const k = status === "accepted" || status === "preparing" || status === "ready" ? status : undefined;
      patchOrder(id, (x) => ({ ...x, kitchenStatus: k }));
      return;
    }
    // Paid in full from the guest's phone (café pay-first): closes itself once served
    // (or waits for the owner's OK when the person serving can't confirm payments).
    const pre = (o?.prepaid ?? []).reduce((a, p) => a + p.amount, 0);
    // Paid on the restaurant's gateway: the server already checked the exact amount (with any coupon or reward)
    if (o && status === "served" && o.gateway && pre > 0) {
      patchOrder(id, (x) => ({ ...x, status }));
      orderActions.pay([id], o.prepaid!, `Online · ${o.gateway.provider === "razorpay" ? "Razorpay" : "Cashfree"}`);
      return;
    }
    // the guest's coupon (applied on their phone before paying) comes off the bill they prepaid
    const sub = o ? o.lines.reduce((s, l) => s + l.qty * l.price, 0) : 0;
    const cp = o?.wantsCoupon ? couponStore.get().find((c) => c.code === normCode(o.wantsCoupon!)) : undefined;
    const cOff = cp ? couponOff(cp, sub) : 0;
    const due = Math.round(Math.max(0, sub - cOff) * (1 + gstRate()));
    if (o && status === "served" && pre > 0 && pre >= due - 1) {
      patchOrder(id, (x) => ({ ...x, status }));
      orderActions.settle([id], o.prepaid!, o.customer ?? "Guest", {
        source: "guest",
        ...(cOff > 0 ? { discounts: [{ kind: "coupon" as const, label: `Coupon ${cp!.code}`, amount: cOff, code: cp!.code }], coupon: cp!.code, discount: cOff } : {}),
      });
      return;
    }
    patchOrder(id, (x) => ({ ...x, status }));
    if (o && o.status !== status && (status === "accepted" || status === "cancelled"))
      logActivity("order", `${status === "accepted" ? "Accepted" : "Cancelled"} order #${o.number || "new"} · ${where(o)}`, o.outletId);
  },
  toggleLine(id: string, idx: number) {
    patchOrder(id, (o) => ({ ...o, lines: o.lines.map((l, i) => (i === idx ? { ...l, done: !l.done } : l)) }));
  },
  /** A party moved table (or joined another party): its orders follow it. */
  moveParty(fromTableId: string, fromPartyId: string, to: { tableId: string; tableName: string; partyId: string }) {
    orderStore.set(
      orderStore.get().map((o) =>
        o.tableId === fromTableId && (o.partyId ?? "A") === fromPartyId && o.status !== "paid" && o.status !== "cancelled"
          ? { ...o, tableId: to.tableId, tableName: to.tableName, partyId: to.partyId }
          : o,
      ),
    );
  },
  /** Guest: "use my stamp card reward on this bill" (staff see it at checkout, already switched on). */
  askCoupon(ids: string[], code?: string) {
    orderStore.set(orderStore.get().map((o) => (ids.includes(o.id) ? { ...o, wantsCoupon: code || undefined } : o)));
  },
  askReward(ids: string[], on: boolean) {
    orderStore.set(orderStore.get().map((o) => (ids.includes(o.id) ? { ...o, wantsReward: on || undefined } : o)));
  },
  setPreference(ids: string[], pref: PayMethod) {
    orderStore.set(orderStore.get().map((o) => (ids.includes(o.id) ? { ...o, payPreference: pref } : o)));
  },
  /**
   * Someone says the bill is paid. The owner (or a member with "Confirm payments")
   * closes it straight away; anyone else's "paid" waits for their OK.
   * Returns "paid" or "waiting".
   */
  settle(ids: string[], payments: Payment[], by: string, opts: { source?: PayClaim["source"]; discount?: number; coupon?: string; reward?: PayClaim["reward"]; discounts?: BillDiscount[] } = {}): "paid" | "waiting" {
    const c = getCloud();
    // staff the owner lets collect bills ("Charge bills") close them at once; only others' wait for the owner's OK
    const trusted = c.role !== "guest" && opts.source !== "guest" && (canConfirmPay(currentMember()) || hasPerm(currentMember(), "charge"));
    const discounts = opts.discounts ?? discountsFrom(opts);
    if (trusted) {
      orderActions.pay(ids, payments, by, undefined, discounts);
      return "paid";
    }
    const claim: PayClaim = {
      id: `pc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      payments,
      by,
      at: new Date().toISOString(),
      source: opts.source ?? (c.role === "guest" ? "guest" : "staff"),
      ...(opts.discount ? { discount: opts.discount } : {}),
      ...(opts.coupon ? { coupon: opts.coupon } : {}),
      ...(opts.reward ? { reward: opts.reward } : {}),
      ...(discounts.length ? { discounts } : {}),
    };
    const at = claim.at;
    const list = orderStore.get().filter((o) => ids.includes(o.id));
    orderStore.set(
      orderStore.get().map((o) =>
        ids.includes(o.id)
          ? { ...o, payClaim: claim, paymentLog: [...(o.paymentLog ?? []), { at, by, text: `Marked paid · ${paymentsText(payments)} · waiting for confirmation` }] }
          : o,
      ),
    );
    if (list[0]) logActivity("payment", `${by} marked ${where(list[0])} paid · ${paymentsText(payments)} · waiting for confirmation`, list[0].outletId);
    return "waiting";
  },
  /** Owner / trusted manager: the money is in. Closes the bill. */
  confirm(claimId: string) {
    const list = orderStore.get().filter((o) => o.payClaim?.id === claimId && o.status !== "paid" && o.status !== "cancelled");
    const claim = list[0]?.payClaim;
    if (!claim) return [];
    const who = myName();
    orderActions.pay(list.map((o) => o.id), claim.payments, claim.by, who, claim.discounts ?? discountsFrom(claim));
    logActivity("payment", `Confirmed ${where(list[0])} · ${paymentsText(claim.payments)} (marked by ${claim.by})`, list[0].outletId);
    return list;
  },
  /** Owner / trusted manager: the money did not come. The bill opens again. */
  rejectClaim(claimId: string) {
    const list = orderStore.get().filter((o) => o.payClaim?.id === claimId);
    const claim = list[0]?.payClaim;
    if (!claim) return [];
    const at = new Date().toISOString();
    const who = myName();
    orderStore.set(
      orderStore.get().map((o) =>
        o.payClaim?.id === claimId
          ? { ...o, payClaim: undefined, prepaid: undefined, paymentLog: [...(o.paymentLog ?? []), { at, by: who, text: `Not received · ${paymentsText(claim.payments)} (marked by ${claim.by})` }] }
          : o,
      ),
    );
    logActivity("payment", `Payment not received for ${where(list[0])} · ${paymentsText(claim.payments)} (marked by ${claim.by})`, list[0].outletId);
    return list;
  },
  /** Owner only (after typing the password): a bill marked paid by mistake goes back to unpaid. */
  unpay(ids: string[]) {
    const at = new Date().toISOString();
    const who = myName();
    const list = orderStore.get().filter((o) => ids.includes(o.id) && o.status === "paid");
    if (!list.length) return [];
    orderStore.set(
      orderStore.get().map((o) =>
        ids.includes(o.id) && o.status === "paid"
          ? { ...o, status: "served", payments: undefined, payment: undefined, payClaim: undefined, confirmedBy: undefined, discounts: undefined, paymentLog: [...(o.paymentLog ?? []), { at, by: who, text: `Marked unpaid (was ${paymentsText(o.payments)})` }] }
          : o,
      ),
    );
    logActivity("payment", `Marked unpaid: ${list.map((o) => `#${o.number}`).join(", ")} · ${where(list[0])} (was ${paymentsText(list.flatMap((o) => o.payments ?? []))})`, list[0].outletId);
    return list;
  },
  /** Settle one or more orders (a party's bill) with one or more payments. */
  pay(ids: string[], payments: Payment[], by: string, confirmedBy?: string, discounts: BillDiscount[] = []) {
    const at = new Date().toISOString();
    // Save the bill on the guest's record (one entry per bill, not per order).
    const first = orderStore.get().find((o) => ids.includes(o.id) && o.guestPhone);
    if (first?.guestPhone) {
      const amount = payments.reduce((a, p) => a + p.amount, 0);
      guestActions.addBill(first.guestPhone, { orderNo: first.number, amount, method: paymentsText(payments) }, first.outletId);
    }
    // One bill can cover several orders (a table's rounds): give each order its share,
    // so reports add up to exactly what was collected.
    const share = splitPayments(orderStore.get().filter((o) => ids.includes(o.id)), payments);
    // the bill's discounts sit on its first order (so totals in reports count them once)
    const firstId = orderStore.get().find((o) => ids.includes(o.id))?.id;
    const off = discounts.filter((d) => d.amount > 0);
    const offText = off.length ? ` · ${off.map((d) => `${d.label} −${rs(d.amount)}`).join(", ")}` : "";
    orderStore.set(
      orderStore.get().map((o) =>
        ids.includes(o.id)
          ? {
              ...o,
              discounts: o.id === firstId && off.length ? off : undefined,
              status: "paid",
              // paid before the food was ready: it stays on the kitchen screen till it's ready and handed over
              kitchenStatus: o.status === "accepted" || o.status === "preparing" || o.status === "ready" ? o.status : o.kitchenStatus,
              payments: share.get(o.id) ?? payments,
              payment: payments.length > 1 ? "split" : payments[0]?.method,
              payClaim: undefined,
              confirmedBy: confirmedBy ?? by,
              paymentLog: [...(o.paymentLog ?? []), { at, by: confirmedBy ?? by, text: `Paid · ${paymentsText(payments)}${ids.length > 1 ? ` (bill for ${ids.length} orders)` : ""}${offText}${confirmedBy ? ` · marked by ${by}, confirmed` : ""}` }],
            }
          : o,
      ),
    );
    const o0 = orderStore.get().find((o) => ids.includes(o.id));
    if (o0 && !confirmedBy) logActivity("payment", `Bill paid · ${where(o0)} · ${paymentsText(payments)}`, o0.outletId);
  },
  /** The guest paid part of the bill from their phone (e.g. the UPI half of
   *  "Cash + UPI"). The order stays open; the cashier collects the rest. */
  prepay(ids: string[], payment: Payment, by: string) {
    const at = new Date().toISOString();
    orderStore.set(
      orderStore.get().map((o, i, all) => {
        if (!ids.includes(o.id)) return o;
        // record the money once, on the first order of the bill
        const first = all.find((x) => ids.includes(x.id))?.id === o.id;
        return {
          ...o,
          payPreference: "cash",
          prepaid: first ? [...(o.prepaid ?? []), payment] : o.prepaid,
          paymentLog: [...(o.paymentLog ?? []), ...(first ? [{ at, by, text: `Guest paid ${methodLabel[payment.method]} ₹${payment.amount.toLocaleString("en-IN")} from their phone · rest in cash` }] : [])],
        };
      }),
    );
  },
  /** Correct how a bill was paid after the fact — logged for the owner. */
  editPayment(id: string, payments: Payment[], by: string) {
    const was = orderStore.get().find((o) => o.id === id);
    if (was) logActivity("payment", `Changed how #${was.number} was paid: ${paymentsText(was.payments)} → ${paymentsText(payments)}`, was.outletId);
    patchOrder(id, (o) => ({
      ...o,
      payments,
      payment: payments.length > 1 ? "split" : payments[0]?.method,
      paymentLog: [
        ...(o.paymentLog ?? []),
        { at: new Date().toISOString(), by, text: `Changed from ${paymentsText(o.payments)} to ${paymentsText(payments)}` },
      ],
    }));
  },
};

/* ---------------- guests (CRM) ---------------- */
// Each outlet keeps its own guest book: one record per outlet and phone number (id "phone@outlet"),
// with that outlet's visits, spend, stamp card and WhatsApp opt-in. Older records with no outlet
// belong to the first outlet.
const guestStore = createStore<Customer[]>([], "guests", { kind: "collection", coll: "guests" });
const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);
export const guestKey = (phone: string, outletId: string | undefined) => (outletId ? `${normPhone(phone)}@${outletId}` : normPhone(phone));
/** Records of one outlet (the outlet on screen when none is given). */
export function guestsOf(all: Customer[], outletId: string | undefined, mainId: string | undefined): Customer[] {
  return outletId ? all.filter((c) => (c.outletId ?? mainId) === outletId) : all;
}
const outletGuests = (outletId?: string) => guestsOf(guestStore.get(), outletId ?? currentOutletId(), mainOutletId(outletStore.get()));
/** The guest book of the outlet on screen. */
export function useGuests() {
  const all = guestStore.use();
  const o = useCurrentOutlet();
  const mainId = mainOutletId(outletStore.use());
  return useMemo(() => guestsOf(all, o.id, mainId), [all, o.id, mainId]);
}
/** Every outlet's guest records (export). */
export const useAllGuests = () => guestStore.use();
/** This guest's record in an outlet (the outlet on screen when none is given). */
export const findGuest = (phone: string, outletId?: string) => {
  const key = normPhone(phone);
  return key.length === 10 ? outletGuests(outletId).find((c) => normPhone(c.phone) === key) : undefined;
};
const patchGuest = (phone: string, fn: (c: Customer) => Customer, outletId?: string) => {
  const g = findGuest(phone, outletId);
  if (g) guestStore.set(guestStore.get().map((c) => (c.id === g.id ? fn(c) : c)));
};
/** A bill on a guest's record, once: the same bill number is never counted twice. */
const withBill = (c: Customer, bill: { orderNo: number; amount: number; method: string }, outletId: string | undefined, name?: string): Customer => {
  const now = new Date().toISOString();
  if (bill.orderNo > 0 && (c.bills ?? []).some((b) => b.orderNo === bill.orderNo)) return { ...c, name: c.name || name?.trim() || c.name, lastVisit: now };
  return {
    ...c,
    name: c.name || name?.trim() || c.name,
    visits: c.visits + 1,
    lastVisit: now,
    spend: c.spend + bill.amount,
    points: c.points + Math.floor(bill.amount / 10),
    bills: [{ ...bill, at: now, outletId }, ...(c.bills ?? [])],
  };
};
const newGuest = (name: string, phone: string, outletId: string | undefined, extra: Partial<Customer>): Customer => {
  const key = normPhone(phone);
  return {
    id: guestKey(key, outletId),
    outletId,
    name: name.trim() || "Guest",
    phone: `${key.slice(0, 5)} ${key.slice(5)}`,
    visits: 0,
    spend: 0,
    lastVisit: new Date().toISOString(),
    points: 0,
    tier: "New",
    favourite: "—",
    verified: false,
    source: "pos",
    optIn: false,
    bills: [],
    ...extra,
  };
};

/** Feedback of the outlet on screen (older reviews with no outlet: the first outlet). */
export function useFeedback() {
  const all = feedbackStore.use();
  const o = useCurrentOutlet();
  const mainId = mainOutletId(outletStore.use());
  return useMemo(() => (o.id ? all.filter((f) => (f.outletId ?? mainId) === o.id) : all), [all, o.id, mainId]);
}
export const useAllFeedback = () => feedbackStore.use();

export const guestActions = {
  /** A QR guest gave their number (or staff saved it): create or update the guest record of this outlet. */
  upsert(name: string, phone: string, optIn: boolean): Customer {
    const key = normPhone(phone);
    const oid = currentOutletId() || undefined;
    const c = getCloud();
    if (c.role === "guest" && c.rid) {
      // Guests can't read the guest book; they only add or update their own name.
      const rec = { id: key, outletId: oid, name, phone: `${key.slice(0, 5)} ${key.slice(5)}`, verified: false, source: "qr" as const, optIn, lastVisit: new Date().toISOString() };
      guestUpsert(c.rid, key, rec);
      return { ...rec, id: guestKey(key, oid), visits: 1, spend: 0, points: 0, tier: "New", favourite: "—" };
    }
    const found = findGuest(key, oid);
    if (found) {
      const updated = { ...found, name: name || found.name, verified: true, optIn: optIn || found.optIn, lastVisit: new Date().toISOString() };
      guestStore.set(guestStore.get().map((x) => (x.id === found.id ? updated : x)));
      return updated;
    }
    const nc = newGuest(name, key, oid, { visits: 1, verified: true, source: "qr", optIn });
    guestStore.set([nc, ...guestStore.get()]);
    return nc;
  },
  /** Staff typed the guest's number at billing (walk-in / counter): this outlet's guest book gets the bill. */
  fromBill(name: string, phone: string, bill: { orderNo: number; amount: number; method: string }) {
    const key = normPhone(phone);
    if (key.length !== 10) return;
    const oid = currentOutletId() || undefined;
    const found = findGuest(key, oid);
    if (found) {
      guestStore.set(guestStore.get().map((c) => (c.id === found.id ? withBill(c, bill, oid, name) : c)));
      return;
    }
    guestStore.set([withBill(newGuest(name, key, oid, {}), bill, oid), ...guestStore.get()]);
  },
  /** A bill paid on an order that carries the guest's number (QR, or a number saved on the order). */
  addBill(phone: string, bill: { orderNo: number; amount: number; method: string }, outletId?: string) {
    const oid = outletId ?? (currentOutletId() || undefined);
    const found = findGuest(phone, oid);
    if (found) guestStore.set(guestStore.get().map((c) => (c.id === found.id ? withBill(c, bill, oid) : c)));
  },
};

/* ---------------- stamp card ---------------- */
// Stamps sit on the guest's record of that outlet (oldest first). A full card turns into the reward.
export const stampActions = {
  /** One stamp for this bill. */
  give(phone: string, info: { orderNo?: number; by?: string; outletId?: string }) {
    patchGuest(phone, (c) => ({ ...c, stamps: [...(c.stamps ?? []), { at: new Date().toISOString(), ...info }] }), info.outletId);
    const c = findGuest(phone, info.outletId);
    logActivity("guest", `Stamp for ${c?.name || phone}${info.orderNo ? ` on #${info.orderNo}` : ""} (${c?.stamps?.length ?? 1})`, info.outletId);
  },
  /** The card was full: the reward went on this bill; a new card starts. */
  redeem(phone: string, live: number, needed: number, info: { reward: string; amount: number; orderNo?: number; by?: string; outletId?: string }) {
    patchGuest(
      phone,
      (c) => {
        // drop expired stamps and the ones this reward used up
        const all = c.stamps ?? [];
        const keep = all.slice(all.length - live).slice(needed);
        return { ...c, stamps: keep, rewards: [{ at: new Date().toISOString(), ...info }, ...(c.rewards ?? [])] };
      },
      info.outletId,
    );
    const c = findGuest(phone, info.outletId);
    logActivity("guest", `Stamp card reward for ${c?.name || phone}: ${info.reward} (₹${info.amount} off${info.orderNo ? `, #${info.orderNo}` : ""})`, info.outletId);
  },
  /** Fix a card by hand (Guests → a guest), in the outlet on screen. */
  adjust(phone: string, delta: number, by?: string) {
    patchGuest(phone, (c) => {
      const all = c.stamps ?? [];
      return { ...c, stamps: delta > 0 ? [...all, ...Array.from({ length: delta }, () => ({ at: new Date().toISOString(), by }))] : all.slice(0, Math.max(0, all.length + delta)) };
    });
    const c = findGuest(phone);
    logActivity("guest", `${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} stamp${Math.abs(delta) > 1 ? "s" : ""} for ${c?.name || phone} by hand`, currentOutletId());
  },
};

/**
 * A guest paid from their phone (QR) and the restaurant just confirmed the money: the stamp card follows the
 * same rules as a bill charged at the counter. If the guest used their full card, the reward is booked and
 * the card starts again at 0 (no new stamp on the reward bill). Otherwise this bill earns its stamp.
 */
export function stampsForGuestPayment(list: Order[], claim: PayClaim) {
  const phone = list.find((o) => o.guestPhone)?.guestPhone;
  if (!phone || claim.source !== "guest") return;
  const outlet = outletStore.get().find((x) => x.id === list[0]?.outletId) ?? outletStore.get()[0];
  const prog = stampProgramOf(outlet, outletStore.get());
  if (!outlet || !prog?.on) return;
  if (featureState("stamps", accountStore.get().plan, outletKinds(outlet)) !== "ok") return;
  const p = programOf(prog);
  const me = currentMember();
  const guest = findGuest(phone, outlet.id);
  const have = liveStamps(guest, p).length;
  const info = { orderNo: list[0]?.number, by: me?.name, outletId: outlet.id };
  if (claim.reward && have >= p.needed) {
    // the confirm is the restaurant's OK for the reward: the guest already paid the lower amount
    stampActions.redeem(phone, have, p.needed, { reward: claim.reward.name, amount: claim.reward.amount, ...info });
    return;
  }
  if (!p.auto || !mayAct(me, p.givers)) return;
  const subtotal = list.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty * l.price, 0), 0) - (claim.discount ?? 0);
  if (stampProblem(p, guest, subtotal)) return;
  stampActions.give(phone, info);
}

/* ---------------- menu ---------------- */
const menuStore = createStore<MenuItem[]>([], "menu", { kind: "collection", coll: "menu", guest: "read" });
/** The first outlet (the one made with the restaurant): older dishes and categories with no outlet belong to it. */
export const mainOutletId = (outlets: Pick<Outlet, "id" | "sort">[]) =>
  [...outlets].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id.localeCompare(b.id))[0]?.id;
/** Does a dish or category belong to this outlet? Each outlet has its own menu and categories. */
const belongs = (x: { outletIds?: string[] }, oid: string, mainId: string | undefined) =>
  x.outletIds?.length ? x.outletIds.includes(oid) : oid === mainId;
/** The dishes of one outlet (each outlet has its own menu). */
export function menuFor(all: MenuItem[], o: Pick<Outlet, "id"> | undefined, mainId?: string): MenuItem[] {
  if (!o?.id) return all;
  return all
    .filter((m) => belongs(m, o.id, mainId ?? o.id))
    .map((m) => (m.available && m.offIn?.includes(o.id) ? { ...m, available: false } : m));
}
/** Dishes of the outlet on screen (or of the guest's QR outlet). */
export function useMenu() {
  const all = menuStore.use();
  const o = useCurrentOutlet();
  const mainId = mainOutletId(outletStore.use());
  return useMemo(() => menuFor(all, o, mainId), [all, o.id, mainId]); // eslint-disable-line react-hooks/exhaustive-deps
}
/** A new dish or category belongs to the outlet on screen. */
function inThisOutlet<T extends { outletIds?: string[] }>(x: T): T {
  if (x.outletIds?.length) return x;
  const oid = currentOutletId();
  return oid && outletStore.get().length ? { ...x, outletIds: [oid] } : x;
}
/** Every dish of every outlet. */
export const useAllMenu = () => menuStore.use();
export const menuActions = {
  /** Sold out / back, in this dish's outlet. */
  setAvailable(id: string, on: boolean) {
    const m = menuStore.get().find((x) => x.id === id);
    if (!m) return;
    menuStore.set(menuStore.get().map((x) => (x.id === id ? { ...x, available: on, offIn: undefined } : x)));
    logActivity("menu", `${m.name} marked ${on ? "available" : "sold out"}`, currentOutletId());
  },
  /**
   * Copy one outlet's dishes (and the categories they use) into another outlet. Dishes the other
   * outlet already has (same name) are skipped. Returns how many dishes were copied.
   */
  copyMenu(fromId: string, toId: string) {
    const outlets = outletStore.get();
    const mainId = mainOutletId(outlets);
    const have = new Set(menuFor(menuStore.get(), { id: toId }, mainId).map((m) => m.name.trim().toLowerCase()));
    const dishes = menuFor(menuStore.get(), { id: fromId }, mainId).filter((m) => !have.has(m.name.trim().toLowerCase()));
    if (!dishes.length) return 0;
    const stamp = Date.now().toString(36);
    // categories: reuse the target's category of the same name, else copy it
    const cats = catStore.get();
    const toCats = cats.filter((c) => belongs(c, toId, mainId));
    const catMap = new Map<string, string>();
    const newCats: Category[] = [];
    for (const cid of new Set(dishes.map((m) => m.categoryId))) {
      const c = cats.find((x) => x.id === cid);
      if (!c) continue;
      const same = toCats.find((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
      if (same) catMap.set(cid, same.id);
      else {
        const copy: Category = { ...c, id: `${c.id}-${toId}-${stamp}`.slice(0, 80), outletIds: [toId] };
        newCats.push(copy);
        catMap.set(cid, copy.id);
      }
    }
    if (newCats.length) catStore.set([...cats, ...newCats]);
    const copies = dishes.map((m, i) => ({ ...m, id: `m${stamp}${i.toString(36)}`, outletIds: [toId], offIn: undefined, categoryId: catMap.get(m.categoryId) ?? m.categoryId, soldThisWeek: 0 }));
    menuStore.set([...menuStore.get(), ...copies]);
    const name = (id: string) => outlets.find((o) => o.id === id)?.name ?? id;
    logActivity("menu", `Copied ${copies.length} dishes from ${name(fromId)} to ${name(toId)}`, toId);
    return copies.length;
  },
  update(id: string, patch: Partial<MenuItem>) {
    const old = menuStore.get().find((m) => m.id === id);
    menuStore.set(menuStore.get().map((m) => (m.id === id ? { ...m, ...patch } : m)));
    if (!old) return;
    if (patch.price !== undefined && patch.price !== old.price) logActivity("menu", `Price of ${old.name}: ${rs(old.price)} → ${rs(patch.price)}`);
    if (patch.available !== undefined && patch.available !== old.available) logActivity("menu", `${old.name} marked ${patch.available ? "available" : "sold out"}`);
    if (patch.name && patch.name !== old.name) logActivity("menu", `Renamed ${old.name} to ${patch.name}`);
  },
  add(itemIn: MenuItem) {
    const item = inThisOutlet(itemIn);
    menuStore.set([...menuStore.get(), item]);
    logActivity("menu", `Added dish ${item.name} · ${rs(item.price)}`);
  },
  /** Many dishes in one go (menu read from a photo). */
  addMany(itemsIn: MenuItem[]) {
    const items = itemsIn.map(inThisOutlet);
    if (items.length) menuStore.set([...menuStore.get(), ...items]);
    if (items.length) logActivity("menu", `Added ${items.length} dishes from a menu photo`);
  },
  /** Delete a dish. Old bills and reports keep its name (orders store the name). */
  remove(id: string) {
    const m = menuStore.get().find((x) => x.id === id);
    if (!m) return;
    menuStore.set(menuStore.get().filter((x) => x.id !== id));
    logActivity("menu", `Deleted dish ${m.name}`, m.outletIds?.[0]);
  },
};
/** Is this dish the free dish of a stamp card? (warn before deleting it) */
export const isStampReward = (id: string) => outletStore.get().some((o) => o.stamps?.rewardKind === "item" && o.stamps.rewardItemId === id);

/* ---------------- categories (owner-defined → guest filters + side bar) ---------------- */
const catStore = createStore<Category[]>([], "categories", { kind: "collection", coll: "categories", guest: "read" });
/** Categories of one outlet (each outlet has its own). */
export const categoriesFor = (all: Category[], o: Pick<Outlet, "id"> | undefined, mainId?: string) =>
  o?.id ? all.filter((c) => belongs(c, o.id, mainId ?? o.id)) : all;
/** Categories of the outlet on screen (or of the guest's QR outlet). */
export function useCategories() {
  const all = catStore.use();
  const o = useCurrentOutlet();
  const mainId = mainOutletId(outletStore.use());
  return useMemo(() => categoriesFor(all, o, mainId), [all, o.id, mainId]); // eslint-disable-line react-hooks/exhaustive-deps
}
/** Every outlet's categories. */
export const useAllCategories = () => catStore.use();
export const categoryActions = {
  add(name: string, icon?: string): Category {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
    const taken = new Set(catStore.get().map((c) => c.id));
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    const c = inThisOutlet<Category>({ id, name: name.trim(), icon });
    catStore.set([...catStore.get(), c]);
    return c;
  },
  update(id: string, patch: Partial<Category>) {
    catStore.set(catStore.get().map((c) => (c.id === id ? { ...c, ...patch } : c)));
  },
  /** Delete a category. Its dishes move to another category, or are deleted with it. */
  remove(id: string, dishes: { moveTo: string } | "delete" | null = null) {
    const c = catStore.get().find((x) => x.id === id);
    if (!c) return;
    const inIt = menuStore.get().filter((m) => m.categoryId === id);
    const to = dishes && dishes !== "delete" ? catStore.get().find((x) => x.id === dishes.moveTo) : undefined;
    if (inIt.length && to) menuStore.set(menuStore.get().map((m) => (m.categoryId === id ? { ...m, categoryId: to.id } : m)));
    else if (inIt.length && dishes === "delete") menuStore.set(menuStore.get().filter((m) => m.categoryId !== id));
    else if (inIt.length) return; // never leave dishes without a category
    catStore.set(catStore.get().filter((x) => x.id !== id));
    logActivity("menu", `Deleted category ${c.name}${inIt.length ? (to ? ` · ${inIt.length} dishes moved to ${to.name}` : ` and its ${inIt.length} dishes`) : ""}`);
  },
  /** Move up or down among this outlet's categories. */
  move(id: string, dir: -1 | 1) {
    const list = [...catStore.get()];
    const c = list.find((x) => x.id === id);
    if (!c) return;
    const mainId = mainOutletId(outletStore.get());
    const oid = c.outletIds?.[0] ?? mainId;
    // positions (in the whole list) of this outlet's categories
    const mine = list.map((x, k) => (oid && !belongs(x, oid, mainId) ? -1 : k)).filter((k) => k >= 0);
    const at = mine.indexOf(list.indexOf(c));
    const other = mine[at + dir];
    if (at < 0 || other === undefined) return;
    const i = mine[at];
    [list[i], list[other]] = [list[other], list[i]];
    catStore.set(list);
  },
};

/* ---------------- feedback (guest ratings after paying) ---------------- */
const feedbackStore = createStore<Feedback[]>([], "feedback", { kind: "collection", coll: "feedback" });
export const feedbackActions = {
  add(fIn: Omit<Feedback, "id" | "at">) {
    const f = { ...fIn, outletId: fIn.outletId ?? currentOutletId() };
    const c = getCloud();
    if (c.role === "guest" && c.rid) {
      const id = `f${Date.now()}`;
      guestUpsert(c.rid, id, { ...f, id, at: new Date().toISOString() }, "feedback");
      return;
    }
    feedbackStore.set([{ ...f, id: `f${Date.now()}`, at: new Date().toISOString() }, ...feedbackStore.get()]);
  },
};

/* ---------------- stock ---------------- */
const stockStore = createStore<StockItem[]>([], "stock", { kind: "collection", coll: "stock_items" });
export const useStock = () => stockStore.use();
const stockId = () => `st${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const stockActions = {
  save(item: Omit<StockItem, "id"> & { id?: string }) {
    const list = stockStore.get();
    if (item.id && list.some((x) => x.id === item.id)) stockStore.set(list.map((x) => (x.id === item.id ? { ...x, ...item, id: x.id } : x)));
    else stockStore.set([...list, { ...item, id: stockId() }]);
  },
  remove(id: string) {
    const x = stockStore.get().find((i) => i.id === id);
    stockStore.set(stockStore.get().filter((x) => x.id !== id));
    if (x) logActivity("stock", `Removed stock item ${x.name}`);
  },
  /** Stock in, used, wasted, or a fresh count. */
  move(id: string, kind: StockLog["kind"], qty: number, by: string, note?: string) {
    stockStore.set(
      stockStore.get().map((x) => {
        if (x.id !== id) return x;
        const stock = kind === "count" ? qty : kind === "in" ? x.stock + qty : Math.max(0, x.stock - qty);
        const entry: StockLog = { at: new Date().toISOString(), kind, qty, by, ...(note ? { note } : {}) };
        return { ...x, stock: Math.round(stock * 1000) / 1000, log: [entry, ...(x.log ?? [])].slice(0, 50) };
      }),
    );
    const it = stockStore.get().find((x) => x.id === id);
    if (it) logActivity("stock", `${{ in: "Stock in", used: "Used", waste: "Wasted", count: "Counted" }[kind]} ${it.name}: ${qty} ${it.unit}${kind === "count" ? " in stock" : ""}${note ? ` · ${note}` : ""}`, it.outletId);
  },
};

/* ---------------- coupons (guest discounts) ---------------- */
const couponStore = createStore<Coupon[]>([], "coupons", { kind: "collection", coll: "coupons" });
export const useCoupons = () => couponStore.use();
export const getCoupons = () => couponStore.get();
export const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
/** Coupons made for some outlets only work there; the others work everywhere. */
export const couponWorksIn = (c: Pick<Coupon, "outletIds">, outletId?: string) => !c.outletIds?.length || !outletId || c.outletIds.includes(outletId);
export const couponActions = {
  save(c: Omit<Coupon, "id" | "uses" | "createdAt"> & { id?: string }) {
    const list = couponStore.get();
    const code = normCode(c.code);
    if (c.id && list.some((x) => x.id === c.id)) couponStore.set(list.map((x) => (x.id === c.id ? { ...x, ...c, code, id: x.id } : x)));
    else couponStore.set([{ ...c, code, id: `cp${Date.now().toString(36)}`, uses: 0, createdAt: new Date().toISOString() }, ...list]);
    logActivity("coupon", `${c.id ? "Changed" : "Made"} coupon ${code} · ${couponLabel(c)}${c.active === false ? " (off)" : ""}`);
  },
  remove(id: string) {
    const x = couponStore.get().find((c) => c.id === id);
    couponStore.set(couponStore.get().filter((x) => x.id !== id));
    if (x) logActivity("coupon", `Deleted coupon ${x.code}`);
  },
  /** Count one use (called when a bill with this coupon is paid), and remember who used it. */
  used(id: string, phone?: string) {
    const p = (phone ?? "").replace(/\D/g, "").slice(-10);
    couponStore.set(
      couponStore.get().map((x) =>
        x.id === id ? { ...x, uses: (x.uses ?? 0) + 1, ...(p.length === 10 && !x.usedBy?.includes(p) ? { usedBy: [...(x.usedBy ?? []), p].slice(-5000) } : {}) } : x,
      ),
    );
  },
  /** Campaigns: a private coupon may be used by these guests too. */
  invite(id: string, phones: string[]) {
    const ps = phones.map((p) => p.replace(/\D/g, "").slice(-10)).filter((p) => p.length === 10);
    if (!ps.length) return;
    couponStore.set(couponStore.get().map((x) => (x.id === id ? { ...x, forPhones: [...new Set([...(x.forPhones ?? []), ...ps])].slice(-5000) } : x)));
  },
};
/** Why a coupon can't be used on this bill, or null when it can. */
/** Is this a coupon only for the guests it was sent to? */
export const couponIsPrivate = (c: Pick<Coupon, "forPhones" | "audience">) => c.audience === "invited" || !!c.forPhones?.length;
/** Does using this coupon need the guest's number (to check who may use it, once each)? */
export const couponNeedsPhone = (c: Pick<Coupon, "forPhones" | "oncePerGuest" | "audience">) => couponIsPrivate(c) || c.oncePerGuest !== false;
export function couponProblem(c: Coupon | undefined, subtotal: number, phone?: string): string | null {
  if (!c) return "No coupon with this code";
  const p = (phone ?? "").replace(/\D/g, "").slice(-10);
  if (!c.active) return "This coupon is turned off";
  if (c.validTo && c.validTo < new Date().toISOString().slice(0, 10)) return "This coupon has expired";
  if (c.maxUses && c.uses >= c.maxUses) return "This coupon has been used up";
  if (!couponWorksIn(c, currentOutletId())) return "This coupon is for another outlet";
  if (c.minBill && subtotal < c.minBill) return `Works on bills of ₹${c.minBill} or more`;
  if (couponIsPrivate(c) && p.length === 10 && !c.forPhones?.includes(p)) return "This coupon is only for the guests it was sent to";
  if (c.oncePerGuest !== false && p.length === 10 && c.usedBy?.includes(p)) return "This guest has already used this coupon";
  if (couponNeedsPhone(c) && p.length !== 10) return "Add the guest's mobile number to use this coupon (each guest once)";
  return null;
}
export function couponOff(c: Coupon, subtotal: number) {
  const raw = c.kind === "percent" ? (subtotal * c.value) / 100 : c.value;
  return Math.max(0, Math.min(subtotal, Math.round(c.maxOff && c.kind === "percent" ? Math.min(raw, c.maxOff) : raw)));
}
export const couponLabel = (c: Pick<Coupon, "kind" | "value" | "maxOff" | "minBill">) =>
  `${c.kind === "percent" ? `${c.value}% off` : `₹${c.value} off`}${c.kind === "percent" && c.maxOff ? ` (up to ₹${c.maxOff})` : ""}${c.minBill ? ` on ₹${c.minBill}+` : ""}`;

/* ---------------- QR ordering hours ---------------- */
const toMin = (hhmm?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** "21:00" → "9:00 pm" */
export const niceTime = (hhmm?: string) => {
  const m = toMin(hhmm);
  if (m === null) return "";
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
/** Can guests order from the QR right now? Paused by hand, or outside the set hours = no. */
export function orderingOpen(s: { orderFrom?: string; orderTo?: string; ordersPaused?: boolean }, now = new Date()) {
  if (s.ordersPaused) return { open: false as const, why: "paused" as const };
  const a = toMin(s.orderFrom), b = toMin(s.orderTo);
  if (a === null || b === null || a === b) return { open: true as const };
  const t = now.getHours() * 60 + now.getMinutes();
  const inside = a < b ? t >= a && t < b : t >= a || t < b; // b < a: open past midnight
  return inside ? { open: true as const } : { open: false as const, why: "hours" as const, opensAt: niceTime(s.orderFrom) };
}

/* ---------------- waiter calls: a guest taps "Call a waiter" ---------------- */
// Every waiter in that outlet gets it. One of them taps "I'll go" (or the owner /
// a sub admin assigns someone), and everyone sees who has it. Then "Done".
export interface WaiterCall {
  id: string;
  at: string; // ISO
  outletId?: string;
  tableId?: string;
  tableName: string;
  partyId?: string;
  customer?: string;
  /** what the guest needs (water, the bill, …) — picked when calling */
  reason?: string;
  status: "open" | "taken" | "done" | "cancelled";
  /** the member going to the table */
  to?: string;
  toName?: string;
  takenAt?: string;
  /** set when someone else gave it to them (the owner / a sub admin) */
  assignedBy?: string;
  doneAt?: string;
}
const callStore = createStore<WaiterCall[]>([], "calls", { kind: "collection", coll: "calls", guest: "own" });
export const useCalls = () => callStore.use();
/** Calls still waiting (open or on the way) from the last 2 hours. Older ones are stale. */
export const liveCalls = (calls: WaiterCall[]) => {
  const since = Date.now() - 2 * 3600_000;
  return calls.filter((c) => (c.status === "open" || c.status === "taken") && Date.parse(c.at) > since);
};
/** Who answers waiter calls: the owner, and staff with Tables access in that outlet. */
export const answersCalls = (m: Member | null | undefined, outletId?: string) => !!m && m.active && hasPerm(m, "tables") && (!outletId || inOutlet(m, outletId));
/** Who can hand a call to someone: the owner, and sub admins who manage the team. */
export const assignsCalls = (m: Member | null | undefined) => !!m && m.active && (m.role === "owner" || hasPerm(m, "team"));
const patchCall = (id: string, fn: (c: WaiterCall) => WaiterCall) => callStore.set(callStore.get().map((c) => (c.id === id ? fn(c) : c)));
export const callActions = {
  /** Guest: call a waiter to this table. */
  call(c: Pick<WaiterCall, "outletId" | "tableId" | "tableName" | "partyId" | "customer" | "reason">): WaiterCall {
    const call: WaiterCall = { ...c, id: `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), status: "open" };
    // a guest can't write "to" (the server refuses it), so leave empty keys out
    for (const k of Object.keys(call) as (keyof WaiterCall)[]) if (call[k] === undefined) delete call[k];
    callStore.set([call, ...callStore.get()]);
    return call;
  },
  /** Guest: never mind. */
  cancel(id: string) {
    patchCall(id, (c) => (c.status === "open" ? { ...c, status: "cancelled" } : c));
  },
  /** Waiter: "I'll go". */
  take(id: string): string | null {
    const me = currentMember();
    if (!me) return null;
    const cur = callStore.get().find((c) => c.id === id);
    if (cur?.status === "taken" && cur.to !== me.id) return cur.toName ?? "someone"; // someone got there first
    patchCall(id, (c) => ({ ...c, status: "taken", to: me.id, toName: me.name, takenAt: new Date().toISOString(), assignedBy: undefined }));
    return null;
  },
  /** Owner / sub admin: send this waiter. */
  assign(id: string, m: Member) {
    const me = currentMember();
    patchCall(id, (c) => ({ ...c, status: "taken", to: m.id, toName: m.name, takenAt: new Date().toISOString(), assignedBy: me && me.id !== m.id ? me.name : undefined }));
    const c = callStore.get().find((x) => x.id === id);
    if (c) logActivity("order", `Sent ${m.name} to ${c.tableName === "Counter" ? "the counter" : `Table ${c.tableName}`} (waiter call)`, c.outletId);
  },
  /** At the table: done. */
  done(id: string) {
    patchCall(id, (c) => ({ ...c, status: "done", doneAt: new Date().toISOString() }));
  },
};
