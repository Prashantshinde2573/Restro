"use client";

// Live stores shared by the staff screens and the guest QR page.
//
// Demo mode (no Supabase keys): saved in this browser and synced between tabs.
// Cloud mode (Supabase keys in .env.local): every store mirrors a Supabase table for
// this restaurant (rid), so all phones and tablets see the same data live.
import { repo } from "./repo";
import { PREFIX, cloudConfigured, createStore, hydrateStores } from "./store";
import { getCloud, guestUpsert, isConnected } from "./cloud";
export { cloudConfigured };
import { featureState, hasPerm, inOutlet, type Feature, type FeatureState, type Member, type Perm, type PlanId } from "./access";
import type { Account, Category, Customer, Feedback, MenuItem, Order, OrderStatus, Outlet, OutletSettings, Payment, PayMethod } from "./types";

export { hydrateStores };
/** Sample data in demo mode; empty in cloud mode (a new restaurant starts clean). */
const seed = <T,>(sample: T, empty: T): T => (cloudConfigured ? empty : sample);

/** Demo helper: forget everything saved and go back to the sample data. */
export function resetSavedData() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch {}
  location.reload();
}

/* ---------------- account, outlets, members, who is signed in ---------------- */
const blankAccount: Account = { name: "", owner: "", plan: "growth", renewsAt: new Date(Date.now() + 365 * 86_400_000).toISOString() };
const accountStore = createStore<Account>(seed({ ...repo.account() }, blankAccount), "account", { kind: "doc", guest: "read" });
export const useAccount = () => accountStore.use();
export const accountActions = {
  setPlan(plan: PlanId) {
    accountStore.set({ ...accountStore.get(), plan });
  },
  /** Prototype stand-in for a Razorpay renewal: pushes the end date a month on. */
  renew() {
    const a = accountStore.get();
    const from = Math.max(Date.now(), new Date(a.renewsAt).getTime());
    accountStore.set({ ...a, renewsAt: new Date(from + 30 * 86_400_000).toISOString() });
  },
  rename(name: string) {
    accountStore.set({ ...accountStore.get(), name });
  },
};

const outletStore = createStore<Outlet[]>(seed(repo.outlets().map((o) => ({ ...o })), []), "outlets", { kind: "collection", coll: "outlets", guest: "read" });
export const useOutlets = () => outletStore.use();
export const outletActions = {
  add(o: Omit<Outlet, "id">): Outlet {
    const base = o.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "outlet";
    const taken = new Set(outletStore.get().map((x) => x.id));
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    const outlet = { ...o, id };
    outletStore.set([...outletStore.get(), outlet]);
    // the owner works everywhere
    memberStore.set(memberStore.get().map((m) => (m.role === "owner" ? { ...m, outletIds: [...m.outletIds, id] } : m)));
    return outlet;
  },
  update(id: string, patch: Partial<Outlet>) {
    outletStore.set(outletStore.get().map((o) => (o.id === id ? { ...o, ...patch } : o)));
  },
};

const memberStore = createStore<Member[]>(seed(repo.members().map((m) => ({ ...m })), []), "members", { kind: "collection", coll: "members" });
export const useMembers = () => memberStore.use();
export const getMembers = () => memberStore.get();
export const memberActions = {
  save(m: Member) {
    const list = memberStore.get();
    memberStore.set(list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]);
  },
  remove(id: string) {
    memberStore.set(memberStore.get().filter((m) => m.id !== id));
  },
};

