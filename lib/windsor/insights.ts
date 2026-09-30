/**
 * Pure aggregation over Windsor media rows. No network, no `server-only`,
 * so it is unit-testable like the matcher.
 */

export interface WindsorMediaRow {
  media_id: string;
  media_type?: string | null;
  media_product_type?: string | null;
  media_caption?: string | null;
  timestamp?: string | null;
  media_reach?: number | null;
  media_views?: number | null;
  media_engagement?: number | null;
}

export interface Bucket {
  key: string;
  posts: number;
  reach: number;
  conversions: number;
  /** conversions / reach, 0 when reach is 0. */
  rate: number;
}

export interface Insights {
  byHour: Bucket[];
  byWeekday: Bucket[];
  byFormat: Bucket[];
  byTheme: Bucket[];
}

const TZ = "America/Sao_Paulo";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Hour (0-23) and weekday index of an ISO timestamp in São Paulo time. */
export function localParts(iso: string): { hour: number; weekday: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
  return { hour, weekday };
}

/** First hashtag in the caption, else null. Used as the post's "theme". */
export function themeOf(caption: string | null | undefined): string | null {
  const m = caption?.match(/#([\p{L}\p{N}_]+)/u);
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function formatOf(row: WindsorMediaRow): string {
  if (row.media_product_type === "REELS") return "REEL";
  return row.media_type ?? "DESCONHECIDO";
}

function rank(map: Map<string, Omit<Bucket, "rate" | "key">>, minPosts = 1): Bucket[] {
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v, rate: v.reach > 0 ? v.conversions / v.reach : 0 }))
    .filter((b) => b.posts >= minPosts)
    .sort((a, b) => b.rate - a.rate || b.conversions - a.conversions);
}

/**
 * Joins Windsor's post metrics with our own conversion counts
 * (`comment_event` rows with a sent DM, keyed by media id) and ranks
 * hour / weekday / format / theme by conversions per reach.
 */
export function computeInsights(
  rows: WindsorMediaRow[],
  conversionsByMedia: Map<string, number>,
): Insights {
  const hour = new Map<string, Omit<Bucket, "rate" | "key">>();
  const weekday = new Map<string, Omit<Bucket, "rate" | "key">>();
  const format = new Map<string, Omit<Bucket, "rate" | "key">>();
  const theme = new Map<string, Omit<Bucket, "rate" | "key">>();

  const add = (
    m: Map<string, Omit<Bucket, "rate" | "key">>,
    key: string,
    reach: number,
    conv: number,
  ) => {
    const cur = m.get(key) ?? { posts: 0, reach: 0, conversions: 0 };
    cur.posts += 1;
    cur.reach += reach;
    cur.conversions += conv;
    m.set(key, cur);
  };

  for (const row of rows) {
    const reach = Number(row.media_reach ?? 0);
    const conv = conversionsByMedia.get(row.media_id) ?? 0;
    const lp = row.timestamp ? localParts(row.timestamp) : null;
    if (lp) {
      add(hour, `${String(lp.hour).padStart(2, "0")}h`, reach, conv);
      add(weekday, WEEKDAYS[lp.weekday], reach, conv);
    }
    add(format, formatOf(row), reach, conv);
    const t = themeOf(row.media_caption);
    if (t) add(theme, t, reach, conv);
  }

  return {
    byHour: rank(hour),
    byWeekday: rank(weekday),
    byFormat: rank(format),
    byTheme: rank(theme, 2), // a theme seen once is noise
  };
}
