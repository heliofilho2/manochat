/**
 * Números do mídia kit (heliofilho.dev/media-kit), montados a partir do que a API do
 * Instagram devolve. Funções puras, testadas em __tests__/media-kit.test.ts; a busca
 * (chamadas à API, banco e cache) fica em media-kit-fetch.ts.
 */

/** Um item de `data` da Insights API (conta ou mídia). */
export interface InsightMetric {
  name: string;
  values?: { value: number; end_time?: string }[];
  total_value?: {
    value?: number;
    breakdowns?: {
      dimension_keys?: string[];
      results?: { dimension_values: string[]; value: number }[];
    }[];
  };
}

export interface Slice {
  key: string;
  value: number;
  /** 0–100, uma casa decimal. */
  pct: number;
}

export interface WindowTotals {
  views: number | null;
  reach: number | null;
  accountsEngaged: number | null;
  interactions: number | null;
  saves: number | null;
  shares: number | null;
  likes: number | null;
  comments: number | null;
}

/** Métricas que podem ser somadas entre janelas (reach e contas são únicas, não somam). */
export type AdditiveTotals = Pick<WindowTotals, "views" | "interactions" | "saves" | "shares" | "likes" | "comments">;

export interface MediaStat {
  id: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string | null;
  productType: string | null;
  views: number | null;
  reach: number | null;
  saves: number | null;
  shares: number | null;
  interactions: number | null;
}

export interface TopReel {
  id: string;
  title: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string | null;
  views: number;
  saves: number | null;
  shares: number | null;
}

