/** Pure link-in-bio helpers: no network, no DB, unit-testable. */

export interface BioAutomation {
  scope: string;
  postIds: string[];
}

export const STALE_MS = 3 * 60 * 60 * 1000;

export function isStale(syncedAt: Date | null | undefined, now = Date.now()): boolean {
  return !syncedAt || now - syncedAt.getTime() > STALE_MS;
}

export function withUtm(url: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "ig");
  u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_content", "link_in_bio");
  return u.toString();
}

/**
 * Where a click on an automation button lands: the single post it is scoped
 * to when we know its permalink, else the profile. Never a user-supplied URL,
 * so the redirect route cannot be used as an open redirect.
 */
export function destinationFor(
  a: BioAutomation,
  permalinks: Map<string, string | null>,
  username: string,
): string {
  if (a.scope === "specific_posts" && a.postIds.length === 1) {
    const link = permalinks.get(a.postIds[0]);
    if (link) return link;
  }
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}
