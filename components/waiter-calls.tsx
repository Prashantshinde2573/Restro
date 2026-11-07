"use client";

// Waiter calls from the guest's phone ("Call a waiter"):
//   • every waiter in that outlet (and the owner) gets a ping
//   • one taps "I'll go", or the owner / a sub admin sends someone
//   • everyone sees who is going; the waiter taps "Done" at the table
import clsx from "clsx";
import { BellRing, Check, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useReady } from "@/lib/store";
import { inOutlet, type Member } from "@/lib/access";
import { answersCalls, assignsCalls, callActions, liveCalls, useCalls, useCurrentOutlet, useMe, useMembers, useOutlets, type WaiterCall } from "@/lib/live";
import { timeAgo } from "@/lib/format";
import { Avatar, Button, Sheet } from "./ui";
import { useToast } from "./toast";
import { pushNotice } from "./notifications";
import { chime } from "./sound";

export const callWhere = (c: Pick<WaiterCall, "tableName" | "partyId">) =>
  c.tableName && c.tableName !== "Counter" ? `Table ${c.tableName}${c.partyId && c.partyId !== "A" ? ` · ${c.partyId}` : ""}` : "Counter";

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification(title, { body, icon: "/brand/icon-192.png", tag: title + body });
  } catch {}
}

/** Pings for waiter calls (mounted once in the app frame). */
export function CallAlerts() {
  const calls = useCalls();
  const me = useMe();
  const outlets = useOutlets();
  const ready = useReady("calls");
  const toast = useToast();
  const seen = useRef<Map<string, string> | null>(null); // id → "status:to"

  useEffect(() => {
    if (!ready || !me) return;
    const mine = calls.filter((c) => !c.outletId || inOutlet(me, c.outletId));
    const key = (c: WaiterCall) => `${c.status}:${c.to ?? ""}`;
    if (!seen.current) {
      seen.current = new Map(mine.map((c) => [c.id, key(c)]));
      return;
    }
    const tag = (id?: string) => (outlets.length > 1 && id ? ` · ${outlets.find((o) => o.id === id)?.name ?? ""}` : "");
    let ring = false;
    for (const c of liveCalls(mine)) {
      const was = seen.current.get(c.id);
      const now = key(c);
      if (was === now) continue;
      seen.current.set(c.id, now);
      const where = callWhere(c);
      if (c.status === "open" && !was) {
        // a new call: every waiter here, and whoever hands out calls
        if (answersCalls(me, c.outletId) || assignsCalls(me)) {
          const title = `${where} is calling a waiter`;
          const body = `${c.customer ? `${c.customer} · ` : ""}tap “I'll go” so the others know${tag(c.outletId)}`;
          pushNotice({ kind: "call", title, body, href: "/app" });
          notify(title, body);
          toast(`🔔 ${where} is calling a waiter`);
          ring = true;
        }
      } else if (c.status === "taken" && c.to) {
        if (c.to === me.id) {
          if (c.assignedBy) {
            const title = `Go to ${where}`;
            const body = `${c.assignedBy} sent you · the guest called a waiter${tag(c.outletId)}`;
            pushNotice({ kind: "call", title, body, href: "/app" });
            notify(title, body);
            toast(`${c.assignedBy} sent you to ${where}`);
            ring = true;
          }
        } else if (answersCalls(me, c.outletId) || assignsCalls(me)) {
          // everyone else: who is on it (quietly)
          toast(`${c.toName} is going to ${where}`);
        }
      }
    }
    for (const c of mine) if (!seen.current.has(c.id)) seen.current.set(c.id, key(c));
    if (ring) chime("waiter");
  }, [calls, me, outlets, ready, toast]);
  return null;
}

/** Who can be sent to this call. */
function useWaiters(outletId?: string) {
  return useMembers().filter((m) => answersCalls(m, outletId));
}

