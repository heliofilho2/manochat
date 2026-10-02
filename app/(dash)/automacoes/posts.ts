import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, igPost } from "@/db";
import { accessTokenFor, getAccountById } from "@/lib/account";
import { getStories } from "@/lib/instagram/client";
import { refresh } from "@/lib/bio/data";
import { toPostView, type PostView } from "@/lib/posts-view";

/** The post list is re-fetched when the newest cached row is older than this. */
const POSTS_FRESH_MS = 2 * 60 * 1000;
/** ...but never more often than this, so a failing API is not hammered. */
const MIN_REFRESH_GAP_MS = 60 * 1000;

/**
 * Cached media for the post picker. The cache is topped up on demand when it
 * is a couple of minutes old (or forced by the "Atualizar lista" button), so a
 * reel published a moment ago shows up without waiting for the cron.
 */
export async function listPosts(
  accountId: string,
  limit = 60,
  opts: { force?: boolean } = {},
): Promise<PostView[]> {
  const read = () =>
    db
      .select()
      .from(igPost)
      .where(eq(igPost.accountId, accountId))
      .orderBy(desc(igPost.timestamp))
      .limit(limit);

  let rows = await read();
  const acct = await getAccountById(accountId);
  if (acct) {
    const now = Date.now();
    const newestSync = rows.reduce((m, r) => Math.max(m, r.syncedAt?.getTime() ?? 0), 0);
    const lastTried = acct.followersSyncedAt?.getTime() ?? 0;
    const cacheOld = rows.length === 0 || now - newestSync > POSTS_FRESH_MS;
    const canTry = now - lastTried > MIN_REFRESH_GAP_MS;
    if (opts.force || (cacheOld && canTry)) {
      await refresh(acct);
      rows = await read();
    }
  }
  return rows.map(toPostView);
}

/**
 * Stories that are live right now (Instagram serves them for 24h). Fetched
 * fresh each time: they are not worth caching and expire quickly.
 */
export async function listStories(accountId: string): Promise<PostView[]> {
  const acct = await getAccountById(accountId);
  if (!acct) return [];
  try {
    const { data } = await getStories(accessTokenFor(acct));
    return (data ?? []).map((m) =>
      toPostView({
        id: m.id,
        caption: "Story",
        mediaType: m.media_type ?? null,
        mediaUrl: m.media_url ?? null,
        thumbnailUrl: m.thumbnail_url ?? null,
        permalink: m.permalink ?? null,
        timestamp: m.timestamp ? new Date(m.timestamp) : null,
      }),
    );
  } catch (error) {
    console.error("[stories] could not load", error);
    return [];
  }
}
