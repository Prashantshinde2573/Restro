"use client";

import { useEffect, type ReactNode } from "react";
import { hydrateStores, sessionActions } from "@/lib/live";
import { emailLink, startCloud } from "@/lib/cloud";
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
    // An expired email link can land on any page: explain it on the login screen.
    if (emailLink === "expired" && window.location.pathname !== "/login") window.location.replace("/login?link=expired");
  }, []);
  return (
    <LangProvider>
      <ToastProvider>{children}</ToastProvider>
    </LangProvider>
  );
}
