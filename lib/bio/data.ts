import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { account, automation, db, igPost } from "@/db";
import { accessTokenFor } from "@/lib/account";
import { getFollowersCount, getMedia } from "@/lib/instagram/client";
import { buildLinks, isStale } from "./links";

/**
 * Refreshes follower count and recent media for the public page. Lazy on
 * purpose: visitors are the trigger, so no cron is needed and idle accounts
 * cost nothing. Failures keep the previous cache.
 */
async function refresh(acct: typeof account.$inferSelect) {
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
    const { data } = await getMedia(token, 12);
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

export async function loadBio(username: string) {
  const [acct] = await db.select().from(account).where(eq(account.username, username)).limit(1);
  if (!acct) return null;

  if (isStale(acct.followersSyncedAt)) await refresh(acct);

  const [automations, posts] = await Promise.all([
    db
      .select()
      .from(automation)
      .where(and(eq(automation.accountId, acct.id), eq(automation.status, "live"))),
    db
      .select()
      .from(igPost)
      .where(eq(igPost.accountId, acct.id))
      .orderBy(desc(igPost.timestamp))
      .limit(6),
  ]);

  return {
    username: acct.username,
    avatar: acct.profilePictureUrl,
    followers: acct.followersCount,
    links: buildLinks(automations),
    posts: posts.filter((p) => p.permalink),
  };
}
