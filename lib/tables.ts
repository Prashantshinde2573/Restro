"use client";

// Table + party helpers and the shared tables store (Tables screen, POS and
// the guest QR page all read the same live state).
import { createStore } from "./store";
import { logActivity, useCurrentOutlet } from "./live";
import type { Party, Table, TableStatus } from "./types";

const rank: Record<Party["status"], number> = { seated: 1, ordered: 2, billing: 3 };

/** Overall state of a table, from its most urgent party. */
export function tableState(t: Table): TableStatus {
  if (t.parties.length === 0) return t.reservedAt ? "reserved" : "free";
  return t.parties.reduce((a, p) => (rank[p.status] > rank[a.status] ? p : a)).status;
}

export const seatsTaken = (t: Table) => t.parties.reduce((s, p) => s + p.guests, 0);
export const seatsFree = (t: Table) => Math.max(0, t.seats - seatsTaken(t));
export const isShared = (t: Table) => t.parties.length > 1;
export const tableTotal = (t: Table) => t.parties.reduce((s, p) => s + (p.total ?? 0), 0);
export const oldestSince = (t: Table) => t.parties.map((p) => p.since).sort()[0];

export const nextPartyId = (t: Table) => {
  const used = new Set(t.parties.map((p) => p.id));
  return "ABCDEFGHIJ".split("").find((l) => !used.has(l)) ?? `P${t.parties.length + 1}`;
};

export const newCode = () => String(Math.floor(1000 + Math.random() * 9000));

/* ---------------- store ---------------- */
// restaurants' tables live in Supabase (guests may only change the parties list).
const tableStore = createStore<Table[]>([], "tables", { kind: "collection", coll: "tables", guest: "read" });
const all = () => tableStore.get();

/** All tables of the restaurant (every outlet). */
export function useAllTables() {
  return tableStore.use();
}
/** Tables of the outlet on screen, in name order. Tables saved before outlets existed show everywhere. */
export function useTables() {
  const all = tableStore.use();
  const outlet = useCurrentOutlet();
  return all.filter((t) => !t.outletId || !outlet.id || t.outletId === outlet.id).sort(byTableName);
}

export const getTable = (nameOrId: string) =>
  all().find((t) => t.id === nameOrId || t.name.toLowerCase() === nameOrId.toLowerCase());

function patch(tableId: string, fn: (t: Table) => Table) {
  tableStore.set(all().map((t) => (t.id === tableId ? fn(t) : t)));
}

const sortKey = (name: string) => name.replace(/\d+/g, (d) => d.padStart(5, "0")).toLowerCase();
export const byTableName = (a: Table, b: Table) => sortKey(a.name).localeCompare(sortKey(b.name));