export interface ReelSummary {
  /** Reels da janela que passaram de 100 mil e de 200 mil visualizações. */
  over100k: number;
  over200k: number;
  top: TopReel[];
  /** Média, por post, de interações sobre seguidores (0–100). */
  engagementPerPost: number | null;
  /** Interações dos reels sobre o alcance dos reels (0–100). */
  reelInteractionRate: number | null;
  posts: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const FIELD: Record<string, keyof WindowTotals> = {
  views: "views",
  reach: "reach",
  accounts_engaged: "accountsEngaged",
  total_interactions: "interactions",
  saves: "saves",
  shares: "shares",
  likes: "likes",
  comments: "comments",
};

/** Totais de uma janela (metric_type=total_value). Métrica que não veio fica null. */
export function totalsFrom(data: InsightMetric[]): WindowTotals {
  const out: WindowTotals = {
    views: null,
    reach: null,
    accountsEngaged: null,
    interactions: null,
    saves: null,
    shares: null,
    likes: null,
    comments: null,
  };
  for (const m of data) {
    const field = FIELD[m.name];
    const v = m.total_value?.value;
    if (field && typeof v === "number") out[field] = v;
  }
  return out;
}

/** Soma duas janelas só nas métricas somáveis. Se uma faltar, a soma é null (número pela metade engana). */
export function sumAdditive(a: WindowTotals, b: WindowTotals): AdditiveTotals {
  const add = (x: number | null, y: number | null) => (x === null || y === null ? null : x + y);
  return {
    views: add(a.views, b.views),
    interactions: add(a.interactions, b.interactions),
    saves: add(a.saves, b.saves),
    shares: add(a.shares, b.shares),
    likes: add(a.likes, b.likes),
    comments: add(a.comments, b.comments),
  };
}

/** Resultados do primeiro breakdown de uma métrica, como [{ key, value }]. */
export function breakdownFrom(metric: InsightMetric | undefined): { key: string; value: number }[] {
  const results = metric?.total_value?.breakdowns?.[0]?.results ?? [];
  return results
    .filter((r) => Array.isArray(r.dimension_values) && typeof r.value === "number")
    .map((r) => ({ key: r.dimension_values.join(" / "), value: r.value }));
}

/** follows_and_unfollows com breakdown=follow_type: FOLLOWER = quem seguiu, NON_FOLLOWER = quem deixou de seguir. */
export function followsFrom(data: InsightMetric[]): { follows: number; unfollows: number; net: number } | null {
  const m = data.find((d) => d.name === "follows_and_unfollows");
  const rows = breakdownFrom(m);
  if (rows.length === 0) return null;
  const follows = rows.find((r) => r.key === "FOLLOWER")?.value ?? 0;
  const unfollows = rows.find((r) => r.key === "NON_FOLLOWER")?.value ?? 0;
  return { follows, unfollows, net: follows - unfollows };
}

/**
 * Série diária (metric_type=time_series). O Instagram fecha o dia às 07:00 UTC (meia-noite do
 * Pacífico) e marca o fim: o valor com end_time 2026-10-07T07:00 é o do dia 06/10.
 */
export function dailyFrom(metric: InsightMetric | undefined): { date: string; value: number }[] {
  return (metric?.values ?? [])
    .filter((v) => typeof v.value === "number" && v.end_time)
    .map((v) => {
      const end = Date.parse(v.end_time!);
      const day = new Date(end - 86_400_000).toISOString().slice(0, 10);
      return { date: day, value: v.value };
    })
    .filter((v) => !Number.isNaN(Date.parse(v.date)));
}

/** Converte contagens em fatias com %, em ordem decrescente. */
export function toSlices(rows: { key: string; value: number }[]): Slice[] {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total <= 0) return [];
  return rows
    .map((r) => ({ key: r.key, value: r.value, pct: round1((r.value / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

/** Faixas de idade na ordem natural (13-17, 18-24 … 65+), sem a de menores quando vier vazia. */
export function ageSlices(rows: { key: string; value: number }[]): Slice[] {
  const start = (k: string) => Number.parseInt(k, 10) || 0;
  return toSlices(rows).sort((a, b) => start(a.key) - start(b.key));
}

/** "São Paulo, São Paulo (state)" → "São Paulo". */
export function cityName(key: string): string {
  return key.split(",")[0].trim();
}

/** Primeira frase da legenda, sem hashtags, pra servir de título do reel. */
export function captionTitle(caption: string | null, max = 110): string {
  if (!caption) return "";
  // Primeira linha com texto em português de verdade: pula gancho em outro alfabeto
  // (ex.: a legenda em japonês do reel da internet morta) e linha só de @menção.
  const firstLine =
    caption
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => /[A-Za-zÀ-ÿ]{3,}/.test(l.replace(/@[\w.]+/g, ""))) ?? "";
  const noTags = firstLine.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").trim();
  // Corta na primeira frase quando ela já diz o bastante; senão, no limite de caracteres.
  const sentence = noTags.match(/^(.{25,}?[.!?])(\s|$)/u)?.[1] ?? noTags;
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : max).trim()}…`;
}

/** Resumo dos reels e posts da janela: virais, destaques e taxas de interação. */
export function reelSummary(media: MediaStat[], followers: number | null, topN = 6): ReelSummary {
  const reels = media.filter((m) => m.productType === "REELS" && typeof m.views === "number");
  const over = (n: number) => reels.filter((r) => (r.views ?? 0) >= n).length;

  const top: TopReel[] = [...reels]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, topN)
    .map((r) => ({
      id: r.id,
      title: captionTitle(r.caption),
      permalink: r.permalink,
      thumbnailUrl: r.thumbnailUrl,
      timestamp: r.timestamp,
      views: r.views ?? 0,
      saves: r.saves,
      shares: r.shares,
    }));

  const withInteractions = media.filter((m) => typeof m.interactions === "number");
  const engagementPerPost =
    followers && followers > 0 && withInteractions.length > 0
      ? round1(
          (withInteractions.reduce((s, m) => s + (m.interactions ?? 0), 0) / withInteractions.length / followers) * 100,
        )
      : null;

  const reelReach = reels.reduce((s, r) => s + (r.reach ?? 0), 0);
  const reelInteractions = reels.reduce((s, r) => s + (r.interactions ?? 0), 0);
  const reelInteractionRate = reelReach > 0 ? round1((reelInteractions / reelReach) * 100) : null;

  return {
    over100k: over(100_000),
    over200k: over(200_000),
    top,
    engagementPerPost,
    reelInteractionRate,
    posts: media.length,
  };
}
