"use client";

// Tables to clean:
//   • a table needs cleaning when a group leaves after paying (or a team member asks for it)
//   • anyone can send someone to clean it; that person gets a notification
//   • "Cleaned" takes it off the list
import clsx from "clsx";
import Link from "next/link";
import { Check, SprayCan, UsersRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { hasPerm, inOutlet, type Member } from "@/lib/access";
import { timeAgo } from "@/lib/format";
import { useCurrentOutlet, useMe, useMembers, useOutlets } from "@/lib/live";
import { useFresh } from "@/lib/store";
import { tableActions, useAllTables } from "@/lib/tables";
import type { Table } from "@/lib/types";
import { Avatar, Button, Sheet } from "./ui";
import { useToast } from "./toast";
import { pushNotice } from "./notifications";
import { chime } from "./sound";

/** Name shown in the log and on the card. */
export const myLabel = (me: Member | null | undefined) => (me ? (me.role === "owner" ? `${me.name} (Owner)` : me.name) : "Staff");

/** "4 min" since the table was left. */
const ago = (iso: string) => timeAgo(iso).replace(/ ago$/, "");

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification(title, { body, icon: "/brand/icon-192.png", tag: title + body });
  } catch {}
}

/** Pick who cleans a table (or leave it to anyone free). */
export function CleanSheet({ table, onClose }: { table: Table | null; onClose: () => void }) {
  const members = useMembers().filter((m) => m.active && (!table?.outletId || inOutlet(m, table.outletId)));
  const me = useMe();
  const toast = useToast();
  const c = table?.cleaning;
  return (
    <Sheet open={!!table} onClose={onClose} title={table ? (c ? `Clean ${table.name}` : `Clean ${table.name}?`) : ""}>
      {table && (
        <div className="space-y-3">
          <p className="text-[14px] text-muted">{c?.toName ? `${c.toName} is on it. Pick someone else, or mark it clean.` : "Who should clean it? They get a notification."}</p>
          <div className="overflow-hidden rounded-group bg-surface">
            {!c && (
              <button
                onClick={() => { tableActions.needsCleaning(table.id); toast(`${table.name} · marked to clean`); onClose(); }}
                className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left hover:bg-sunken/40"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted"><UsersRound size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">Anyone free</span>
                  <span className="block text-[12.5px] text-muted">Everyone on tables sees it</span>
                </span>
              </button>
            )}
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  tableActions.assignCleaning(table.id, { id: m.id, name: m.name }, myLabel(me));
                  toast(m.id === me?.id ? `You're cleaning ${table.name}` : `${m.name} will clean ${table.name}`);
                  onClose();
                }}
                className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40"
              >
                <Avatar name={m.name} hue={m.hue} photo={m.photo} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">{m.name}{m.id === me?.id ? " (you)" : ""}</span>
                  <span className="block text-[12.5px] text-muted">{m.role === "owner" ? "Owner" : m.title || "Staff"}</span>
                </span>
                {c?.to === m.id && <Check size={17} className="text-jade" />}
              </button>
            ))}
          </div>
          {c && (
            <Button className="w-full" onClick={() => { tableActions.cleaned(table.id, myLabel(me)); toast(`${table.name} is clean`); onClose(); }}>
              <Check size={16} /> Cleaned
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** The card on a table's screen: needs cleaning · who · Cleaned / Change. */
export function CleanCard({ table, onChange }: { table: Table; onChange: () => void }) {
  const me = useMe();
  const toast = useToast();
  const c = table.cleaning;
  if (!c) return null;
  return (
    <div className="flex flex-col gap-3 rounded-group bg-rose-soft/70 p-3.5 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <SprayCan size={18} className="mt-0.5 shrink-0 text-rose" />
        <span className="min-w-0 text-[14px]">
          <b>Needs cleaning</b> · {ago(c.since)}
          <span className="block text-[12.5px] text-muted">{c.toName ? `${c.to === me?.id ? "You" : c.toName}${c.by && c.by !== c.toName ? ` · sent by ${c.by}` : ""}` : "No one yet"}</span>
        </span>
      </span>
      <span className="grid grid-cols-2 gap-2 sm:flex">
        <Button size="sm" variant="plain" onClick={onChange}>{c.toName ? "Change" : "Assign"}</Button>
        <Button size="sm" onClick={() => { tableActions.cleaned(table.id, myLabel(me)); toast(`${table.name} is clean`); }}><Check size={15} /> Cleaned</Button>
      </span>
    </div>
  );
}

/** Tables of the outlet on screen that still need cleaning (for people who work the tables). */
export function useTablesToClean() {
  const tables = useAllTables();
  const outlet = useCurrentOutlet();
  const me = useMe();
  if (!me || !hasPerm(me, "tables")) {
    // someone without the tables screen still sees the tables they were sent to
    return tables.filter((t) => t.cleaning?.to && t.cleaning.to === me?.id);
  }
  return tables.filter((t) => t.cleaning && (!t.outletId || !outlet.id || t.outletId === outlet.id) && (!t.outletId || inOutlet(me, t.outletId)));
}

/** "Needs you now": the tables I was sent to (with Cleaned), then the rest. */
export function CleanNeedsCards({ tables, onGo }: { tables: Table[]; onGo?: () => void }) {
  const me = useMe();
  const toast = useToast();
  const mine = tables.filter((t) => t.cleaning?.to === me?.id);
  const rest = tables.filter((t) => t.cleaning?.to !== me?.id);
  return (
    <>
      {mine.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-[16px] bg-surface p-3 text-[14px]">
          <SprayCan size={17} className="shrink-0 text-rose" />
          <span className="min-w-0 flex-1">
            <b>Clean {t.name}</b>
            <span className="block text-[12.5px] text-muted">{t.cleaning!.by && t.cleaning!.by !== t.cleaning!.toName ? `${t.cleaning!.by} sent you · ` : ""}{ago(t.cleaning!.since)}</span>
          </span>
          <Button size="sm" onClick={() => { tableActions.cleaned(t.id, myLabel(me)); toast(`${t.name} is clean`); }}><Check size={15} /> Cleaned</Button>
        </div>
      ))}
      {rest.length > 0 && (
        <Link href="/app/tables" onClick={onGo} className="flex items-center gap-2 rounded-[16px] bg-surface p-3 text-[14px] hover:shadow-float">
          <SprayCan size={17} className="shrink-0 text-rose" />
          <span className="flex-1">
            <b>{rest.map((t) => t.name).join(", ")}</b> {rest.length > 1 ? "need" : "needs"} cleaning
            {rest.some((t) => !t.cleaning!.to) && <span className={clsx("block text-[12.5px] text-muted")}>{rest.filter((t) => !t.cleaning!.to).length === rest.length ? "No one assigned yet" : `${rest.filter((t) => !t.cleaning!.to).map((t) => t.name).join(", ")} · no one yet`}</span>}
          </span>
          <span className="text-[13px] font-semibold text-jade">Open</span>
        </Link>
      )}
    </>
  );
}

