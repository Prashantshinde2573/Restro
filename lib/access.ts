// What each person can see and do, decided by three things together:
//   1. the client's PLAN      (Starter / Growth / Pro / Chain)
//   2. the OUTLET'S TYPE      (restaurant or café — a café never sees table-service tools)
//   3. the MEMBER'S ACCESS    (owner = everything; sub admin / staff = the boxes ticked for them,
//                              only in the outlets they are assigned to)
import type { BusinessType } from "./types";

export type PlanId = "starter" | "growth" | "pro" | "chain";
export const PLAN_ORDER: PlanId[] = ["starter", "growth", "pro", "chain"];
export const PLAN_NAME: Record<PlanId, string> = { starter: "Starter", growth: "Growth", pro: "Pro", chain: "Chain" };
export const planAtLeast = (plan: PlanId, min: PlanId) => PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(min);
/** Outlets each plan allows. */
export const OUTLET_LIMIT: Record<PlanId, number> = { starter: 1, growth: 1, pro: 3, chain: Infinity };
/** Staff logins (besides the owner) each plan allows. */
export const MEMBER_LIMIT: Record<PlanId, number> = { starter: 3, growth: Infinity, pro: Infinity, chain: Infinity };

/* ---------------- features: plan + outlet type ---------------- */
export type Feature =
  | "pos"
  | "orders"
  | "kitchen"
  | "menu"
  | "reports"
  | "tables"
  | "tableSharing"
  | "splitByGuest"
  | "counterToken"
  | "qrOrdering"
  | "stock"
  | "pulse"
  | "team"
  | "guests"
  | "campaigns"
  | "coupons"
  | "voice"
  | "prepForecast"
  | "insights"
  | "menuEngineering";

const BOTH: BusinessType[] = ["restaurant", "cafe"];
export const FEATURES: Record<Feature, { label: string; plan: PlanId; types: BusinessType[] }> = {
  pos: { label: "Billing / new order", plan: "starter", types: BOTH },
  orders: { label: "Orders", plan: "starter", types: BOTH },
  kitchen: { label: "Kitchen orders (KOT)", plan: "starter", types: BOTH },
  menu: { label: "Menu", plan: "starter", types: BOTH },
  reports: { label: "Reports", plan: "starter", types: BOTH },
  tables: { label: "Tables", plan: "starter", types: ["restaurant"] },
  tableSharing: { label: "Shared tables", plan: "starter", types: ["restaurant"] },
  splitByGuest: { label: "Split bill by guest", plan: "growth", types: ["restaurant"] },
  counterToken: { label: "Counter orders with token", plan: "starter", types: ["cafe"] },
  qrOrdering: { label: "QR ordering", plan: "growth", types: BOTH },
  stock: { label: "Stock and recipes", plan: "growth", types: BOTH },
  pulse: { label: "Restropi Pulse briefing", plan: "growth", types: BOTH },
  team: { label: "Team", plan: "starter", types: BOTH },
  guests: { label: "Guests", plan: "growth", types: BOTH },
  campaigns: { label: "Campaigns", plan: "growth", types: BOTH },
  coupons: { label: "Discount coupons", plan: "growth", types: BOTH },
  voice: { label: "Voice ordering", plan: "pro", types: BOTH },
  prepForecast: { label: "Prep forecast", plan: "pro", types: BOTH },
  insights: { label: "Insights and Leak guard", plan: "pro", types: BOTH },
  menuEngineering: { label: "What's working (menu engineering)", plan: "pro", types: BOTH },
};

/** The ways an outlet serves guests. `mixed` outlets run both. */
/** Restaurants also take counter orders unless the owner turned it off; cafés serve at tables only when turned on. */
export const isMixed = (o: { businessType: BusinessType; mixed?: boolean }) => o.mixed ?? o.businessType === "restaurant";
export const outletKinds = (o: { businessType: BusinessType; mixed?: boolean }): BusinessType[] => (isMixed(o) ? ["restaurant", "cafe"] : [o.businessType]);
/** Has tables (dine-in at a table, table QR, captains). */
export const hasTables = (o: { businessType: BusinessType; mixed?: boolean }) => o.businessType === "restaurant" || isMixed(o);
/** Takes counter orders with a token (counter QR, pay first). */
export const hasCounter = (o: { businessType: BusinessType; mixed?: boolean }) => o.businessType === "cafe" || isMixed(o);

export type FeatureState = "ok" | "plan" | "type";
export function featureState(f: Feature, plan: PlanId, type: BusinessType | BusinessType[]): FeatureState {
  const m = FEATURES[f];
  const kinds = Array.isArray(type) ? type : [type];
  if (!kinds.some((k) => m.types.includes(k))) return "type";
  if (!planAtLeast(plan, m.plan)) return "plan";
  return "ok";
}

/* ---------------- permissions: the checkboxes ---------------- */
export type Perm =
  | "pos"
  | "orders"
  | "charge"
  | "tables"
  | "kitchen"
  | "discount"
  | "refund"
  | "editPayment"
  | "confirmPay"
  | "dayClose"
  | "menu"
  | "stock"
  | "team"
  | "guests"
  | "campaigns"
  | "insights"
  | "reports"
  | "activity"
  | "outletSettings";

