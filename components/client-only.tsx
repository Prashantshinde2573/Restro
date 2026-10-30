"use client";

import { useEffect, useState, type ReactNode } from "react";

// Live restaurant screens depend on the current time and (later) on
// Firestore listeners, so they render in the browser only.
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready && fallback !== undefined) return <>{fallback}</>;
  if (!ready)
    return (
      <div className="px-4 pt-6 lg:px-10 lg:pt-10" aria-busy="true">
        <div className="h-9 w-56 animate-pulse rounded-ctl bg-sunken" />
        <div className="mt-6 h-40 animate-pulse rounded-group bg-sunken" />
      </div>
    );
  return <>{children}</>;
}
