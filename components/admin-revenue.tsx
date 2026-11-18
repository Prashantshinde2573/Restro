"use client";

// Super admin: Restropi's own subscription revenue (plans × outlets), with plan and status filters.
// Restaurants' own sales are theirs and are not shown here.
import { useState } from "react";
import { Chips, Segmented, Sheet } from "./ui";
import type { AdminRestaurant } from "@/lib/cloud";
import { plans } from "@/lib/plans";
import { inr } from "@/lib/format";

const price = (id: string) => plans.find((p) => p.id === id)?.monthly ?? 0;
const DAY = 86_400_000;

export function RevenueSheet({ open, onClose, list }: { open: boolean; onClose: () => void; list: AdminRestaurant[] }) {
  const [plan, setPlan] = useState<"all" | AdminRestaurant["plan"]>("all");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("active");
  const [sort, setSort] = useState<"revenue" | "renews" | "name">("revenue");

  const shown = list.filter((r) => (plan === "all" || r.plan === plan) && (status === "all" || r.status === status));
  const table = shown
    .map((r) => ({ r, mrr: r.status === "active" && r.plan !== "chain" ? price(r.plan) * Math.max(1, r.outlets) : 0 }))
    .sort((a, b) => (sort === "name" ? a.r.name.localeCompare(b.r.name) : sort === "renews" ? a.r.renewsAt.localeCompare(b.r.renewsAt) : b.mrr - a.mrr));
  const mrr = table.reduce((s, x) => s + x.mrr, 0);
  const now = Date.now();
  const due30 = table.filter((x) => x.r.status === "active" && new Date(x.r.renewsAt).getTime() - now < 30 * DAY);
  const dueAmt = due30.reduce((s, x) => s + x.mrr, 0);
  const planMix = plans.map((p) => ({ p, n: shown.filter((r) => r.plan === p.id && r.status === "active").length, v: table.filter((x) => x.r.plan === p.id).reduce((s, x) => s + x.mrr, 0) }));

  const csv = () => {
    const cell = (v: unknown) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [
      ["Restaurant", "City", "Plan", "Status", "Outlets", "Plan runs until", "Subscription per month (Rs)"],
      ...table.map((x) => [x.r.name, x.r.city, x.r.plan, x.r.status, x.r.outlets, x.r.renewsAt.slice(0, 10), x.mrr]),
      ["Total", "", "", "", "", "", mrr],
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `restropi-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Restropi revenue" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Chips value={plan} onChange={setPlan} options={[{ value: "all", label: "All plans" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]} />
          <Chips value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "all", label: "Any status" }]} />
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-4">
          {[
            ["Per month", inr(mrr), "active plans × outlets"],
            ["Per year", inr(mrr * 12), "if all renew"],
            ["Renewals in 30 days", String(due30.length), due30.length ? `${inr(dueAmt)}/mo to collect` : "none due"],
            ["Paying restaurants", String(table.filter((x) => x.mrr > 0).length), `of ${shown.length} shown`],
          ].map(([l, v, h]) => (
            <div key={l} className="bg-surface p-4">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight tnum">{v}</div>
              <div className="text-[12px] text-faint">{h}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-[12.5px]">
          {planMix.map(({ p, n, v }) => (
            <span key={p.id} className="rounded-full bg-surface px-3 py-1.5 ring-1 ring-line">
              <b>{p.name}</b> · {n} active{p.monthly ? ` · ${inr(v)}/mo` : ""}
            </span>
          ))}
        </div>

        <div className="overflow-hidden rounded-group bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-line/80 px-4 py-2.5">
            <span className="text-[13px] font-semibold text-muted">By restaurant</span>
            <div className="flex items-center gap-2">
              <Segmented value={sort} onChange={setSort} options={[{ value: "revenue", label: "Revenue" }, { value: "renews", label: "Renews" }, { value: "name", label: "A–Z" }]} />
              <button onClick={csv} className="rounded-full bg-sunken px-3 py-1.5 text-[12.5px] font-semibold hover:bg-line">Excel</button>
            </div>
          </div>
          {table.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-muted">No restaurants match.</p>}
          {table.map((x) => (
            <div key={x.r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-b border-line/80 px-4 py-3 last:border-0 sm:grid-cols-[1.6fr_.8fr_.9fr_.9fr]">
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-medium">{x.r.name}</div>
                <div className="truncate text-[12px] text-muted">{x.r.city || "—"} · {x.r.outlets} outlet{x.r.outlets === 1 ? "" : "s"}</div>
              </div>
              <span className="hidden text-[13px] capitalize text-muted sm:block">{x.r.plan}{x.r.status === "suspended" ? " · paused" : ""}</span>
              <span className="hidden text-right text-[13px] text-muted tnum sm:block">till {new Date(x.r.renewsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="text-right text-[14.5px] font-semibold text-jade tnum">{x.mrr ? `${inr(x.mrr)}/mo` : "—"}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-faint">Restropi revenue = plan price × outlets for active restaurants (Chain is priced by hand, so not counted). Restaurants&apos; own sales are not shown here.</p>
      </div>
    </Sheet>
  );
}
