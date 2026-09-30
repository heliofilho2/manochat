import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { account, automation, bioConfig, db, igPost } from "@/db";
import { accessTokenFor } from "@/lib/account";
import { getFollowersCount, getMedia } from "@/lib/instagram/client";
import { toPostView } from "@/lib/posts-view";
import { isStale } from "./links";
import { buildItems, DEFAULT_BIO, safeUrl, type BioSettings } from "./theme";

/**
 * Refreshes follower count and recent media. Lazy on purpose: whoever opens
 * the page is the trigger, so no cron is needed and idle accounts cost
 * nothing. Failures keep the previous cache.
 */
export async function refresh(acct: typeof account.$inferSelect) {
  const token = accessTokenFor(acct);
  // Stamp first so a burst of visitors doesn't fan out N refreshes.
  await db.update(account).set({ followersSyncedAt: new Date() }).where(eq(account.id, acct.id));
  try {
    const followers = await getFollowersCount(token);
    if (followers !== null) {
      await db.update(account).set({ followersCount: followers }).where(eq(account.id, acct.id));
      acct.followersCount = followers;
    }
  } catch (e) {
    console.error("[bio] followers refresh failed", e);
  }
  try {
    const { data } = await getMedia(token, 30);
    for (const m of data ?? []) {
      const values = {
        id: m.id,
        accountId: acct.id,
        caption: m.caption ?? null,
        mediaType: m.media_type ?? null,
        mediaUrl: m.media_url ?? null,
        thumbnailUrl: m.thumbnail_url ?? null,
        permalink: m.permalink ?? null,
        timestamp: m.timestamp ? new Date(m.timestamp) : null,
        syncedAt: new Date(),
      };
      await db.insert(igPost).values(values).onConflictDoUpdate({ target: igPost.id, set: values });
    }
  } catch (e) {
    console.error("[bio] media refresh failed", e);
  }
}

export async function loadBioSettings(accountId: string): Promise<BioSettings> {
  const [row] = await db.select().from(bioConfig).where(eq(bioConfig.accountId, accountId)).limit(1);
  if (!row) return DEFAULT_BIO;
  return {
    theme: row.theme,
    shape: row.shape,
    bio: row.bio,
    photo: row.photo,
    showFollowers: row.showFollowers,
    showPosts: row.showPosts,
    postLayout: row.postLayout,
    order: row.order,
    hidden: row.hidden,
    manual: row.manual,
  };
}

export async function loadActiveAutomations(accountId: string) {
  return db
    .select({
      id: automation.id,
      name: automation.name,
      keywords: automation.keywords,
      scope: automation.scope,
      postIds: automation.postIds,
    })
    .from(automation)
    .where(and(eq(automation.accountId, accountId), eq(automation.status, "live")));
}

export async function loadRecentPosts(accountId: string, limit: number) {
  const rows = await db
    .select()
    .from(igPost)
    .where(eq(igPost.accountId, accountId))
    .orderBy(desc(igPost.timestamp))
    .limit(limit);
  return rows.map(toPostView);
}

/** Everything the public /u/[username] page renders. */
export async function loadPublicBio(username: string) {
  const [acct] = await db.select().from(account).where(eq(account.username, username)).limit(1);
  if (!acct) return null;

  if (isStale(acct.followersSyncedAt)) await refresh(acct);

  const [settings, autos, posts] = await Promise.all([
    loadBioSettings(acct.id),
    loadActiveAutomations(acct.id),
    loadRecentPosts(acct.id, 30),
  ]);

  // Manual links without a usable URL would be dead buttons; leave them out.
  const usable: BioSettings = {
    ...settings,
    manual: settings.manual.filter((m) => m.label.trim() && safeUrl(m.url)),
  };
  const items = buildItems(usable, autos).filter((i) => !i.hidden);

  return { acct, settings: usable, items, posts };
}
