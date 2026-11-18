"use client";

// Saving to Supabase without losing anything when the internet drops.
//
// Every write the app makes (a new order, a status change, a payment…) goes
// through here as a small, plain "job". A job that can't reach the server
// (no signal, a timeout, the server busy) waits in a queue on this device —
// kept in localStorage, so it survives a reload — and is sent again, in order,
// as soon as the connection is back. A job the server refuses (a rule says
// no) is not retried: the person sees a red "Not saved" bar and the error is
// reported to Admin → App errors.
//
// While nothing is waiting, jobs are sent straight away, exactly as before.
import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Job =
  | { op: "insert"; table: string; rows: Record<string, unknown>[] }
  | { op: "update"; table: string; rid: string; id: string; data: unknown }
  | { op: "upsert"; table: string; rows: Record<string, unknown>[] }
  | { op: "delete"; table: string; rid: string; ids: string[] }
  | { op: "patchOrder"; rid: string; id: string; set: Record<string, unknown>; drop: string[]; full: unknown }
  | { op: "rpc"; fn: string; args: Record<string, unknown> };

type Queued = { qid: string; job: Job; tries: number; at?: number };
type Result = { error: { message?: string; code?: string; details?: string } | null; status?: number; data?: unknown };

export interface SyncStatus {
  /** changes on this device still waiting to reach the server */
  waiting: number;
  /** changes the server refused (newest first) */
  failed: { at: string; text: string }[];
}

/* ---------------- status, for the banner ---------------- */
let status: SyncStatus = { waiting: 0, failed: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setStatus = (s: Partial<SyncStatus>) => {
  status = { ...status, ...s };
  emit();
};
export const useSyncStatus = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
export const dismissFailed = () => setStatus({ failed: [] });

/* ---------------- the queue ---------------- */
let client: (() => SupabaseClient) | null = null;
let onError: ((kind: string, message: string, context: Record<string, unknown>) => void) | null = null;
let scope: string | null = null;
let queue: Queued[] = [];
let flushing = false;
let retryTimer: number | null = null;
const inFlight = new Set<Promise<unknown>>();

const KEY = "restropi.queue.";
const save = () => {
  if (!scope) return;
  try {
    if (queue.length) localStorage.setItem(KEY + scope, JSON.stringify(queue));
    else localStorage.removeItem(KEY + scope);
  } catch {
    /* storage full or off: the queue still works until the page closes */
  }
  setStatus({ waiting: queue.length });
};

export function initQueue(getClient: () => SupabaseClient, report: (kind: string, message: string, context: Record<string, unknown>) => void) {
  client = getClient;
  onError = report;
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void flush());
}

/** A different person or restaurant signed in on this device: load their waiting changes. */
export function setQueueScope(next: string | null) {
  if (scope === next) return;
  scope = next;
  queue = [];
  if (next) {
    try {
      const raw = localStorage.getItem(KEY + next);
      if (raw) queue = JSON.parse(raw) as Queued[];
    } catch {
      queue = [];
    }
  }
  setStatus({ waiting: queue.length });
  if (queue.length) void flush();
}

/** Ids of rows with a change still waiting: a reload from the server must not drop them. */
export function waitingIds(): Set<string> {
  const ids = new Set<string>();
  for (const q of queue) for (const id of idsOf(q.job)) ids.add(id);
  return ids;
}

function idsOf(job: Job): string[] {
  switch (job.op) {
    case "insert":
    case "upsert":
      return job.rows.map((r) => String(r.id));
    case "update":
    case "patchOrder":
      return [job.id];
    case "delete":
      return job.ids;
    default:
      return [];
  }
}

/** Wait for changes on their way (sent now, or waiting in the queue while online). */
export async function flushAll() {
  await Promise.allSettled([...inFlight]);
  if (queue.length && navigator.onLine) await flush();
}

/** Send a change. Resolves once it is saved, waiting in the queue, or refused. */
export function send(job: Job): Promise<void> {
  if (queue.length || flushing) {
    queue.push({ qid: qid(), job, tries: 0, at: Date.now() });
    save();
    void flush();
    return Promise.resolve();
  }
  const p = run(job).then((r) => {
    if (r === "ok") return;
    if (r === "retry") {
      queue.push({ qid: qid(), job, tries: 1, at: Date.now() });
      save();
      later(1);
      return;
    }
    refused(job, r);
  });
  inFlight.add(p);
  void p.finally(() => inFlight.delete(p));
  return p;
}

