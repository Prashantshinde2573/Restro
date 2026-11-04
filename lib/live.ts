"use client";

// Live stores shared by the staff screens and the guest QR page.
//
// Every store mirrors a Supabase table for this restaurant (rid), so all
// phones and tablets see the same data live. A new restaurant starts empty.
import { gstRate, setGstRate } from "./format";
import { cloudConfigured, createStore, hydrateStores } from "./store";
import { getCloud, guestUpsert, isConnected } from "./cloud";
export { cloudConfigured };
import { canConfirmPay, featureState, hasPerm, inOutlet, isMixed, outletKinds, type Feature, type FeatureState, type Member, type Perm } from "./access";
import type { Account, ActivityEntry, Category, Customer, Feedback, MenuItem, Order, OrderStatus, Outlet, OutletSettings, PayClaim, Payment, PayMethod, StockItem, StockLog, Coupon } from "./types";

export { hydrateStores };
/* ---------------- account, outlets, members, who is signed in ---------------- */
const blankAccount: Account = { name: "", owner: "", plan: "growth", renewsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(), status: "active" };
const accountStore = createStore<Account>(blankAccount, "account", { kind: "doc", guest: "read" });
export const useAccount = () => accountStore.use();
export const accountActions = {
  rename(name: string) {
    accountStore.set({ ...accountStore.get(), name });
  },
};

