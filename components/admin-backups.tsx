"use client";

// Super admin: every restaurant's nightly backup files (kept 30 days), with download links.
import { useEffect, useState } from "react";
import { Button, Sheet } from "./ui";
import { adminBackups, type BackupList } from "@/lib/cloud";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function BackupsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<BackupList[] | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setErr("");
    adminBackups()
      .then((r) => setRows(r as BackupList[]))
      .catch((e: Error) => setErr(e.message));
  };
  useEffect(() => {
    if (open) load();
  }, [open]);

  const runNow = async () => {
    setBusy(true);
    setNote("");
    setErr("");
    try {
      const r = (await adminBackups("run")) as { saved: number; failed: { rid: string; reason: string }[] };
      setNote(`Backed up ${r.saved} restaurant${r.saved === 1 ? "" : "s"}${r.failed.length ? `. Failed: ${r.failed.map((f) => f.rid).join(", ")}` : "."}`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Backups" wide>
      <div className="space-y-3">
        <p className="text-[14px] text-muted">Every night at 3 AM each restaurant&apos;s data is saved to its own file, kept 30 days. On Sundays a copy is also emailed to you. Menu photos are not in these files.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="tinted" onClick={runNow} disabled={busy}>{busy ? "Backing up…" : "Back up now"}</Button>
          <Button size="sm" variant="tinted" onClick={load}>Refresh</Button>
        </div>
        {note && <p className="text-[14px] font-medium text-jade">{note}</p>}
        {err && <p className="text-[14px] font-medium text-[#B42318]">{err}</p>}
        {!rows && !err && <p className="text-[14px] text-muted">Loading…</p>}
        <ul className="divide-y divide-line/70">
          {rows?.map((r) => (
            <li key={r.rid} className="py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <span className="text-[13px] text-muted">{r.files.length ? `Last: ${r.files[0].date}` : "No backup yet"}</span>
              </div>
              {!!r.files.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.files.slice(0, 7).map((f) =>
                    f.url ? (
                      <a key={f.date} href={f.url} className="rounded-full bg-black/[.05] px-3 py-1.5 text-[13px] font-medium hover:bg-black/[.09]">
                        {f.date} · {kb(f.size)}
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
