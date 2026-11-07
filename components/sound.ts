"use client";

// The alert ping, and a per-device mute switch.
import { createStore } from "@/lib/store";

/* ---- sound on / off, kept on this device ---- */
const SOUND_KEY = "restropi.sound";
const soundStore = createStore<boolean>(true);
if (typeof window !== "undefined") {
  try {
    soundStore.set(localStorage.getItem(SOUND_KEY) !== "off");
  } catch {}
}
export const useSound = () => soundStore.use();
export function setSound(on: boolean) {
  soundStore.set(on);
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {}
  if (on) chime();
}

let ctx: AudioContext | null = null;
export function chime() {
  if (!soundStore.get()) return;
  try {
    ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.35);
      o.connect(g).connect(ctx!.destination);
      o.start(t + i * 0.16);
      o.stop(t + i * 0.16 + 0.4);
    });
  } catch {
    /* no sound on this device */
  }
}

