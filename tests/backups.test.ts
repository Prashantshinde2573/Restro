import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny fake of the Supabase admin client: tables with rows, and a storage bucket in memory.
const rows: Record<string, Record<string, unknown>[]> = {};
const files = new Map<string, { body: string; type: string }>();
const sent: { to: unknown; attachments?: { filename: string; content: string }[] }[] = [];

function query(table: string) {
  let list = [...(rows[table] ?? [])];
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => ((list = list.filter((r) => r[k] === v)), q),
    order: () => q,
    range: (a: number, b: number) => Promise.resolve({ data: list.slice(a, b + 1), error: null }),
    maybeSingle: () => Promise.resolve({ data: list[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) => res({ data: list, error: null }),
  };
  return q;
}
const storage = {
  from: () => ({
    upload: async (path: string, blob: Blob, o: { contentType: string }) => {
      files.set(path, { body: await blob.text(), type: o.contentType });
      return { error: null };
    },
    list: async (prefix: string) => ({
      data: [...files.keys()].filter((k) => k.startsWith(prefix + "/")).map((k) => ({ name: k.slice(prefix.length + 1), metadata: { size: files.get(k)!.body.length } })),
    }),
    remove: async (paths: string[]) => (paths.forEach((p) => files.delete(p)), { error: null }),
    createSignedUrl: async (p: string) => ({ data: { signedUrl: "https://x/" + p } }),
  }),
};
vi.mock("@/lib/server/supabase-admin", () => ({ admin: () => ({ from: query, storage }) }));
vi.mock("@/lib/server/env", () => ({ env: { resendKey: "k", notifyEmail: "me@example.com" }, FROM_SUPPORT: "Restropi <s@x>", log: () => {} }));
vi.mock("@/lib/server/resend", () => ({ sendEmail: async (m: (typeof sent)[number]) => (sent.push(m), { ok: true, id: "1" }) }));

import { listBackups, runBackups } from "@/lib/server/backups";

describe("restaurant backups", () => {
  beforeEach(() => {
    files.clear();
    sent.length = 0;
    for (const k of Object.keys(rows)) delete rows[k];
    rows.restaurants = [{ id: "a", name: "Cafe A" }, { id: "b", name: "Hotel B" }];
    rows.orders = [{ rid: "a", id: "o1", data: { total: 100 } }, { rid: "b", id: "o2", data: { total: 50 } }, { rid: "a", id: "o3", data: {} }];
    rows.menu_items = [{ rid: "b", id: "m1", data: { name: "Tea" } }];
  });

  it("saves one file per restaurant with only that restaurant's rows", async () => {
    const r = await runBackups({ email: false });
    expect(r.failed).toEqual([]);
    expect(r.saved.map((s) => s.rid)).toEqual(["a", "b"]);
    const paths = [...files.keys()].sort();
    expect(paths).toHaveLength(2);
    expect(paths[0]).toMatch(/^a\/\d{4}-\d{2}-\d{2}\.json$/);
    const a = JSON.parse(files.get(paths[0])!.body);
    expect(a.kind).toBe("restropi-backup");
    expect(a.restaurant.name).toBe("Cafe A");
    expect(a.tables.orders.map((o: { id: string }) => o.id)).toEqual(["o1", "o3"]);
    expect(a.tables.menu_items).toEqual([]);
    expect(a.tables).not.toHaveProperty("staff_pins");
    expect(sent).toHaveLength(0);
  });

  it("removes files older than 30 days and keeps newer ones", async () => {
    files.set("a/2020-01-01.json", { body: "{}", type: "application/json" });
    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    files.set(`a/${recent}.json`, { body: "{}", type: "application/json" });
    await runBackups({ email: false });
    expect(files.has("a/2020-01-01.json")).toBe(false);
    expect(files.has(`a/${recent}.json`)).toBe(true);
  });

  it("emails every file when asked (Sundays)", async () => {
    const r = await runBackups({ email: true });
    expect(r.emailed).toBe(true);
    expect(sent[0].to).toBe("me@example.com");
    expect(sent[0].attachments?.map((x) => x.filename.split("-")[0])).toEqual(["a", "b"]);
    expect(JSON.parse(Buffer.from(sent[0].attachments![0].content, "base64").toString()).rid).toBe("a");
  });

  it("lists backups with download links", async () => {
    await runBackups({ email: false });
    const list = await listBackups();
    expect(list.map((r) => [r.rid, r.files.length])).toEqual([["a", 1], ["b", 1]]);
    expect(list[0].files[0].url).toContain("a/");
  });
});
