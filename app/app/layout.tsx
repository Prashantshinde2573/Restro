import type { Metadata } from "next";
import { AppShell } from "@/components/shell";

// The app itself: signed-in screens, never in search results.
export const metadata: Metadata = { title: "App", robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
