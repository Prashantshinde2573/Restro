export const inr = (n: number, opts: { decimals?: boolean } = {}) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  });

export const minutesSince = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

export const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 0) return `in ${-m} min`;
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const orderTotal = (lines: { qty: number; price: number }[]) =>
  lines.reduce((s, l) => s + l.qty * l.price, 0);

/** Restaurant GST rate (5% by default; the owner can change it per outlet in Settings → Details on bills). */
let currentGst = 0.05;
export const gstRate = () => currentGst;
export function setGstRate(r: number | undefined) {
  currentGst = typeof r === "number" && r >= 0 && r < 1 ? r : 0.05;
}
/** "2.5%" — half the rate, for the CGST / SGST lines. */
export const halfGstLabel = () => `${+((currentGst * 100) / 2).toFixed(2)}%`;
/** "5%" */
export const gstLabel = () => `${+(currentGst * 100).toFixed(2)}%`;
