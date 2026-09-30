/** Pure link-in-bio helpers: no network, no DB, unit-testable. */

export interface BioAutomation {
  id: string;
  name: string;
  keywords: string[];
  scope: string;
  postIds: string[];
}

export interface BioLink {
  /** "a-<automationId>", resolved server-side by /r/[id]. */
  id: string;
  title: string;
  hint: string;
}

export const STALE_MS = 3 * 60 * 60 * 1000;

export function isStale(syncedAt: Date | null | undefined, now = Date.now()): boolean {
  return !syncedAt || now - syncedAt.getTime() > STALE_MS;
}

/** One button per live automation that has a keyword. */
export function buildLinks(automations: BioAutomation[]): BioLink[] {
  return automations
    .filter((a) => a.keywords.length > 0)
    .map((a) => ({
      id: `a-${a.id}`,
      title: a.name,
      hint: `Comente “${a.keywords[0].toUpperCase()}” no vídeo e receba na DM`,
    }));
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
  a: Pick<BioAutomation, "scope" | "postIds">,
  permalinks: Map<string, string | null>,
  username: string,
): string {
  if (a.scope === "specific_posts" && a.postIds.length === 1) {
    const link = permalinks.get(a.postIds[0]);
    if (link) return link;
  }
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} mi`;
  if (n >= 10_000) return `${Math.round(n / 1000)} mil`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")} mil`;
  return String(n);
}
