"use client";

// Alert sounds: a mute switch, and a different sound for each kind of alert
// (new order, waiter call, kitchen, bill, payment, ready, review). Kept on this device.
import { createStore } from "@/lib/store";

export type SoundEvent = "order" | "waiter" | "kitchen" | "bill" | "payment" | "ready" | "review";
export type SoundId = "chime" | "ding" | "bell" | "pop" | "cash" | "alert" | "soft" | "none";

export const SOUND_EVENTS: { id: SoundEvent; label: string; hint: string }[] = [
  { id: "order", label: "New order", hint: "QR orders and orders from other phones" },
  { id: "waiter", label: "Waiter call", hint: "A guest tapped “Call a waiter”, or you were sent to a table" },
  { id: "kitchen", label: "Kitchen", hint: "A new ticket on the kitchen screen" },
  { id: "bill", label: "Bill requested", hint: "A guest asked for the bill" },
  { id: "payment", label: "Payment", hint: "A payment to confirm, or one not received" },
  { id: "ready", label: "Ready to serve", hint: "The kitchen marked an order ready" },
  { id: "review", label: "Low rating", hint: "A guest gave 3 stars or less" },
];
export const SOUNDS: { id: SoundId; label: string }[] = [
  { id: "chime", label: "Chime" },
  { id: "ding", label: "Ding" },
  { id: "bell", label: "Bell" },
  { id: "pop", label: "Pop" },
  { id: "cash", label: "Cash register" },
  { id: "alert", label: "Alert (loud)" },
  { id: "soft", label: "Soft" },
  { id: "none", label: "No sound" },
];
const DEFAULTS: Record<SoundEvent, SoundId> = { order: "chime", waiter: "alert", kitchen: "bell", bill: "ding", payment: "cash", ready: "pop", review: "soft" };

/* ---- saved choices ---- */
const SOUND_KEY = "restropi.sound";
const PICKS_KEY = "restropi.sounds";
const soundStore = createStore<boolean>(true);
const picksStore = createStore<Record<SoundEvent, SoundId>>(DEFAULTS);
if (typeof window !== "undefined") {
  try {
    soundStore.set(localStorage.getItem(SOUND_KEY) !== "off");
    picksStore.set({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(PICKS_KEY) || "{}") });
  } catch {}
}
export const useSound = () => soundStore.use();
export const useSoundPicks = () => picksStore.use();
export function setSound(on: boolean) {
  soundStore.set(on);
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {}
  if (on) chime("order");
}
export function setSoundFor(ev: SoundEvent, id: SoundId) {
  const next = { ...picksStore.get(), [ev]: id };
  picksStore.set(next);
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify(next));
  } catch {}
  playSound(id);
}

/* ---- the sounds (made on the device, nothing to download) ---- */
let ctx: AudioContext | null = null;
function audio() {
  ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(c: AudioContext, freq: number, start: number, dur: number, vol = 0.25, type: OscillatorType = "sine", to?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (to) o.frequency.exponentialRampToValueAtTime(to, start + dur * 0.6);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** Play one sound now (also used for the preview). Ignores the mute switch. */
export function playSound(id: SoundId) {
  if (id === "none") return;
  try {
    const c = audio();
    const t = c.currentTime;
    switch (id) {
      case "chime":
        tone(c, 880, t, 0.35);
        tone(c, 1320, t + 0.16, 0.4);
        break;
      case "ding":
        tone(c, 1046, t, 0.9, 0.3, "triangle");
        break;
      case "bell":
        [660, 990, 1320, 1980].forEach((f, i) => tone(c, f, t, 1.4 - i * 0.25, 0.18 / (i + 1)));
        tone(c, 660, t + 0.45, 1.1, 0.12);
        break;
      case "pop":
        tone(c, 520, t, 0.12, 0.3, "sine", 1100);
        tone(c, 780, t + 0.13, 0.14, 0.25, "sine", 1500);
        break;
      case "cash":
        tone(c, 2093, t, 0.06, 0.2, "square");
        tone(c, 2637, t + 0.07, 0.06, 0.2, "square");
        tone(c, 1568, t + 0.16, 0.7, 0.25, "triangle");
        tone(c, 2349, t + 0.16, 0.6, 0.12, "sine");
        break;
      case "alert":
        [0, 0.22, 0.44].forEach((d) => tone(c, 740, t + d, 0.16, 0.22, "square"));
        break;
      case "soft":
        [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.12, 0.5, 0.12));
        break;
    }
  } catch {
    /* no sound on this device */
  }
}

/** The alert sound for this kind of alert (silent when muted). */
export function chime(ev: SoundEvent = "order") {
  if (!soundStore.get()) return;
  playSound(picksStore.get()[ev] ?? DEFAULTS[ev]);
}
