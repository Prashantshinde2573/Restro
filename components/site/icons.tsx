// Rastropi's own line icons for the public website: 32px grid, 1.6 stroke,
// round caps. Inside a `.group` they redraw themselves on hover.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
function Base({ size = 32, children, className, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`site-icon ${className ?? ""}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBill = (p: P) => (
  <Base {...p}>
    <path d="M8 4h16v24l-2.7-1.8L18.7 28 16 26.2 13.3 28l-2.6-1.8L8 28z" />
    <path d="M12.5 10.5h7M12.5 10.5c3.6 0 3.6 4.6 0 4.6h-1M19.5 13h-7M12 15.1l6 5.4" />
  </Base>
);
export const IconTable = (p: P) => (
  <Base {...p}>
    <rect x="8" y="10" width="16" height="12" rx="2.5" />
    <path d="M12 6.5h8M12 25.5h8M4.5 13.5v5M27.5 13.5v5" />
    <path d="M13 16h6" opacity=".55" />
  </Base>
);
export const IconKitchen = (p: P) => (
  <Base {...p}>
    <path d="M5 22.5h22M7 22.5a9 9 0 0 1 18 0" />
    <path d="M16 13.5v-1.5M14 26h4" />
    <path d="M12 9c-1-1.2 1-2.2 0-3.5M16 8c-1-1.2 1-2.2 0-3.5M20 9c-1-1.2 1-2.2 0-3.5" />
  </Base>
);
export const IconStock = (p: P) => (
  <Base {...p}>
    <path d="M6 13.5h20v13H6z" />
    <path d="M9 13.5V9.5h14v4M12 9.5V5.5h8v4" />
    <path d="M13 19.5h6" />
  </Base>
);
export const IconTeam = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="11.5" r="4" />
    <path d="M4.5 26c.8-4.4 3.8-7 7.5-7s6.7 2.6 7.5 7" />
    <circle cx="22.5" cy="10" r="3" />
    <path d="M21 17.2c3.3-.4 6 1.8 6.6 6" />
  </Base>
);
export const IconGuests = (p: P) => (
  <Base {...p}>
    <path d="M16 27s-10-5.7-10-13A5.5 5.5 0 0 1 16 10.6 5.5 5.5 0 0 1 26 14c0 7.3-10 13-10 13z" />
    <path d="M12 15.5h8" opacity=".55" />
  </Base>
);
export const IconReports = (p: P) => (
  <Base {...p}>
    <path d="M5 27h22" />
    <path d="M8 27v-7M14 27v-11M20 27v-8M26 27V9" />
    <path d="M6 14l7-5 6 4 7-8" />
  </Base>
);
export const IconPulse = (p: P) => (
  <Base {...p}>
    <path d="M3 17h5l3-7 4 14 4-11 2.5 4H29" />
  </Base>
);
export const IconVoice = (p: P) => (
  <Base {...p}>
    <rect x="12" y="4" width="8" height="15" rx="4" />
    <path d="M7.5 15a8.5 8.5 0 0 0 17 0M16 23.5V28M12 28h8" />
  </Base>
);
export const IconSplit = (p: P) => (
  <Base {...p}>
    <rect x="4" y="4" width="10" height="10" rx="1.5" />
    <rect x="18" y="4" width="10" height="10" rx="1.5" />
    <rect x="4" y="18" width="10" height="10" rx="1.5" />
    <path d="M18 18h4v4M28 18v10h-6M22 25.5V28" />
    <path d="M8 8h2v2H8zM22 8h2v2h-2zM8 22h2v2H8z" />
  </Base>
);
export const IconForecast = (p: P) => (
  <Base {...p}>
    <rect x="4" y="6.5" width="24" height="21" rx="3" />
    <path d="M4 12.5h24M10 4v5M22 4v5" />
    <path d="M16 16.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" />
  </Base>
);
export const IconShield = (p: P) => (
  <Base {...p}>
    <path d="M16 4l10 4v7.5c0 6-4.2 10.4-10 12.5C10.2 25.9 6 21.5 6 15.5V8z" />
    <path d="M11.5 16l3 3 6-6.5" />
  </Base>
);
export const IconStar = (p: P) => (
  <Base {...p}>
    <path d="M16 4.5l3.4 7 7.6 1.1-5.5 5.4 1.3 7.6L16 22l-6.8 3.6 1.3-7.6L5 12.6l7.6-1.1z" />
  </Base>
);
export const IconChat = (p: P) => (
  <Base {...p}>
    <path d="M16 4.5a11.5 11.5 0 0 0-9.9 17.3L4.5 27.5l5.9-1.5A11.5 11.5 0 1 0 16 4.5z" />
    <path d="M11.5 12.5c.5 3.6 3.6 6.8 7.4 7.5l1.6-1.8-2.4-1.2-1.2 1.1c-1.3-.6-2.5-1.8-3.1-3.1l1.1-1.2-1.2-2.4z" />
  </Base>
);
export const IconOffline = (p: P) => (
  <Base {...p}>
    <path d="M9 24.5h13.5a5.5 5.5 0 0 0 .9-10.9A8 8 0 0 0 9.2 11.4 6.5 6.5 0 0 0 9 24.5z" />
    <path d="M5 5l22 22" />
  </Base>
);
export const IconArrow = ({ size = 20, className, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} {...rest}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);
export const IconMenu = ({ size = 22, open = false }: { size?: number; open?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
    <path d={open ? "M5 5l12 12" : "M3 8h16"} style={{ transition: "d .3s" }} />
    <path d={open ? "M17 5L5 17" : "M3 14h16"} style={{ transition: "d .3s" }} />
  </svg>
);
