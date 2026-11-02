"use client";

// Charts that read at a glance: gridlines with values, the peak and the latest
// point labelled, an average line, and a tooltip on hover / tap.
import clsx from "clsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type Point = { label: string; value: number; ghost?: number; hint?: string };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Nice round steps for the value axis. */
function ticks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
const short = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(Math.round(n)));

/** Smooth path through points (monotone-ish cubic). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cx = (x1 - x0) * 0.42;
    d += ` C${x0 + cx},${y0} ${x1 - cx},${y1} ${x1},${y1}`;
  }
  return d;
}

/** Sales over days: a smooth area with the trend, average and latest value. */
export function TrendChart({
  data,
  height = 220,
  format = (n) => String(n),
  avgLabel = "Avg",
  className,
}: {
  data: Point[];
  height?: number;
  format?: (n: number) => string;
  avgLabel?: string;
  className?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const padL = 40, padR = 14, padT = 26, padB = 26;
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.ghost ?? 0)));
  const tk = ticks(max);
  const top = tk[tk.length - 1];
  const iw = Math.max(1, w - padL - padR), ih = height - padT - padB;
  const x = (i: number) => padL + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => padT + ih - (v / top) * ih;
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = smooth(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${padT + ih} L${pts[0][0]},${padT + ih} Z` : "";
  const ghost = data.some((d) => d.ghost !== undefined) ? smooth(data.map((d, i) => [x(i), y(d.ghost ?? 0)] as [number, number])) : "";
  const avg = data.reduce((s, d) => s + d.value, 0) / Math.max(1, data.length);
  const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  const last = data.length - 1;
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 46)));
  const h = hover ?? null;

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const i = Math.round(((px - padL) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div ref={ref} className={clsx("relative w-full select-none", className)} style={{ height }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          className="overflow-visible"
          onMouseMove={(e) => pick(e.clientX, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => pick(e.touches[0].clientX, e.currentTarget)}
          onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget)}
          role="img"
          aria-label={`Chart: ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`}
        >
          <defs>
            <linearGradient id={`a${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--jade))" stopOpacity="0.28" />
              <stop offset="100%" stopColor="rgb(var(--jade))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {tk.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-faint text-[10.5px] tnum">{short(t)}</text>
            </g>
          ))}
          {ghost && <path d={ghost} fill="none" stroke="rgb(var(--faint))" strokeWidth={1.6} strokeDasharray="4 4" />}
          <path d={area} fill={`url(#a${gid})`} />
          <path d={line} fill="none" stroke="rgb(var(--jade))" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          {/* average */}
          {data.length > 2 && avg > 0 && (
            <g>
              <line x1={padL} x2={padL + iw} y1={y(avg)} y2={y(avg)} stroke="rgb(var(--saffron))" strokeWidth={1.2} strokeDasharray="5 4" />
              <rect x={padL + 4} y={y(avg) - 17} width={(avgLabel.length + format(Math.round(avg)).length + 1) * 6.2 + 10} height={15} rx={7.5} fill="rgb(var(--saffron-soft))" />
              <text x={padL + 9} y={y(avg) - 6} className="fill-saffron text-[10.5px] font-semibold">{avgLabel} {format(Math.round(avg))}</text>
            </g>
          )}
          {data.map((d, i) => (i % every === 0 || i === last ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className={clsx("text-[10.5px]", i === last ? "fill-ink font-semibold" : "fill-faint")}>{d.label}</text>
          ) : null))}
          {/* peak + latest */}
          {data.length > 1 && data[peak].value > 0 && peak !== last && h === null && (
            <g>
              <circle cx={x(peak)} cy={y(data[peak].value)} r={3.5} fill="rgb(var(--surface))" stroke="rgb(var(--jade))" strokeWidth={2} />
              <text x={x(peak)} y={y(data[peak].value) - 9} textAnchor="middle" className="fill-muted text-[10.5px] font-semibold">Best {format(data[peak].value)}</text>
            </g>
          )}
          {pts[last] && h === null && (
            <g>
              <circle cx={pts[last][0]} cy={pts[last][1]} r={9} fill="rgb(var(--jade))" opacity={0.15} />
              <circle cx={pts[last][0]} cy={pts[last][1]} r={4.5} fill="rgb(var(--jade))" stroke="rgb(var(--surface))" strokeWidth={2} />
            </g>
          )}
          {h !== null && pts[h] && (
            <g>
              <line x1={pts[h][0]} x2={pts[h][0]} y1={padT - 6} y2={padT + ih} stroke="rgb(var(--ink))" strokeOpacity={0.25} />
              <circle cx={pts[h][0]} cy={pts[h][1]} r={5} fill="rgb(var(--jade))" stroke="rgb(var(--surface))" strokeWidth={2.5} />
            </g>
          )}
        </svg>
      )}
      {h !== null && pts[h] && (
        <Tip x={pts[h][0]} y={pts[h][1]} w={w} title={data[h].hint ?? data[h].label} value={format(data[h].value)} sub={data[h].ghost !== undefined ? `Last time ${format(data[h].ghost!)}` : undefined} />
      )}
    </div>
  );
}

