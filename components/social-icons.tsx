import type { SocialType } from "@/lib/bio/theme";

/** Simple monochrome glyphs, drawn to inherit `currentColor`. */
export function SocialIcon({ type, size = 22 }: { type: SocialType; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "instagram":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...p}>
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.4 2.6 2.2 4.4 5 4.6" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...p}>
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
          <path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" />
        </svg>
      );
    case "x":
      return (
        <svg {...p}>
          <path d="M4 4l16 16" />
          <path d="M20 4 4 20" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 10.5V16" />
          <circle cx="8" cy="7.7" r=".6" fill="currentColor" />
          <path d="M12 16v-5.5M12 13c0-1.5 1-2.5 2.3-2.5S16.5 11.4 16.5 13V16" />
        </svg>
      );
    case "github":
      return (
        <svg {...p}>
          <path d="m8.5 8-4 4 4 4" />
          <path d="m15.5 8 4 4-4 4" />
          <path d="m13.5 6-3 12" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...p}>
          <path d="M20 11.5A8 8 0 0 1 8.4 18.6L4 20l1.4-4.2A8 8 0 1 1 20 11.5z" />
          <path d="M9.2 8.8c.2 2.6 3.2 5.6 5.9 5.9l1.2-1.3-2-1-1 .6c-.9-.4-1.6-1.1-2-2l.6-1-1-2z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M13.5 20v-7h2.3M13.5 13H11m2.5 0V10.8c0-1 .6-1.6 1.7-1.6h.8" />
        </svg>
      );
    case "spotify":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M7.5 9.5c3.3-1 6.7-.7 9.5 1" />
          <path d="M8 12.5c2.7-.7 5.4-.4 7.7 1" />
          <path d="M8.6 15.4c2-.5 4-.3 5.7.7" />
        </svg>
      );
    case "email":
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7.5 8 5.5 8-5.5" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
      );
  }
}
