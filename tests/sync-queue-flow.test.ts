import { beforeAll, describe, expect, it, vi } from "vitest";

// a tiny browser: storage, online flag, timers
const store = new Map<string, string>();
beforeAll(() => {
  Object.assign(globalThis, {
    window: { setTimeout, clearTimeout, addEventListener: () => {} },
    document: { addEventListener: () => {}, visibilityState: "visible" },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
});

/** A fake Supabase: each call takes the next planned answer. */
function fakeClient(plan: (string | null)[], log: string[]) {
  const answer = (what: string) => {
    log.push(what);
    const next = plan.shift() ?? null;
    if (next === "net") return Promise.resolve({ error: { message: "TypeError: Failed to fetch" }, status: 0 });
    if (next) return Promise.resolve({ error: { message: next, code: "P0001" }, status: 400 });
    return Promise.resolve({ error: null, status: 200 });
  };
  const chain = (what: string) => {
    const p = () => answer(what);
    const q: Record<string, unknown> = {};
    q.eq = () => q;
    q.in = () => q;
    q.then = (a: (v: unknown) => unknown, b?: (e: unknown) => unknown) => p().then(a, b);
    return q;
  };
  return {
    from: (t: string) => ({
      insert: () => chain(`insert ${t}`),
      upsert: () => chain(`upsert ${t}`),
      update: () => chain(`update ${t}`),
      delete: () => chain(`delete ${t}`),
    }),
    rpc: (fn: string) => answer(`rpc ${fn}`),
  };
}

describe("save queue", () => {
  it("keeps a change that hit a network error and sends it again, in order", async () => {
    vi.useFakeTimers();
    const q = await import("@/lib/sync-queue");
    const log: string[] = [];
    const plan: (string | null)[] = ["net", null, null];
    const errors: string[] = [];
    q.initQueue(() => fakeClient(plan, log) as never, (_k, m) => errors.push(m));
    q.setQueueScope("u1.r1");

    await q.send({ op: "insert", table: "orders", rows: [{ id: "a" }] }); // network error → waits
    expect(q.waitingIds().has("a")).toBe(true);
    await q.send({ op: "patchOrder", rid: "r1", id: "a", set: { status: "ready" }, drop: [], full: {} }); // queued behind it
    expect(store.get("restropi.queue.u1.r1")).toContain('"a"'); // survives a reload

    await vi.advanceTimersByTimeAsync(3000); // retry
    expect(log).toEqual(["insert orders", "insert orders", "rpc patch_order"]);
    expect(q.waitingIds().size).toBe(0);
    expect(store.has("restropi.queue.u1.r1")).toBe(false);
    expect(errors).toEqual([]);
    vi.useRealTimers();
  });

  it("does not retry a change the server refuses, and reports it", async () => {
    const q = await import("@/lib/sync-queue");
    const log: string[] = [];
    const errors: string[] = [];
    q.initQueue(() => fakeClient(["This bill needs the owner's confirmation"], log) as never, (_k, m) => errors.push(m));
    q.setQueueScope("u2.r1");
    await q.send({ op: "update", table: "orders", rid: "r1", id: "b", data: {} });
    expect(log).toEqual(["update orders"]);
    expect(errors).toEqual(["This bill needs the owner's confirmation"]);
    expect(q.waitingIds().size).toBe(0);
  });

  it("treats a repeated insert that already landed as saved", async () => {
    const q = await import("@/lib/sync-queue");
    const log: string[] = [];
    const errors: string[] = [];
    const client = fakeClient([], log);
    // duplicate key = the first try reached the server
    client.from = () => ({ insert: () => ({ then: (a: (v: unknown) => unknown) => Promise.resolve({ error: { message: "duplicate key", code: "23505" }, status: 409 }).then(a) }) }) as never;
    q.initQueue(() => client as never, (_k, m) => errors.push(m));
    q.setQueueScope("u3.r1");
    await q.send({ op: "insert", table: "orders", rows: [{ id: "c" }] });
    expect(errors).toEqual([]);
  });
});
