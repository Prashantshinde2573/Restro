import { beforeAll, describe, expect, it, vi } from "vitest";

// Charge without "Send to kitchen" first: the new order and its payment are sent a moment apart.
// The payment must never be lost because it reached the server before the order did.
const store = new Map<string, string>();
beforeAll(() => {
  Object.assign(globalThis, {
    window: { setTimeout: (f: () => void, ms?: number) => setTimeout(f, ms), clearTimeout: (t: number) => clearTimeout(t), addEventListener: () => {} },
    document: { addEventListener: () => {}, visibilityState: "visible" },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  });
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
});

/** A fake server: inserts are slow (200 ms), patch_order answers at once (false when the row isn't there). */
function fakeServer(insertMs = 200) {
  const rows = new Map<string, Record<string, unknown>>();
  const later = <T,>(ms: number, f: () => T) => new Promise<T>((r) => setTimeout(() => r(f()), ms));
  const done = (data?: unknown) => ({ error: null, status: 200, data });
  const thenable = (p: () => Promise<unknown>) => {
    const q: Record<string, unknown> = {};
    q.eq = () => q;
    q.in = () => q;
    q.then = (a: (v: unknown) => unknown, b?: (e: unknown) => unknown) => p().then(a, b);
    return q;
  };
  const client = {
    from: () => ({
      insert: (list: { id: string; data: Record<string, unknown> }[]) =>
        thenable(() => later(insertMs, () => (list.forEach((r) => rows.set(r.id, { ...r.data })), done()))),
      upsert: (list: { id: string; data: Record<string, unknown> }[]) =>
        thenable(() => later(5, () => (list.forEach((r) => rows.set(r.id, { ...(rows.get(r.id) ?? {}), ...r.data })), done()))),
      update: () => thenable(() => Promise.resolve(done())),
      delete: () => thenable(() => Promise.resolve(done())),
    }),
    rpc: (_fn: string, a: { p_id: string; p_set: Record<string, unknown> }) =>
      later(5, () => {
        const r = rows.get(a.p_id);
        if (!r) return done(false);
        Object.assign(r, a.p_set);
        return done(true);
      }),
  };
  return { client, rows };
}

describe("charge straight away (order + payment)", () => {
  it("the payment lands after the order, never lost", async () => {
    vi.useFakeTimers();
    const q = await import("@/lib/sync-queue");
    const { client, rows } = fakeServer();
    const errors: string[] = [];
    q.initQueue(() => client as never, (_k, m) => errors.push(m));
    q.setQueueScope("u1.r1");

    void q.send({ op: "insert", table: "orders", rows: [{ rid: "r1", id: "o1", data: { id: "o1", status: "accepted" } }] });
    void q.send({ op: "patchOrder", rid: "r1", id: "o1", set: { status: "paid", payments: [{ method: "cash", amount: 210 }] }, drop: [], full: {} });
    await vi.advanceTimersByTimeAsync(1000);

    expect(rows.get("o1")).toMatchObject({ status: "paid", payments: [{ method: "cash", amount: 210 }] });
    expect(errors).toEqual([]);
    vi.useRealTimers();
  });

  it("an edit for an order the server doesn't have yet is tried again, then the whole order is saved", async () => {
    vi.useFakeTimers();
    const q = await import("@/lib/sync-queue");
    const { client, rows } = fakeServer();
    q.initQueue(() => client as never, () => {});
    q.setQueueScope("u2.r1");

    // the insert never came from this device (e.g. lost): the patch must not vanish
    void q.send({ op: "patchOrder", rid: "r1", id: "o9", set: { status: "paid" }, drop: [], full: { id: "o9", status: "paid", lines: [] } });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rows.get("o9")).toMatchObject({ status: "paid" });
    expect(q.waitingIds().size).toBe(0);
    vi.useRealTimers();
  });

  it("other orders don't wait for each other", async () => {
    vi.useFakeTimers();
    const q = await import("@/lib/sync-queue");
    const { client, rows } = fakeServer(500);
    q.initQueue(() => client as never, () => {});
    q.setQueueScope("u3.r1");
    rows.set("b", { status: "ready" });
    void q.send({ op: "insert", table: "orders", rows: [{ rid: "r1", id: "a", data: { status: "accepted" } }] });
    void q.send({ op: "patchOrder", rid: "r1", id: "b", set: { status: "served" }, drop: [], full: {} });
    await vi.advanceTimersByTimeAsync(20);
    expect(rows.get("b")).toMatchObject({ status: "served" }); // done before the slow insert of "a"
    expect(rows.has("a")).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(rows.has("a")).toBe(true);
    vi.useRealTimers();
  });
});
