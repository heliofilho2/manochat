/**
 * Classification and bucketing helpers for the link-in-bio metrics. Pure, so
 * the rules are unit-tested; the queries live in the metrics page.
 */

export const SOURCES = ["instagram", "tiktok", "whatsapp", "facebook", "youtube", "x", "direto", "outros"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X (Twitter)",
  direto: "Direto",
  outros: "Outros sites",
};

export type Device = "celular" | "tablet" | "desktop";

const BOT = /bot|crawl|spider|preview|facebookexternalhit|slurp|whatsapp\/|headless|lighthouse|curl|wget|python-requests|vercel|monitor|pingdom|uptime/i;

export function isBot(ua: string): boolean {
  return ua.trim() === "" || BOT.test(ua);
}

export function classifyDevice(ua: string): Device {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "celular";
  return "desktop";
}

function hostOf(referrer: string): string {
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Where a visit came from. The in-app browsers say it in the user agent, which
 * is the most reliable signal (Instagram strips the referrer); the referrer
 * covers regular browsers.
 */
export function classifySource(referrer: string, ua: string): Source {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return "tiktok";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";

  const host = hostOf(referrer);
  if (!host) return "direto";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return "whatsapp";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host)) return "facebook";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "youtube";
  if (/(^|\.)(x\.com|twitter\.com|t\.co)$/.test(host)) return "x";
  return "outros";
}

const TZ = "America/Sao_Paulo";

/** YYYY-MM-DD in São Paulo time, matching the SQL bucketing. */
export function dayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ms));
}

/** One entry per day for the last `days` days (oldest first), zero where there is no row. */
export function fillDays(rows: { day: string; n: number }[], days: number, nowMs: number): { day: string; n: number }[] {
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  const out: { day: string; n: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(nowMs - i * 86_400_000);
    out.push({ day, n: byDay.get(day) ?? 0 });
  }
  return out;
}

/** Share of `part` in `total`, 0-100 with one decimal, or null when total is 0. */
export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}
