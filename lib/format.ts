/** pt-BR formatting helpers shared by server and client components. */

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

/** 48200 → "48,2 mil"; 1_250_000 → "1,3 mi"; 950 → "950". */
export function formatFollowers(n: number): string {
  const one = (v: number) => v.toFixed(1).replace(".", ",").replace(/,0$/, "");
  if (n >= 1_000_000) return `${one(n / 1_000_000)} mi`;
  if (n >= 1000) return `${one(n / 1000)} mil`;
  return String(n);
}

export function initialsOf(username: string): string {
  const parts = username.split(/[._\s-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[1][0] : username.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** "há 2 min", "há 3 h", "ontem", "há 4 d". */
export function timeAgo(date: Date | string | null, now = Date.now()): string {
  if (!date) return "";
  const t = typeof date === "string" ? Date.parse(date) : date.getTime();
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} d`;
}
