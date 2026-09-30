/** Themes, shapes and the shared bio view model. Pure and client-safe. */

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
};

export const THEME_LIST: [key: string, label: string][] = [
  ["papel", "Papel"],
  ["noite", "Noite"],
  ["laranja", "Laranja"],
  ["menta", "Menta"],
  ["lilas", "Lilás"],
  ["mono", "Mono"],
];

export const SHAPES: Record<string, string> = { arredondado: "16px", pilula: "999px", reto: "4px" };
export const POST_LAYOUTS = ["grid3", "grid2", "carrossel", "lista"] as const;
export type PostLayout = (typeof POST_LAYOUTS)[number];

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
  manual: { id: string; label: string; url: string }[];
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
};

/** A button on the page: an active automation, or a manual link. */
export interface BioItem {
  id: string;
  kind: "auto" | "manual";
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

/** Automations (active) + manual links, ordered by `order`, flagged by `hidden`. */
export function buildItems(b: BioSettings, autos: AutoLike[]): BioItem[] {
  const all: BioItem[] = [
    ...autos
      .filter((a) => a.keywords.length > 0)
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
      kind: "manual" as const,
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
