"use client";

// "Add from photo": the owner takes photos of their printed or handwritten menu,
// Gemini reads them (edge function menu-from-photo), and the owner checks the
// list before anything is added. Existing dishes are never changed.
import clsx from "clsx";
import { Camera, Check, ImagePlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, DietMark, Sheet, inputCls } from "./ui";
import { useToast } from "./toast";
import { CookingLoader } from "./loader";
import { readMenuPhotos, useCloud } from "@/lib/cloud";
import { categoryActions, menuActions, useCategories, useMenu } from "@/lib/live";
import type { Diet, MenuItem } from "@/lib/types";

const MAX_PHOTOS = 6;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim();

type Shot = { id: string; url: string; mime: string; data: string };
type Row = { key: string; on: boolean; name: string; price: string; diet: Diet; desc: string; dup: boolean };
type Group = { key: string; name: string; rows: Row[] };

/** Shrink a phone photo so it uploads fast but stays readable. */
async function prepare(file: File): Promise<Shot> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((ok, bad) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => bad(new Error("This photo can't be opened. Use a JPG or PNG."));
    i.src = url;
  });
  const max = 2000;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.85);
  return { id: `${Date.now()}${Math.random()}`, url, mime: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

const stationFor = (cat: string): MenuItem["station"] =>
  /bever|drink|juice|shake|mocktail|cocktail|coffee|\btea\b|chai|soda|lassi|bar\b|smoothie/i.test(cat)
    ? "bar"
    : /dessert|sweet|ice ?cream|kulfi|mithai/i.test(cat)
      ? "dessert"
      : /tandoor|kebab|tikka/i.test(cat)
        ? "tandoor"
        : "kitchen";

export function MenuFromPhoto({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cloud = useCloud();
  const cats = useCategories();
  const menu = useMenu();
  const toast = useToast();
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [groups, setGroups] = useState<Group[] | null>(null);

  const reset = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    setGroups(null);
    setErr("");
    setBusy(false);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    const room = MAX_PHOTOS - shots.length;
    if (room <= 0) return setErr(`Up to ${MAX_PHOTOS} photos at a time.`);
    try {
      const next = await Promise.all([...files].slice(0, room).map(prepare));
      setShots((s) => [...s, ...next]);
      if (files.length > room) setErr(`Only the first ${MAX_PHOTOS} photos are used.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't open the photo");
    }
  };

  const read = async () => {
    if (!cloud.rid || !shots.length) return;
    setBusy(true);
    setErr("");
    try {
      const r = await readMenuPhotos(cloud.rid, shots.map(({ mime, data }) => ({ mime, data })));
      const have = new Set(menu.map((m) => norm(m.name)));
      const g = r.categories.map((c, i) => ({
        key: `g${i}`,
        name: c.name,
        rows: c.items.map((it, j) => {
          const dup = have.has(norm(it.name));
          return { key: `g${i}-${j}`, on: !dup, name: it.name, price: it.price ? String(it.price) : "", diet: it.diet, desc: it.desc, dup };
        }),
      }));
      if (!g.length) setErr("No dishes found in these photos. Try a closer, straight photo in good light.");
      else setGroups(g);
      if (r.left !== null && r.left <= 5) toast(`${r.left} menu photo reads left today`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't read the menu");
    } finally {
      setBusy(false);
    }
  };

  const setRow = (gk: string, rk: string, patch: Partial<Row>) =>
    setGroups((gs) => gs && gs.map((g) => (g.key !== gk ? g : { ...g, rows: g.rows.map((r) => (r.key === rk ? { ...r, ...patch } : r)) })));
  const setGroup = (gk: string, patch: Partial<Group>) => setGroups((gs) => gs && gs.map((g) => (g.key === gk ? { ...g, ...patch } : g)));

  const picked = useMemo(() => (groups ?? []).flatMap((g) => g.rows.filter((r) => r.on && r.name.trim())), [groups]);
  const noPrice = picked.filter((r) => !(Number(r.price) > 0)).length;
  const catByName = (name: string) => cats.find((c) => norm(c.name) === norm(name));

  const save = () => {
    if (!groups) return;
    const items: MenuItem[] = [];
    let newCats = 0;
    groups.forEach((g, gi) => {
      const rows = g.rows.filter((r) => r.on && r.name.trim());
      if (!rows.length) return;
      const name = g.name.trim() || "Other";
      let cat = catByName(name);
      if (!cat) {
        cat = categoryActions.add(name);
        newCats++;
      }
      rows.forEach((r, ri) =>
        items.push({
          id: `m${Date.now().toString(36)}${gi}x${ri}`,
          name: r.name.trim(),
          categoryId: cat!.id,
          price: Math.max(0, Math.round(Number(r.price) || 0)),
          cost: 0,
          diet: r.diet,
          available: true,
          soldThisWeek: 0,
          prepMins: 10,
          station: stationFor(name),
          desc: r.desc || undefined,
          hue: Math.floor(Math.random() * 360),
        }),
      );
    });
    menuActions.addMany(items);
    toast(`${items.length} dish${items.length === 1 ? "" : "es"} added${newCats ? ` in ${newCats} new categor${newCats === 1 ? "y" : "ies"}` : ""}`);
    reset();
    onClose();
  };

  const nextDiet = (d: Diet): Diet => (d === "veg" ? "nonveg" : d === "nonveg" ? "egg" : "veg");

  return (
    <Sheet
      open={open}
      onClose={close}
      title={groups ? "Check the dishes" : "Add menu from photo"}
      wide
      footer={
        groups ? (
          <div className="flex gap-2">
            <Button variant="plain" className="!bg-sunken" onClick={() => setGroups(null)}>Back</Button>
            <Button size="lg" className="flex-1" disabled={!picked.length} onClick={save}>
              {picked.length ? `Add ${picked.length} dish${picked.length === 1 ? "" : "es"}` : "Pick dishes to add"}
            </Button>
          </div>
        ) : (
          <Button size="lg" className="w-full" disabled={!shots.length || busy || !cloud.rid} onClick={read}>
            {busy ? "Reading the menu…" : shots.length ? `Read ${shots.length} photo${shots.length === 1 ? "" : "s"}` : "Add a photo first"}
          </Button>
        )
      }
    >
      {busy ? (
        <div className="flex flex-col items-center py-14 text-center">
          <CookingLoader size={72} label="Reading the menu" />
          <p className="mt-4 text-[15px] font-semibold">Reading your menu…</p>
          <p className="mt-1 text-[13.5px] text-muted">This takes 10–30 seconds.</p>
        </div>
      ) : !groups ? (
        <div className="space-y-4">
          <p className="text-[14px] text-muted">
            Take a clear, straight photo of each menu page (printed or handwritten). We&apos;ll list the categories, dishes and prices for you to check before anything is added.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-ctl bg-ink text-[15px] font-semibold text-canvas">
              <Camera size={18} /> Take photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
            </label>
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-ctl bg-surface text-[15px] font-semibold ring-1 ring-line">
              <ImagePlus size={18} /> From gallery
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {shots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {shots.map((s, i) => (
                <div key={s.id} className="relative aspect-[3/4] overflow-hidden rounded-[12px] bg-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={`Menu page ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    aria-label="Remove photo"
                    onClick={() => { URL.revokeObjectURL(s.url); setShots((x) => x.filter((y) => y.id !== s.id)); }}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-1 text-[13px] text-muted">
            <li>• One page per photo, flat, in good light, no glare.</li>
            <li>• Up to {MAX_PHOTOS} photos at a time. Half/full prices become two dishes.</li>
          </ul>
          {err && <p className="rounded-ctl bg-rose-soft px-3 py-2 text-[13.5px] text-rose">{err}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[13.5px] text-muted">
            Fix any name or price, tap the mark to change veg / non-veg / egg, and untick what you don&apos;t want.
            {noPrice > 0 && <span className="text-saffron"> {noPrice} dish{noPrice === 1 ? " has" : "es have"} no price yet.</span>}
          </p>
          {groups.map((g) => {
            const existing = catByName(g.name);
            const allOn = g.rows.every((r) => r.on);
            return (
              <div key={g.key} className="overflow-hidden rounded-group bg-surface">
                <div className="flex items-center gap-2 border-b border-line/80 px-3 py-2.5">
                  <input className="min-w-0 flex-1 bg-transparent text-[15.5px] font-semibold outline-none" value={g.name} onChange={(e) => setGroup(g.key, { name: e.target.value })} aria-label="Category name" />
                  <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold", existing ? "bg-sunken text-muted" : "bg-jade-soft text-jade-deep")}>{existing ? "Existing category" : "New category"}</span>
                  <button onClick={() => setGroup(g.key, { rows: g.rows.map((r) => ({ ...r, on: !allOn })) })} className="shrink-0 text-[12.5px] font-semibold text-jade">{allOn ? "None" : "All"}</button>
                </div>
                {g.rows.map((r) => (
                  <div key={r.key} className={clsx("flex items-center gap-2 border-b border-line/60 px-3 py-2 last:border-0", !r.on && "opacity-50")}>
                    <button
                      aria-label={r.on ? "Don't add" : "Add"}
                      onClick={() => setRow(g.key, r.key, { on: !r.on })}
                      className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px]", r.on ? "bg-jade text-white" : "ring-1 ring-line")}
                    >
                      {r.on && <Check size={15} />}
                    </button>
                    <button aria-label="Change veg / non-veg" onClick={() => setRow(g.key, r.key, { diet: nextDiet(r.diet) })} className="p-1">
                      <DietMark diet={r.diet} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <input className="w-full bg-transparent text-[14.5px] outline-none" value={r.name} onChange={(e) => setRow(g.key, r.key, { name: e.target.value })} aria-label="Dish name" />
                      {r.dup && <div className="text-[11.5px] text-saffron">Already on your menu</div>}
                    </div>
                    <div className="flex shrink-0 items-center rounded-[9px] bg-sunken px-2">
                      <span className="text-[13px] text-muted">₹</span>
                      <input
                        className={clsx(inputCls, "!h-8 !w-16 !bg-transparent !px-1 !text-right !text-[14px] !ring-0", !(Number(r.price) > 0) && "placeholder:text-saffron")}
                        inputMode="numeric"
                        placeholder="—"
                        value={r.price}
                        onChange={(e) => setRow(g.key, r.key, { price: e.target.value.replace(/[^\d]/g, "") })}
                        aria-label="Price"
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
