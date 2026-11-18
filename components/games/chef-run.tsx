"use client";

// Chef Run: our own little runner. The chef runs through the kitchen, tap to
// jump (tap again in the air for a second jump), grab samosas and chai, and
// jump over the stove flames and hot pans. It gets faster as you go.
import { useEffect, useRef, useState } from "react";
import { tx, type GuestLang } from "@/lib/guest-lang";

const BEST = "restropi.chefrun.best";
const W = 360; // game units; the canvas scales to the screen
const H = 220;
const GROUND = 182;

type Thing = { kind: "flame" | "pan" | "samosa" | "chai"; x: number; y: number; w: number; h: number; got?: boolean };

export function ChefRun({ lang }: { lang: GuestLang }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const input = useRef<() => void>(() => {});

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem(BEST)) || 0);
    } catch {}
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = W * dpr;
    el.height = H * dpr;
    ctx.scale(dpr, dpr);

    // the run
    let y = GROUND, vy = 0, jumps = 0, speed = 3.2, dist = 0, points = 0, t = 0;
    let things: Thing[] = [];
    let nextAt = 220;
    let alive = phase === "play";
    let raf = 0;
    let last = performance.now();

    input.current = () => {
      if (!alive) return;
      if (jumps < 2) {
        vy = jumps === 0 ? -8.6 : -7.4;
        jumps++;
      }
    };

    const spawn = () => {
      const r = Math.random();
      const x = W + 20;
      if (r < 0.42) things.push({ kind: "flame", x, y: GROUND - 22, w: 20, h: 22 });
      else if (r < 0.62) things.push({ kind: "pan", x, y: GROUND - 14, w: 34, h: 14 });
      else {
        const high = Math.random() < 0.5;
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) things.push({ kind: Math.random() < 0.6 ? "samosa" : "chai", x: x + i * 30, y: high ? GROUND - 92 : GROUND - 40, w: 18, h: 18 });
      }
      nextAt = dist + 150 + Math.random() * 160 - Math.min(60, speed * 6);
    };

    const drawChef = (x: number, yy: number, step: number) => {
      // legs
      ctx.strokeStyle = "#2b3a33";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      const swing = jumps ? 0 : Math.sin(step) * 6;
      ctx.beginPath();
      ctx.moveTo(x - 4, yy - 14); ctx.lineTo(x - 4 + swing, yy);
      ctx.moveTo(x + 4, yy - 14); ctx.lineTo(x + 4 - swing, yy);
      ctx.stroke();
      // apron body
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.roundRect(x - 10, yy - 36, 20, 24, 6); ctx.fill();
      ctx.fillStyle = "#18935B";
      ctx.fillRect(x - 10, yy - 24, 20, 3);
      // face
      ctx.fillStyle = "#f2c49b";
      ctx.beginPath(); ctx.arc(x, yy - 44, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2b3a33";
      ctx.beginPath(); ctx.arc(x + 3, yy - 45, 1.3, 0, Math.PI * 2); ctx.fill();
      // moustache
      ctx.strokeStyle = "#4a3426"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - 1, yy - 41); ctx.quadraticCurveTo(x + 3, yy - 39, x + 7, yy - 41.5); ctx.stroke();
      // chef hat
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.roundRect(x - 7, yy - 56, 14, 6, 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 4, yy - 58, 5, 0, Math.PI * 2); ctx.arc(x + 4, yy - 58, 5, 0, Math.PI * 2); ctx.arc(x, yy - 61, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#dfe3df"; ctx.lineWidth = 1; ctx.stroke();
    };

    const drawThing = (o: Thing) => {
      if (o.got) return;
      if (o.kind === "flame") {
        // stove + flame
        ctx.fillStyle = "#3b4540"; ctx.fillRect(o.x - 4, GROUND - 6, o.w + 8, 6);
        const f = 1 + Math.sin(t / 3 + o.x) * 0.12;
        ctx.fillStyle = "#f2762e";
        ctx.beginPath(); ctx.moveTo(o.x, GROUND - 6); ctx.quadraticCurveTo(o.x + o.w / 2, o.y - 10 * f, o.x + o.w, GROUND - 6); ctx.fill();
        ctx.fillStyle = "#ffd25e";
        ctx.beginPath(); ctx.moveTo(o.x + 5, GROUND - 6); ctx.quadraticCurveTo(o.x + o.w / 2, o.y + 2 * f, o.x + o.w - 5, GROUND - 6); ctx.fill();
      } else if (o.kind === "pan") {
        ctx.fillStyle = "#2b3a33";
        ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, GROUND - 7, o.w / 2, 7, 0, 0, Math.PI); ctx.fill();
        ctx.fillRect(o.x + o.w - 2, GROUND - 9, 14, 3);
        ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(o.x + 8 + i * 9, GROUND - 14); ctx.quadraticCurveTo(o.x + 12 + i * 9, GROUND - 20 - Math.sin(t / 5 + i) * 3, o.x + 8 + i * 9, GROUND - 26); ctx.stroke(); }
      } else if (o.kind === "samosa") {
        const bob = Math.sin(t / 8 + o.x / 30) * 2;
        ctx.fillStyle = "#e0a443"; ctx.strokeStyle = "#a96f1c"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y + bob); ctx.lineTo(o.x + o.w, o.y + o.h + bob); ctx.lineTo(o.x, o.y + o.h + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        const bob = Math.sin(t / 8 + o.x / 30) * 2;
        ctx.fillStyle = "#f4efe6"; ctx.strokeStyle = "#9c7a55"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(o.x + 2, o.y + 3 + bob); ctx.lineTo(o.x + o.w - 2, o.y + 3 + bob); ctx.lineTo(o.x + o.w - 4, o.y + o.h + bob); ctx.lineTo(o.x + 4, o.y + o.h + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#b5773f"; ctx.fillRect(o.x + 3.5, o.y + 5 + bob, o.w - 7, 4);
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(2.2, (now - last) / 16.67); // 1 = one 60 fps frame
      last = now;
      t += dt;
      if (alive) {
        speed = Math.min(8.5, 3.2 + dist / 1400);
        dist += speed * dt;
        vy += 0.5 * dt;
        y += vy * dt;
        if (y >= GROUND) { y = GROUND; vy = 0; jumps = 0; }
        if (dist > nextAt) spawn();
        for (const o of things) o.x -= speed * dt;
        things = things.filter((o) => o.x + o.w > -40);
        // hits (a little forgiving)
        const box = { l: 60 - 8, r: 60 + 8, t: y - 52, b: y - 2 };
        for (const o of things) {
          if (o.got) continue;
          const hit = box.r > o.x + 3 && box.l < o.x + o.w - 3 && box.b > o.y + 3 && box.t < o.y + o.h;
          if (!hit) continue;
          if (o.kind === "samosa" || o.kind === "chai") { o.got = true; points += o.kind === "chai" ? 15 : 10; }
          else alive = false;
        }
        const sc = Math.floor(dist / 10) + points;
        setScore(sc);
        if (!alive) {
          setPhase("over");
          try {
            const b = Number(localStorage.getItem(BEST)) || 0;
            if (sc > b) { localStorage.setItem(BEST, String(sc)); setBest(sc); }
          } catch {}
        }
      }

      // kitchen
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#fff7ea"); sky.addColorStop(1, "#ffe9cf");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // wall tiles drift slowly
      ctx.strokeStyle = "rgba(200,170,130,.25)"; ctx.lineWidth = 1;
      const off = -(dist * 0.3) % 24;
      for (let x = off; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND - 40); ctx.stroke(); }
      for (let yy = 12; yy < GROUND - 40; yy += 24) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
      // hanging pans in the back
      const off2 = -(dist * 0.5) % 120;
      ctx.fillStyle = "rgba(43,58,51,.12)";
      for (let x = off2; x < W + 120; x += 120) { ctx.beginPath(); ctx.arc(x + 40, 40, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 39, 18, 2, 12); }
      // counter
      ctx.fillStyle = "#c98f5a"; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "#b07a49"; ctx.fillRect(0, GROUND, W, 4);
      const off3 = -dist % 40;
      ctx.fillStyle = "rgba(0,0,0,.06)";
      for (let x = off3; x < W; x += 40) ctx.fillRect(x, GROUND + 10, 20, 2);

      for (const o of things) drawThing(o);
      drawChef(60, y, dist / 7);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const tap = () => {
    if (phase === "play") input.current();
    else { setScore(0); setPhase("play"); }
  };

  return (
    <div className="px-1 pb-2">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-[15px] font-bold tnum">{tx(lang, "Score", "गुण")} {score}</span>
        <span className="text-[13px] font-semibold text-muted tnum">{tx(lang, "Best", "सर्वोत्तम")} {best}</span>
      </div>
      <div
        className="relative select-none overflow-hidden rounded-[18px] ring-1 ring-line"
        onPointerDown={(e) => { e.preventDefault(); tap(); }}
        onKeyDown={(e) => { if (e.key === " " || e.key === "ArrowUp" || e.key === "Enter") { e.preventDefault(); tap(); } }}
        role="button"
        tabIndex={0}
        aria-label={tx(lang, "Chef Run: tap to jump", "शेफ रन: उडी मारायला टॅप करा")}
        style={{ touchAction: "manipulation" }}
      >
        <canvas ref={canvas} className="block h-auto w-full" style={{ aspectRatio: `${W} / ${H}` }} />
        {phase !== "play" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 text-center backdrop-blur-[2px]">
            <div className="text-[22px] font-bold">{phase === "over" ? tx(lang, "Ouch, hot!", "अरे, गरम!") : "👨‍🍳 Chef Run"}</div>
            <div className="mt-1 text-[13.5px] text-ink/70">
              {phase === "over" ? `${tx(lang, "Score", "गुण")} ${score}` : tx(lang, "Tap to jump. Tap again in the air to jump higher.", "उडी मारायला टॅप करा. हवेत पुन्हा टॅप केलं की अजून उंच.")}
            </div>
            <div className="mt-3 rounded-full bg-jade-deep px-5 py-2 text-[15px] font-semibold text-white">{phase === "over" ? tx(lang, "Play again", "पुन्हा खेळा") : tx(lang, "Start", "सुरू करा")}</div>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
        <span>🔺 {tx(lang, "Samosa +10", "समोसा +10")}</span>
        <span>☕ {tx(lang, "Chai +15", "चहा +15")}</span>
        <span>🔥 {tx(lang, "Jump the flames and pans", "ज्वाळा आणि तवा टाळा")}</span>
      </div>
    </div>
  );
}