const outletStore = createStore<Outlet[]>([], "outlets", { kind: "collection", coll: "outlets", guest: "read" });
export const useOutlets = () => outletStore.use();
export const outletActions = {
  add(o: Omit<Outlet, "id">): Outlet {
    const base = o.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outlet";
    const taken = new Set(outletStore.get().map((x) => x.id));
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    const outlet = { ...o, id };
    outletStore.set([...outletStore.get(), outlet]);
    logActivity("settings", `Added outlet ${o.name}`, id);
    // the owner works everywhere
    memberStore.set(memberStore.get().map((m) => (m.role === "owner" ? { ...m, outletIds: [...m.outletIds, id] } : m)));
    return outlet;
  },
  update(id: string, patch: Partial<Outlet>) {
    outletStore.set(outletStore.get().map((o) => (o.id === id ? { ...o, ...patch } : o)));
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
    sessionStore.set({ ...sessionStore.get(), memberId });
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
    outletId: outletId ?? (sessionStore.get().outletId || outletStore.get()[0]?.id),
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
export function useCurrentOutlet(): Outlet {
  const { outletId } = useSession();
  const outlets = useOutlets();
  const me = useMe();
  // guests (no member): the outlet their QR belongs to
  const mine = me ? outlets.filter((o) => inOutlet(me, o.id)) : outlets;
  const o = mine.find((o) => o.id === outletId) ?? mine[0] ?? outlets[0] ?? blankOutlet;
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

/** Brand name + current outlet's settings (what the guest QR page needs). */
export function useSettings(): OutletSettings {
  const a = useAccount();
  const o = useCurrentOutlet();
  return {
    name: a.name, businessType: o.businessType, mixed: isMixed(o), upi: o.upi, payFirst: o.payFirst,
    address: o.address ?? "", phone: o.phone ?? "", gstin: o.gstin ?? "", fssai: o.fssai ?? "", hours: o.hours ?? "", billFooter: o.billFooter ?? "", acceptCard: o.acceptCard ?? true,
    orderFrom: o.orderFrom ?? "", orderTo: o.orderTo ?? "", ordersPaused: !!o.ordersPaused, gstRate: o.gstRate ?? 0.05,
  };
}
export const settingsActions = {
  /** Brand name goes on the account; the rest on the current outlet. */
  update(patch: Partial<OutletSettings>) {
    const { name, ...rest } = patch;
    if (name !== undefined) accountActions.rename(name);
    const id = sessionStore.get().outletId || outletStore.get()[0]?.id;
    if (Object.keys(rest).length) outletActions.update(id, rest);
    const names: Record<string, string> = { upi: "UPI ID", gstRate: "GST rate", ordersPaused: "QR ordering pause", orderFrom: "QR ordering hours", orderTo: "QR ordering hours", payFirst: "pay first", businessType: "outlet type", mixed: "outlet type", acceptCard: "card payments", billFooter: "bill footer", address: "address", phone: "phone", gstin: "GSTIN", fssai: "FSSAI", hours: "hours" };
    const what = [...new Set([...(name !== undefined ? ["name"] : []), ...Object.keys(rest).map((k) => names[k] ?? k)])];
    if (what.length) logActivity("settings", `Changed settings: ${what.join(", ")}${rest.gstRate !== undefined ? ` (GST ${Math.round(rest.gstRate * 100)}%)` : ""}${rest.ordersPaused !== undefined ? (rest.ordersPaused ? " (paused)" : " (back on)") : ""}`, id);
  },
};

/* ---------------- orders ---------------- */
export const methodLabel: Record<PayMethod, string> = { upi: "UPI", cash: "Cash", card: "Card" };
export const paymentsText = (p?: Payment[]) => (p?.length ? p.map((x) => `${methodLabel[x.method]} ₹${x.amount.toLocaleString("en-IN")}`).join(" + ") : "—");

export const billOf = (o: Order) => Math.round(o.lines.reduce((s, l) => s + l.qty * l.price, 0) * (1 + gstRate()));
const orderStore = createStore<Order[]>([], "orders", { kind: "collection", coll: "orders", guest: "own" });
export const useOrders = () => orderStore.use();
export const getOrders = () => orderStore.get();

/** The outlet this device is working in (or the first one). */
export const currentOutletId = (): string | undefined => sessionStore.get().outletId || outletStore.get()[0]?.id;

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
  setStatus(id: string, status: OrderStatus) {
    const o = orderStore.get().find((x) => x.id === id);
    // Paid in full from the guest's phone (café pay-first): closes itself once served
    // (or waits for the owner's OK when the person serving can't confirm payments).
    const pre = (o?.prepaid ?? []).reduce((a, p) => a + p.amount, 0);
    if (o && status === "served" && pre > 0 && pre >= billOf(o)) {
      patchOrder(id, (x) => ({ ...x, status }));
      orderActions.settle([id], o.prepaid!, o.customer ?? "Guest", { source: "guest" });
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
  setPreference(ids: string[], pref: PayMethod) {
    orderStore.set(orderStore.get().map((o) => (ids.includes(o.id) ? { ...o, payPreference: pref } : o)));
  },
  /**
   * Someone says the bill is paid. The owner (or a member with "Confirm payments")
   * closes it straight away; anyone else's "paid" waits for their OK.
   * Returns "paid" or "waiting".
   */
  settle(ids: string[], payments: Payment[], by: string, opts: { source?: PayClaim["source"]; discount?: number; coupon?: string } = {}): "paid" | "waiting" {
    const c = getCloud();
    const trusted = c.role !== "guest" && opts.source !== "guest" && canConfirmPay(currentMember());
    if (trusted) {
      orderActions.pay(ids, payments, by);
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
    orderActions.pay(list.map((o) => o.id), claim.payments, claim.by, who);
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
          ? { ...o, status: "served", payments: undefined, payment: undefined, payClaim: undefined, confirmedBy: undefined, paymentLog: [...(o.paymentLog ?? []), { at, by: who, text: `Marked unpaid (was ${paymentsText(o.payments)})` }] }
          : o,
      ),
    );
    logActivity("payment", `Marked unpaid: ${list.map((o) => `#${o.number}`).join(", ")} · ${where(list[0])} (was ${paymentsText(list.flatMap((o) => o.payments ?? []))})`, list[0].outletId);
    return list;
  },
  /** Settle one or more orders (a party's bill) with one or more payments. */
  pay(ids: string[], payments: Payment[], by: string, confirmedBy?: string) {
    const at = new Date().toISOString();
    // Save the bill on the guest's record (one entry per bill, not per order).
    const first = orderStore.get().find((o) => ids.includes(o.id) && o.guestPhone);
    if (first?.guestPhone) {
      const amount = payments.reduce((a, p) => a + p.amount, 0);
      guestActions.addBill(first.guestPhone, { orderNo: first.number, amount, method: paymentsText(payments) });
    }
    // One bill can cover several orders (a table's rounds): give each order its share,
    // so reports add up to exactly what was collected.
    const share = splitPayments(orderStore.get().filter((o) => ids.includes(o.id)), payments);
    orderStore.set(
      orderStore.get().map((o) =>
        ids.includes(o.id)
          ? {
              ...o,
              status: "paid",
              payments: share.get(o.id) ?? payments,
              payment: payments.length > 1 ? "split" : payments[0]?.method,
              payClaim: undefined,
              confirmedBy: confirmedBy ?? by,
              paymentLog: [...(o.paymentLog ?? []), { at, by: confirmedBy ?? by, text: `Paid · ${paymentsText(payments)}${ids.length > 1 ? ` (bill for ${ids.length} orders)` : ""}${confirmedBy ? ` · marked by ${by}, confirmed` : ""}` }],
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
const guestStore = createStore<Customer[]>([], "guests", { kind: "collection", coll: "guests" });
export const useGuests = () => guestStore.use();

const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);

export const guestActions = {
  /** Called after OTP: create or update the guest record. */
  upsert(name: string, phone: string, optIn: boolean): Customer {
    const key = normPhone(phone);
    const c = getCloud();
    if (c.role === "guest" && c.rid) {
      // Guests can't read the guest book; they only add or update their own name.
      const rec = { id: key, name, phone: `${key.slice(0, 5)} ${key.slice(5)}`, verified: false, source: "qr" as const, optIn, lastVisit: new Date().toISOString() };
      guestUpsert(c.rid, key, rec);
      return { ...rec, visits: 1, spend: 0, points: 0, tier: "New", favourite: "—" };
    }
    const list = guestStore.get();
    const found = list.find((c) => normPhone(c.phone) === key);
    if (found) {
      const updated = { ...found, name: name || found.name, verified: true, optIn: optIn || found.optIn, lastVisit: new Date().toISOString() };
      guestStore.set(list.map((c) => (c.id === found.id ? updated : c)));
      return updated;
    }
    const nc: Customer = {
      id: key,
      name,
      phone: `${key.slice(0, 5)} ${key.slice(5)}`,
      visits: 1,
      spend: 0,
      lastVisit: new Date().toISOString(),
      points: 0,
      tier: "New",
      favourite: "—",
      verified: true,
      source: "qr",
      optIn,
      bills: [],
    };
    guestStore.set([nc, ...list]);
    return nc;
  },
  /** Staff typed the guest's number at billing (walk-in / counter): add them to the guest book with this bill. */
  fromBill(name: string, phone: string, bill: { orderNo: number; amount: number; method: string }) {
    const key = normPhone(phone);
    if (key.length !== 10) return;
    const list = guestStore.get();
    const found = list.find((c) => normPhone(c.phone) === key);
    const now = new Date().toISOString();
    const entry = { ...bill, at: now };
    if (found) {
      guestStore.set(
        list.map((c) =>
          c.id === found.id
            ? { ...c, name: c.name || name.trim(), visits: c.visits + 1, lastVisit: now, spend: c.spend + bill.amount, points: c.points + Math.floor(bill.amount / 10), bills: [entry, ...(c.bills ?? [])] }
            : c,
        ),
      );
      return;
    }
    guestStore.set([
      {
        id: key,
        name: name.trim() || "Guest",
        phone: `${key.slice(0, 5)} ${key.slice(5)}`,
        visits: 1,
        spend: bill.amount,
        lastVisit: now,
        points: Math.floor(bill.amount / 10),
        tier: "New",
        favourite: "—",
        verified: false,
        source: "pos",
        optIn: false,
        bills: [entry],
      },
      ...list,
    ]);
  },
  addBill(phone: string, bill: { orderNo: number; amount: number; method: string }) {
    const key = normPhone(phone);
    guestStore.set(
      guestStore.get().map((c) =>
        normPhone(c.phone) === key
          ? { ...c, visits: (c.bills?.length ?? 0) > 0 ? c.visits + 1 : c.visits, lastVisit: new Date().toISOString(), spend: c.spend + bill.amount, points: c.points + Math.floor(bill.amount / 10), bills: [{ ...bill, at: new Date().toISOString() }, ...(c.bills ?? [])] }
          : c,
      ),
    );
  },
};

/* ---------------- menu ---------------- */
const menuStore = createStore<MenuItem[]>([], "menu", { kind: "collection", coll: "menu", guest: "read" });
export const useMenu = () => menuStore.use();
export const menuActions = {
  update(id: string, patch: Partial<MenuItem>) {
    const old = menuStore.get().find((m) => m.id === id);
    menuStore.set(menuStore.get().map((m) => (m.id === id ? { ...m, ...patch } : m)));
    if (!old) return;
    if (patch.price !== undefined && patch.price !== old.price) logActivity("menu", `Price of ${old.name}: ${rs(old.price)} → ${rs(patch.price)}`);
    if (patch.available !== undefined && patch.available !== old.available) logActivity("menu", `${old.name} marked ${patch.available ? "available" : "sold out"}`);
    if (patch.name && patch.name !== old.name) logActivity("menu", `Renamed ${old.name} to ${patch.name}`);
  },
  add(item: MenuItem) {
    menuStore.set([...menuStore.get(), item]);
    logActivity("menu", `Added dish ${item.name} · ${rs(item.price)}`);
  },
  /** Many dishes in one go (menu read from a photo). */
  addMany(items: MenuItem[]) {
    if (items.length) menuStore.set([...menuStore.get(), ...items]);
    if (items.length) logActivity("menu", `Added ${items.length} dishes from a menu photo`);
  },
};

/* ---------------- categories (owner-defined → guest filters + side bar) ---------------- */
const catStore = createStore<Category[]>([], "categories", { kind: "collection", coll: "categories", guest: "read" });
export const useCategories = () => catStore.use();
export const categoryActions = {
  add(name: string, icon?: string): Category {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
    const taken = new Set(catStore.get().map((c) => c.id));
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    const c: Category = { id, name: name.trim(), icon };
    catStore.set([...catStore.get(), c]);
    return c;
  },
  update(id: string, patch: Partial<Category>) {
    catStore.set(catStore.get().map((c) => (c.id === id ? { ...c, ...patch } : c)));
  },
  move(id: string, dir: -1 | 1) {
    const list = [...catStore.get()];
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    catStore.set(list);
  },
};

/* ---------------- feedback (guest ratings after paying) ---------------- */
const feedbackStore = createStore<Feedback[]>([], "feedback", { kind: "collection", coll: "feedback" });
export const useFeedback = () => feedbackStore.use();
export const feedbackActions = {
  add(f: Omit<Feedback, "id" | "at">) {
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
export const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
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
  /** Count one use (called when a bill with this coupon is paid). */
  used(id: string) {
    couponStore.set(couponStore.get().map((x) => (x.id === id ? { ...x, uses: (x.uses ?? 0) + 1 } : x)));
  },
};
/** Why a coupon can't be used on this bill, or null when it can. */
export function couponProblem(c: Coupon | undefined, subtotal: number): string | null {
  if (!c) return "No coupon with this code";
  if (!c.active) return "This coupon is turned off";
  if (c.validTo && c.validTo < new Date().toISOString().slice(0, 10)) return "This coupon has expired";
  if (c.maxUses && c.uses >= c.maxUses) return "This coupon has been used up";
  if (c.minBill && subtotal < c.minBill) return `Works on bills of ₹${c.minBill} or more`;
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
