import "server-only";
import { unstable_cache } from "next/cache";
import { getMediaForInsights, getMediaReach } from "@/lib/instagram/client";
import type { MediaRow } from "./insights";

const DAY_MS = 86_400_000;
const CHUNK = 10;

async function load(token: string, days: number): Promise<MediaRow[]> {
  const since = Date.now() - days * DAY_MS;
  const { data } = await getMediaForInsights(token, 50);
  const recent = data.filter((m) => m.timestamp && Date.parse(m.timestamp) >= since);

  const rows: MediaRow[] = [];
  // Small batches keep us well under Graph API rate limits.
  for (let i = 0; i < recent.length; i += CHUNK) {
    const batch = recent.slice(i, i + CHUNK);
    const metrics = await Promise.allSettled(batch.map((m) => getMediaReach(token, m.id)));
    batch.forEach((m, j) => {
      const r = metrics[j];
      // A post without insights (e.g. published before the account went
      // professional) still counts for format/time, just with zero reach.
      const ok = r.status === "fulfilled" ? r.value : { reach: 0, views: 0 };
      rows.push({
        mediaId: m.id,
        mediaType: m.media_type,
        productType: m.media_product_type,
        caption: m.caption,
        timestamp: m.timestamp,
        reach: ok.reach,
        views: ok.views,
      });
    });
    // If every call in the first batch failed, it's a permission problem:
    // surface it instead of returning a page of zeros.
    if (i === 0 && metrics.every((r) => r.status === "rejected")) {
      throw (metrics[0] as PromiseRejectedResult).reason;
    }
  }
  return rows;
}

/**
 * Per-post reach/views for one account, straight from the Instagram API.
 * Cached an hour per account so dashboard views don't fan out N calls each.
 * The token is not part of the cache key; the account id is.
 */
export function fetchMediaMetrics(accountId: string, token: string, days = 90) {
  return unstable_cache(() => load(token, days), ["ig-insights", accountId, String(days)], {
    revalidate: 3600,
  })();
}
