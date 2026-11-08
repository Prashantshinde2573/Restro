import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The picture shown when a Restropi link is shared (WhatsApp, LinkedIn, X, Google).
export const alt = "Restropi: restaurant billing, KOT and QR ordering app";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const mark = await readFile(join(process.cwd(), "public/brand/restropi-mark.png"));
  const src = `data:image/png;base64,${mark.toString("base64")}`;
  const chips = ["Billing + UPI QR", "Kitchen (KOT)", "QR ordering", "Stock", "Team"];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "linear-gradient(135deg, #F3F4F1 0%, #E3F1EB 100%)", color: "#14201B" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={70} height={72} alt="" />
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Restropi</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5, maxWidth: 960 }}>Run the whole restaurant from one calm screen.</div>
          <div style={{ marginTop: 22, fontSize: 30, color: "#4C5A54" }}>For cafés, restaurants and cloud kitchens in India</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {chips.map((c) => (
            <div key={c} style={{ display: "flex", padding: "12px 22px", borderRadius: 999, background: "#ffffff", fontSize: 24, fontWeight: 600, color: "#0E7A5F" }}>{c}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
