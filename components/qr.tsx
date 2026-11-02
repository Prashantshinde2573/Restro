"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

/**
 * A real, scannable QR code drawn as SVG (no network, works offline).
 * Used for UPI payment QRs (upi://pay?…) and for the printed table QRs.
 */
export function ScanQr({ value, size = 200, label = "QR code", className, logo = true }: { value: string; size?: number; label?: string; className?: string; logo?: boolean }) {
  const path = useMemo(() => {
    // High error correction so the Restropi "R" in the middle never stops it scanning
    const qr = QRCode.create(value, { errorCorrectionLevel: logo ? "H" : "M" });
    const n = qr.modules.size;
    // leave the middle empty for the logo (about 22% of the width)
    const hole = logo ? Math.ceil(n * 0.22) | 1 : 0;
    const h0 = Math.floor((n - hole) / 2);
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (hole && x >= h0 - 1 && x < h0 + hole + 1 && y >= h0 - 1 && y < h0 + hole + 1) continue;
        if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { d, n, hole, h0 };
  }, [value, logo]);
  const q = 2; // quiet zone, in modules
  return (
    <svg
      viewBox={`${-q} ${-q} ${path.n + q * 2} ${path.n + q * 2}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={className}
    >
      <rect x={-q} y={-q} width={path.n + q * 2} height={path.n + q * 2} fill="#fff" />
      <path d={path.d} fill="#14201C" shapeRendering="crispEdges" />
      {path.hole > 0 && (
        <>
          <rect x={path.h0 - 0.5} y={path.h0 - 0.5} width={path.hole + 1} height={path.hole + 1} rx={(path.hole + 1) * 0.24} fill="#fff" />
          <image href="/brand/restropi-mark.png" x={path.h0 + path.hole * 0.08} y={path.h0 + path.hole * 0.08} width={path.hole * 0.84} height={path.hole * 0.84} preserveAspectRatio="xMidYMid meet" />
        </>
      )}
    </svg>
  );
}
