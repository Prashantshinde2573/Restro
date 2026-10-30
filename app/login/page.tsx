"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/shell";
import { Avatar, Button, Segmented } from "@/components/ui";
import { OwnerAuth } from "@/components/owner-auth";
import { cloudConfigured, publicInfo, publicStaff, signInStaff, useCloud } from "@/lib/cloud";
import { getMembers, sessionActions, useCurrentOutlet, useMembers } from "@/lib/live";

type StaffFace = { id: string; name: string; hue: number; outletIds: string[] };
const RID_KEY = "restro.rid"; // which restaurant this device belongs to (for the staff PIN screen)

export default function LoginPage() {
  const router = useRouter();
  const cloud = useCloud();
  const [mode, setMode] = useState<"owner" | "staff">("owner");
  const [who, setWho] = useState<StaffFace | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rid, setRid] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [faces, setFaces] = useState<StaffFace[]>([]);

  // demo mode: staff of the outlet on this device
  const outlet = useCurrentOutlet();
  const demoStaff = useMembers().filter((m) => m.active && m.role !== "owner" && m.outletIds.includes(outlet.id)).slice(0, 9);

  // cloud mode: which restaurant is this device for?
  useEffect(() => {
    if (!cloudConfigured) return;
    const fromUrl = new URLSearchParams(window.location.search).get("r");
    let r = fromUrl;
    try {
      if (fromUrl) localStorage.setItem(RID_KEY, fromUrl);
      r = r ?? localStorage.getItem(RID_KEY);
    } catch {}
    if (!r) return;
    setRid(r);
    publicInfo(r).then((i) => setPlace(i?.name ?? "")).catch(() => {});
    publicStaff(r).then(setFaces).catch(() => {});
  }, []);

  // already signed in → straight in
  useEffect(() => {
    if (cloud.status === "ready" && cloud.role !== "guest") {
      try {
        if (cloud.rid) localStorage.setItem(RID_KEY, cloud.rid);
      } catch {}
      router.replace("/app");
    }
    if (cloud.status === "needsOnboarding") router.replace("/onboarding");
  }, [cloud, router]);

  // PIN complete
  useEffect(() => {
    if (pin.length !== 4 || !who) return;
    if (!cloudConfigured) {
      const id = window.setTimeout(() => {
        const m = getMembers().find((x) => x.id === who.id);
        if (m) sessionActions.signInAs(m.id);
        router.push(m?.role === "subadmin" || !m?.perms.includes("pos") ? "/app" : "/app/pos");
      }, 300);
      return () => window.clearTimeout(id);
    }
    setBusy(true);
    setError("");
    signInStaff(rid!, who.id, pin)
      .then(() => sessionActions.setMember(who.id))
      .catch((e: Error) => {
        setError(e.message);
        setPin("");
      })
      .finally(() => setBusy(false));
  }, [pin, who, rid, router]);

  const staff: StaffFace[] = cloudConfigured ? faces : demoStaff;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <div className="hidden flex-1 flex-col justify-between bg-ink p-12 text-canvas lg:flex">
        <Wordmark className="text-[20px]" />
        <p className="max-w-md text-[34px] font-semibold leading-tight tracking-tight">Bills, kitchen, tables, stock and staff — in one place.</p>
        <div className="text-[14px] text-canvas/60">Restro for restaurants and cafés</div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Wordmark className="text-[20px]" /></div>
          <h1 className="large-title">Sign in</h1>
          {place && <p className="mt-1 text-[15px] text-muted">{place}</p>}
          <Segmented
            className="mt-6 w-full"
            value={mode}
            onChange={(v) => { setMode(v); setPin(""); setWho(null); setError(""); }}
            options={[{ value: "owner", label: "Owner" }, { value: "staff", label: "Staff PIN" }]}
          />

          {mode === "owner" ? (
            <div className="mt-6 space-y-4">
              {cloudConfigured ? (
                <OwnerAuth />
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    const owner = getMembers().find((m) => m.role === "owner");
                    if (owner) sessionActions.signInAs(owner.id);
                    router.push("/app");
                  }}
                >
                  Enter demo as owner
                </Button>
              )}
              <p className="text-center text-[13.5px] text-muted">
                New to Restro? <Link href="/onboarding" className="font-semibold text-jade">Set up your restaurant</Link>
              </p>
            </div>
          ) : cloudConfigured && !rid ? (
            <p className="mt-6 rounded-group bg-surface p-4 text-[14px] text-muted">
              The owner needs to sign in once on this device first. After that, staff can sign in here with their PIN.
            </p>
          ) : !who ? (
            staff.length ? (
              <div className="mt-6 grid grid-cols-3 gap-3">
                {staff.map((s) => (
                  <button key={s.id} onClick={() => { setWho(s); setPin(""); setError(""); }} className="flex flex-col items-center gap-2 rounded-group bg-surface px-2 py-4 active:scale-[.97]">
                    <Avatar name={s.name} hue={s.hue} size={48} />
                    <span className="text-center text-[13px] font-medium leading-tight">{s.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-group bg-surface p-4 text-[14px] text-muted">No staff added yet. The owner adds staff in Members &amp; access.</p>
            )
          ) : (
            <div className="mt-6 flex flex-col items-center">
              <div className="text-[15px] font-medium">Hi {who.name.split(" ")[0]}, enter your PIN</div>
              <div className="my-6 flex gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={clsx("h-3.5 w-3.5 rounded-full transition", i < pin.length ? "scale-110 bg-ink" : "bg-line")} />
                ))}
              </div>
              <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k) =>
                  k === "" ? (
                    <button key="back" onClick={() => setWho(null)} className="text-[14px] font-medium text-jade">Back</button>
                  ) : (
                    <button
                      key={k}
                      disabled={busy}
                      aria-label={k === "del" ? "Delete" : k}
                      onClick={() => setPin((p) => (k === "del" ? p.slice(0, -1) : p.length < 4 ? p + k : p))}
                      className="flex aspect-square items-center justify-center rounded-full bg-surface text-[26px] font-medium transition active:scale-95 active:bg-sunken"
                    >
                      {k === "del" ? <Delete size={22} /> : k}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
          {error && <p className="mt-4 text-center text-[14px] font-medium text-rose">{error}</p>}
        </div>
      </div>
    </div>
  );
}