/** Pings: a table to clean (everyone on tables), and "you were sent to clean T3" (that person). Mounted once in the app frame. */
export function CleanAlerts() {
  const tables = useAllTables();
  const me = useMe();
  const outlets = useOutlets();
  const outletNow = useCurrentOutlet();
  const ready = useFresh("tables");
  const toast = useToast();
  const seen = useRef<Map<string, string> | null>(null); // table id → "since:to"

  useEffect(() => {
    if (!ready || !me) return;
    const key = (t: Table) => (t.cleaning ? `${t.cleaning.since}:${t.cleaning.to ?? ""}` : "");
    if (!seen.current) {
      seen.current = new Map(tables.map((t) => [t.id, key(t)]));
      return;
    }
    const tag = (id?: string) => (outlets.length > 1 && id ? ` · ${outlets.find((o) => o.id === id)?.name ?? ""}` : "");
    let ring = false;
    for (const t of tables) {
      const was = seen.current.get(t.id) ?? "";
      const now = key(t);
      if (was === now) continue;
      seen.current.set(t.id, now);
      const c = t.cleaning;
      if (!c) continue;
      if (!c.to && Date.now() - Date.parse(c.since) > 30 * 60_000) continue; // left long ago: no ping, it's on the list
      if (c.to) {
        // sent to me (by someone else): always, whatever outlet is on screen
        if (c.to === me.id && c.by !== myLabel(me)) {
          const title = `Clean ${t.name}`;
          const body = `${c.by ? `${c.by} sent you` : "You were sent"}${tag(t.outletId)}`;
          pushNotice({ kind: "clean", title, body, href: "/app/tables", outletId: t.outletId });
          notify(title, body);
          toast(`🧽 ${c.by ? `${c.by} sent you to clean` : "Clean"} ${t.name}`);
          ring = true;
        }
      } else if (!was.startsWith(c.since)) {
        // newly left to clean, no one yet: everyone who works the tables in that outlet
        if (!hasPerm(me, "tables") || (t.outletId && !inOutlet(me, t.outletId))) continue;
        if (t.outletId && outletNow.id && t.outletId !== outletNow.id) continue;
        const title = `${t.name} needs cleaning`;
        const body = "Guests left · tap to send someone";
        pushNotice({ kind: "clean", title, body, href: "/app/tables", outletId: t.outletId });
        notify(title, body);
        toast(`🧽 ${t.name} needs cleaning`);
        ring = true;
      }
    }
    if (ring) chime("clean");
  }, [tables, me, outlets, ready, toast, outletNow.id]);
  return null;
}
