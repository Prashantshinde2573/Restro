"use client";

// Printable table QR cards: each card is 4 × 6 inches (4 wide, 6 tall), one card per page,
// for 4×6 photo paper or a print shop. ?t=<tableId> opens with just that one.
import { hasCounter, hasTables } from "@/lib/access";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Printer, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { ScanQr } from "@/components/qr";
import { Button } from "@/components/ui";
import { useCloud } from "@/lib/cloud";
import { useAccount, useCurrentOutlet } from "@/lib/live";
import { useTables } from "@/lib/tables";

type Item = { id: string; title: string; sub: string; value: string };

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

  const url = (id: string) => `${origin}/order/${id}${cloud.rid ? `?r=${cloud.rid}` : ""}`;
  const counterUrl = `${origin}/order/counter?${cloud.rid ? `r=${cloud.rid}&` : ""}o=${outlet.id}`;
  const items: Item[] = [
    ...(hasCounter(outlet) ? [{ id: "counter", title: "Order here", sub: "Counter", value: counterUrl }] : []),
    ...all.map((t) => ({ id: t.id, title: t.name, sub: "Table", value: url(t.id) })),
  ];
  const shown = only ? items.filter((i) => i.id === only) : items;

  /** Print one card on its own, then come back to the full list. */
  const printOne = (id: string) => {
    setOnly(id);
    window.history.replaceState(null, "", `?t=${encodeURIComponent(id)}`);
    window.setTimeout(() => window.print(), 300);
  };
  const showAll = () => {
    setOnly(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/app/tables" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunken" aria-label="Back"><ChevronLeft size={22} /></Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-semibold tracking-tight">{only ? "Print one QR" : "QR codes"}</h1>
            <p className="truncate text-[13px] text-muted">
              {account.name}{outlet.name ? ` · ${outlet.name}` : ""} · {only ? "1 card" : `${shown.length} cards`} · 4 × 6 inch, one per page
            </p>
          </div>
          {only ? (
            <>
              <Button variant="tinted" onClick={showAll}>Show all</Button>
              <Button onClick={() => window.print()} disabled={!origin}><Printer size={16} /> Print this QR</Button>
            </>
          ) : (
            <Button onClick={() => window.print()} disabled={!origin || !shown.length}><Printer size={16} /> Print all ({shown.length})</Button>
          )}
        </div>
      </header>

      {!only && shown.length > 1 && (
        <p className="mx-auto max-w-5xl px-5 pt-4 text-[13.5px] text-muted print:hidden">Need just one? Tap <b className="text-ink">Print this</b> under that card.</p>
      )}

      <main className={clsx("qr-sheet mx-auto px-5 pb-12 pt-4", only ? "qr-single max-w-md" : "grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3")}>
        {origin &&
          shown.map((i) => (
            <div key={i.id} className="qr-cell flex flex-col items-center gap-2">
              <Card item={i} brand={account.name} outlet={outlet.name} logo={account.logo} />
              {!only && (
                <button onClick={() => printOne(i.id)} className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-[14px] font-semibold text-jade ring-1 ring-line hover:bg-jade-soft print:hidden">
                  <Printer size={15} /> Print this
                </button>
              )}
            </div>
          ))}
        {!all.length && hasTables(outlet) && (
          <p className="col-span-full rounded-group bg-surface p-6 text-center text-muted print:hidden">No tables yet. Add them in Tables → Manage tables.</p>
        )}
      </main>

      <style>{`
        .qr-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          /* one 4 × 6 inch card per page (4 wide, 6 tall) */
          @page { size: 4in 6in; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; }
          .qr-sheet { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .qr-cell { display: block !important; width: 4in; height: 6in; overflow: hidden; break-after: page; page-break-after: always; break-inside: avoid; }
          .qr-cell:last-child { break-after: auto; page-break-after: auto; }
          .qr-card { width: 4in !important; height: 6in !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; outline: none !important; }
        }
      `}</style>
    </div>
  );
}

/** One table card: brand band, table name, QR in a frame, three steps, footer. */
function Card({ item, brand, outlet, logo }: { item: Item; brand: string; outlet?: string; logo?: string }) {
  const initials = (brand || "R").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="qr-card relative flex w-full max-w-[340px] flex-col overflow-hidden rounded-[22px] bg-white text-center shadow-[0_10px_40px_-12px_rgba(14,122,95,.35)] ring-1 ring-black/5 print:max-w-none print:rounded-[5mm]">
      {/* brand band */}
      <div className="relative flex shrink-0 items-center gap-3 overflow-hidden bg-[#0E7A60] px-5 py-4 text-left text-white" style={{ backgroundImage: "radial-gradient(120% 140% at 100% 0%, #18a07f 0%, #0E7A60 45%, #0a5a47 100%)" }}>
        <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute right-10 top-10 h-10 w-10 rounded-full bg-white/10" />
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="relative h-11 w-11 shrink-0 rounded-full bg-white object-contain p-1" />
        ) : (
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#0E7A60]">{initials}</span>
        )}
        <div className="relative min-w-0">
          <div className="truncate text-[17px] font-semibold leading-tight">{brand || "Your restaurant"}</div>
          {outlet && <div className="truncate text-[12px] text-white/75">{outlet}</div>}
        </div>
      </div>

      {/* table name */}
      <div className="flex flex-1 flex-col items-center px-5 pt-4 print:justify-evenly print:pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0E7A60]">{item.sub}</div>
        <div className="mt-0.5 max-w-full truncate text-[40px] font-bold leading-none tracking-tight text-[#14201C]">{item.title}</div>

        {/* QR in a framed box with corner marks */}
        <div className="relative mt-4 rounded-[18px] bg-[#f1f7f4] p-3">
          {(["left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[14px]", "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[14px]", "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-[14px]", "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-[14px]"] as const).map((c) => (
            <span key={c} className={clsx("absolute h-7 w-7 border-[#0E7A60]", c)} />
          ))}
          <div className="rounded-[10px] bg-white p-1.5">
            <ScanQr value={item.value} size={176} label={`${item.sub} ${item.title} QR`} className="block h-auto w-[176px] print:w-[2.35in]" />
          </div>
        </div>

        <div className="mt-4 text-[17px] font-semibold leading-snug text-[#14201C] print:text-[19px]">Scan to see the menu & order</div>

        {/* three steps */}
        <div className="mb-4 mt-4 grid w-full grid-cols-3 gap-1.5 print:mb-3 print:mt-2">
          {["Scan", "Order", "Pay by UPI"].map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1 rounded-[12px] bg-[#f4f6f5] px-1 py-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0E7A60] text-[12px] font-bold text-white">{i + 1}</span>
              <span className="text-[12px] font-semibold leading-tight text-[#14201C]">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <div className="mt-auto flex shrink-0 items-center justify-center gap-1.5 border-t border-dashed border-[#dfe5e2] px-5 py-2.5 text-[10.5px] text-[#8b938f]">
        <QrCode size={11} /> No app needed · Powered by <b className="font-semibold text-[#0E7A60]">Restropi</b>
      </div>
    </div>
  );
}
