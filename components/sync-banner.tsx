"use client";

import { AlertTriangle, CloudOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { dismissFailed, useSyncStatus } from "@/lib/sync-queue";

/**
 * A small bar at the bottom of the screen when changes have not reached the server:
 * amber while they wait for the internet (they save on their own), red when the server
 * refused one (it will not save; someone should check it).
 */
export function SyncBanner() {
  const { waiting, failed } = useSyncStatus();
  const [online, setOnline] = useState(true);
  // only show "waiting" after a moment, so a normal save never flashes the bar
  const [showWaiting, setShowWaiting] = useState(false);

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (!waiting) return setShowWaiting(false);
    const t = window.setTimeout(() => setShowWaiting(true), 1500);
    return () => window.clearTimeout(t);
  }, [waiting]);

  if (failed.length) {
    return (
      <div role="alert" className="pointer-events-none fixed inset-x-0 top-[max(56px,calc(env(safe-area-inset-top)+44px))] z-[190] flex justify-center px-3">
        <div className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-2xl bg-[#B42318] px-4 py-3 text-[14px] text-white shadow-float">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Not saved</div>
            <div className="break-words opacity-90">{failed[0].text}</div>
            {failed.length > 1 && <div className="opacity-75">and {failed.length - 1} more</div>}
          </div>
          <button type="button" onClick={dismissFailed} aria-label="Close" className="-m-1 rounded-full p-1.5 hover:bg-white/15">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }
  if (!showWaiting) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-[max(56px,calc(env(safe-area-inset-top)+44px))] z-[190] flex justify-center px-3">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-2xl bg-[#B54708] px-4 py-3 text-[14px] text-white shadow-float">
        <CloudOff size={18} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-semibold">
            {waiting} change{waiting > 1 ? "s" : ""} waiting to save.
          </span>{" "}
          <span className="opacity-90">{online ? "Saving now…" : "They will save when the internet is back. Keep this screen open."}</span>
        </div>
      </div>
    </div>
  );
}
