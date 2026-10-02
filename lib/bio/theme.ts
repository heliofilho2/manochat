/** Themes, style options and the shared bio view model. Pure and client-safe. */

export interface Theme {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  btnBg: string;
  btnFg: string;
  btnLine: string;
  accent: string;
  accentFg: string;
  dispWeight: number;
}

export const THEMES: Record<string, Theme> = {
  papel: { bg: "#F8F5F0", card: "#FFFFFF", ink: "#2B2724", muted: "#7C756C", line: "#ECE6DD", btnBg: "#2B2724", btnFg: "#FFFFFF", btnLine: "#2B2724", accent: "#F08C6E", accentFg: "#2B2724", dispWeight: 700 },
  noite: { bg: "#16130F", card: "#221E18", ink: "#F8F5F0", muted: "#A89F92", line: "#4F4841", btnBg: "#F08C6E", btnFg: "#16130F", btnLine: "#F08C6E", accent: "#16130F", accentFg: "#F4A184", dispWeight: 700 },
  laranja: { bg: "#F08C6E", card: "#FDEEE7", ink: "#2B2724", muted: "#3A1A0E", line: "#2B2724", btnBg: "#2B2724", btnFg: "#FDEEE7", btnLine: "#2B2724", accent: "#F08C6E", accentFg: "#2B2724", dispWeight: 800 },
  menta: { bg: "#DCEFE4", card: "#F3FBF6", ink: "#0F2A1D", muted: "#3F6452", line: "#B9DCC8", btnBg: "#0F2A1D", btnFg: "#DCEFE4", btnLine: "#0F2A1D", accent: "#7DD3A5", accentFg: "#0F2A1D", dispWeight: 700 },
  lilas: { bg: "#E8E3FF", card: "#F7F5FF", ink: "#1C1640", muted: "#4F4880", line: "#CFC6FF", btnBg: "#1C1640", btnFg: "#F7F5FF", btnLine: "#1C1640", accent: "#B6A8FF", accentFg: "#1C1640", dispWeight: 700 },
  mono: { bg: "#FFFFFF", card: "#FFFFFF", ink: "#000000", muted: "#555555", line: "#000000", btnBg: "#FFFFFF", btnFg: "#000000", btnLine: "#000000", accent: "#000000", accentFg: "#FFFFFF", dispWeight: 600 },
  areia: { bg: "#EFE6D8", card: "#FAF5EC", ink: "#3B2F22", muted: "#7A6A56", line: "#D9CBB5", btnBg: "#3B2F22", btnFg: "#FAF5EC", btnLine: "#3B2F22", accent: "#C9A26B", accentFg: "#3B2F22", dispWeight: 700 },
  oceano: { bg: "#0E2A47", card: "#153A5E", ink: "#EAF4FF", muted: "#9DB9D6", line: "#2A5686", btnBg: "#5CC8FF", btnFg: "#06263F", btnLine: "#5CC8FF", accent: "#5CC8FF", accentFg: "#06263F", dispWeight: 700 },
  rosa: { bg: "#FFE3EC", card: "#FFF5F8", ink: "#4A1230", muted: "#8C4A6A", line: "#F5B9CF", btnBg: "#E11D74", btnFg: "#FFFFFF", btnLine: "#E11D74", accent: "#E11D74", accentFg: "#FFFFFF", dispWeight: 800 },
  floresta: { bg: "#0F2A1D", card: "#173B29", ink: "#E8F5EC", muted: "#94B8A3", line: "#2C5A40", btnBg: "#7DD3A5", btnFg: "#0F2A1D", btnLine: "#7DD3A5", accent: "#7DD3A5", accentFg: "#0F2A1D", dispWeight: 700 },
};

export const THEME_LIST: [key: string, label: string][] = [
  ["papel", "Papel"],
  ["noite", "Noite"],
  ["laranja", "Laranja"],
  ["menta", "Menta"],
  ["lilas", "Lilás"],
  ["mono", "Mono"],
  ["areia", "Areia"],
  ["oceano", "Oceano"],
  ["rosa", "Rosa"],
  ["floresta", "Floresta"],
];

