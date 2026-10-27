"use client";

import type { ReactNode } from "react";
import { LangProvider } from "@/lib/i18n";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <ToastProvider>{children}</ToastProvider>
    </LangProvider>
  );
}
