"use client";

// One small store type for every list the app shares (orders, menu, tables…).
//
// Two ways to keep the data:
//   • Demo mode (no Supabase keys in .env.local): saved in this browser
//     (localStorage) and kept in step between tabs.
//   • Cloud mode (Supabase keys present): the store mirrors a Supabase
//     table filtered by restaurant (rid) — every device sees the
//     same data live. lib/cloud.ts plugs in the reading and writing.
import { useSyncExternalStore } from "react";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export const PREFIX = "restropi.v1.";
export const cloudConfigured = !!SUPABASE_URL && !!SUPABASE_KEY;

/** Where a store lives in Supabase (a table filtered by rid, or the restaurants row). */
export type RemoteSpec = { kind: "collection"; coll: string; guest?: "read" | "own" | "none" } | { kind: "doc"; guest?: "read" | "none" };

export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  use: () => T;
}

export interface RemoteBinding {
  key: string;
  spec: RemoteSpec;
  empty: unknown;
  /** Replace the state with what the server says (never written back). */
  receive: (v: unknown) => void;
  get: () => unknown;
}

/** Writes a local change to Supabase. Installed by lib/cloud.ts once signed in. */
type Writer = (b: RemoteBinding, prev: unknown, next: unknown) => void;
let writer: Writer | null = null;
export const remoteBindings: RemoteBinding[] = [];
export function setRemoteWriter(w: Writer | null) {
  writer = w;
}

const hydrators: (() => void)[] = [];

export function createStore<T>(initial: T, key?: string, remote?: RemoteSpec): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const binding: RemoteBinding | null = remote && key ? { key, spec: remote, empty: Array.isArray(initial) ? [] : initial, receive: (v) => { state = v as T; emit(); }, get: () => state } : null;
  if (binding) remoteBindings.push(binding);

  // Demo mode only: keep a copy in this browser.
  const local = !!key && !cloudConfigured && typeof window !== "undefined";
  if (local) {
    hydrators.push(() => {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw) {
          state = JSON.parse(raw);
          emit();
        }
      } catch {}
    });
    window.addEventListener("storage", (e) => {
      if (e.key !== PREFIX + key || !e.newValue) return;
      try {
        state = JSON.parse(e.newValue);
        emit();
      } catch {}
    });
  }
  // Device-only stores (like "who is signed in here") always stay in the browser.
  const deviceOnly = !!key && !remote && typeof window !== "undefined";
  if (deviceOnly && !local) {
    hydrators.push(() => {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw) {
          state = JSON.parse(raw);
          emit();
        }
      } catch {}
    });
  }

  return {
    get: () => state,
    set(next: T) {
      const prev = state;
      state = next;
      if (key && (local || deviceOnly)) {
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(next));
        } catch {}
      }
      if (binding && writer) writer(binding, prev, next);
      emit();
    },
    use() {
      return useSyncExternalStore(
        (l) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        () => state,
        () => state,
      );
    },
  };
}

/* ---- has a cloud list finished its first load? (so screens show "loading", not "empty") ---- */
const ready = new Map<string, boolean>();
const readyListeners = new Set<() => void>();
export function setReady(key: string, v: boolean) {
  if (ready.get(key) === v) return;
  ready.set(key, v);
  readyListeners.forEach((l) => l());
}
/** True once the list behind `key` has loaded from the server (always true in demo mode). */
export function useReady(key: string) {
  return useSyncExternalStore(
    (l) => {
      readyListeners.add(l);
      return () => readyListeners.delete(l);
    },
    () => !cloudConfigured || ready.get(key) === true,
    () => true,
  );
}

let hydrated = false;
/** Load what this browser saved, once, after the first paint. */
export function hydrateStores() {
  if (hydrated) return;
  hydrated = true;
  hydrators.forEach((h) => h());
}
