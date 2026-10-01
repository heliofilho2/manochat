import { after, NextRequest, NextResponse } from "next/server";
import { account, conversation, db, igPost, message } from "@/db";
import { accessTokenFor, type Account } from "@/lib/account";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { getConversations, getMedia } from "@/lib/instagram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Backfills DM threads and refreshes the cached post list.
 *
 * Webhooks are the primary source for messages; this catches anything
 * delivered while the app was down. It can only see the 20 most recent
 * messages per thread, so it supplements the mirror rather than replacing it.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const accounts = await db.select().from(account);
  if (accounts.length === 0) return NextResponse.json({ skipped: "no account connected" });

  // Answer right away (cron-job.org gives up after 30 s); sync after the response.
  // One account failing must never starve the others.
  after(async () => {
    const results = [];
    for (const acct of accounts) {
      results.push(await syncAccount(acct));
    }
    console.log("[cron] sync-inbox", results);
  });
  return NextResponse.json({ accounts: accounts.length, started: true });
}

async function syncAccount(acct: Account) {
  const token = accessTokenFor(acct);
  let threads = 0;
  let messages = 0;
  let posts = 0;

  try {
    const { data } = await getConversations(token);

    for (const thread of data ?? []) {
      const other = thread.participants?.data?.find((p) => p.id !== acct.igUserId);
      const recent = thread.messages?.data ?? [];
      const newest = recent[0];

      await db
        .insert(conversation)
        .values({
          id: thread.id,
          accountId: acct.id,
          participantIgId: other?.id ?? null,
          participantUsername: other?.username ?? null,
          lastMessageAt: newest?.created_time ? new Date(newest.created_time) : null,
          lastMessagePreview: newest?.message ?? null,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: conversation.id,
          set: {
            participantUsername: other?.username ?? null,
            syncedAt: new Date(),
          },
        });
      threads++;

      // One insert per thread instead of one per message: far fewer round trips.
      const rows = recent.map((m) => ({
        id: m.id,
        conversationId: thread.id,
        fromIgId: m.from?.id ?? null,
        isFromAccount: m.from?.id === acct.igUserId,
        text: m.message ?? null,
        sentAt: m.created_time ? new Date(m.created_time) : null,
      }));
      if (rows.length > 0) {
        await db.insert(message).values(rows).onConflictDoNothing({ target: message.id });
        messages += rows.length;
      }
    }
  } catch (error) {
    console.error("[cron] inbox sync failed", error);
  }

  try {
    const { data } = await getMedia(token);
    for (const media of data ?? []) {
      const values = {
        id: media.id,
        accountId: acct.id,
        caption: media.caption ?? null,
        mediaType: media.media_type ?? null,
        mediaUrl: media.media_url ?? null,
        thumbnailUrl: media.thumbnail_url ?? null,
        permalink: media.permalink ?? null,
        timestamp: media.timestamp ? new Date(media.timestamp) : null,
        syncedAt: new Date(),
      };
      await db
        .insert(igPost)
        .values(values)
        .onConflictDoUpdate({ target: igPost.id, set: values });
      posts++;
    }
  } catch (error) {
    console.error("[cron] media sync failed", error);
  }

  return { username: acct.username, threads, messages, posts };
}
