import "server-only";
import type { WindsorMediaRow } from "./insights";

const FIELDS = [
  "media_id",
  "media_type",
  "media_product_type",
  "media_caption",
  "timestamp",
  "media_reach",
  "media_views",
  "media_engagement",
].join(",");

/** True when the Windsor connector is configured. The dashboard degrades without it. */
export function windsorConfigured(): boolean {
  return Boolean(process.env.WINDSOR_API_KEY);
}

/**
 * Pulls per-post Instagram metrics from Windsor.ai's REST connector.
 * Returns every Instagram account connected in Windsor; per-account
 * filtering (multi-tenant) is not wired up yet. The key goes in the
 * X-Api-Key header so it never appears in URLs or logs.
 */
export async function fetchMediaMetrics(days = 90): Promise<WindsorMediaRow[]> {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return [];

  const url = new URL("https://connectors.windsor.ai/instagram");
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("date_preset", `last_${days}d`);

  // Windsor data is slow-moving; cache an hour instead of hitting it per view.
  const res = await fetch(url, {
    headers: { "X-Api-Key": apiKey },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Windsor ${res.status}`);
  const json = (await res.json()) as { data?: WindsorMediaRow[] };
  return (json.data ?? []).filter((r) => r.media_id);
}
