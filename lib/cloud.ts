"use client";

// Supabase: sign-in and live sync of every store with the database.
//
// One restaurant (tenant) = one row in `restaurants`. Every other table has
// (rid, id, data jsonb): outlets, members, categories, menu_items,
// dining_tables, orders, guests, feedback. Row level security keeps each
// restaurant's data to its own team; guests on the QR page only read the menu
// side and their own orders. See supabase/migrations for the rules.
//
// Who signs in how:
//   owner  → email + password (Supabase Auth)
//   staff  → 4-digit PIN, checked by the `staff-login` edge function
//   guest  → anonymous sign-in, no screen
import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { cloudConfigured, createStore, remoteBindings, setRemoteWriter, type RemoteBinding } from "./store";

export { cloudConfigured };

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

let _sb: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!_sb) _sb = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "restro.auth" } });
  return _sb;
}

/** Store key → table name. */
const TABLE: Record<string, string> = {
  outlets: "outlets",
  members: "members",
  categories: "categories",
  menu: "menu_items",
  tables: "dining_tables",
  orders: "orders",
  guests: "guests",
  feedback: "feedback",
  stock: "stock_items",
};

/* ---------------- who is signed in on this device ---------------- */
export type Role = "owner" | "staff" | "guest" | "superadmin";
/** needsOnboarding = signed in, but this login isn't linked to any restaurant. */
export type CloudStatus = "off" | "loading" | "signedOut" | "needsOnboarding" | "ready";
export interface CloudState {
  status: CloudStatus;
  role?: Role;
  rid?: string;
  uid?: string;
  memberId?: string;
  email?: string | null;
  displayName?: string | null;
  /** First sign-in with a temporary password: must set their own. */
  mustChangePassword?: boolean;
}
const stateStore = createStore<CloudState>({ status: cloudConfigured ? "loading" : "off" });
export const useCloud = () => stateStore.use();
export const getCloud = () => stateStore.get();

/** Start listening to sign-in changes (called once from <Providers>). */
let started = false;
let lastUid: string | null = null;
export function startCloud(onSignedIn: (s: CloudState) => void) {
  if (!cloudConfigured || started || typeof window === "undefined") return;
  started = true;
  const handle = async (session: Session | null) => {
    if (!session) {
      lastUid = null;
      disconnect();
      stateStore.set({ status: "signedOut" });
      return;
    }
    // token refreshes fire too; only re-resolve when the person changes
    if (session.user.id === lastUid && stateStore.get().status !== "loading") return;
    lastUid = session.user.id;
    let s: CloudState;
    try {
      s = await resolveUser(session);
    } catch {
      lastUid = null;
      stateStore.set({ status: "signedOut" });
      return;
    }
    stateStore.set(s);
    if (s.status === "ready" && s.rid && (s.role === "owner" || s.role === "staff")) {
      connect(s.rid, s.role!, session.user.id);
      onSignedIn(s);
    }
  };
  sb().auth.onAuthStateChange((event, session) => {
    // don't await inside the auth callback (supabase-js deadlocks on nested calls)
    setTimeout(async () => {
      await handle(session);
      // opened a "reset password" email link: ask for a new password first
      if (event === "PASSWORD_RECOVERY") stateStore.set({ ...stateStore.get(), mustChangePassword: true });
    }, 0);
  });
}

async function resolveUser(session: Session): Promise<CloudState> {
  const user = session.user;
  if (user.is_anonymous) return { ...stateStore.get(), status: "ready", role: "guest", uid: user.id };
  const name = (user.user_metadata?.name as string | undefined) ?? null;
  const must = !!user.user_metadata?.must_change_password;
  const base = { uid: user.id, email: user.email, displayName: name, mustChangePassword: must };
  const meta = (user.app_metadata ?? {}) as { rid?: string; member_id?: string };
  if (meta.rid) return { ...base, status: "ready", role: "staff", rid: meta.rid, memberId: meta.member_id ?? "", mustChangePassword: false };
  const { data, error } = await sb().rpc("whoami");
  if (error) throw error;
  const w = data as { superAdmin: boolean; restaurant: { id: string; status: string } | null };
  if (w.superAdmin) return { ...base, status: "ready", role: "superadmin" };
  if (!w.restaurant) return { ...base, status: "needsOnboarding" };
  return { ...base, status: "ready", role: "owner", rid: w.restaurant.id, memberId: "owner" };
}

