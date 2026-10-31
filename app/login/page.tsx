"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/shell";
import { KotTicket, PhoneOwner, UpiCard } from "@/components/site/mockups";
import { RiseText } from "@/components/site/motion";
import { Mesh } from "@/components/site/hero";
import { Avatar, Segmented } from "@/components/ui";
import { ChangePassword, OwnerAuth } from "@/components/owner-auth";
import { cloudSignOut, publicInfo, publicStaff, signInStaff, useCloud } from "@/lib/cloud";
import { sessionActions } from "@/lib/live";

type StaffFace = { id: string; name: string; hue: number; outletIds: string[] };
const RID_KEY = "rastropi.rid"; // which restaurant this device belongs to (for the staff PIN screen)

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

  // which restaurant is this device for? (for the staff PIN screen)
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("r");
    let r = fromUrl;
    try {
      if (fromUrl) localStorage.setItem(RID_KEY, fromUrl);
      r = r ?? localStorage.getItem(RID_KEY);
    } catch {}
    if (!r) return;
    setRid(r);
    setMode("staff");
    publicInfo(r).then((i) => setPlace(i?.name ?? "")).catch(() => {});
    publicStaff(r).then(setFaces).catch(() => {});
  }, []);

  // already signed in → straight in (after setting their own password)
  useEffect(() => {
    if (cloud.status !== "ready" || cloud.role === "guest" || cloud.mustChangePassword) return;
    try {
      if (cloud.rid) localStorage.setItem(RID_KEY, cloud.rid);
    } catch {}
    router.replace(cloud.role === "superadmin" ? "/admin" : "/app");
  }, [cloud, router]);

  // PIN complete
  useEffect(() => {
    if (pin.length !== 4 || !who) return;
    setBusy(true);
    setError("");
    signInStaff(rid!, who.id, pin)
      .then(() => sessionActions.setMember(who.id))
      .catch((e: Error) => {
        setError(e.message);
        setPin("");
      })
      .finally(() => setBusy(false));
  }, [pin, who, rid]);

  const staff = faces;
  const [linkExpired, setLinkExpired] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (q.get("link") === "expired" || h.get("error_code") === "otp_expired") setLinkExpired(true);
  }, []);
  const mustSet = cloud.status === "ready" && cloud.role !== "guest" && cloud.role !== "staff" && cloud.mustChangePassword;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <div className="relative isolate m-3 hidden flex-1 flex-col justify-between overflow-hidden rounded-[36px] bg-canvas p-12 lg:flex">
        <Mesh solid />
        <Link href="/" className="relative w-fit" aria-label="Rastropi home"><Wordmark className="text-[20px]" /></Link>
        {/* the owner's evening, floating in 3D */}
        <div aria-hidden className="relative mx-auto h-[420px] w-full max-w-[460px]" style={{ perspective: "1400px" }}>
          <div className="absolute inset-0" style={{ transformStyle: "preserve-3d", transform: "rotateX(14deg) rotateY(-18deg) rotateZ(4deg)" }}>
            <div className="absolute left-[18%] top-0" style={{ transform: "translateZ(0px)" }}><div className="animate-float"><div className="glass rounded-[48px] p-2.5"><PhoneOwner /></div></div></div>
            <div className="absolute right-0 top-[38%]" style={{ transform: "translateZ(120px)" }}><div className="animate-float" style={{ animationDelay: "-3s" }}><div className="glass rounded-[30px] p-2.5"><UpiCard className="!shadow-none" /></div></div></div>
            <div className="absolute bottom-0 left-0" style={{ transform: "translateZ(80px) rotateZ(-6deg)" }}><div className="animate-float" style={{ animationDelay: "-5s" }}><div className="glass rounded-[26px] p-2.5"><KotTicket className="!shadow-none" /></div></div></div>
          </div>
        </div>
        <div className="relative">
          <RiseText as="p" text="Bills, kitchen, tables, stock and staff — *in one place.*" className="max-w-md text-[40px] font-semibold leading-[1.02] tracking-[-0.035em]" />
          <div className="mt-4 text-[14px] text-muted">Rastropi for restaurants and cafés</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Wordmark className="text-[20px]" /></div>
          {mustSet ? (
            <>
              <ChangePassword
                title="Set a new password"
                subtitle={`${cloud.email ? `For ${cloud.email}. ` : ""}Choose your own password to continue.`}
              />
              <button onClick={() => void cloudSignOut()} className="mt-4 block w-full text-center text-[14px] font-medium text-muted">Sign out</button>
            </>
          ) : (
          <>
          <h1 className="large-title">Sign in</h1>
          {linkExpired && (
            <p className="mt-3 rounded-group bg-saffron-soft p-3 text-[14px] text-ink">
              That email link was already used or has expired. Each link works once — use &ldquo;Forgot password?&rdquo; to get a new one, and open only the newest email.
            </p>
          )}
          {place && <p className="mt-1 text-[15px] text-muted">{place}</p>}
          <Segmented
            className="mt-6 w-full"
            value={mode}
            onChange={(v) => { setMode(v); setPin(""); setWho(null); setError(""); }}
            options={[{ value: "owner", label: "Owner" }, { value: "staff", label: "Staff PIN" }]}
          />

          {mode === "owner" ? (
            <div className="mt-6 space-y-4">
              <OwnerAuth />
              <p className="text-center text-[13px] text-faint">Restaurant logins are given by Rastropi. Staff sign in with their PIN.</p>
            </div>
          ) : !rid ? (
            <p className="mt-6 rounded-group bg-surface p-4 text-[14px] text-muted">
              Open the staff sign-in link from your owner once on this device (or the owner signs in here once). After that, staff sign in here with their PIN.
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
          </>
          )}
        </div>
      </div>
    </div>
  );
}
