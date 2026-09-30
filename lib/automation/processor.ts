import "server-only";
import { and, desc, eq } from "drizzle-orm";
import {
  automation,
  commentEvent,
  contact,
  conversation,
  db,
  message,
  webhookEvent,
} from "@/db";
import { accessTokenFor, getAccountByIgUserId, type Account } from "@/lib/account";
import { addTag, touchContact } from "@/lib/contacts";
import {
  getUserFollowsBusiness,
  InstagramApiError,
  replyToComment,
  sendDirectMessage,
  sendPrivateReply,
} from "@/lib/instagram/client";
import type {
  CommentValue,
  MessagingEvent,
  WebhookBody,
  WebhookEntry,
} from "@/lib/instagram/types";
import {
  buildLinkMessage,
  buildNotFollower,
  buildOpener,
  decideUnlock,
  isWindowOpen,
  parseUnlockPayload,
} from "./flow";
import { findMatch, pickReply, type MatchableAutomation } from "./matcher";

/** Meta refuses private replies to comments older than this. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Processes one stored webhook event.
 *
 * Called twice over: once immediately after the webhook responds 200, and
 * again by the cron sweeper for anything left `pending` or `failed`. It must
 * therefore be safe to run repeatedly on the same event — the unique index
 * on `comment_event.comment_id` is what provides that guarantee.
 */
export async function processEvent(eventId: string): Promise<void> {
  const [event] = await db
    .select()
    .from(webhookEvent)
    .where(eq(webhookEvent.id, eventId))
    .limit(1);

  if (!event || event.status === "done" || event.status === "dead") return;

  // Past the 7-day window there is nothing left to attempt.
  if (event.expiresAt && event.expiresAt.getTime() < Date.now()) {
    await markEvent(eventId, "dead", "Private reply window (7 days) expired.");
    return;
  }

  await db
    .update(webhookEvent)
    .set({ status: "processing", attempts: event.attempts + 1 })
    .where(eq(webhookEvent.id, eventId));

  try {
    const body = event.payload as WebhookBody;
    for (const entry of body.entry ?? []) {
      await processEntry(entry);
    }
    await markEvent(eventId, "done", null);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const permanent =
      error instanceof InstagramApiError ? error.isPermanent : false;
    const exhausted = event.attempts + 1 >= MAX_ATTEMPTS;

    await markEvent(eventId, permanent || exhausted ? "dead" : "failed", reason);
  }
}

async function markEvent(id: string, status: string, lastError: string | null) {
  await db
    .update(webhookEvent)
    .set({ status, lastError, processedAt: new Date() })
    .where(eq(webhookEvent.id, id));
}

