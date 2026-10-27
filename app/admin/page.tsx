"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Wordmark } from "@/components/shell";
import { Bars, Button, Chips, Field, Group, Pill, Segmented, Sheet, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { repo } from "@/lib/repo";
import { compactInr, inr } from "@/lib/format";
import type { Tenant } from "@/lib/types";

type F = "all" | Tenant["status"];
const tone = { active: "jade", trial: "sky", "past-due": "saffron", cancelled: "neutral" } as const;
const label = { active: "Paying", trial: "Trial", "past-due": "Payment due", cancelled: "Cancelled" } as const;

const mrrHistory = [
  { m: "May", v: 18200 },
  { m: "Jun", v: 24900 },
  { m: "Jul", v: 31400 },
  { m: "Aug", v: 38800 },
  { m: "Sep", v: 46100 },
  { m: "Oct", v: 51493 },
];

export default function AdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"restaurants" | "plans">("restaurants");
  const [f, setF] = useState<F>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Tenant | null>(null);
  const tenants = repo.tenants();
  const plans = repo.plans();

  const mrr = tenants.reduce((s, t) => s + t.mrr, 0);
  const shown = useMemo(() => tenants.filter((t) => (f === "all" || t.status === f) && (!q || `${t.name} ${t.city}`.toLowerCase().includes(q.toLowerCase()))), [tenants, f, q]);
  const count = (s: F) => (s === "all" ? tenants.length : tenants.filter((t) => t.status === s).length);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:px-6">
          <Wordmark className="text-[18px]" />
          <Pill tone="saffron">Admin</Pill>
          <Link href="/app" className="ml-auto text-[14px] font-semibold text-jade">Open restaurant app</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-8 lg:px-6">
        <div>
          <h1 className="large-title">Your business</h1>
          <p className="mt-1 text-[15px] text-muted">Every restaurant on Restro, their plans and payments.</p>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-group bg-line/70 lg:grid-cols-5">
          {[
            ["Monthly revenue", inr(mrr), "+11.7% vs Sep"],
            ["Paying restaurants", String(count("active")), `${tenants.filter((t) => t.status === "active").reduce((s, t) => s + t.outlets, 0)} outlets`],
            ["On trial", String(count("trial")), "62% usually convert"],
            ["Payment due", String(count("past-due")), compactInr(tenants.filter((t) => t.status === "past-due").reduce((s, t) => s + t.mrr, 0)) + " at risk"],
            ["Orders today", tenants.reduce((s, t) => s + t.ordersToday, 0).toLocaleString("en-IN"), "across all outlets"],
          ].map(([l, v, n]) => (
            <div key={l} className="bg-surface p-4">
              <div className="text-[13px] text-muted">{l}</div>
              <div className="mt-1 text-[24px] font-semibold tracking-tight tnum">{v}</div>
              <div className="text-[12.5px] text-muted">{n}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Group title="Monthly revenue">
            <Bars data={mrrHistory.map((m) => ({ label: m.m, value: m.v }))} height={160} highlightLast format={(n) => inr(n)} />
          </Group>
          <Group title="Plan mix" flush>
            {(["Starter", "Growth", "Pro", "Chain"] as const).map((p) => {
              const list = tenants.filter((t) => t.plan === p && t.status !== "cancelled");
              return (
                <div key={p} className="flex items-center justify-between border-b border-line/80 px-4 py-3 last:border-0 lg:px-5">
                  <span className="text-[15px] font-medium">{p}</span>
                  <span className="text-[14px] text-muted tnum">{list.length} · {inr(list.reduce((s, t) => s + t.mrr, 0))}</span>
                </div>
              );
            })}
          </Group>
        </div>

        <Segmented value={tab} onChange={setTab} options={[{ value: "restaurants", label: "Restaurants" }, { value: "plans", label: "Plans and prices" }]} />

        {tab === "restaurants" ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative lg:w-80">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search restaurant or city" className="h-11 w-full rounded-ctl bg-surface pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-jade" />
              </div>
              <Chips value={f} onChange={setF} options={(["all", "active", "trial", "past-due", "cancelled"] as F[]).map((s) => ({ value: s, label: s === "all" ? "All" : label[s], count: count(s) }))} />
            </div>
            <Group flush>
              {shown.map((t) => (
                <button key={t.id} onClick={() => setSel(t)} className="flex w-full items-center gap-3 border-b border-line/80 px-4 py-3.5 text-left last:border-0 hover:bg-sunken/40 lg:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-sunken text-[13px] font-bold">{t.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{t.name}</div>
                    <div className="truncate text-[13px] text-muted">{t.city} · {t.plan} · {t.outlets} outlet{t.outlets > 1 ? "s" : ""} · since {t.since}</div>
                  </div>
                  <div className="hidden w-28 text-right text-[13px] text-muted sm:block tnum">{t.ordersToday} orders today</div>
                  <div className="flex w-24 flex-col items-end gap-1">
                    <span className="text-[14.5px] font-semibold tnum">{t.mrr ? inr(t.mrr) : "—"}</span>
                    <Pill tone={tone[t.status]}>{label[t.status]}</Pill>
                  </div>
                </button>
              ))}
            </Group>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => (
              <Group key={p.id}>
                <div className="text-[17px] font-semibold">{p.name}</div>
                <div className="mt-3 space-y-3">
                  <Field label="Monthly (₹ per outlet)"><input className={inputCls} defaultValue={p.monthly ?? ""} placeholder="Custom" /></Field>
                  <Field label="Yearly (₹ per outlet)"><input className={inputCls} defaultValue={p.yearly ?? ""} placeholder="Custom" /></Field>
                  <div className="text-[13px] text-muted">{p.features.length} features · {p.outlets}</div>
                </div>
              </Group>
            ))}
            <div className="md:col-span-2 xl:col-span-4">
              <Button onClick={() => toast("Prices saved · new signups see them now")}>Save prices</Button>
              <span className="ml-3 text-[13px] text-muted">Existing customers keep their price until renewal.</span>
            </div>
          </div>
        )}
      </main>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Pill tone={tone[sel.status]}>{label[sel.status]}</Pill><span className="text-[14px] text-muted">{sel.city}</span></div>
            <div className="overflow-hidden rounded-group bg-surface">
              {[["Plan", `${sel.plan} · ${sel.outlets} outlets`], ["Paying", sel.mrr ? `${inr(sel.mrr)} / month` : "—"], ["Customer since", sel.since], ["Orders today", String(sel.ordersToday)], ["Owner", "+91 98xxx xxxxx"]].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-line/80 px-4 py-3 text-[14.5px] last:border-0"><span className="text-muted">{l}</span><span className="font-medium">{v}</span></div>
              ))}
            </div>
            <div className="grid gap-2">
              {sel.status === "trial" && <Button onClick={() => { setSel(null); toast("Trial extended by 7 days"); }}>Extend trial by 7 days</Button>}
              {sel.status === "past-due" && <Button onClick={() => { setSel(null); toast("Payment reminder sent on WhatsApp"); }}>Send payment reminder</Button>}
              <Button variant="plain" onClick={() => toast("Plan change opened")}>Change plan</Button>
              <Button variant="plain" onClick={() => toast("Support view opened (read-only)")}>Open as support (read-only)</Button>
              <Button variant="danger" onClick={() => toast("Account paused")}>Pause account</Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
