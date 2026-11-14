"use client";

// Super admin: problems the app reported from every restaurant — crashes, and
// changes the server refused to save. Newest first.
import { useEffect, useState } from "react";
import { Button, Sheet } from "./ui";
import { adminClearErrors, adminErrors, type AppError } from "@/lib/cloud";
import { timeAgo } from "@/lib/format";

export function ErrorsSheet({ open, onClose, names }: { open: boolean; onClose: () => void; names: Record<string, string> }) {
  const [rows, setRows] = useState<AppError[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setErr("");
    adminErrors()
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  };
  useEffect(() => {
    if (open) load();
  }, [open]);

  const clear = async () => {
    setBusy(true);
    try {
      await adminClearErrors();
      setRows([]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="App errors" wide>
      <div className="space-y-3">
        <p className="text-[14px] text-muted">Crashes on a phone, and changes the server refused to save. Each restaurant sends at most 30 an hour.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="tinted" onClick={load}>Refresh</Button>
          {!!rows?.length && (
            <Button size="sm" variant="tinted" onClick={clear} disabled={busy}>Clear all</Button>
          )}
        </div>
        {err && <p className="text-[14px] font-medium text-[#B42318]">{err}</p>}
        {!rows && !err && <p className="text-[14px] text-muted">Loading…</p>}
        {rows && !rows.length && <p className="text-[14px] text-muted">No errors reported.</p>}
        <ul className="divide-y divide-line/70">
          {rows?.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-muted">
                <span className="font-semibold text-ink">{r.kind === "save-refused" ? "Not saved" : r.kind === "crash" ? "Crash" : r.kind}</span>
                <span>{(r.rid && names[r.rid]) || r.rid || "—"}</span>
                <span>· {r.role ?? "?"}</span>
                <span>· {timeAgo(r.at)}</span>
                {typeof r.context?.page === "string" && <span>· {r.context.page}</span>}
              </div>
              <div className="mt-1 break-words text-[14px]">{r.message}</div>
              {typeof r.context?.what === "string" && <div className="text-[13px] text-muted">{r.context.what}</div>}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