function AssignSheet({ call, onClose }: { call: WaiterCall | null; onClose: () => void }) {
  const waiters = useWaiters(call?.outletId);
  const me = useMe();
  const toast = useToast();
  return (
    <Sheet open={!!call} onClose={onClose} title={call ? `Who goes to ${callWhere(call)}?` : ""}>
      {call && (
        <div className="overflow-hidden rounded-group bg-surface">
          {waiters.length === 0 && <p className="p-4 text-[14px] text-muted">No one with Tables access in this outlet yet. Give a waiter the “Tables” box in Team.</p>}
          {waiters.map((m: Member) => (
            <button
              key={m.id}
              onClick={() => {
                callActions.assign(call.id, m);
                toast(m.id === me?.id ? `You're going to ${callWhere(call)}` : `${m.name} will go to ${callWhere(call)}`);
                onClose();
              }}
              className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 hover:bg-sunken/40"
            >
              <Avatar name={m.name} hue={m.hue} photo={m.photo} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">{m.name}{m.id === me?.id ? " (you)" : ""}</span>
                <span className="block text-[12.5px] text-muted">{m.role === "owner" ? "Owner" : m.title || "Staff"}</span>
              </span>
              {call.to === m.id && <Check size={17} className="text-jade" />}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** One call: where, how long, who is going, and the buttons. */
function CallCard({ c, onAssign }: { c: WaiterCall; onAssign: (c: WaiterCall) => void }) {
  const me = useMe();
  const toast = useToast();
  const canGo = answersCalls(me, c.outletId);
  const canAssign = assignsCalls(me);
  const mine = c.status === "taken" && c.to === me?.id;
  const where = callWhere(c);
  return (
    <div className={clsx("rounded-[16px] bg-surface p-3", c.status === "open" && "ring-2 ring-saffron/40")}>
      <div className="flex items-start gap-2">
        <BellRing size={17} className={clsx("mt-0.5 shrink-0", c.status === "open" ? "animate-pulse text-saffron" : "text-jade")} />
        <div className="min-w-0 flex-1 text-[14px]">
          <b>{where}</b> {c.status === "open" ? "is calling a waiter" : "called a waiter"}
          <div className="text-[12.5px] text-muted">
            {c.customer ? `${c.customer} · ` : ""}
            {timeAgo(c.at)}
            {c.status === "taken" && (
              <>
                {" · "}
                <span className="font-semibold text-jade">{mine ? "You're going" : `${c.toName} is going`}</span>
                {c.assignedBy ? ` · sent by ${c.assignedBy}` : ""}
              </>
            )}
            {c.status === "open" && " · no one yet"}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {c.status === "open" && canGo && (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              const first = callActions.take(c.id);
              toast(first ? `${first} is already going` : `You're going to ${where}`);
            }}
          >
            I&apos;ll go
          </Button>
        )}
        {(mine || (c.status === "taken" && canAssign)) && (
          <Button size="sm" className="flex-1" variant={mine ? "primary" : "plain"} onClick={() => { callActions.done(c.id); toast(`${where} · done`); }}>
            <Check size={15} /> Done
          </Button>
        )}
        {canAssign && (
          <Button size="sm" variant="plain" className={clsx(!(c.status === "open" && canGo) && !(mine || c.status === "taken") && "flex-1")} onClick={() => onAssign(c)}>
            <UserRound size={15} /> {c.status === "open" ? "Assign" : "Change"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** The calls for this outlet, for "Needs you now". */
export function useOutletCalls() {
  const calls = useCalls();
  const outlet = useCurrentOutlet();
  const me = useMe();
  const live = liveCalls(calls).filter((c) => !c.outletId || !outlet.id || c.outletId === outlet.id);
  return me && (answersCalls(me, outlet.id) || assignsCalls(me)) ? live.slice().reverse() : []; // oldest first
}

export function WaiterCallCards({ calls }: { calls: WaiterCall[] }) {
  const [assign, setAssign] = useState<WaiterCall | null>(null);
  return (
    <>
      {calls.map((c) => (
        <CallCard key={c.id} c={c} onAssign={setAssign} />
      ))}
      <AssignSheet call={assign} onClose={() => setAssign(null)} />
    </>
  );
}

/** A small bar above the tabs on every screen (not home, which has "Needs you now"). */
export function WaiterCallBar() {
  const path = usePathname() ?? "";
  const calls = useOutletCalls();
  const me = useMe();
  const toast = useToast();
  const [assign, setAssign] = useState<WaiterCall | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  if (path === "/app") return null;
  // what needs this person: open calls, then the one they're on
  const c = calls.find((x) => x.status === "open" && !hidden.includes(x.id)) ?? calls.find((x) => x.status === "taken" && x.to === me?.id && !hidden.includes(x.id));
  if (!c) return null;
  const where = callWhere(c);
  const canGo = answersCalls(me, c.outletId);
  const open = c.status === "open";
  const more = calls.filter((x) => x.status === "open").length - (open ? 1 : 0);
  return (
    <>
      <div className="fixed inset-x-3 bottom-[88px] z-40 mx-auto flex max-w-md animate-pop items-center gap-2 rounded-[18px] bg-ink py-2.5 pl-4 pr-2 text-canvas shadow-float lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
        <BellRing size={18} className={clsx("shrink-0", open ? "animate-pulse text-saffron" : "text-jade")} />
        <span className="min-w-0 flex-1 text-[13.5px] leading-tight">
          <b>{where}</b> {open ? "is calling" : "· you're going"}
          {more > 0 && <span className="block text-[11.5px] text-canvas/60">+{more} more calling</span>}
        </span>
        {open && canGo && (
          <button
            onClick={() => {
              const first = callActions.take(c.id);
              toast(first ? `${first} is already going` : `You're going to ${where}`);
            }}
            className="rounded-full bg-canvas px-3 py-1.5 text-[13px] font-semibold text-ink"
          >
            I&apos;ll go
          </button>
        )}
        {open && assignsCalls(me) && (
          <button onClick={() => setAssign(c)} className="rounded-full bg-canvas/15 px-3 py-1.5 text-[13px] font-semibold">
            Assign
          </button>
        )}
        {!open && (
          <button onClick={() => { callActions.done(c.id); toast(`${where} · done`); }} className="rounded-full bg-canvas px-3 py-1.5 text-[13px] font-semibold text-ink">
            Done
          </button>
        )}
        <button onClick={() => setHidden((h) => [...h, c.id])} aria-label="Hide" className="p-1 text-canvas/60"><X size={16} /></button>
      </div>
      <AssignSheet call={assign} onClose={() => setAssign(null)} />
    </>
  );
}
