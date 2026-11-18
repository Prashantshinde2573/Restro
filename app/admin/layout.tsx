import type { Metadata } from "next";

// Not for search engines.
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