/** Set a new password (first sign-in, or from the profile). */
export async function changePassword(password: string) {
  const { data, error } = await sb().auth.updateUser({ password, data: { must_change_password: false } });
  if (error) throw new Error(/should be different/i.test(error.message) ? "Use a different password from the temporary one." : error.message);
  stateStore.set({ ...stateStore.get(), mustChangePassword: false });
  return data;
}

/* ---------------- sign-in actions ---------------- */
const friendly = (m: string) =>
  /invalid login/i.test(m) ? "Email or password is wrong" :
  /already registered/i.test(m) ? "This email already has an account. Sign in instead." :
  /email not confirmed/i.test(m) ? "Open the link we emailed you first, then sign in." :
  /password should be/i.test(m) ? "Use at least 6 characters for the password." : m;

/** Owner sign in. */
export async function signInOwner(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendly(error.message));
}
export async function sendPasswordReset(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
  if (error) throw new Error(friendly(error.message));
}

async function callFn<T>(name: string, body: unknown, withUser = false): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", apikey: KEY };
  if (withUser) {
    const { data } = await sb().auth.getSession();
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
  }
  const r = await fetch(`${URL_}/functions/v1/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "Something went wrong");
  return j as T;
}

export async function signInStaff(rid: string, memberId: string, pin: string) {
  const t = await callFn<{ access_token: string; refresh_token: string }>("staff-login", { rid, memberId, pin });
  const { error } = await sb().auth.setSession(t);
  if (error) throw new Error(error.message);
}
/** Guests on the QR page: an anonymous account, no login screen. */
export async function ensureGuest(rid: string) {
  const a = sb().auth;
  let { data } = await a.getSession();
  if (!data.session) {
    const r = await a.signInAnonymously();
    if (r.error) throw new Error(r.error.message);
    data = { session: r.data.session! };
  }
  const uid = data.session!.user.id;
  const cur = getCloud();
  if (cur.role === "guest" || !cur.rid || data.session!.user.is_anonymous) {
    const role: Role = data.session!.user.is_anonymous ? "guest" : (cur.role ?? "guest");
    stateStore.set({ status: "ready", role, rid, uid, memberId: cur.memberId });
    connect(rid, role, uid);
  }
}
/** Sign this login out on every phone and computer. */
export async function signOutEverywhere() {
  disconnect();
  await sb().auth.signOut({ scope: "global" });
}
export async function cloudSignOut() {
  disconnect();
  await sb().auth.signOut();
}
/** Upload a dish photo (already resized) and get its public link. */
export async function uploadMenuPhoto(blob: Blob): Promise<string> {
  const rid = stateStore.get().rid;
  if (!rid) throw new Error("Not signed in");
  const path = `${rid}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb().storage.from("menu-photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return sb().storage.from("menu-photos").getPublicUrl(path).data.publicUrl;
}
/** Owner or sub admin sets a staff member's 4-digit PIN (stored hashed on the server). */
export async function setStaffPin(rid: string, memberId: string, pin: string) {
  await flushWrites();
  await callFn("set-pin", { rid, memberId, pin }, true);
}
/** Staff names and faces for the PIN screen (public, no prices or phones). */
export async function publicStaff(rid: string): Promise<{ id: string; name: string; hue: number; outletIds: string[] }[]> {
  const { data, error } = await sb().rpc("public_staff", { r: rid });
  if (error) throw new Error(error.message);
  return (data as { id: string; name: string; hue: number; outletIds: string[] }[]) ?? [];
}
export async function publicInfo(rid: string): Promise<{ name: string } | null> {
  const { data } = await sb().rpc("public_info", { r: rid });
  return (data as { name: string } | null) ?? null;
}

/* ---------------- live sync ---------------- */
let channel: RealtimeChannel | null = null;
let connected: { rid: string; role: Role; uid: string } | null = null;
const pending = new Set<Promise<unknown>>();

function disconnect() {
  if (channel) void sb().removeChannel(channel);
  channel = null;
  connected = null;
  setRemoteWriter(null);
}

type Row = { id: string; data: Record<string, unknown>; number?: number };
const fromRow = (key: string, r: Row) => (key === "orders" ? { ...r.data, id: r.id, number: r.number ?? r.data.number ?? 0 } : { ...r.data, id: r.id });

type AccountRow = { name: string; owner: string; plan: string; renews_at: string; status: string };
const fromAccount = (r: AccountRow) => ({ name: r.name, owner: r.owner, plan: r.plan, renewsAt: r.renews_at, status: r.status });

export function connect(rid: string, role: Role, uid: string) {
  if (connected && connected.rid === rid && connected.role === role && connected.uid === uid) return;
  disconnect();
  connected = { rid, role, uid };
  const client = sb();
  // Keep each list as a map so live changes can be applied one row at a time.
  const maps = new Map<string, Map<string, unknown>>();
  const publish = (b: RemoteBinding) => b.receive(sortLike(b.key, [...(maps.get(b.key)?.values() ?? [])]));

  const ch = client.channel(`restro:${rid}:${uid}`);
  for (const b of remoteBindings) {
    const g = b.spec.guest ?? "none";
    if (role === "guest" && g === "none") {
      b.receive(b.empty);
      continue;
    }
    if (b.spec.kind === "doc") {
      ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${rid}` }, (p) =>
        b.receive({ ...(b.empty as object), ...fromAccount(p.new as AccountRow) }),
      );
      void client
        .from("restaurants")
        .select("name, owner, plan, renews_at, status")
        .eq("id", rid)
        .maybeSingle()
        .then(({ data }) => data && b.receive({ ...(b.empty as object), ...fromAccount(data as AccountRow) }));
      continue;
    }
    const table = TABLE[b.key];
    if (!table) continue;
    const map = new Map<string, unknown>();
    maps.set(b.key, map);
    b.receive([]);
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table, filter: `rid=eq.${rid}` }, (p) => {
      const r = p.new as Row;
      map.set(r.id, fromRow(b.key, r));
      publish(b);
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `rid=eq.${rid}` }, (p) => {
      const r = p.new as Row;
      map.set(r.id, fromRow(b.key, r));
      publish(b);
    });
    // deletes can't be filtered server-side; the old row carries its key (rid, id)
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table }, (p) => {
      const o = p.old as { rid?: string; id?: string };
      if (o.rid === rid && o.id && map.delete(o.id)) publish(b);
    });
    let q = client.from(table).select(b.key === "orders" ? "id, data, number" : "id, data").eq("rid", rid);
    if (role === "guest" && g === "own") q = q.eq("guest_uid", uid);
    if (b.key === "orders") q = q.order("updated_at", { ascending: false }).limit(1000);
    void q.then(({ data, error }) => {
      if (error) return report(error);
      for (const r of (data as unknown as Row[]) ?? []) if (!map.has(r.id)) map.set(r.id, fromRow(b.key, r));
      publish(b);
    });
  }
  ch.subscribe();
  channel = ch;
  setRemoteWriter((b, prev, next) => write(rid, role, uid, b, prev, next));
}

const sortLike = (key: string, list: unknown[]) => {
  const l = list as Record<string, unknown>[];
  if (key === "orders") return l.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (key === "categories" || key === "outlets") return l.sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0));
  if (key === "tables" || key === "members") return l.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  return l;
};

const track = <T,>(p: PromiseLike<T>) => {
  const pr = Promise.resolve(p);
  pending.add(pr);
  void pr.finally(() => pending.delete(pr));
  return pr;
};
/** Wait for writes still on their way (e.g. save a person before setting their PIN). */
export const flushWrites = async () => {
  await Promise.allSettled([...pending]);
};

function write(rid: string, role: Role, uid: string, b: RemoteBinding, prev: unknown, next: unknown) {
  const g = b.spec.guest ?? "none";
  if (role === "guest" && g === "none") return;
  const client = sb();

  if (b.spec.kind === "doc") {
    if (role !== "owner") return; // only the owner renames; plan changes go through billing
    const n = next as { name?: string; owner?: string };
    track(client.from("restaurants").update({ name: n.name, owner: n.owner }).eq("id", rid).then(check));
    return;
  }
  const table = TABLE[b.key];
  if (!table) return;
  const before = new Map(((prev as { id: string }[]) ?? []).map((x) => [x.id, x]));
  const after = (next as { id: string }[]) ?? [];
  const keep = new Set(after.map((x) => x.id));
  const changed: Record<string, unknown>[] = [];
  after.forEach((item, i) => {
    if (before.get(item.id) === item) return; // unchanged object
    const data = b.key === "categories" || b.key === "outlets" ? { ...item, sort: i } : { ...item };
    changed.push(data);
  });

  if (role === "guest") {
    // Guests: tables only change through a narrow server function; orders are their own.
    if (b.key === "tables") {
      for (const t of changed) track(client.rpc("guest_set_parties", { r: rid, t: t.id, parties: t.parties ?? [] }).then(check));
      return;
    }
    if (b.key !== "orders") return;
    for (const o of changed) {
      const isNew = !before.has(String(o.id));
      const row = { rid, id: String(o.id), data: o, guest_uid: uid };
      track((isNew ? client.from(table).insert(row) : client.from(table).update({ data: o }).eq("rid", rid).eq("id", String(o.id))).then(check));
    }
    return;
  }

  if (b.key === "orders") {
    // insert new ones and update the rest separately, so an update never uses up an order number
    const fresh = changed.filter((o) => !before.has(String(o.id)));
    const edits = changed.filter((o) => before.has(String(o.id)));
    if (fresh.length) track(client.from(table).insert(fresh.map((d) => ({ rid, id: String(d.id), data: d }))).then(check));
    for (const d of edits) track(client.from(table).update({ data: d }).eq("rid", rid).eq("id", String(d.id)).then(check));
  } else if (changed.length) {
    const rows = changed.map((d) => ({ rid, id: String(d.id), data: d, updated_at: new Date().toISOString() }));
    track(client.from(table).upsert(rows, { onConflict: "rid,id" }).then(check));
  }
  const gone = [...before.keys()].filter((id) => !keep.has(id));
  if (gone.length) track(client.from(table).delete().eq("rid", rid).in("id", gone).then(check));
}

const check = ({ error }: { error: unknown }) => {
  if (error) report(error);
};
const report = (e: unknown) => console.error("[restro] cloud write failed", e);

/** New order: the server trigger gives it the next order number (0 until it arrives). */
export function createOrderInCloud(order: { id: string } & Record<string, unknown>) {
  // The normal store writer inserts it (guests: with their uid); nothing extra needed.
  void order;
}
export const isConnected = () => !!connected;

/** Guests add/update only their own customer record (name, phone), or leave feedback. */
export function guestUpsert(rid: string, id: string, data: Record<string, unknown>, coll: "guests" | "feedback" = "guests") {
  if (coll === "guests") track(sb().rpc("guest_touch", { r: rid, rec: { ...data, id } }).then(check));
  else track(sb().from("feedback").insert({ rid, id, data }).then(check));
}

/* ---------------- super admin ---------------- */
export interface AdminRestaurant {
  id: string;
  name: string;
  owner: string;
  ownerEmail: string;
  phone: string;
  city: string;
  notes: string;
  plan: "starter" | "growth" | "pro" | "chain";
  renewsAt: string;
  status: "active" | "suspended";
  createdAt: string;
  outlets: number;
  members: number;
  menuItems: number;
  orders30: number;
  lastOrderAt: string | null;
}
export async function adminList(): Promise<AdminRestaurant[]> {
  const { data, error } = await sb().rpc("admin_restaurants");
  if (error) throw new Error(error.message);
  return (data as AdminRestaurant[]) ?? [];
}
export async function adminUpdate(rid: string, patch: Partial<Pick<AdminRestaurant, "plan" | "renewsAt" | "status" | "name" | "owner" | "phone" | "city" | "notes">>) {
  const { error } = await sb().rpc("admin_update_restaurant", { r: rid, patch });
  if (error) throw new Error(error.message);
}
export interface NewRestaurant {
  name: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  city: string;
  notes: string;
  plan: string;
  months: number;
  trialDays: number;
  tables: number;
  outlet: { name: string; address: string; businessType: "restaurant" | "cafe"; upi: string; payFirst: boolean };
}
export const adminCreate = (r: NewRestaurant) =>
  callFn<{ rid: string; ownerEmail: string; tempPassword: string }>("admin-restaurants", { action: "create", ...r }, true);
export const adminResetOwnerPassword = (rid: string) =>
  callFn<{ ownerEmail: string; tempPassword: string }>("admin-restaurants", { action: "reset_owner_password", rid }, true);
export const adminDelete = (rid: string, confirmName: string) =>
  callFn<{ ok: true }>("admin-restaurants", { action: "delete", rid, confirmName }, true);