export const tableActions = {
  /** Owner/manager adds a table. Names must be unique within the outlet. */
  add(t: { name: string; zone: string; seats: number; outletId?: string }): Table {
    const table: Table = {
      id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      name: t.name.trim(),
      zone: t.zone.trim() || "Indoor",
      seats: Math.max(1, Math.round(t.seats)),
      outletId: t.outletId,
      parties: [],
      visitId: `v-${Date.now().toString(36)}`,
    };
    tableStore.set([...all(), table]);
    logActivity("table", `Added table ${table.name}`, table.outletId);
    return table;
  },
  /** Add many at once: "T11" to "T20". */
  addMany(prefix: string, from: number, to: number, zone: string, seats: number, outletId?: string) {
    const stamp = Date.now().toString(36);
    const made: Table[] = [];
    for (let n = from; n <= to; n++)
      made.push({ id: `t${stamp}${n}`, name: `${prefix}${n}`, zone: zone.trim() || "Indoor", seats: Math.max(1, seats), outletId, parties: [], visitId: `v-${stamp}-${n}` });
    tableStore.set([...all(), ...made]);
    if (made.length) logActivity("table", `Added tables ${made[0].name}–${made[made.length - 1].name}`, outletId);
    return made.length;
  },
  edit(tableId: string, changes: { name?: string; zone?: string; seats?: number }) {
    patch(tableId, (x) => ({ ...x, ...changes, name: (changes.name ?? x.name).trim(), zone: (changes.zone ?? x.zone).trim() || "Indoor" }));
  },
  /** Only an empty table can be removed. */
  remove(tableId: string) {
    const t = all().find((x) => x.id === tableId);
    tableStore.set(all().filter((t) => t.id !== tableId));
    if (t) logActivity("table", `Removed table ${t.name}`, t.outletId);
  },
  /** Seat a new party. On a busy table this is "share table". */
  seat(tableId: string, guests: number, opts: Partial<Party> = {}): Party {
    const t = all().find((x) => x.id === tableId)!;
    const p: Party = {
      id: nextPartyId(t),
      guests,
      since: new Date().toISOString(),
      status: "seated",
      code: newCode(),
      source: "captain",
      ...opts,
    };
    patch(tableId, (x) => ({ ...x, reservedAt: undefined, parties: [...x.parties, p] }));
    logActivity("table", p.source === "qr" ? `New group at ${t.name} from the QR` : `Seated ${guests} guest${guests > 1 ? "s" : ""} at ${t.name}${t.parties.length ? ` (party ${p.id})` : ""}`, t.outletId);
    return p;
  },
  update(tableId: string, partyId: string, changes: Partial<Party>) {
    patch(tableId, (x) => ({ ...x, parties: x.parties.map((p) => (p.id === partyId ? { ...p, ...changes } : p)) }));
  },
  /** "Share group access": a fresh code that works for 10 minutes. */
  shareCode(tableId: string, partyId: string) {
    const code = newCode();
    tableActions.update(tableId, partyId, { code, codeExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString() });
    return code;
  },
  /** Find the party a group code belongs to (ignores expired codes). */
  findByCode(tableId: string, code: string) {
    const t = all().find((x) => x.id === tableId);
    return t?.parties.find((p) => p.code === code && (!p.codeExpiresAt || new Date(p.codeExpiresAt).getTime() > Date.now()));
  },
  /** Party paid and left. When the last party leaves, the next guests start a new visit. */
  close(tableId: string, partyId: string, why = "") {
    const t = all().find((x) => x.id === tableId);
    if (t?.parties.some((p) => p.id === partyId))
      logActivity("table", `${t.name}${t.parties.length > 1 ? ` · party ${partyId}` : ""} is free${t.parties.length > 1 ? "d" : ""}${why ? ` · ${why}` : ""}`, t.outletId);
    patch(tableId, (x) => {
      const parties = x.parties.filter((p) => p.id !== partyId);
      return { ...x, parties, visitId: parties.length ? x.visitId : `${x.id}-${Date.now().toString(36)}` };
    });
  },
  /** Two parties turn out to be together: one bill. */
  merge(tableId: string, fromId: string, intoId: string) {
    const t = all().find((x) => x.id === tableId);
    if (t) logActivity("table", `${t.name}: party ${fromId} joined party ${intoId}`, t.outletId);
    patch(tableId, (x) => {
      const from = x.parties.find((p) => p.id === fromId)!;
      return {
        ...x,
        parties: x.parties
          .filter((p) => p.id !== fromId)
          .map((p) => (p.id === intoId ? { ...p, guests: p.guests + from.guests, total: (p.total ?? 0) + (from.total ?? 0) } : p)),
      };
    });
  },
  /** Move one party (with its order) to another table. */
  move(fromTableId: string, partyId: string, toTableId: string) {
    const from = all().find((x) => x.id === fromTableId)!;
    const p = from.parties.find((x) => x.id === partyId)!;
    patch(fromTableId, (x) => {
      const parties = x.parties.filter((q) => q.id !== partyId);
      return { ...x, parties, visitId: parties.length ? x.visitId : `${x.id}-${Date.now().toString(36)}` };
    });
    const to = all().find((x) => x.id === toTableId)!;
    const moved = { ...p, id: nextPartyId(to) };
    patch(toTableId, (x) => ({ ...x, reservedAt: undefined, parties: [...x.parties, moved] }));
    logActivity("table", `Moved guests from ${from.name} to ${to.name}`, from.outletId);
    return moved;
  },
};

/** Where an order belongs, for tickets and lists: "Table T6 · B" on a shared table. */
export function orderWhere(
  o: { tableName?: string; partyId?: string; customer?: string; type?: string },
  all: Table[],
) {
  if (!o.tableName) return o.customer ?? (o.type === "delivery" ? "Delivery" : "Takeaway");
  const t = all.find((x) => x.name === o.tableName);
  return t && isShared(t) && o.partyId ? `Table ${o.tableName} · ${o.partyId}` : `Table ${o.tableName}`;
}
