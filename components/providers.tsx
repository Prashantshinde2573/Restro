"use client";

import { useEffect, type ReactNode } from "react";
import { hydrateStores, sessionActions } from "@/lib/live";
import { startCloud } from "@/lib/cloud";
import { LangProvider } from "@/lib/i18n";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  // Saved data loads after the first paint, so server and client render the
  // same HTML. With Supabase keys set, sign-in is restored and live sync starts.
  useEffect(() => {
    hydrateStores();
    startCloud((s) => {
      if (s.memberId) sessionActions.setMember(s.memberId);
    });
  }, []);
  return (
    <LangProvider>
      <ToastProvider>{children}</ToastProvider>
    </LangProvider>
  );
}
