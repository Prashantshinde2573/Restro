"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

/**
 * A real, scannable QR code drawn as SVG (no network, works offline).
 * Used for UPI payment QRs (upi://pay?…) and for the printed table QRs.
 */
export function ScanQr({ value, size = 200, label = "QR code", className }: { value: string; size?: number; label?: string; className?: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { d, n };
  }, [value]);
  const q = 2; // quiet zone, in modules
  return (
    <svg
      viewBox={`${-q} ${-q} ${path.n + q * 2} ${path.n + q * 2}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
    >
      <rect x={-q} y={-q} width={path.n + q * 2} height={path.n + q * 2} fill="#fff" />
      <path d={path.d} fill="#14201C" />
    </svg>
  );
}