/** Bars with a value scale, the busiest bar labelled and an optional "usual" shadow. */
export function BarChart({
  data,
  height = 200,
  format = (n) => String(n),
  highlightLast = false,
  className,
}: {
  data: Point[];
  height?: number;
  format?: (n: number) => string;
  highlightLast?: boolean;
  className?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const padL = 34, padR = 6, padT = 24, padB = 24;
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.ghost ?? 0)));
  const tk = ticks(max, 3);
  const top = tk[tk.length - 1];
  const iw = Math.max(1, w - padL - padR), ih = height - padT - padB;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(4, Math.min(34, slot * 0.62));
  const y = (v: number) => padT + ih - (v / top) * ih;
  const peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 34)));
  const geo = useMemo(() => data.map((d, i) => ({ cx: padL + slot * i + slot / 2, top: y(d.value), gtop: d.ghost !== undefined ? y(d.ghost) : null })), [data, slot, top, ih]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className={clsx("relative w-full select-none", className)} style={{ height }} onMouseLeave={() => setHover(null)}>
      {w > 0 && (
        <svg width={w} height={height} className="overflow-visible" role="img" aria-label={`Chart: ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`}>
          <defs>
            <linearGradient id={`b${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--jade))" />
              <stop offset="100%" stopColor="rgb(var(--jade-deep))" />
            </linearGradient>
          </defs>
          {tk.map((t) => (
            <g key={t}>
              <line x1={padL} x2={padL + iw} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={padL - 7} y={y(t) + 4} textAnchor="end" className="fill-faint text-[10.5px] tnum">{short(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const g = geo[i];
            const dim = (highlightLast && i !== data.length - 1) || (hover !== null && hover !== i);
            const hgt = Math.max(d.value ? 3 : 0, padT + ih - g.top);
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} onTouchStart={() => setHover(i)} className="cursor-pointer">
                <rect x={g.cx - slot / 2} y={padT} width={slot} height={ih} fill="transparent" />
                {g.gtop !== null && <rect x={g.cx - bw / 2} y={g.gtop} width={bw} height={Math.max(0, padT + ih - g.gtop)} rx={Math.min(6, bw / 3)} fill="rgb(var(--sunken))" stroke="rgb(var(--line))" strokeDasharray="3 3" />}
                <rect
                  x={g.cx - bw / 2 + (g.gtop !== null ? bw * 0.18 : 0)}
                  y={padT + ih - hgt}
                  width={g.gtop !== null ? bw * 0.64 : bw}
                  height={hgt}
                  rx={Math.min(6, bw / 3)}
                  fill={`url(#b${gid})`}
                  opacity={dim ? 0.35 : 1}
                  style={{ transition: "opacity .2s" }}
                />
                {(i % every === 0 || i === data.length - 1) && (
                  <text x={g.cx} y={height - 6} textAnchor="middle" className={clsx("text-[10.5px]", i === data.length - 1 && highlightLast ? "fill-ink font-semibold" : "fill-faint")}>{d.label}</text>
                )}
              </g>
            );
          })}
          {hover === null && data[peak]?.value > 0 && (
            <text x={geo[peak].cx} y={geo[peak].top - 7} textAnchor="middle" className="fill-ink text-[10.5px] font-semibold">{format(data[peak].value)}</text>
          )}
        </svg>
      )}
      {hover !== null && geo[hover] && (
        <Tip x={geo[hover].cx} y={geo[hover].top} w={w} title={data[hover].hint ?? data[hover].label} value={format(data[hover].value)} sub={data[hover].ghost !== undefined ? `Usual ${format(data[hover].ghost!)}` : undefined} />
      )}
    </div>
  );
}

function Tip({ x, y, w, title, value, sub }: { x: number; y: number; w: number; title: string; value: string; sub?: string }) {
  const left = Math.max(4, Math.min(w - 132, x - 66));
  return (
    <div className="pointer-events-none absolute z-10 w-[132px] rounded-[12px] bg-ink px-3 py-2 text-canvas shadow-float" style={{ left, top: Math.max(-8, y - 66) }}>
      <div className="text-[11px] opacity-70">{title}</div>
      <div className="text-[15px] font-semibold tnum">{value}</div>
      {sub && <div className="text-[11px] opacity-70">{sub}</div>}
    </div>
  );
}

/** Share of a total, as a ring with the total in the middle and a legend. */
export function Donut({
  parts,
  total,
  centerLabel,
  format = (n) => String(n),
  size = 150,
}: {
  parts: { label: string; value: number; color: string }[];
  total?: number;
  centerLabel: string;
  format?: (n: number) => string;
  size?: number;
}) {
  const sum = total ?? parts.reduce((s, p) => s + p.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--sunken))" strokeWidth={16} />
          {sum > 0 &&
            parts.map((p) => {
              const len = (p.value / sum) * c;
              const el = (
                <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={16} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} strokeLinecap="butt" style={{ transition: "stroke-dasharray .6s" }} />
              );
              acc += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted">{centerLabel}</span>
          <span className="text-[17px] font-semibold tracking-tight tnum">{format(sum)}</span>
        </div>
      </div>
      <ul className="min-w-[150px] flex-1 space-y-2.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2.5 text-[14px]">
            <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: p.color }} />
            <span className="flex-1 font-medium">{p.label}</span>
            <span className="text-[12.5px] text-muted tnum">{sum ? Math.round((p.value / sum) * 100) : 0}%</span>
            <span className="w-20 text-right font-semibold tnum">{format(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
