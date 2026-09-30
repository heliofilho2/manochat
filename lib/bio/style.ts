/**
 * Turns the saved bio settings into concrete CSS values. Pure: the page and
 * the editor preview both call it, and it is unit-tested.
 */
import { SHAPES, THEMES, type BioSettings } from "./theme";

type Css = Record<string, string | number>;

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return "#111111";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.45 ? "#111111" : "#FFFFFF";
}

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export interface ResolvedStyle {
  text: string;
  muted: string;
  card: string;
  line: string;
  /** Styles of the content panel, or null when there is no frame. */
  frame: Css | null;
  accent: string;
  accentFg: string;
  radius: string;
  wallpaper: Css;
  /** Blur the profile photo behind the page. */
  blurPhoto: boolean;
  /** Dim layer over blur/image wallpapers, for legibility. */
  overlay: string | null;
  button: Css;
  hover: boolean;
  fontVar: string;
}

const FONT_VAR: Record<string, string> = {
  jakarta: "var(--font-jakarta)",
  serif: "var(--font-bio-serif)",
  mono: "var(--font-bio-mono)",
  rounded: "var(--font-bio-rounded)",
  display: "var(--font-bio-display)",
  elegant: "var(--font-bio-elegant)",
};

export function resolveStyle(s: BioSettings): ResolvedStyle {
  const t = THEMES[s.theme] ?? THEMES.papel;
  const st = s.style;
  const framed = st.frame !== "none";
  const frameBg = st.frameColor ?? t.card;
  // Inside a custom-coloured panel the text follows the panel, not the wallpaper.
  const wallInk = st.textColor ?? t.ink;
  const text = st.textColor ?? (framed && st.frameColor ? readableOn(st.frameColor) : t.ink);
  const base = st.wallpaper.color ?? t.bg;

  let wallpaper: Css = { background: base };
  let blurPhoto = false;
  let overlay: string | null = null;
  switch (st.wallpaper.type) {
    case "gradient":
      wallpaper = {
        background: `linear-gradient(${st.wallpaper.angle}deg, ${base}, ${st.wallpaper.color2 ?? t.card})`,
      };
      break;
    case "blur":
      blurPhoto = true;
      overlay = mix(base, 35);
      break;
    case "pattern": {
      const ink = mix(wallInk, 14);
      const size = "22px 22px";
      wallpaper =
        st.wallpaper.pattern === "grid"
          ? {
              backgroundColor: base,
              backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
              backgroundSize: size,
            }
          : st.wallpaper.pattern === "lines"
            ? {
                backgroundColor: base,
                backgroundImage: `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 14px)`,
              }
            : {
                backgroundColor: base,
                backgroundImage: `radial-gradient(${ink} 1.6px, transparent 1.7px)`,
                backgroundSize: size,
              };
      break;
    }
    case "image":
      wallpaper = st.wallpaper.image
        ? {
            backgroundColor: base,
            backgroundImage: `url(${st.wallpaper.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : { background: base };
      overlay = st.wallpaper.image ? mix(base, 30) : null;
      break;
  }

  const btnBg = st.button.color ?? t.btnBg;
  const btnFg = st.button.text ?? (st.button.color ? readableOn(st.button.color) : t.btnFg);
  let button: Css;
  switch (st.button.style) {
    case "outline":
      button = { background: "transparent", color: text, border: `2px solid ${btnBg}` };
      break;
    case "soft":
      button = { background: mix(btnBg, 16), color: text, border: "1.5px solid transparent" };
      break;
    case "glass":
      button = framed
        ? // white-on-white would vanish inside a light panel
          { background: mix(text, 8), color: text, border: `1.5px solid ${mix(text, 22)}` }
        : {
            background: "rgba(255,255,255,0.16)",
            color: text,
            border: "1.5px solid rgba(255,255,255,0.35)",
            backdropFilter: "blur(12px)",
          };
      break;
    case "hard": {
      const face = st.button.color ?? frameBg;
      button = {
        background: face,
        color: st.button.text ?? readableOn(face),
        border: `2px solid ${text}`,
        boxShadow: `4px 4px 0 ${text}`,
      };
      break;
    }
    default:
      button = { background: btnBg, color: btnFg, border: `1.5px solid ${btnBg}` };
  }

  return {
    text,
    muted: st.textColor ? mix(text, 65) : t.muted,
    card: frameBg,
    line: t.line,
    frame: framed
      ? ({
          background: frameBg,
          borderRadius: 28,
          ...(st.frame === "outline"
            ? { border: `2px solid ${text}`, boxShadow: `6px 6px 0 ${text}` }
            : { border: `1px solid ${mix(text, 10)}`, boxShadow: "0 24px 60px rgba(0,0,0,.18)" }),
        } as Css)
      : null,
    accent: t.accent,
    accentFg: t.accentFg,
    radius: SHAPES[s.shape] ?? SHAPES.arredondado,
    wallpaper,
    blurPhoto,
    overlay,
    button,
    hover: st.button.lift,
    fontVar: FONT_VAR[st.font] ?? FONT_VAR.jakarta,
  };
}
