import "server-only";
import { unstable_cache } from "next/cache";
import { and, eq, gt, sql } from "drizzle-orm";
import { commentEvent, db, linkClick } from "@/db";
import { accessTokenFor, type Account } from "@/lib/account";
import { getAccountInsights, getMediaKitMetrics, getMediaPage } from "@/lib/instagram/client";
import {
  ageSlices,
  breakdownFrom,
  cityName,
  dailyFrom,
  followsFrom,
  reelSummary,
  sumAdditive,
  toSlices,
  totalsFrom,
  type AdditiveTotals,
  type MediaStat,
  type ReelSummary,
  type Slice,
  type WindowTotals,
} from "./media-kit";

/**
 * Tudo o que heliofilho.dev/media-kit mostra, puxado do Instagram e do banco do Oslinke.
 * Cada pedaço falha sozinho: se a Meta recusar uma métrica, o resto continua e o campo
 * volta null (a página esconde o bloco em vez de mostrar zero).
 */
export interface MediaKitData {
  updatedAt: string;
  followers: number | null;
  last30: (WindowTotals & { follows: number | null; unfollows: number | null; netFollows: number | null }) | null;
  last60: AdditiveTotals | null;
  dailyReach: { date: string; value: number }[];
  audience: {
    age: Slice[];
    gender: Slice[];
    countries: Slice[];
    cities: string[];
  } | null;
  reels: ReelSummary | null;
  /** Comentários com palavra-chave, DMs entregues e cliques em links rastreados, 30 dias. */
  oslinke: { comments: number; dms: number; clicks: number } | null;
}

const DAY_S = 86_400;
// A Insights API aceita no máximo 30 dias entre since e until; um minuto de folga evita
// cair na borda do limite por diferença de relógio.
const WINDOW_S = 30 * DAY_S - 60;
const MAX_PAGES = 5;
const CHUNK = 10;

async function safe<T>(label: string, p: () => Promise<T>): Promise<T | null> {
  try {
    return await p();
  } catch (e) {
    console.error(`[media-kit] ${label} falhou`, e);
    return null;
  }
}

const TOTALS = "views,reach,accounts_engaged,total_interactions,saves,shares,likes,comments";
const ADDITIVE = "views,total_interactions,saves,shares,likes,comments";

async function windowTotals(token: string, igId: string, metric: string, since: number, until: number) {
  const { data } = await getAccountInsights(token, igId, {
    metric,
    period: "day",
    metric_type: "total_value",
    since: String(since),
    until: String(until),
  });
  return totalsFrom(data);
}

async function demographic(token: string, igId: string, breakdown: string) {
  const { data } = await getAccountInsights(token, igId, {
    metric: "follower_demographics",
    period: "lifetime",
    metric_type: "total_value",
    timeframe: "this_month",
    breakdown,
  });
  return breakdownFrom(data.find((d) => d.name === "follower_demographics"));
}

/** Posts e reels publicados desde `since` (segundos), com as métricas de cada um. */
async function mediaSince(token: string, since: number): Promise<MediaStat[]> {
  const items: Awaited<ReturnType<typeof getMediaPage>>["data"] = [];
  let after: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await getMediaPage(token, after);
    const data = res.data ?? [];
    items.push(...data);
    const oldest = data[data.length - 1]?.timestamp;
    after = res.paging?.cursors?.after;
    if (!res.paging?.next || !after || (oldest && Date.parse(oldest) / 1000 < since)) break;
  }

  const recent = items.filter(
    (m) => m.timestamp && Date.parse(m.timestamp) / 1000 >= since && m.media_product_type !== "STORY",
  );
  const out: MediaStat[] = [];
  // Lotes pequenos ficam longe do limite de chamadas da Graph API.
  for (let i = 0; i < recent.length; i += CHUNK) {
    const batch = recent.slice(i, i + CHUNK);
    const metrics = await Promise.allSettled(batch.map((m) => getMediaKitMetrics(token, m.id)));
    batch.forEach((m, j) => {
      const r = metrics[j];
      const v = r.status === "fulfilled" ? r.value : null;
      out.push({
        id: m.id,
        caption: m.caption ?? null,
        permalink: m.permalink ?? null,
        thumbnailUrl: m.thumbnail_url ?? (m.media_type === "IMAGE" ? (m.media_url ?? null) : null),
        timestamp: m.timestamp ?? null,
        productType: m.media_product_type ?? null,
        views: v?.views ?? null,
        reach: v?.reach ?? null,
        saves: v?.saves ?? null,
        shares: v?.shares ?? null,
        interactions: v?.interactions ?? null,
      });
    });
  }
  return out;
}