export const PERM_GROUPS: { title: string; perms: { key: Perm; label: string; feature?: Feature }[] }[] = [
  {
    title: "Daily work",
    perms: [
      { key: "pos", label: "Take orders", feature: "pos" },
      { key: "orders", label: "See and accept orders", feature: "orders" },
      { key: "charge", label: "Charge bills", feature: "pos" },
      { key: "tables", label: "Tables", feature: "tables" },
      { key: "kitchen", label: "Kitchen orders (KOT)", feature: "kitchen" },
    ],
  },
  {
    title: "Money",
    perms: [
      { key: "discount", label: "Give discounts" },
      { key: "refund", label: "Cancel orders after they are accepted" },
      { key: "editPayment", label: "Change how a bill was paid" },
      { key: "confirmPay", label: "Confirm payments (bills close without the owner's OK)" },
    ],
  },
  {
    title: "Manage",
    perms: [
      { key: "menu", label: "Edit menu and prices", feature: "menu" },
      { key: "stock", label: "Stock and purchases", feature: "stock" },
      { key: "team", label: "Manage staff and their access", feature: "team" },
      { key: "outletSettings", label: "Outlet settings (UPI, GST, QR ordering)" },
    ],
  },
  {
    title: "Grow",
    perms: [
      { key: "guests", label: "Guests and reviews", feature: "guests" },
      { key: "campaigns", label: "Campaigns", feature: "campaigns" },
      { key: "insights", label: "Insights", feature: "insights" },
      { key: "reports", label: "Reports", feature: "reports" },
      { key: "activity", label: "Activity log (who did what)" },
    ],
  },
];
export const ALL_PERMS: Perm[] = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key));

/** Starting ticks for common jobs — the admin can change any box after. */
export const PRESETS: { name: string; types: BusinessType[]; perms: Perm[] }[] = [
  { name: "Outlet manager", types: BOTH, perms: ALL_PERMS },
  { name: "Captain", types: ["restaurant"], perms: ["pos", "orders", "tables", "kitchen"] },
  { name: "Cashier", types: BOTH, perms: ["pos", "orders", "charge", "discount"] },
  { name: "Counter staff", types: ["cafe"], perms: ["pos", "orders", "charge", "kitchen"] },
  { name: "Chef", types: BOTH, perms: ["kitchen", "stock"] },
];

/* ---------------- members ---------------- */
export type MemberRole = "owner" | "subadmin" | "staff";
export interface Member {
  id: string;
  name: string;
  phone: string;
  role: MemberRole;
  title: string; // job name shown on screens: "Outlet manager", "Captain"…
  outletIds: string[];
  perms: Perm[];
  active: boolean;
  hue: number;
}

export const isOwner = (m?: Member | null) => m?.role === "owner";
export const hasPerm = (m: Member | null | undefined, p: Perm) => !!m && m.active && (m.role === "owner" || m.perms.includes(p));
/** Owner, or staff the owner trusts to confirm payments. Everyone else's "paid" waits for them. */
export const canConfirmPay = (m: Member | null | undefined) => hasPerm(m, "confirmPay");
export const inOutlet = (m: Member | null | undefined, outletId: string) => !!m && (m.role === "owner" || m.outletIds.includes(outletId));

/**
 * Can `editor` change `target`? The owner can change anyone but themselves.
 * A sub admin can change staff only, and only staff who work in the sub
 * admin's own outlets.
 */
export function canManage(editor: Member | null | undefined, target: Member) {
  if (!editor || !editor.active) return false;
  if (target.role === "owner") return false;
  if (editor.role === "owner") return true;
  if (editor.role !== "subadmin" || !editor.perms.includes("team")) return false;
  return target.role === "staff" && target.outletIds.length > 0 && target.outletIds.every((o) => editor.outletIds.includes(o));
}
/** Which boxes `editor` may tick for someone else: never more than they have themselves. */
export const grantable = (editor: Member | null | undefined): Perm[] => (!editor ? [] : editor.role === "owner" ? ALL_PERMS : editor.perms);
/** Which outlets `editor` may assign. */
export const assignableOutlets = (editor: Member | null | undefined, all: string[]) => (!editor ? [] : editor.role === "owner" ? all : all.filter((o) => editor.outletIds.includes(o)));

/* ---------------- screens ---------------- */
/** Each screen: the feature it needs and the permission a non-owner needs. */
export const ROUTES: { href: string; feature?: Feature; perm?: Perm | "ownerOrSettings" }[] = [
  { href: "/app/pos", feature: "pos", perm: "pos" },
  { href: "/app/orders", feature: "orders", perm: "orders" },
  { href: "/app/tables", feature: "tables", perm: "tables" },
  { href: "/app/kitchen", feature: "kitchen", perm: "kitchen" },
  { href: "/app/menu", feature: "menu", perm: "menu" },
  { href: "/app/inventory", feature: "stock", perm: "stock" },
  { href: "/app/team", feature: "team", perm: "team" },
  { href: "/app/access", feature: "team", perm: "team" },
  { href: "/app/guests", feature: "guests", perm: "guests" },
  { href: "/app/campaigns", feature: "campaigns", perm: "campaigns" },
  { href: "/app/insights", feature: "insights", perm: "insights" },
  { href: "/app/reports", feature: "reports", perm: "reports" },
  { href: "/app/activity", perm: "activity" },
];
export const routeFor = (path: string) => ROUTES.find((r) => path === r.href || path.startsWith(r.href + "/"));

/* ---------------- subscription ---------------- */
export const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
/** Owners see a reminder from 10 days before the plan ends. */
export const RENEW_WARN_DAYS = 10;