export const SHAPES: Record<string, string> = { arredondado: "16px", pilula: "999px", reto: "4px", quadrado: "0px" };
export const POST_LAYOUTS = ["grid3", "grid2", "carrossel", "lista"] as const;
export type PostLayout = (typeof POST_LAYOUTS)[number];

export const HEADER_LAYOUTS = ["classic", "hero", "banner", "side"] as const;
export const WALLPAPERS = ["solid", "gradient", "blur", "pattern", "image"] as const;
export const PATTERNS = ["dots", "grid", "lines"] as const;
export const BUTTON_STYLES = ["fill", "outline", "soft", "glass", "hard"] as const;
export const BUTTON_LAYOUTS = ["list", "grid"] as const;
export const FRAMES = ["none", "card", "outline"] as const;
export const FONTS = ["jakarta", "serif", "mono", "rounded", "display", "elegant"] as const;
export const SOCIAL_TYPES = [
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "linkedin",
  "github",
  "whatsapp",
  "facebook",
  "spotify",
  "email",
  "site",
] as const;

export type SocialType = (typeof SOCIAL_TYPES)[number];

export const SOCIAL_LABELS: Record<SocialType, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  github: "GitHub",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  spotify: "Spotify",
  email: "E-mail",
  site: "Site",
};

export interface BioStyle {
  header: (typeof HEADER_LAYOUTS)[number];
  /** Shown instead of @username when set. */
  title: string;
  wallpaper: {
    type: (typeof WALLPAPERS)[number];
    /** null = the theme's background */
    color: string | null;
    color2: string | null;
    angle: number;
    pattern: (typeof PATTERNS)[number];
    /** Small JPEG data URL, only for type "image". */
    image: string | null;
  };
  button: {
    style: (typeof BUTTON_STYLES)[number];
    layout: (typeof BUTTON_LAYOUTS)[number];
    color: string | null;
    text: string | null;
    lift: boolean;
  };
  /** A rectangular panel holding the content, distinct from the wallpaper. */
  frame: (typeof FRAMES)[number];
  /** null = the theme's card colour */
  frameColor: string | null;
  font: (typeof FONTS)[number];
  textColor: string | null;
  socials: { type: SocialType; url: string }[];
  showBranding: boolean;
  /** List the active automations ("Comente PALAVRA…") on the page. Off by default. */
  showAutomations: boolean;
}

export const DEFAULT_STYLE: BioStyle = {
  header: "classic",
  title: "",
  wallpaper: { type: "solid", color: null, color2: null, angle: 160, pattern: "dots", image: null },
  button: { style: "fill", layout: "list", color: null, text: null, lift: true },
  frame: "none",
  frameColor: null,
  font: "jakarta",
  textColor: null,
  socials: [],
  showBranding: true,
  showAutomations: false,
};

/** Applied when a preset is picked, so each theme feels different, not just recoloured. */
export const PRESET_STYLE: Record<string, Partial<Pick<BioStyle, "font"> & { wallpaper: Partial<BioStyle["wallpaper"]>; button: Partial<BioStyle["button"]>; header: BioStyle["header"] }>> = {
  papel: {},
  noite: { button: { style: "fill" } },
  laranja: { font: "display", button: { style: "hard" } },
  menta: { font: "rounded", button: { style: "soft" } },
  lilas: { wallpaper: { type: "gradient", color: "#E8E3FF", color2: "#CFC6FF", angle: 160 }, button: { style: "glass" } },
  mono: { font: "mono", button: { style: "outline" } },
  areia: { font: "elegant", wallpaper: { type: "pattern", pattern: "dots" }, button: { style: "outline" } },
  oceano: { wallpaper: { type: "gradient", color: "#0E2A47", color2: "#1C5D99", angle: 170 }, button: { style: "glass" } },
  rosa: { font: "rounded", wallpaper: { type: "gradient", color: "#FFE3EC", color2: "#FFC2D9", angle: 160 }, button: { style: "fill" } },
  floresta: { font: "serif", wallpaper: { type: "pattern", pattern: "lines" }, button: { style: "soft" } },
};

