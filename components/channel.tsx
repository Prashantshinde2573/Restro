import clsx from "clsx";
import { Mic, QrCode, MessageCircle, Store, Bike } from "lucide-react";
import type { OrderChannel, OrderStatus } from "@/lib/types";
import { Pill } from "./ui";

const meta: Record<OrderChannel, { label: string; icon: typeof Store; cls: string }> = {
  pos: { label: "Counter", icon: Store, cls: "bg-sunken text-ink" },
  qr: { label: "Table QR", icon: QrCode, cls: "bg-sky-soft text-sky" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, cls: "bg-[#E3F7EA] text-[#128C4A]" },
  swiggy: { label: "Swiggy", icon: Bike, cls: "bg-[#FFEBDD] text-[#E2620C]" },
  zomato: { label: "Zomato", icon: Bike, cls: "bg-rose-soft text-rose" },
  voice: { label: "Voice", icon: Mic, cls: "bg-jade-soft text-jade-deep" },
};

export function ChannelIcon({ channel, size = 40 }: { channel: OrderChannel; size?: number }) {
  const m = meta[channel];
  return (
    <span title={m.label} className={clsx("inline-flex shrink-0 items-center justify-center rounded-full", m.cls)} style={{ width: size, height: size }}>
      <m.icon size={size * 0.45} />
    </span>
  );
}

export const channelLabel = (c: OrderChannel) => meta[c].label;

export function StatusPill({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { tone: "neutral" | "jade" | "saffron" | "rose" | "sky"; label: string }> = {
    new: { tone: "saffron", label: "New" },
    preparing: { tone: "sky", label: "Cooking" },
    ready: { tone: "jade", label: "Ready" },
    served: { tone: "neutral", label: "Served" },
    paid: { tone: "neutral", label: "Paid" },
    cancelled: { tone: "rose", label: "Cancelled" },
  };
  const s = map[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}
