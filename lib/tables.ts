"use client";

// Table + party helpers and the shared tables store (Tables screen, POS and
// the guest QR page all read the same live state).
import { repo } from "./repo";
import { cloudConfigured, createStore } from "./store";
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

/** "T6" for a single party, "T6 · B" when the table is shared. */
export function partyLabel(tableName: string, partyId?: string, shared = true) {
  return partyId && shared ? `${tableName} · ${partyId}` : tableName;
}

export const nextPartyId = (t: Table) => {
  const used = new Set(t.parties.map((p) => p.id));
  return "ABCDEFGHIJ".split("").find((l) => !used.has(l)) ?? `P${t.parties.length + 1}`;
};

export const newCode = () => String(Math.floor(1000 + Math.random() * 9000));

/* ---------------- store ---------------- */
// Demo: sample tables in this browser. Cloud: restaurants/{rid}/tables (guests may update parties).
const tableStore = createStore<Table[]>(
  cloudConfigured ? [] : repo.tables().map((t) => ({ ...t, parties: t.parties.map((p) => ({ ...p })) })),
  "tables",
  { kind: "collection", coll: "tables", guest: "read" },
);
const all = () => tableStore.get();

export function useTables() {
  return tableStore.use();
}

export const getTable = (nameOrId: string) =>
  all().find((t) => t.id === nameOrId || t.name.toLowerCase() === nameOrId.toLowerCase());

function patch(tableId: string, fn: (t: Table) => Table) {
  tableStore.set(all().map((t) => (t.id === tableId ? fn(t) : t)));
}

export const tableActions = {
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
      server: "Rohit",
      ...opts,
    };
    patch(tableId, (x) => ({ ...x, reservedAt: undefined, parties: [...x.parties, p] }));
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
  close(tableId: string, partyId: string) {
    patch(tableId, (x) => {
      const parties = x.parties.filter((p) => p.id !== partyId);
      return { ...x, parties, visitId: parties.length ? x.visitId : `${x.id}-${Date.now().toString(36)}` };
    });
  },
  /** Two parties turn out to be together: one bill. */
  merge(tableId: string, fromId: string, intoId: string) {
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
    tableActions.close(fromTableId, partyId);
    const to = all().find((x) => x.id === toTableId)!;
    const moved = { ...p, id: nextPartyId(to) };
    patch(toTableId, (x) => ({ ...x, reservedAt: undefined, parties: [...x.parties, moved] }));
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
