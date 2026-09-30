import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, igPost } from "@/db";
import { getAccountById } from "@/lib/account";
import { refresh } from "@/lib/bio/data";
import { isStale } from "@/lib/bio/links";
import { toPostView, type PostView } from "@/lib/posts-view";

/**
 * Cached media for the post picker. The cache is topped up on demand when it
 * is stale (or empty and not just tried), so the picker never depends on a
 * cron having run.
 */
export async function listPosts(accountId: string, limit = 60): Promise<PostView[]> {
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
    const stale = isStale(acct.followersSyncedAt);
    const emptyAndNotJustTried =
      rows.length === 0 &&
      (!acct.followersSyncedAt || Date.now() - acct.followersSyncedAt.getTime() > 5 * 60 * 1000);
    if (stale || emptyAndNotJustTried) {
      await refresh(acct);
      rows = await read();
    }
  }
  return rows.map(toPostView);
}
