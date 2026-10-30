"use client";

// Printable table QR cards (A4: 2 x 3 per page). ?t=<tableId> prints one.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { ScanQr } from "@/components/qr";
import { Button } from "@/components/ui";
import { useCloud } from "@/lib/cloud";
import { useAccount, useCurrentOutlet } from "@/lib/live";
import { useTables } from "@/lib/tables";

export default function PrintTables() {
  const cloud = useCloud();
  const router = useRouter();
  const account = useAccount();
  const outlet = useCurrentOutlet();
  const all = useTables();
  const [only, setOnly] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setOnly(new URLSearchParams(window.location.search).get("t"));
  }, []);
  useEffect(() => {
    if (cloud.status === "signedOut") router.replace("/login");
  }, [cloud.status, router]);

  const tables = only ? all.filter((t) => t.id === only) : all;
  const url = (id: string) => `${origin}/order/${id}${cloud.rid ? `?r=${cloud.rid}` : ""}`;
  const counterUrl = `${origin}/order/counter?${cloud.rid ? `r=${cloud.rid}&` : ""}o=${outlet.id}`;
  const cafe = outlet.businessType === "cafe";

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <header className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-4 print:hidden">
        <Link href="/app/tables" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunken" aria-label="Back"><ChevronLeft size={22} /></Link>
        <div className="flex-1">
          <h1 className="text-[20px] font-semibold tracking-tight">QR codes</h1>
          <p className="text-[13px] text-muted">{account.name}{outlet.name ? ` · ${outlet.name}` : ""} · {tables.length + (cafe && !only ? 1 : 0)} to print</p>
        </div>
        <Button onClick={() => window.print()} disabled={!origin}><Printer size={16} /> Print</Button>
      </header>

      <main className="mx-auto grid max-w-4xl grid-cols-2 gap-4 px-5 pb-10 print:max-w-none print:gap-0 print:p-0 sm:grid-cols-3">
        {cafe && !only && origin && (
          <Card title="Order here" sub="Counter" brand={account.name} value={counterUrl} />
        )}
        {origin && tables.map((t) => <Card key={t.id} title={t.name} sub="Table" brand={account.name} value={url(t.id)} />)}
        {!tables.length && !cafe && <p className="col-span-full rounded-group bg-surface p-6 text-center text-muted">No tables yet. Add them in Tables → Manage tables.</p>}
      </main>
      <style>{`@media print { @page { size: A4; margin: 10mm; } }`}</style>
    </div>
  );
}

function Card({ title, sub, brand, value }: { title: string; sub: string; brand: string; value: string }) {
  return (
    <div className="flex break-inside-avoid flex-col items-center rounded-group bg-surface p-5 text-center print:m-[3mm] print:rounded-none print:border print:border-black/20">
      <div className="text-[13px] font-medium text-muted">{brand}</div>
      <div className="mt-1 text-[12px] uppercase tracking-wider text-faint">{sub}</div>
      <div className="text-[34px] font-semibold leading-tight tracking-tight">{title}</div>
      <div className="my-3 rounded-[12px] bg-white p-2"><ScanQr value={value} size={170} label={`${sub} ${title} QR`} /></div>
      <div className="text-[14px] font-semibold">Scan to see the menu and order</div>
      <div className="text-[12px] text-muted">Pay by UPI from your phone</div>
    </div>
  );
}
