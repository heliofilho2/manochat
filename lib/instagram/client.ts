import "server-only";
import type { IgMedia, OutboundMessage } from "./types";

const API_VERSION = "v23.0";
const BASE = `https://graph.instagram.com/${API_VERSION}`;

/**
 * An error carrying Meta's own error code, so callers can distinguish
 * "this will never work, stop retrying" from "try again later".
 */
export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
    readonly status?: number,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }

  /** Meta code 190: the access token expired or the session was invalidated. */
  get isTokenInvalid(): boolean {
    return this.code === 190;
  }

  /**
   * True when retrying is pointless: the comment was deleted, the 7-day
   * private-reply window closed, or we already replied to this comment.
   */
  get isPermanent(): boolean {
    // An invalid token fixes itself once the owner reconnects: keep the event.
    if (this.isTokenInvalid) return false;
    if (this.status === 400 || this.status === 403) return true;
    // 10 = permission denied, 100 = invalid parameter, 200 = permissions error.
    return this.code === 10 || this.code === 100 || this.code === 200;
  }
}

async function call<T>(
  path: string,
  init: RequestInit & { params?: Record<string, string> } = {},
): Promise<T> {
  const { params, ...rest } = init;
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, { ...rest, cache: "no-store" });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = json?.error ?? {};
    throw new InstagramApiError(
      err.message ?? `Instagram API ${res.status} on ${path}`,
      err.code,
      err.error_subcode,
      res.status,
    );
  }
  return json as T;
}

/** Profile of the connected account. */
export function getMe(token: string) {
  return call<{ user_id: string; username: string; profile_picture_url?: string }>("/me", {
    params: {
      fields: "user_id,username,profile_picture_url",
      access_token: token,
    },
  });
}

/** Recent media, for the automation builder's post picker. */
export function getMedia(token: string, limit = 50) {
  return call<{ data: IgMedia[] }>("/me/media", {
    params: {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
      limit: String(limit),
      access_token: token,
    },
  });
}

/** Username/name of someone who messaged the account (needs their DM to exist). */
export function getUserProfile(token: string, igsid: string) {
  return call<{ username?: string; name?: string }>(`/${igsid}`, {
    params: { fields: "username,name", access_token: token },
  });
}

/** Currently live stories (they disappear after 24h), for the story picker. */
export function getStories(token: string) {
  return call<{
    data: {
      id: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      timestamp?: string;
    }[];
  }>("/me/stories", {
    params: {
      fields: "id,media_type,media_url,thumbnail_url,permalink,timestamp",
      access_token: token,
    },
  });
}

/** Reacts to a received message (used for the story-reply heart). */
export function reactToMessage(
  token: string,
  igUserId: string,
  recipientId: string,
  messageId: string,
  reaction = "love",
) {
  return call<{ recipient_id: string }>(`/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    params: { access_token: token },
    body: JSON.stringify({
      recipient: { id: recipientId },
      sender_action: "react",
      payload: { message_id: messageId, reaction },
    }),
  });
}

/** Follower count of the connected account (instagram_business_basic). */
export async function getFollowersCount(token: string): Promise<number | null> {
  const res = await call<{ followers_count?: number }>("/me", {
    params: { fields: "followers_count", access_token: token },
  });
  return res.followers_count ?? null;
}

/** Media with the fields the insights ranking needs, newest first. */
export function getMediaForInsights(token: string, limit = 50) {
  return call<{
    data: {
      id: string;
      caption?: string;
      media_type?: string;
      media_product_type?: string;
      timestamp?: string;
    }[];
  }>("/me/media", {
    params: {
      fields: "id,caption,media_type,media_product_type,timestamp",
      limit: String(limit),
      access_token: token,
    },
  });
}

/** Reach and views of one post. Needs `instagram_business_manage_insights`. */
export async function getMediaReach(
  token: string,
  mediaId: string,
): Promise<{ reach: number; views: number }> {
  const res = await call<{
    data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[];
  }>(`/${mediaId}/insights`, {
    params: { metric: "reach,views", access_token: token },
  });
  const pick = (name: string) => {
    const m = res.data.find((d) => d.name === name);
    return m?.values?.[0]?.value ?? m?.total_value?.value ?? 0;
  };
  return { reach: pick("reach"), views: pick("views") };
}

/**
 * Subscribes this app to the account's `comments` and `messages` webhooks.
 *
 * Done automatically at login so the Meta dashboard never has to be touched
 * again after the initial app setup.
 */
export function subscribeWebhooks(token: string) {
  return call<{ success: boolean }>("/me/subscribed_apps", {
    method: "POST",
    params: {
      subscribed_fields: "comments,messages,messaging_postbacks",
      access_token: token,
    },
  });
}

/** Posts a public reply underneath a comment. */
export function replyToComment(token: string, commentId: string, message: string) {
  return call<{ id: string }>(`/${commentId}/replies`, {
    method: "POST",
    params: { message, access_token: token },
  });
}

/**
 * Sends a Private Reply: a DM to a commenter with no pre-existing
 * conversation. This is the mechanism behind "comment LINK and I'll DM you".
 *
 * Meta's hard limits: one per comment ever, and only within 7 days of the
 * comment. A second attempt on the same comment returns an error, which is
 * why `comment_event.comment_id` is UNIQUE.
 */
export function sendPrivateReply(
  token: string,
  igUserId: string,
  commentId: string,
  message: string | OutboundMessage,
) {
  return send(token, igUserId, { comment_id: commentId }, message);
}

/**
 * Sends a DM to a user by IGSID. Only valid inside Meta's 24h window after
 * the user's last interaction (callers must check `isWindowOpen` first).
 */
export function sendDirectMessage(
  token: string,
  igUserId: string,
  recipientId: string,
  message: string | OutboundMessage,
) {
  return send(token, igUserId, { id: recipientId }, message);
}

function send(
  token: string,
  igUserId: string,
  recipient: { comment_id: string } | { id: string },
  message: string | OutboundMessage,
) {
  return call<{ recipient_id: string; message_id: string }>(`/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    params: { access_token: token },
    body: JSON.stringify({
      recipient,
      message: typeof message === "string" ? { text: message } : message,
    }),
  });
}

/**
 * Whether this user follows the business. Only answerable for users who have
 * interacted with the account (e.g. just tapped a postback button).
 */
export async function getUserFollowsBusiness(
  token: string,
  igsid: string,
): Promise<boolean> {
  const res = await call<{ is_user_follow_business?: boolean }>(`/${igsid}`, {
    params: { fields: "is_user_follow_business", access_token: token },
  });
  return res.is_user_follow_business === true;
}

interface ConversationsResponse {
  data: {
    id: string;
    updated_time?: string;
    participants?: { data: { id: string; username?: string }[] };
    messages?: {
      data: {
        id: string;
        created_time?: string;
        from?: { id: string; username?: string };
        message?: string;
      }[];
    };
  }[];
}

/**
 * Lists DM threads with their most recent messages.
 *
 * Note the hard API cap: only the 20 most recent messages per conversation
 * are retrievable — anything older errors out. The Inbox therefore mirrors
 * messages into Postgres as webhooks arrive rather than relying on this.
 */
export function getConversations(token: string, limit = 50) {
  return call<ConversationsResponse>("/me/conversations", {
    params: {
      platform: "instagram",
      fields: "id,updated_time,participants,messages{id,created_time,from,message}",
      limit: String(limit),
      access_token: token,
    },
  });
}