async function oslinkeStats(accountId: string, since: Date) {
  const [[events], [clicks]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where ${commentEvent.dmStatus} = 'sent')::int`,
      })
      .from(commentEvent)
      .where(and(eq(commentEvent.accountId, accountId), gt(commentEvent.createdAt, since))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(linkClick)
      .where(and(eq(linkClick.accountId, accountId), gt(linkClick.createdAt, since))),
  ]);
  return { comments: events?.total ?? 0, dms: events?.sent ?? 0, clicks: clicks?.n ?? 0 };
}

async function build(acct: Account): Promise<MediaKitData> {
  const token = accessTokenFor(acct);
  const igId = acct.igUserId;
  const until = Math.floor(Date.now() / 1000);
  const since30 = until - WINDOW_S;
  const since60 = since30 - WINDOW_S;

  const [w30, w30b, follows, reach, age, gender, country, city, media, osl] = await Promise.all([
    safe("totais 30 dias", () => windowTotals(token, igId, TOTALS, since30, until)),
    safe("totais 30-60 dias", () => windowTotals(token, igId, ADDITIVE, since60, since30)),
    safe("seguidores ganhos", async () => {
      const { data } = await getAccountInsights(token, igId, {
        metric: "follows_and_unfollows",
        period: "day",
        metric_type: "total_value",
        breakdown: "follow_type",
        since: String(since30),
        until: String(until),
      });
      return followsFrom(data);
    }),
    safe("alcance diário", async () => {
      const { data } = await getAccountInsights(token, igId, {
        metric: "reach",
        period: "day",
        metric_type: "time_series",
        since: String(since30),
        until: String(until),
      });
      return dailyFrom(data.find((d) => d.name === "reach"));
    }),
    safe("idade", () => demographic(token, igId, "age")),
    safe("gênero", () => demographic(token, igId, "gender")),
    safe("país", () => demographic(token, igId, "country")),
    safe("cidade", () => demographic(token, igId, "city")),
    safe("posts", () => mediaSince(token, since60)),
    safe("Oslinke", () => oslinkeStats(acct.id, new Date(since30 * 1000))),
  ]);

  const audience =
    age && age.length > 0
      ? {
          age: ageSlices(age.filter((a) => a.key !== "13-17" || a.value > 0)),
          gender: toSlices(gender ?? []),
          countries: toSlices(country ?? []).slice(0, 5),
          cities: toSlices(city ?? [])
            .slice(0, 6)
            .map((c) => cityName(c.key)),
        }
      : null;

  return {
    updatedAt: new Date().toISOString(),
    followers: acct.followersCount,
    last30: w30
      ? { ...w30, follows: follows?.follows ?? null, unfollows: follows?.unfollows ?? null, netFollows: follows?.net ?? null }
      : null,
    last60: w30 && w30b ? sumAdditive(w30, w30b) : null,
    dailyReach: reach ?? [],
    audience,
    reels: media && media.length > 0 ? reelSummary(media, acct.followersCount) : null,
    oslinke: osl,
  };
}

/**
 * Cacheado 3 horas por conta: o site revalida a cada 30 minutos, mas só a primeira chamada
 * de cada janela bate na Meta (são ~15 chamadas de conta + uma por post dos últimos 60 dias).
 */
export function getMediaKit(acct: Account): Promise<MediaKitData> {
  return unstable_cache(() => build(acct), ["media-kit", acct.id], { revalidate: 10_800 })();
}
