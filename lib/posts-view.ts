/** Client-safe view model of a cached Instagram post. */

export interface PostView {
  id: string;
  type: "Reel" | "Imagem" | "Carrossel";
  caption: string;
  imageUrl: string | null;
  tone: string;
  date: string;
  permalink: string | null;
}

const TONES = ["#EAD3C3", "#CDBBA7", "#F4C3AE", "#DCD3C6", "#E6D5C3", "#F3E3D3", "#C9D8CB", "#F6CDBE"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function toneFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

export function shortDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

interface PostRow {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: Date | null;
}

export function toPostView(p: PostRow): PostView {
  const type =
    p.mediaType === "VIDEO" ? "Reel" : p.mediaType === "CAROUSEL_ALBUM" ? "Carrossel" : "Imagem";
  return {
    id: p.id,
    type,
    caption: p.caption ?? "",
    // Video posts expose a still in thumbnail_url; images serve media_url.
    imageUrl: p.thumbnailUrl ?? (p.mediaType === "VIDEO" ? null : p.mediaUrl),
    tone: toneFor(p.id),
    date: shortDate(p.timestamp),
    permalink: p.permalink,
  };
}