export interface ManualLink {
  id: string;
  label: string;
  url: string;
  /** "heading" is a section title with no URL. */
  type?: "link" | "heading";
}

export interface BioSettings {
  theme: string;
  shape: string;
  bio: string;
  photo: string | null;
  showFollowers: boolean;
  showPosts: boolean;
  postLayout: string;
  order: string[];
  hidden: string[];
  manual: ManualLink[];
  style: BioStyle;
}

export const DEFAULT_BIO: BioSettings = {
  theme: "papel",
  shape: "arredondado",
  bio: "",
  photo: null,
  showFollowers: true,
  showPosts: true,
  postLayout: "grid3",
  order: [],
  hidden: [],
  manual: [],
  style: DEFAULT_STYLE,
};

/** Fills gaps in a stored (possibly older/partial) style with the defaults. */
export function mergeStyle(raw: unknown): BioStyle {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<BioStyle>;
  return {
    ...DEFAULT_STYLE,
    ...r,
    wallpaper: { ...DEFAULT_STYLE.wallpaper, ...(r.wallpaper ?? {}) },
    button: { ...DEFAULT_STYLE.button, ...(r.button ?? {}) },
    socials: Array.isArray(r.socials) ? r.socials : [],
  };
}

/** A button on the page: an active automation, a manual link, or a section title. */
export interface BioItem {
  id: string;
  kind: "auto" | "manual" | "heading";
  label: string;
  /** auto only */
  keyword: string;
  /** auto only: the post it points at, when scoped to exactly one. */
  postId: string | null;
  /** manual only */
  url: string;
  hidden: boolean;
}

interface AutoLike {
  id: string;
  name: string;
  keywords: string[];
  scope: string;
  postIds: string[];
}

/**
 * Manual entries, plus the active automations when the owner turned them on,
 * ordered by `order` and flagged by `hidden`.
 */
export function buildItems(b: BioSettings, autos: AutoLike[]): BioItem[] {
  const all: BioItem[] = [
    ...autos
      .filter((a) => b.style.showAutomations && a.keywords.length > 0)
      .map((a) => ({
        id: a.id,
        kind: "auto" as const,
        label: a.name,
        keyword: a.keywords[0].toUpperCase(),
        postId: a.scope === "specific_posts" && a.postIds.length === 1 ? a.postIds[0] : null,
        url: "",
        hidden: false,
      })),
    ...b.manual.map((m) => ({
      id: m.id,
      kind: m.type === "heading" ? ("heading" as const) : ("manual" as const),
      label: m.label,
      keyword: "",
      postId: null,
      url: m.url,
      hidden: false,
    })),
  ];
  const ix = (id: string) => {
    const i = b.order.indexOf(id);
    return i < 0 ? 999 : i;
  };
  return all.sort((x, y) => ix(x.id) - ix(y.id)).map((it) => ({ ...it, hidden: b.hidden.includes(it.id) }));
}

/** Only http(s) links may be stored/redirected to. */
export function safeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Where a social icon points. Accepts a handle, a number or a full URL. */
export function socialHref(type: SocialType, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (type === "email") return /^\S+@\S+\.\S+$/.test(v) ? `mailto:${v}` : null;
  if (type === "whatsapp") {
    const digits = v.replace(/\D/g, "");
    if (/^https?:\/\//i.test(v)) return safeUrl(v);
    return digits.length >= 10 ? `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}` : null;
  }
  if (/^https?:\/\//i.test(v)) return safeUrl(v);
  if (type === "site") return v.includes(".") && !/\s/.test(v) ? safeUrl(`https://${v}`) : null;
  const handle = v.replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]+$/.test(handle)) return null;
  const base: Partial<Record<SocialType, string>> = {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/@",
    youtube: "https://youtube.com/@",
    x: "https://x.com/",
    linkedin: "https://linkedin.com/in/",
    github: "https://github.com/",
    facebook: "https://facebook.com/",
  };
  return base[type] ? `${base[type]}${handle}` : null;
}