async function processEntry(entry: WebhookEntry) {
  // `entry.id` is the Instagram account the event belongs to.
  const acct = await getAccountByIgUserId(entry.id);
  if (!acct) throw new Error(`No connected account for Instagram id ${entry.id}`);

  for (const change of entry.changes ?? []) {
    if (change.field === "comments") {
      await handleComment(acct, change.value);
    }
  }
  for (const event of entry.messaging ?? []) {
    if (event.postback) await handlePostback(acct, event);
    else await mirrorMessage(acct, event);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Postback (button tap) → follow check → link
 * ──────────────────────────────────────────────────────────────────────── */

async function handlePostback(acct: Account, event: MessagingEvent) {
  const postback = event.postback!;
  if (event.sender.id === acct.igUserId) return;

  const automationId = parseUnlockPayload(postback.payload);
  if (!automationId) return;

  const igsid = event.sender.id;
  const at = new Date(event.timestamp);

  /*
   * Claim this tap. Meta may redeliver the webhook; the mirrored row keyed
   * by the postback's mid is what stops a second link/prompt being sent.
   */
  const conversationId = `ig:${acct.igUserId}:${igsid}`;
  await db
    .insert(conversation)
    .values({
      id: conversationId,
      accountId: acct.id,
      participantIgId: igsid,
      lastMessageAt: at,
      lastMessagePreview: postback.title ?? "button",
    })
    .onConflictDoUpdate({
      target: conversation.id,
      set: { lastMessageAt: at, lastMessagePreview: postback.title ?? "button" },
    });
  const claimed = await db
    .insert(message)
    .values({
      id: `pb:${postback.mid}`,
      conversationId,
      fromIgId: igsid,
      isFromAccount: false,
      text: postback.title ?? "button",
      sentAt: at,
    })
    .onConflictDoNothing({ target: message.id })
    .returning({ id: message.id });
  if (claimed.length === 0) return;

  try {
    await unlock(acct, automationId, igsid, at);
  } catch (error) {
    // Release the claim so the sweeper's retry is not mistaken for a duplicate.
    await db.delete(message).where(eq(message.id, `pb:${postback.mid}`));
    throw error;
  }
}

async function unlock(acct: Account, automationId: string, igsid: string, at: Date) {
  // A tap is an inbound interaction: it (re)opens the 24h window.
  const contactId = await touchContact(acct.id, igsid, null, at);

  const [rule] = await db
    .select()
    .from(automation)
    .where(and(eq(automation.id, automationId), eq(automation.accountId, acct.id)))
    .limit(1);
  if (!rule) return;

  const token = accessTokenFor(acct);
  // Only ask Meta about following when this automation actually gates on it.
  let isFollower = true;
  if (rule.requireFollow) {
    isFollower = await getUserFollowsBusiness(token, igsid);
    await db
      .update(contact)
      .set({ isFollower, followerCheckedAt: new Date() })
      .where(eq(contact.id, contactId));
  }

  const decision = decideUnlock(isFollower, rule.requireFollow);
  if (decision === "send_link" && rule.requireFollow) await addTag(acct.id, contactId, "follower");

  // Window guard for every non-private-reply send.
  const [c] = await db
    .select({ expires: contact.messagingWindowExpiresAt })
    .from(contact)
    .where(eq(contact.id, contactId))
    .limit(1);
  if (!isWindowOpen(c?.expires ?? null)) {
    throw new Error("24h messaging window closed; not sending.");
  }

  await sendDirectMessage(
    token,
    acct.igUserId,
    igsid,
    decision === "send_link" ? buildLinkMessage(rule) : buildNotFollower(rule),
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Comments → reply + DM
 * ──────────────────────────────────────────────────────────────────────── */

async function handleComment(acct: Account, value: CommentValue) {
  const commenterId = value.from?.id;

  // Never react to our own comments. Without this, the public reply we post
  // arrives back as a new comment event and the bot replies to itself
  // forever.
  if (!commenterId || commenterId === acct.igUserId) return;

  const commentedAt = value.timestamp ? new Date(value.timestamp) : new Date();
  const mediaId = value.media?.id ?? null;

  const candidates = (await db
    .select()
    .from(automation)
    .where(and(eq(automation.accountId, acct.id), eq(automation.status, "live")))
    .orderBy(desc(automation.createdAt))) as MatchableAutomation[];

  const match = findMatch(candidates, {
    text: value.text ?? "",
    mediaId,
    commentedAt,
  });
  if (!match) return;

  const rule = match.automation as unknown as typeof automation.$inferSelect;

  /*
   * Claim this comment first.
   *
   * The unique index on `comment_id` means a concurrent or duplicated
   * delivery loses this insert and returns nothing — at which point we stop.
   * That is what structurally guarantees one DM per comment, rather than
   * relying on the surrounding logic being correct.
   */
  const claimed = await db
    .insert(commentEvent)
    .values({
      accountId: acct.id,
      automationId: rule.id,
      commentId: value.id,
      mediaId,
      commentText: value.text ?? "",
      matchedKeyword: match.keyword,
      fromIgId: commenterId,
      fromUsername: value.from?.username ?? null,
      replyStatus: rule.replyEnabled ? "pending" : "skipped",
      dmStatus: "pending",
      commentedAt,
    })
    .onConflictDoNothing({ target: commentEvent.commentId })
    .returning({ id: commentEvent.id });

  if (claimed.length === 0) return; // Already handled.
  const rowId = claimed[0].id;

  // Contact + tags. Non-critical: never let CRM bookkeeping block the DM.
  try {
    const contactId = await touchContact(
      acct.id,
      commenterId,
      value.from?.username ?? null,
      commentedAt,
    );
    await addTag(acct.id, contactId, `kw:${match.keyword}`);
  } catch (error) {
    console.error("[contacts] upsert failed", error);
  }

  const token = accessTokenFor(acct);

  // Public reply. A failure here must not block the DM — the DM is the part
  // the commenter actually asked for.
  if (rule.replyEnabled) {
    const replyText = pickReply(rule.replyVariants);
    if (!replyText) {
      await db
        .update(commentEvent)
        .set({ replyStatus: "skipped" })
        .where(eq(commentEvent.id, rowId));
    } else {
      try {
        await replyToComment(token, value.id, replyText);
        await db
          .update(commentEvent)
          .set({ replyStatus: "sent", replyText })
          .where(eq(commentEvent.id, rowId));
      } catch (error) {
        await db
          .update(commentEvent)
          .set({
            replyStatus: "failed",
            replyText,
            replyError: error instanceof Error ? error.message : String(error),
          })
          .where(eq(commentEvent.id, rowId));
      }
    }
  }

  // The private reply DM.
  try {
    await sendPrivateReply(
      token,
      acct.igUserId,
      value.id,
      buildOpener(rule),
    );
    await db
      .update(commentEvent)
      .set({ dmStatus: "sent" })
      .where(eq(commentEvent.id, rowId));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await db
      .update(commentEvent)
      .set({ dmStatus: "failed", dmError: reason })
      .where(eq(commentEvent.id, rowId));
    throw error; // Surfaces on the event so the sweeper can retry.
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Messages → Inbox mirror
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Copies an incoming DM into our own tables.
 *
 * The conversations API only exposes the 20 most recent messages per thread,
 * so this mirror is the only way to keep history beyond that.
 */
async function mirrorMessage(acct: Account, event: MessagingEvent) {
  if (!event.message?.mid) return;

  const isFromAccount = event.sender.id === acct.igUserId;
  const otherPartyId = isFromAccount ? event.recipient.id : event.sender.id;

  /*
   * Instagram does not include a conversation id on messaging webhooks, so
   * the thread is keyed by the other participant's scoped id. That is stable
   * per account and is exactly what a one-to-one DM thread is.
   */
  const conversationId = `ig:${acct.igUserId}:${otherPartyId}`;
  const sentAt = new Date(event.timestamp);
  const text = event.message.text ?? null;
  const attachmentSummary = event.message.attachments?.length
    ? event.message.attachments.map((a) => a.type).join(", ")
    : null;

  await db
    .insert(conversation)
    .values({
      id: conversationId,
      accountId: acct.id,
      participantIgId: otherPartyId,
      lastMessageAt: sentAt,
      lastMessagePreview: text ?? attachmentSummary,
    })
    .onConflictDoUpdate({
      target: conversation.id,
      set: { lastMessageAt: sentAt, lastMessagePreview: text ?? attachmentSummary },
    });

  await db
    .insert(message)
    .values({
      id: event.message.mid,
      conversationId,
      fromIgId: event.sender.id,
      isFromAccount,
      text,
      attachmentSummary,
      sentAt,
    })
    .onConflictDoNothing({ target: message.id });
}
