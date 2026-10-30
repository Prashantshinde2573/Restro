"use client";

// Add, rename, resize or remove the tables of the outlet on screen.
import clsx from "clsx";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Field, Segmented, Sheet, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useCurrentOutlet } from "@/lib/live";
import { tableActions, useTables } from "@/lib/tables";
import type { Table } from "@/lib/types";

function Count({ value, onChange, min = 1, max = 40, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-sunken p-1">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Minus size={16} /></button>
      <span className="w-9 text-center text-[17px] font-semibold tnum">{value}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface"><Plus size={16} /></button>
    </div>
  );
}

type Draft = { id?: string; name: string; zone: string; seats: number };

export function TableManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const tables = useTables();
  const outlet = useCurrentOutlet();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulk, setBulk] = useState<{ prefix: string; from: number; to: number; zone: string; seats: number } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Table | null>(null);

  const zones = Array.from(new Set(["Indoor", "Outdoor", ...tables.map((t) => t.zone)]));
  const nameTaken = (name: string, id?: string) => tables.some((t) => t.id !== id && t.name.trim().toLowerCase() === name.trim().toLowerCase());
  const nextNumber = () => {
    const nums = tables.map((t) => Number(t.name.replace(/\D/g, ""))).filter((n) => n > 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  };

  const draftErr = draft && (!draft.name.trim() ? "Give the table a name" : nameTaken(draft.name, draft.id) ? `${draft.name.trim()} already exists` : "");
  const bulkNames = bulk ? Array.from({ length: Math.max(0, bulk.to - bulk.from + 1) }, (_, i) => `${bulk.prefix}${bulk.from + i}`) : [];
  const bulkClash = bulkNames.find((n) => nameTaken(n));
  const bulkErr = bulk && (bulk.to < bulk.from ? "The last number must be after the first" : bulkNames.length > 60 ? "Add up to 60 at a time" : bulkClash ? `${bulkClash} already exists` : "");

  const saveDraft = () => {
    if (!draft || draftErr) return;
    if (draft.id) {
      tableActions.edit(draft.id, { name: draft.name, zone: draft.zone, seats: draft.seats });
      toast(`${draft.name.trim()} saved`);
    } else {
      tableActions.add({ ...draft, outletId: outlet.id || undefined });
      toast(`${draft.name.trim()} added`);
    }
    setDraft(null);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={`Tables${outlet.name ? ` · ${outlet.name}` : ""}`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="tinted" onClick={() => setDraft({ name: `T${nextNumber()}`, zone: zones[0], seats: 4 })}><Plus size={16} /> Add a table</Button>
            <Button variant="plain" className="!bg-sunken" onClick={() => { const n = nextNumber(); setBulk({ prefix: "T", from: n, to: n + 9, zone: zones[0], seats: 4 }); }}>Add many</Button>
          </div>
        }
      >
        {tables.length === 0 ? (
          <p className="rounded-group bg-surface p-4 text-[14px] text-muted">No tables in this outlet yet. Add them one by one, or many at once (for example T1 to T12).</p>
        ) : (
          <div className="overflow-hidden rounded-group bg-surface">
            {tables.map((t) => {
              const busy = t.parties.length > 0;
              return (
                <div key={t.id} className="flex items-center gap-3 border-b border-line/80 px-4 py-3 last:border-0">
                  <span className="flex h-10 min-w-10 items-center justify-center rounded-[12px] bg-sunken px-2 text-[15px] font-semibold">{t.name}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-medium">{t.zone}</div>
                    <div className="text-[12.5px] text-muted">{t.seats} seats{busy ? " · guests seated now" : ""}</div>
                  </div>
                  <button aria-label={`Edit ${t.name}`} onClick={() => setDraft({ id: t.id, name: t.name, zone: t.zone, seats: t.seats })} className="flex h-9 w-9 items-center justify-center rounded-full bg-sunken text-ink"><Pencil size={15} /></button>
                  <button
                    aria-label={`Remove ${t.name}`}
                    disabled={busy}
                    title={busy ? "Guests are seated here. Close their bill first." : undefined}
                    onClick={() => setConfirmDel(t)}
                    className={clsx("flex h-9 w-9 items-center justify-center rounded-full", busy ? "bg-sunken text-faint" : "bg-rose/10 text-rose")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 px-1 text-[12.5px] text-faint">Renaming a table keeps its printed QR working. Removing it stops that QR.</p>
      </Sheet>

      {/* one table */}
      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${tables.find((t) => t.id === draft.id)?.name ?? "table"}` : "Add a table"}
        footer={<Button size="lg" className="w-full" disabled={!!draftErr} onClick={saveDraft}>{draftErr || (draft?.id ? "Save" : "Add table")}</Button>}
      >
        {draft && (
          <div className="space-y-4">
            <Field label="Table name" hint="Short, as written on the table: T1, R4, Patio 2…">
              <input className={inputCls} value={draft.name} maxLength={12} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Area">
              <div className="space-y-2">
                <Segmented value={zones.includes(draft.zone) ? draft.zone : "__other"} onChange={(v) => setDraft({ ...draft, zone: v === "__other" ? "" : v })} options={[...zones.map((z) => ({ value: z, label: z })), { value: "__other", label: "Other" }]} />
                {!zones.includes(draft.zone) && <input className={inputCls} placeholder="e.g. Terrace, AC hall" value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })} />}
              </div>
            </Field>
            <div className="flex items-center justify-between rounded-group bg-surface px-4 py-3">
              <span className="text-[15px] font-medium">Seats</span>
              <Count value={draft.seats} onChange={(n) => setDraft({ ...draft, seats: n })} label="seats" />
            </div>
          </div>
        )}
      </Sheet>

      {/* many tables */}
      <Sheet
        open={!!bulk}
        onClose={() => setBulk(null)}
        title="Add many tables"
        footer={
          <Button
            size="lg"
            className="w-full"
            disabled={!!bulkErr}
            onClick={() => {
              if (!bulk || bulkErr) return;
              const n = tableActions.addMany(bulk.prefix.trim(), bulk.from, bulk.to, bulk.zone, bulk.seats, outlet.id || undefined);
              setBulk(null);
              toast(`${n} tables added`);
            }}
          >
            {bulkErr || `Add ${bulkNames.length} tables`}
          </Button>
        }
      >
        {bulk && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Starts with"><input className={inputCls} value={bulk.prefix} maxLength={6} onChange={(e) => setBulk({ ...bulk, prefix: e.target.value })} /></Field>
              <Field label="From"><input className={inputCls} inputMode="numeric" value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
              <Field label="To"><input className={inputCls} inputMode="numeric" value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></Field>
            </div>
            <Field label="Area">
              <div className="space-y-2">
                <Segmented value={zones.includes(bulk.zone) ? bulk.zone : "__other"} onChange={(v) => setBulk({ ...bulk, zone: v === "__other" ? "" : v })} options={[...zones.map((z) => ({ value: z, label: z })), { value: "__other", label: "Other" }]} />
                {!zones.includes(bulk.zone) && <input className={inputCls} placeholder="e.g. Terrace" value={bulk.zone} onChange={(e) => setBulk({ ...bulk, zone: e.target.value })} />}
              </div>
            </Field>
            <div className="flex items-center justify-between rounded-group bg-surface px-4 py-3">
              <span className="text-[15px] font-medium">Seats at each</span>
              <Count value={bulk.seats} onChange={(n) => setBulk({ ...bulk, seats: n })} label="seats" />
            </div>
            {bulkNames.length > 0 && bulkNames.length <= 60 && (
              <p className="px-1 text-[13px] text-muted">Adds {bulkNames.slice(0, 3).join(", ")}{bulkNames.length > 4 ? " … " : bulkNames.length === 4 ? ", " : ""}{bulkNames.length > 3 ? bulkNames[bulkNames.length - 1] : ""}</p>
            )}
          </div>
        )}
      </Sheet>

      {/* confirm remove */}
      <Sheet
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Remove ${confirmDel?.name ?? ""}?`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="plain" className="!bg-sunken" onClick={() => setConfirmDel(null)}>Keep</Button>
            <Button variant="danger" onClick={() => { if (confirmDel) { tableActions.remove(confirmDel.id); toast(`${confirmDel.name} removed`); } setConfirmDel(null); }}>Remove</Button>
          </div>
        }
      >
        <p className="text-[15px] text-muted">The printed QR on {confirmDel?.name} will stop working. Past bills stay in your reports.</p>
      </Sheet>
    </>
  );
}