// Who is using this device, and which outlet they are looking at.
const sessionStore = createStore<{ memberId: string; outletId: string }>({ memberId: cloudConfigured ? "" : "s1", outletId: cloudConfigured ? "" : repo.outlets()[0].id }, "session");
export const useSession = () => sessionStore.use();
export const sessionActions = {
  signInAs(memberId: string) {
    const m = memberStore.get().find((x) => x.id === memberId);
    if (!m) return;
    const cur = sessionStore.get().outletId;
    sessionStore.set({ memberId, outletId: m.role === "owner" || m.outletIds.includes(cur) ? cur : m.outletIds[0] ?? cur });
  },
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
/** The outlet on screen (falls back to the first one the member may see). */
export function useCurrentOutlet(): Outlet {
  const { outletId } = useSession();
  const outlets = useOutlets();
  const me = useMe();
  const mine = outlets.filter((o) => inOutlet(me, o.id));
  return mine.find((o) => o.id === outletId) ?? mine[0] ?? outlets[0] ?? blankOutlet;
}
const blankOutlet: Outlet = { id: "", name: "", address: "", businessType: "restaurant", upi: "", payFirst: false };
/** Is a feature on for this plan and this outlet's type? */
export function useFeature(f: Feature): FeatureState {
  const { plan } = useAccount();
  return featureState(f, plan, useCurrentOutlet().businessType);
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
  return { name: a.name, businessType: o.businessType, upi: o.upi, payFirst: o.payFirst };
}
export const settingsActions = {
  /** Brand name goes on the account; the rest on the current outlet. */
  update(patch: Partial<OutletSettings>) {
    const { name, ...rest } = patch;
    if (name !== undefined) accountActions.rename(name);
    const id = sessionStore.get().outletId;
    if (Object.keys(rest).length) outletActions.update(id, rest);
  },
};

/* ---------------- orders ---------------- */
export const methodLabel: Record<PayMethod, string> = { upi: "UPI", cash: "Cash", card: "Card" };
export const paymentsText = (p?: Payment[]) => (p?.length ? p.map((x) => `${methodLabel[x.method]} ₹${x.amount.toLocaleString("en-IN")}`).join(" + ") : "—");

export const billOf = (o: Order) => Math.round(o.lines.reduce((s, l) => s + l.qty * l.price, 0) * 1.05);
const seedPayments = (o: Order): Order => {
  if (o.status !== "paid" || o.payments) return { ...o };
  const amt = billOf(o);
  const payments: Payment[] =
    o.payment === "split"
      ? [{ method: "upi", amount: Math.round(amt * 0.6) }, { method: "cash", amount: amt - Math.round(amt * 0.6) }]
      : [{ method: (o.payment as PayMethod) ?? "cash", amount: amt }];
  return { ...o, payments, paymentLog: [{ at: o.createdAt, by: o.staff, text: `Paid · ${paymentsText(payments)}` }] };
};
const orderStore = createStore<Order[]>(seed(repo.orders().map(seedPayments), []), "orders", { kind: "collection", coll: "orders", guest: "own" });
export const useOrders = () => orderStore.use();
export const getOrders = () => orderStore.get();

const patchOrder = (id: string, fn: (o: Order) => Order) =>
  orderStore.set(orderStore.get().map((o) => (o.id === id ? fn(o) : o)));


export const orderActions = {
  add(o: Omit<Order, "id" | "number">): Order {
    if (isConnected()) {
      // Cloud: the order number comes from a server counter (0 until it arrives).
      const id = `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const order: Order = { ...o, id, number: 0, guestUid: getCloud().role === "guest" ? getCloud().uid : undefined };
      orderStore.set([order, ...orderStore.get()]);
      return order;
    }
    const number = Math.max(1000, ...orderStore.get().map((x) => x.number)) + 1;
    const order = { ...o, id: `o${number}`, number };
    orderStore.set([order, ...orderStore.get()]);
    return order;
  },
  setStatus(id: string, status: OrderStatus) {
    const o = orderStore.get().find((x) => x.id === id);
    // Paid in full from the guest's phone (café pay-first): closes itself once served.
    const pre = (o?.prepaid ?? []).reduce((a, p) => a + p.amount, 0);
    if (o && status === "served" && pre > 0 && pre >= billOf(o)) {
      orderActions.pay([id], o.prepaid!, o.customer ?? "Guest");
      return;
    }
    patchOrder(id, (x) => ({ ...x, status }));
  },
  toggleLine(id: string, idx: number) {
    patchOrder(id, (o) => ({ ...o, lines: o.lines.map((l, i) => (i === idx ? { ...l, done: !l.done } : l)) }));
  },
  setPreference(ids: string[], pref: PayMethod) {
    orderStore.set(orderStore.get().map((o) => (ids.includes(o.id) ? { ...o, payPreference: pref } : o)));
  },
  /** Settle one or more orders (a party's bill) with one or more payments. */
  pay(ids: string[], payments: Payment[], by: string) {
    const at = new Date().toISOString();
    // Save the bill on the guest's record (one entry per bill, not per order).
    const first = orderStore.get().find((o) => ids.includes(o.id) && o.guestPhone);
    if (first?.guestPhone) {
      const amount = payments.reduce((a, p) => a + p.amount, 0);
      guestActions.addBill(first.guestPhone, { orderNo: first.number, amount, method: paymentsText(payments) });
    }
    orderStore.set(
      orderStore.get().map((o) =>
        ids.includes(o.id)
          ? {
              ...o,
              status: "paid",
              payments,
              payment: payments.length > 1 ? "split" : payments[0]?.method,
              paymentLog: [...(o.paymentLog ?? []), { at, by, text: `Paid · ${paymentsText(payments)}` }],
            }
          : o,
      ),
    );
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
const guestStore = createStore<Customer[]>(seed(repo.customers().map((c) => ({ ...c })), []), "guests", { kind: "collection", coll: "guests" });
export const useGuests = () => guestStore.use();

const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);

export const guestActions = {
  /** Called after OTP: create or update the guest record. */
  upsert(name: string, phone: string, optIn: boolean): Customer {
    const key = normPhone(phone);
    const c = getCloud();
    if (c.role === "guest" && c.rid) {
      // Guests can't read the guest book; they only add or update their own name.
      const rec = { id: key, name, phone: `${key.slice(0, 5)} ${key.slice(5)}`, verified: true, source: "qr" as const, optIn, lastVisit: new Date().toISOString() };
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
const menuStore = createStore<MenuItem[]>(seed(repo.menu().map((m) => ({ ...m })), []), "menu", { kind: "collection", coll: "menu", guest: "read" });
export const useMenu = () => menuStore.use();
export const menuActions = {
  update(id: string, patch: Partial<MenuItem>) {
    menuStore.set(menuStore.get().map((m) => (m.id === id ? { ...m, ...patch } : m)));
  },
  add(item: MenuItem) {
    menuStore.set([...menuStore.get(), item]);
  },
};

/* ---------------- categories (owner-defined → guest filters + side bar) ---------------- */
const catStore = createStore<Category[]>(seed(repo.categories().map((c) => ({ ...c })), []), "categories", { kind: "collection", coll: "categories", guest: "read" });
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
const feedbackStore = createStore<Feedback[]>(seed(repo.feedback().map((f) => ({ ...f })), []), "feedback", { kind: "collection", coll: "feedback" });
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