const qid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function flush() {
  if (flushing || !queue.length || !client) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  if (retryTimer) window.clearTimeout(retryTimer);
  retryTimer = null;
  try {
    while (queue.length) {
      const head = queue[0];
      // a table's seating changes fast: an old copy would undo what the staff did since
      if (Date.now() - (head.at ?? Date.now()) > maxAge(head.job)) {
        queue.shift();
        save();
        refused(head.job, "too old to save (the internet was off too long). Please check it and enter it again.");
        continue;
      }
      const r = await run(head.job);
      if (r === "retry") {
        head.tries += 1;
        save();
        later(head.tries);
        return;
      }
      queue.shift();
      save();
      if (r !== "ok") refused(head.job, r);
    }
  } finally {
    flushing = false;
  }
}

const MIN = 60_000;
function maxAge(job: Job) {
  const t = job.op === "patchOrder" ? "orders" : job.op === "rpc" ? job.fn : job.table;
  if (t === "dining_tables" || t === "guest_set_parties" || t === "waiter_calls") return 10 * MIN;
  return 6 * 60 * MIN;
}

function later(tries: number) {
  if (retryTimer) window.clearTimeout(retryTimer);
  const wait = Math.min(30_000, 1000 * 2 ** Math.min(tries, 5)); // 2 s, 4 s … then every 30 s
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void flush();
  }, wait);
}

function refused(job: Job, message: string) {
  const text = describe(job);
  setStatus({ failed: [{ at: new Date().toISOString(), text: `${text}: ${message}` }, ...status.failed].slice(0, 5) });
  onError?.("save-refused", message, { op: job.op, what: text, ids: idsOf(job).slice(0, 5) });
}

function describe(job: Job) {
  const t = job.op === "patchOrder" ? "orders" : job.op === "rpc" ? job.fn : job.table;
  const what: Record<string, string> = {
    orders: "an order",
    dining_tables: "a table",
    menu_items: "a dish",
    categories: "a category",
    stock_items: "stock",
    members: "a team member",
    guests: "a guest",
    coupons: "a coupon",
    outlets: "an outlet",
    waiter_calls: "a waiter call",
    activity: "the activity log",
    feedback: "feedback",
    guest_set_parties: "the table",
    guest_touch: "your details",
  };
  return `Couldn't save ${what[t] ?? t}`;
}

/** "retry" for a network problem, "ok", or the server's reason for refusing. */
async function run(job: Job): Promise<"ok" | "retry" | string> {
  if (!client) return "retry";
  let res: Result;
  try {
    res = (await exec(client(), job)) as Result;
  } catch (e) {
    return isNetwork(String((e as Error)?.message ?? e), 0) ? "retry" : String((e as Error)?.message ?? e);
  }
  if (!res.error) return "ok";
  const msg = `${res.error.message ?? ""}`;
  // the insert reached the server last time, only the answer got lost
  if (job.op === "insert" && res.error.code === "23505") return "ok";
  // the database update with patch_order isn't there yet: save the whole order, as before
  if (job.op === "patchOrder" && (res.error.code === "PGRST202" || /patch_order/.test(msg) && /find|exist/i.test(msg))) {
    return run({ op: "update", table: "orders", rid: job.rid, id: job.id, data: job.full });
  }
  if (isNetwork(msg, res.status)) return "retry";
  return msg || "the server said no";
}

function isNetwork(message: string, status?: number) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (status === 0 || status === 408 || status === 429 || (status !== undefined && status >= 500)) return true;
  return /Failed to fetch|NetworkError|Load failed|fetch failed|network|timed? ?out|ECONN|aborted|socket/i.test(message);
}

function exec(sb: SupabaseClient, job: Job): PromiseLike<unknown> {
  switch (job.op) {
    case "insert":
      return sb.from(job.table).insert(job.rows);
    case "upsert":
      return sb.from(job.table).upsert(job.rows, { onConflict: "rid,id" });
    case "update":
      return sb.from(job.table).update({ data: job.data }).eq("rid", job.rid).eq("id", job.id);
    case "delete":
      return sb.from(job.table).delete().eq("rid", job.rid).in("id", job.ids);
    case "patchOrder":
      return sb.rpc("patch_order", { p_rid: job.rid, p_id: job.id, p_set: job.set, p_drop: job.drop });
    case "rpc":
      return sb.rpc(job.fn, job.args);
  }
}

/** What changed between two versions of an order: top-level fields set, and fields removed. */
export function diffFields(before: Record<string, unknown> | undefined, after: Record<string, unknown>) {
  const set: Record<string, unknown> = {};
  const drop: string[] = [];
  if (!before) return { set: { ...after }, drop };
  for (const [k, v] of Object.entries(after)) {
    if (v === undefined) {
      if (k in before && before[k] !== undefined) drop.push(k);
      continue;
    }
    if (JSON.stringify(v) !== JSON.stringify(before[k])) set[k] = v;
  }
  for (const k of Object.keys(before)) if (!(k in after) && before[k] !== undefined) drop.push(k);
  return { set, drop };
}
