"use client";

import { L } from "@/lib/i18n";
import clsx from "clsx";
import { Building2, Check, Coffee, Copy, Link2, Lock, MessageCircle, Store, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, Chips, Field, Hint, Group, Page, PageHeader, Pill, Segmented, Sheet, Toggle, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { isValidUpi } from "@/components/upi";
import {
  ALL_PERMS,
  FEATURES,
  MEMBER_LIMIT,
  OUTLET_LIMIT,
  PERM_GROUPS,
  PLAN_NAME,
  PRESETS,
  assignableOutlets,
  canManage,
  featureState,
  outletKinds,
  grantable,
  inOutlet,
  isOwner,
  type Member,
  type Perm,
  isMixed,
} from "@/lib/access";
import { mainOutletId, memberActions, menuActions, menuFor, outletActions, useAccount, useAllMenu, useMe, useMembers, useOutlets } from "@/lib/live";
import { setStaffPin, useCloud } from "@/lib/cloud";
import { tableActions, useAllTables } from "@/lib/tables";
import type { BusinessType, Outlet } from "@/lib/types";

const typeLabel = (t: BusinessType) => (t === "cafe" ? "Café" : "Restaurant");
const roleLabel = (m: Member) => (m.role === "owner" ? "Owner" : m.role === "subadmin" ? "Sub admin" : "Staff");

function Check2({ on, disabled, onClick, label, note }: { on: boolean; disabled?: boolean; onClick: () => void; label: string; note?: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={clsx("flex w-full items-center gap-3 px-4 py-2.5 text-left", disabled ? "cursor-not-allowed opacity-50" : "hover:bg-sunken/40")}
    >
      <span className={clsx("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 transition", on ? "border-jade bg-jade text-white" : "border-line bg-surface")}>
        {on && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="flex-1 text-[14.5px]">{label}</span>
      {note && <span className="flex items-center gap-1 text-[12px] font-medium text-faint">{disabled && <Lock size={11} />}{note}</span>}
    </button>
  );
}

type Draft = Member & { isNew?: boolean };

export default function AccessPage() {
  const toast = useToast();
  const me = useMe();
  const owner = isOwner(me);
  const account = useAccount();
  const outlets = useOutlets();
  const members = useMembers();
  const myOutlets = outlets.filter((o) => inOutlet(me, o.id));
  const [filter, setFilter] = useState<string>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pin, setPin] = useState("");
  const cloud = useCloud();
  const [outletDraft, setOutletDraft] = useState<(Outlet & { isNew?: boolean }) | null>(null);

  const outletName = (id: string) => outlets.find((o) => o.id === id)?.name ?? id;
  const shown = useMemo(
    () =>
      members
        .filter((m) => (filter === "all" ? m.role === "owner" || m.outletIds.some((o) => myOutlets.some((x) => x.id === o)) : m.role === "owner" || m.outletIds.includes(filter)))
        .sort((a, b) => ["owner", "subadmin", "staff"].indexOf(a.role) - ["owner", "subadmin", "staff"].indexOf(b.role) || a.name.localeCompare(b.name)),
    [members, filter, myOutlets],
  );
  const staffCount = members.filter((m) => m.role !== "owner").length;
  const memberLimit = MEMBER_LIMIT[account.plan];
  const outletLimit = OUTLET_LIMIT[account.plan];

  /* ---------------- member editor ---------------- */
  const openNew = () => {
    if (staffCount >= memberLimit) {
      toast(L("{0} allows {1} staff logins. Upgrade for more.", PLAN_NAME[account.plan], memberLimit));
      return;
    }
    const firstOutlet = filter !== "all" ? filter : myOutlets[0]?.id;
    setConfirmRemove(false);
    setPin("");
    setDraft({ id: `m${Date.now()}`, name: "", phone: "", role: "staff", title: "", outletIds: firstOutlet ? [firstOutlet] : [], perms: [], active: true, hue: Math.floor(Math.random() * 360), isNew: true });
  };
  const allowedPerms = grantable(me);
  const assignable = assignableOutlets(me, outlets.map((o) => o.id));
  // per outlet: the ways it serves guests (a mixed outlet runs both)
  const draftKinds = draft ? outlets.filter((o) => draft.outletIds.includes(o.id)).map(outletKinds) : [];
  const draftTypes = [...new Set(draftKinds.flat())];
  const permState = (p: Perm): { disabled: boolean; note?: string } => {
    if (!allowedPerms.includes(p)) return { disabled: true, note: "You don't have this" };
    const f = PERM_GROUPS.flatMap((g) => g.perms).find((x) => x.key === p)?.feature;
    if (f && draftTypes.length) {
      const states = draftKinds.map((k) => featureState(f, account.plan, k));
      if (states.every((s) => s === "type")) return { disabled: true, note: "Outlets with tables only" };
      if (states.every((s) => s !== "ok")) return { disabled: true, note: `${PLAN_NAME[FEATURES[f].plan]} plan` };
    }
    return { disabled: false };
  };
  const togglePerm = (p: Perm) => draft && setDraft({ ...draft, perms: draft.perms.includes(p) ? draft.perms.filter((x) => x !== p) : [...draft.perms, p] });
  const applyPreset = (name: string, perms: Perm[]) => draft && setDraft({ ...draft, title: name, perms: perms.filter((p) => !permState(p).disabled) });
  const phoneDigits = draft?.phone.replace(/\D/g, "") ?? "";
  // staff sign in with mobile + PIN, so two people here can't share a number
  const takenBy = draft && phoneDigits.length === 10 ? members.find((m) => m.id !== draft.id && m.role !== "owner" && (m.phone ?? "").replace(/\D/g, "").slice(-10) === phoneDigits) : undefined;
  const phoneTaken = !!takenBy;
  // the number belongs to someone turned off: offer to bring that person back instead
  const reopen = (m: Member) => {
    setConfirmRemove(false);
    setPin("");
    setDraft({ ...m, active: true });
    toast(L("{0} is back on · set a PIN and save", m.name));
  };
  const phoneOk = phoneDigits.length === 10 && !phoneTaken;
  const pinOk = !cloud.rid || (draft?.isNew ? /^\d{4}$/.test(pin) : pin === "" || /^\d{4}$/.test(pin));
  const draftOk = !!draft && draft.name.trim().length > 1 && phoneOk && draft.outletIds.length > 0 && (draft.role === "subadmin" || draft.perms.length > 0) && pinOk;

  const staffLink = typeof window !== "undefined" && cloud.rid ? `${window.location.origin}/login?r=${cloud.rid}` : "";
  const inviteText = (name?: string) =>
    [`Hi${name ? ` ${name.split(" ")[0]}` : ""},`, "", `Sign in to *${account.name || "our restaurant"}* on Restropi:`, staffLink, "", "Open the link, tap *Staff*, then enter your mobile number and 4-digit PIN. It works on any phone or tablet."].join("\n");
  const [inviteFor, setInviteFor] = useState<{ name: string; phone: string } | null>(null);
  const save = () => {
    if (!draft || !draftOk) return;
    const { isNew, ...m } = draft;
    const digits = m.phone.replace(/\D/g, "");
    if (cloud.rid && pin) {
      const rid = cloud.rid;
      const savePin = (tries: number): Promise<void> =>
        setStaffPin(rid, m.id, pin).catch((e: Error) => (tries > 0 ? new Promise((res) => setTimeout(res, 800)).then(() => savePin(tries - 1)) : Promise.reject(e)));
      savePin(4).then(() => toast(L("PIN saved for {0}", m.name.trim()))).catch((e: Error) => toast(e.message));
    }
    setPin("");
    memberActions.save({ ...m, name: m.name.trim(), phone: `${digits.slice(0, 5)} ${digits.slice(5)}`, title: m.title.trim() || (m.role === "subadmin" ? "Outlet manager" : "Staff"), perms: m.perms.filter((p) => !permState(p).disabled) });
    setDraft(null);
    toast(isNew ? `${m.name.trim()} added · send them the sign-in link` : "Access saved");
    if (isNew && staffLink && digits.length === 10) setInviteFor({ name: m.name.trim(), phone: digits });
  };

  /* ---------------- outlet editor ---------------- */
  const openNewOutlet = () => {
    if (outlets.length >= outletLimit) {
      toast(L("{0} allows {1} outlet{2}. Upgrade to add more.", PLAN_NAME[account.plan], outletLimit, outletLimit > 1 ? "s" : ""));
      return;
    }
    setOutletDraft({ id: "", name: "", address: "", businessType: "restaurant", mixed: true, upi: "", payFirst: false, isNew: true });
    setCopyMenuFrom(menuSources[0]?.id ?? "");
  };
  const outletOk = !!outletDraft && outletDraft.name.trim().length > 1 && isValidUpi(outletDraft.upi);
  // a new outlet starts with a copy of another outlet's menu (the first outlet by default) or empty
  const allMenu = useAllMenu();
  const menuMain = mainOutletId(outlets);
  const menuSources = outlets
    .map((o) => ({ id: o.id, name: o.name, dishes: menuFor(allMenu, o, menuMain).length }))
    .filter((o) => o.dishes > 0)
    .sort((a, b) => (a.id === menuMain ? -1 : b.id === menuMain ? 1 : 0));
  const [copyMenuFrom, setCopyMenuFrom] = useState<string>("");
  // delete an outlet: the owner types its name to be sure
  const allTables = useAllTables();
  const [delName, setDelName] = useState<string | null>(null);
  const deleteOutlet = () => {
    if (!outletDraft || outletDraft.isNew) return;
    const why = outletActions.removeProblem(outletDraft.id);
    if (why) return toast(why);
    const busy = allTables.filter((t) => t.outletId === outletDraft.id && t.parties.length).length;
    if (busy) return toast(L("{0} table{1} guests. Free {2} first.", busy, busy === 1 ? " has" : "s have", busy === 1 ? "it" : "them"));
    allTables.filter((t) => t.outletId === outletDraft.id).forEach((t) => tableActions.remove(t.id));
    if (outletActions.remove(outletDraft.id)) toast(L("{0} deleted", outletDraft.name));
    setDelName(null);
    setOutletDraft(null);
  };
  const saveOutlet = () => {
    if (!outletDraft || !outletOk) return;
    const { isNew, id, ...o } = outletDraft;
    if (isNew) {
      const created = outletActions.add({ ...o, name: o.name.trim(), upi: o.upi.trim() });
      const n = copyMenuFrom ? menuActions.copyMenu(copyMenuFrom, created.id) : 0;
      toast(L("{0} created{1} · add its sub admin and staff next", created.name, n ? ` with ${n} dishes` : ""));
    } else {
      outletActions.update(id, { ...o, name: o.name.trim(), upi: o.upi.trim() });
      toast(L("Outlet saved"));
    }
    setOutletDraft(null);
  };

  return (
    <>
      <PageHeader
        title={L("Members & access")}
        subtitle={owner ? L("{0} outlets · {1} people", outlets.length, staffCount) : L("Your outlet{0}: {1}", myOutlets.length > 1 ? "s" : "", myOutlets.map((o) => o.name).join(", "))}
        actions={<Button size="sm" onClick={openNew}><UserPlus size={16} /> {L("Add member")}</Button>}
      />
      <Page className="space-y-6">
        {/* ---------- how staff sign in ---------- */}
        {cloud.rid && (
          <section className="flex flex-col gap-3 rounded-group bg-surface p-4 ring-1 ring-line/70 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-jade-soft text-jade"><Link2 size={19} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{L("Staff sign-in link")}</div>
              <p className="text-[13px] text-muted">{L("Send it to your staff once. On any phone or tablet they sign in with their mobile number and 4-digit PIN.")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button size="sm" variant="tinted" onClick={() => { navigator.clipboard?.writeText(staffLink).then(() => toast(L("Link copied")), () => toast(staffLink)); }}><Copy size={15} /> {L("Copy")}</Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(inviteText())}`} target="_blank" rel="noreferrer"><Button size="sm" className="w-full"><MessageCircle size={15} /> {L("WhatsApp")}</Button></a>
            </div>
          </section>
        )}

        {/* ---------- outlets (owner) ---------- */}
        {owner && (
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-[17px] font-semibold">{L("Outlets")}</h2>
              <span className="text-[13px] text-muted tnum">{outlets.length} {L("of")} {outletLimit === Infinity ? "unlimited" : outletLimit} {L("on")} {PLAN_NAME[account.plan]}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {outlets.map((o) => {
                const subs = members.filter((m) => m.role === "subadmin" && m.outletIds.includes(o.id));
                const n = members.filter((m) => m.role !== "owner" && m.outletIds.includes(o.id)).length;
                return (
                  <button key={o.id} onClick={() => setOutletDraft({ ...o })} className="rounded-group bg-surface p-4 text-left hover:shadow-float">
                    <div className="flex items-start justify-between gap-2">
                      <span className={clsx("flex h-9 w-9 items-center justify-center rounded-[10px] text-white", o.businessType === "cafe" ? "bg-saffron" : "bg-jade")}>
                        {o.businessType === "cafe" ? <Coffee size={17} /> : <Store size={17} />}
                      </span>
                      <Pill tone={o.businessType === "cafe" ? "saffron" : "jade"}>{typeLabel(o.businessType)}{isMixed(o) ? " + " + (o.businessType === "cafe" ? "tables" : "counter") : ""}</Pill>
                    </div>
                    <div className="mt-3 text-[15.5px] font-semibold">{o.name}</div>
                    <div className="text-[13px] text-muted">{n} {n === 1 ? "person" : "people"} · {subs.length ? L("Sub admin: {0}", subs.map((s) => s.name.split(" ")[0]).join(", ")) : L("No sub admin yet")}</div>
                  </button>
                );
              })}
              <button onClick={openNewOutlet} className="flex min-h-[64px] items-center justify-center gap-2 rounded-group border-2 border-dashed border-line px-4 text-muted hover:border-jade hover:text-jade">
                <Building2 size={18} />
                <span className="text-[14px] font-semibold">{outlets.length >= outletLimit ? L("Add outlet · upgrade from {0}", PLAN_NAME[account.plan]) : L("Add outlet")}</span>
              </button>
            </div>
          </section>
        )}

        {/* ---------- people ---------- */}
        <section>
          <div className="mb-2 flex flex-col gap-2 px-1 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-[17px] font-semibold">{L("People")}</h2>
            {myOutlets.length > 1 && (
              <Chips label={L("Outlet")} value={filter} onChange={setFilter} options={[{ id: "all", name: owner ? "All outlets" : "All my outlets" }, ...myOutlets].map((o) => ({ value: o.id, label: o.name }))} />
            )}
          </div>
          <Group flush>
            {shown.map((m) => {
              const editable = canManage(me, m);
              return (
                <button
                  key={m.id}
                  disabled={!editable}
                  onClick={() => { setConfirmRemove(false); setPin(""); setDraft({ ...m }); }}
                  className={clsx("flex w-full items-center gap-3 border-b border-line/80 px-4 py-3 text-left last:border-0 lg:px-5", editable ? "hover:bg-sunken/40" : "cursor-default", !m.active && "opacity-50")}
                >
                  <Avatar name={m.name} hue={m.hue} photo={m.photo} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium">{m.name}</span>
                      {m.id === me?.id && <span className="text-[12px] text-faint">{L("(you)")}</span>}
                    </div>
                    <div className="truncate text-[13px] text-muted">
                      {L(m.title)} · {m.role === "owner" ? L("All outlets") : m.outletIds.map(outletName).join(", ")}
                    </div>
                  </div>
                  <div className="hidden text-right text-[12.5px] text-muted sm:block tnum">
                    {m.role === "owner" ? L("Everything") : m.role === "subadmin" ? L("Everything in their outlet") : L("{0} of {1} access", m.perms.length, ALL_PERMS.length)}
                  </div>
                  <Pill tone={m.role === "owner" ? "jade" : m.role === "subadmin" ? "sky" : "neutral"}>{m.active ? roleLabel(m) : L("Paused")}</Pill>
                </button>
              );
            })}
          </Group>
          {!owner && <p className="mt-2 px-1 text-[12.5px] text-faint">{L("You can manage staff in your outlet")}{myOutlets.length > 1 ? "s" : ""}{L(". Sub admins are managed by the owner.")}</p>}
        </section>
      </Page>

      {/* ---------- add / edit member ---------- */}
      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.isNew ? L("Add member") : draft?.name ?? ""}
        wide
        footer={
          <Button size="lg" className="w-full" disabled={!draftOk} onClick={save}>
            {!draft ? "" : phoneTaken ? L("That mobile is already used by someone else") : !draft.name.trim() || !phoneOk ? L("Add name and 10-digit mobile") : !pinOk ? L("Set a 4-digit PIN") : !draft.outletIds.length ? L("Pick at least one outlet") : draft.role === "staff" && !draft.perms.length ? L("Tick at least one box") : draft.isNew ? L("Add member") : L("Save access")}
          </Button>
        }
      >
        {draft && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={L("Name")}><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={L("Full name")} /></Field>
              <Field
                label={L("Mobile (WhatsApp)")}
                hint={
                  takenBy
                    ? L("{0}{1} already has this number{2}", takenBy.name, takenBy.active ? "" : " (turned off)", takenBy.outletIds.length ? ` · ${takenBy.outletIds.map(outletName).join(", ")}` : "")
                    : L("They sign in with this number and their PIN")
                }
              >
                <input className={inputCls} inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/[^\d ]/g, "").slice(0, 11) })} placeholder={L("98xxx xxxxx")} />
              </Field>
              {takenBy && !takenBy.active && canManage(me, takenBy) && (
                <button type="button" onClick={() => reopen(takenBy)} className="rounded-ctl bg-sky-soft/60 px-4 py-3 text-left text-[14px] font-semibold text-jade sm:col-span-2">
                  {L("Turn")} {takenBy.name.split(" ")[0]} {L("back on instead →")}</button>
              )}
            </div>

            {cloud.rid && (
              <Field label={draft.isNew ? L("Sign-in PIN (4 digits)") : L("Change PIN (leave empty to keep)")}>
                <input
                  className={inputCls}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                />
              </Field>
            )}

            {owner && (
              <Field label={L("Role")}>
                <Segmented
                  className="w-full"
                  value={draft.role === "subadmin" ? "subadmin" : "staff"}
                  onChange={(v) =>
                    setDraft(
                      v === "subadmin"
                        ? { ...draft, role: "subadmin", title: draft.title || "Outlet manager", perms: ALL_PERMS }
                        : { ...draft, role: "staff", title: draft.title === "Outlet manager" ? "" : draft.title, perms: draft.perms.filter((p) => p !== "team") },
                    )
                  }
                  options={[{ value: "subadmin", label: "Sub admin · runs outlet" }, { value: "staff", label: "Staff" }]}
                />
              </Field>
            )}

            <div>
              <div className="mb-1.5 text-[13px] font-medium text-muted">{L("Outlets")}</div>
              <div className="overflow-hidden rounded-group bg-surface">
                {outlets.filter((o) => assignable.includes(o.id)).map((o) => (
                  <Check2
                    key={o.id}
                    on={draft.outletIds.includes(o.id)}
                    onClick={() => setDraft({ ...draft, outletIds: draft.outletIds.includes(o.id) ? draft.outletIds.filter((x) => x !== o.id) : [...draft.outletIds, o.id] })}
                    label={o.name}
                    note={typeLabel(o.businessType)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[13px] font-medium text-muted">{L("Job")}</div>
              <div className="mb-2 flex flex-wrap gap-2">
                {PRESETS.filter((p) => !draftTypes.length || p.types.some((t) => draftTypes.includes(t)))
                  .filter((p) => draft.role === "subadmin" || p.name !== "Outlet manager")
                  .map((p) => (
                    <button key={p.name} onClick={() => applyPreset(p.name, p.perms)} className={clsx("rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold", draft.title === p.name ? "bg-ink text-canvas" : "bg-surface")}>
                      {p.name}
                    </button>
                  ))}
              </div>
              <input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={L("Or type a job name (e.g. Barista)")} />
            </div>

            {draft.role === "subadmin" ? (
              <div className="rounded-group bg-sky-soft/60 p-4 text-[14px] leading-relaxed">
                <div className="flex items-center gap-1 font-semibold">
                  {L("Admin of")} {draft.outletIds.length ? draft.outletIds.map((id) => outlets.find((o) => o.id === id)?.name ?? id).join(", ") : L("their outlet")}
                  <Hint align="left">{L("Everything the owner does in this outlet: orders, bills and payments, tables, kitchen, stock, staff and access, attendance and salary, outlet settings, stamp card, guests, campaigns, coupons, reports and activity.")}</Hint>
                </div>
                <p className="mt-1 text-[13px] text-muted">{L("Full access to this outlet · not other outlets, plan or billing.")}</p>
                {owner && (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-ctl bg-surface px-4 py-3">
                    <div>
                      <div className="text-[15px] font-semibold text-ink">{L("Attendance & salary")}</div>
                      <div className="text-[12.5px] text-muted">{L("Keep their days and pay like staff (My attendance for them)")}</div>
                    </div>
                    <Toggle checked={!!draft.payrollOn} onChange={(payrollOn) => setDraft({ ...draft, payrollOn })} label={L("Attendance and salary")} />
                  </div>
                )}
              </div>
            ) : (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13px] font-medium text-muted">{L("What they can see and do")}</span>
                <span className="text-[12.5px] text-faint tnum">{draft.perms.length} {L("ticked")}</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {PERM_GROUPS.map((g) => {
                  const usable = g.perms.filter((p) => !permState(p.key).disabled).map((p) => p.key);
                  const all = usable.length > 0 && usable.every((p) => draft.perms.includes(p));
                  return (
                    <div key={g.title} className="overflow-hidden rounded-group bg-surface">
                      <div className="flex items-center justify-between border-b border-line/80 px-4 py-2">
                        <span className="text-[13px] font-semibold">{L(g.title)}</span>
                        {usable.length > 0 && (
                          <button
                            onClick={() => setDraft({ ...draft, perms: all ? draft.perms.filter((p) => !usable.includes(p)) : [...new Set([...draft.perms, ...usable])] })}
                            className="text-[12.5px] font-semibold text-jade"
                          >
                            {all ? L("Clear") : L("Tick all")}
                          </button>
                        )}
                      </div>
                      {g.perms.map((p) => {
                        const st = permState(p.key);
                        return <Check2 key={p.key} on={draft.perms.includes(p.key) && !st.disabled} disabled={st.disabled} onClick={() => togglePerm(p.key)} label={p.label} note={st.note} />;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {!draft.isNew && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-group bg-surface px-4 py-3">
                  <span className="text-[15px]">{L("Can sign in")}</span>
                  <Toggle checked={draft.active} onChange={(active) => setDraft({ ...draft, active })} label={L("Can sign in")} />
                </div>
                {confirmRemove ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="plain" onClick={() => setConfirmRemove(false)}>{L("Keep")}</Button>
                    <Button variant="danger" onClick={() => { memberActions.remove(draft.id); setDraft(null); toast(L("{0} removed", draft.name)); }}>{L("Remove")} {draft.name.split(" ")[0]}</Button>
                  </div>
                ) : (
                  <Button variant="danger" className="w-full" onClick={() => setConfirmRemove(true)}>{L("Remove from team")}</Button>
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* ---------- add / edit outlet ---------- */}
      <Sheet
        open={!!outletDraft}
        onClose={() => { setOutletDraft(null); setDelName(null); }}
        title={outletDraft?.isNew ? L("New outlet") : outletDraft?.name ?? ""}
        footer={
          <Button size="lg" className="w-full" disabled={!outletOk} onClick={saveOutlet}>
            {outletOk ? (outletDraft?.isNew ? L("Create outlet") : L("Save outlet")) : L("Add a name and a valid UPI ID")}
          </Button>
        }
      >
        {outletDraft && (
          <div className="space-y-4">
            <Field label={L("Outlet name")}><input className={inputCls} value={outletDraft.name} onChange={(e) => setOutletDraft({ ...outletDraft, name: e.target.value })} placeholder={L("e.g. Viman Nagar")} /></Field>
            <Field label={L("Address")}><input className={inputCls} value={outletDraft.address} onChange={(e) => setOutletDraft({ ...outletDraft, address: e.target.value })} placeholder={L("Street, city, PIN")} /></Field>
            <Field label={L("Type")}>
              <Segmented
                className="w-full"
                value={outletDraft.businessType}
                onChange={(t) => setOutletDraft({ ...outletDraft, businessType: t, payFirst: t === "cafe" })}
                options={[{ value: "restaurant", label: "Restaurant" }, { value: "cafe", label: "Café" }]}
              />
            </Field>
            <p className="-mt-2 text-[13px] text-muted">
              {isMixed(outletDraft)
                ? L("Tables and counter both: table QR, dine-in and split bills, plus counter orders with tokens.")
                : outletDraft.businessType === "cafe"
                  ? L("Counter orders with tokens. Turn on tables below if some guests sit and order.")
                  : L("Table service: tables, captains and bills at the end. Turn on counter orders below if you also have a counter.")}
            </p>
            <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
              <span className="text-[15px]">{outletDraft.businessType === "cafe" ? L("Also serve at tables") : L("Also take counter orders")}</span>
              <Toggle checked={isMixed(outletDraft)} onChange={(v) => setOutletDraft({ ...outletDraft, mixed: v })} label={L("Tables and counter both")} />
            </div>
            <Field label={L("UPI ID for this outlet's bills")}>
              <input className={clsx(inputCls, outletDraft.upi && !isValidUpi(outletDraft.upi) && "ring-2 ring-rose")} autoCapitalize="none" value={outletDraft.upi} onChange={(e) => setOutletDraft({ ...outletDraft, upi: e.target.value.replace(/\s/g, "") })} placeholder={L("name@bank")} />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-group bg-surface px-4 py-3">
              <span className="text-[15px]">{L("Guests pay before the kitchen starts")}</span>
              <Toggle checked={outletDraft.payFirst} onChange={(payFirst) => setOutletDraft({ ...outletDraft, payFirst })} label={L("Guests pay first")} />
            </div>
            {outletDraft.isNew && menuSources.length > 0 && (
              <Field label={L("Menu")} hint={L("Each outlet has its own menu. A copy can be changed freely; you can also copy later from Menu.")}>
                <Segmented
                  className="w-full"
                  value={copyMenuFrom}
                  onChange={setCopyMenuFrom}
                  options={[...menuSources.slice(0, 2).map((o) => ({ value: o.id, label: `Copy ${o.name} (${o.dishes})` })), { value: "", label: "Start empty" }]}
                />
              </Field>
            )}

            {owner && !outletDraft.isNew && outlets.length > 1 && (
              <div className="rounded-group border border-rose/30 bg-rose-soft/40 p-4">
                {delName === null ? (
                  <Button variant="danger" className="w-full" onClick={() => { const why = outletActions.removeProblem(outletDraft.id); if (why) toast(why); else setDelName(""); }}>
                    <Trash2 size={16} /> {L("Delete this outlet")}</Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-[15px] font-semibold text-rose">{L("Delete")} {outletDraft.name}?</div>
                    <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink/80">
                      <li>{L("Its tables, stock, menu and its coupons are deleted.")}</li>
                      <li>{L("People who work only here can't sign in any more (they stay in your list, turned off).")}</li>
                      <li>{L("Past bills stay in your reports and data export.")}</li>
                      <li>{L("This can't be undone.")}</li>
                    </ul>
                    <Field label={L("Type {0} to confirm", outletDraft.name)}>
                      <input className={inputCls} value={delName} onChange={(e) => setDelName(e.target.value)} placeholder={outletDraft.name} autoCapitalize="none" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="plain" onClick={() => setDelName(null)}>{L("Keep it")}</Button>
                      <Button variant="danger" disabled={delName.trim().toLowerCase() !== outletDraft.name.trim().toLowerCase()} onClick={deleteOutlet}><Trash2 size={16} /> {L("Delete")}</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>
      <Sheet open={!!inviteFor} onClose={() => setInviteFor(null)} title={L("Send the sign-in link")}>
        {inviteFor && (
          <div className="space-y-4">
            <p className="text-[14.5px] text-muted">{inviteFor.name} {L("needs this link once to sign in. Tell them their PIN yourself (it isn't in the message).")}</p>
            <pre className="whitespace-pre-wrap rounded-group bg-surface p-4 text-[13.5px] leading-relaxed">{inviteText(inviteFor.name)}</pre>
            <a href={`https://wa.me/91${inviteFor.phone}?text=${encodeURIComponent(inviteText(inviteFor.name))}`} target="_blank" rel="noreferrer" onClick={() => setInviteFor(null)}>
              <Button size="lg" className="w-full"><MessageCircle size={18} /> {L("Send on WhatsApp")}</Button>
            </a>
          </div>
        )}
      </Sheet>
    </>
  );
}
