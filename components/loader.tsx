// Loader: a spoon spins and turns into a fork, then back, with two swooshes.
// Redrawn from the "Cooking loader" Lottie file as plain SVG + CSS (no player
// needed, sharp at any size). Animation lives in app/globals.css (.ck-*).

export function CookingLoader({ size = 72, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <svg role="img" aria-label={label} viewBox="-75 -75 150 150" width={size} height={size} className="ck">
      <g className="ck-spin">
        {/* swooshes */}
        <g fill="none" strokeWidth="9" strokeLinecap="round" className="ck-swoosh">
          <path d="M34.2 -27C53.1 -8.1 53.1 22.6 34.2 41.5" pathLength={100} />
          <path d="M-34.2 41.5C-53.1 22.6 -53.1 -8.1 -34.2 -27" pathLength={100} />
        </g>
        {/* spoon */}
        <g className="ck-spoon">
          <line x1="0" y1="-12" x2="0" y2="57" strokeWidth="11" strokeLinecap="round" />
          <ellipse cx="0" cy="-33.3" rx="20.9" ry="26.7" />
        </g>
        {/* fork (drawn upside down: it turns up after half a spin) */}
        <g className="ck-fork" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="scale(1 -1)">
          <path d="M15.8 -52V-28A15.8 15.8 0 0 1 -15.8 -28V-52" strokeWidth="8.5" />
          <line x1="0" y1="-52" x2="0" y2="-15" strokeWidth="8.5" />
          <line x1="0" y1="-12" x2="0" y2="54" strokeWidth="11" />
        </g>
      </g>
    </svg>
  );
}

/** Full-screen loader (app start, sign-in checks, page changes). */
export function FullLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" aria-busy="true">
      <CookingLoader label={label} />
    </div>
  );
}
