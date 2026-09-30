import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ────────────────────────────────────────────────────────────────────────
 * Account — the connected Instagram professional account.
 *
 * Single-tenant today: there is exactly one row. Every other table already
 * carries `accountId`, so going multi-tenant later is a matter of dropping
 * the "just read the first row" helper, not reshaping the schema.
 * ──────────────────────────────────────────────────────────────────────── */
export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  igUserId: text("ig_user_id").notNull().unique(),
  username: text("username").notNull(),
  profilePictureUrl: text("profile_picture_url"),

  /** AES-256-GCM ciphertext. Never stored or logged in plaintext. */
  accessToken: text("access_token").notNull(),
  /** Long-lived tokens last 60 days; the daily cron refreshes well before this. */
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),

  webhookSubscribed: boolean("webhook_subscribed").notNull().default(false),
  /** Cached for the public link-in-bio page; refreshed lazily every few hours. */
  followersCount: integer("followers_count"),
  followersSyncedAt: timestamp("followers_synced_at", { withTimezone: true }),
  /** Optional HTTPS endpoint that receives each captured lead as JSON. */
  leadsWebhookUrl: text("leads_webhook_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────────────────────────────────────────────────
 * Automation — one keyword rule: what to watch, what to reply, what to DM.
 * ──────────────────────────────────────────────────────────────────────── */
export const automation = pgTable(
  "automation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    /** draft | live | paused — only `live` automations fire. */
    status: text("status").notNull().default("draft"),

    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    /** exact_word | contains — see lib/automation/matcher.ts */
    matchMode: text("match_mode").notNull().default("exact_word"),

    /**
     * Which posts this applies to.
     *   all_posts      — every post on the account
     *   specific_posts — only the ids in `postIds`
     *   from_now_on    — only posts published at/after `appliesFrom`
     */
    scope: text("scope").notNull().default("all_posts"),
    postIds: jsonb("post_ids").$type<string[]>().notNull().default([]),
    appliesFrom: timestamp("applies_from", { withTimezone: true }),

    /**
     * Public comment replies. Multiple variants are picked at random:
     * posting the identical string on every comment is the fastest way to
     * get flagged as spam by Instagram.
     */
    replyVariants: jsonb("reply_variants").$type<string[]>().notNull().default([]),
    /** Set false to send the DM only, with no public reply. */
    replyEnabled: boolean("reply_enabled").notNull().default(true),

    /** DM body. `{link}` is substituted with `dmLink` at send time. */
    dmText: text("dm_text").notNull(),
    dmLink: text("dm_link"),

    /**
     * Follow gate. When on, the first DM carries only a postback button and
     * the link (`dmText`) is sent after `is_user_follow_business` is true.
     */
    requireFollow: boolean("require_follow").notNull().default(false),
    /** First DM text when the gate is on. Null = built-in default. */
    openerText: text("opener_text"),
    followButtonLabel: text("follow_button_label").notNull().default("Já sigo ✅"),
    /** Sent when the tapped user does not follow yet. Null = built-in default. */
    notFollowerText: text("not_follower_text"),
    /** When set, the link is delivered as a clickable URL button with this label. */
    linkButtonLabel: text("link_button_label"),

    /**
     * comment | story. A story automation fires on a DM that replies to a
     * story; it reuses `scope`/`postIds` (story ids) and `keywords` (empty =
     * any reply).
     */
    kind: text("kind").notNull().default("comment"),
    /** Story: react to the person's reply with a heart. */
    reactHeart: boolean("react_heart").notNull().default(false),
    /** Story: after the link, ask for e-mail / WhatsApp and save them as a lead. */
    collectEmail: boolean("collect_email").notNull().default(false),
    collectPhone: boolean("collect_phone").notNull().default(false),
    emailPrompt: text("email_prompt"),
    phonePrompt: text("phone_prompt"),
    thanksText: text("thanks_text"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("automation_account_status_idx").on(t.accountId, t.status)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Webhook event — every raw delivery from Meta, stored before any work.
 *
 * Meta disables webhooks that respond slowly, so the receiver's only job is
 * to write this row and return 200. Processing happens after the response,
 * and this table is what makes that safe: a crash mid-processing leaves a
 * `pending` row that the cron sweeper retries.
 * ──────────────────────────────────────────────────────────────────────── */
export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** comments | messages */
    field: text("field").notNull(),
    payload: jsonb("payload").notNull(),

    /** pending | processing | done | failed | dead */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),

    /**
     * Comment time + 7 days. Meta refuses private replies after this, so a
     * job still failing at this point is permanently dead, not retryable.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("webhook_event_status_idx").on(t.status, t.receivedAt)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Comment event — one row per comment we acted on. Powers the Activity log.
 * ──────────────────────────────────────────────────────────────────────── */
export const commentEvent = pgTable(
  "comment_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id").references(() => automation.id, {
      onDelete: "set null",
    }),

    /**
     * UNIQUE. Meta allows exactly one private reply per comment, ever.
     * Enforcing that here means a duplicate webhook delivery cannot produce
     * a second DM even if the application logic is wrong.
     */
    commentId: text("comment_id").notNull(),
    mediaId: text("media_id"),
    commentText: text("comment_text").notNull(),
    matchedKeyword: text("matched_keyword"),

    fromIgId: text("from_ig_id"),
    fromUsername: text("from_username"),

    /** skipped | pending | sent | failed */
    replyStatus: text("reply_status").notNull().default("pending"),
    replyText: text("reply_text"),
    replyError: text("reply_error"),

    dmStatus: text("dm_status").notNull().default("pending"),
    dmError: text("dm_error"),

    commentedAt: timestamp("commented_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("comment_event_comment_id_idx").on(t.commentId),
    index("comment_event_account_created_idx").on(t.accountId, t.createdAt),
  ],
);

/* ────────────────────────────────────────────────────────────────────────
 * Contact — one row per Instagram user (IGSID) who interacted with us.
 *
 * `messagingWindowExpiresAt` tracks Meta's 24h standard messaging window:
 * it is pushed to (last inbound interaction + 24h). Free-form DMs after it
 * need a recurring-notification opt-in or are refused by Meta.
 * ──────────────────────────────────────────────────────────────────────── */
export const contact = pgTable(
  "contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    igId: text("ig_id").notNull(),
    username: text("username"),

    /** Result of the last is_user_follow_business check; null = never checked. */
    isFollower: boolean("is_follower"),
    followerCheckedAt: timestamp("follower_checked_at", { withTimezone: true }),

    /** Recurring-notification (Meta opt-in) consent. */
    optedInRecurring: boolean("opted_in_recurring").notNull().default(false),
    optedInAt: timestamp("opted_in_at", { withTimezone: true }),

    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    messagingWindowExpiresAt: timestamp("messaging_window_expires_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contact_account_ig_idx").on(t.accountId, t.igId)],
);

export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tag_account_name_idx").on(t.accountId, t.name)],
);

export const contactTag = pgTable(
  "contact_tag",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contact_tag_pk_idx").on(t.contactId, t.tagId)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Cached media, so the automation builder's post picker is instant.
 * ──────────────────────────────────────────────────────────────────────── */
export const igPost = pgTable(
  "ig_post",
  {
    id: text("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    caption: text("caption"),
    mediaType: text("media_type"),
    mediaUrl: text("media_url"),
    thumbnailUrl: text("thumbnail_url"),
    permalink: text("permalink"),
    timestamp: timestamp("timestamp", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ig_post_account_time_idx").on(t.accountId, t.timestamp)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Inbox mirror.
 *
 * Instagram's conversations API returns only the 20 most recent messages per
 * thread — older ones come back as errors. Mirroring every `messages`
 * webhook into Postgres means history accumulates locally and is not capped.
 * ──────────────────────────────────────────────────────────────────────── */
export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    participantIgId: text("participant_ig_id"),
    participantUsername: text("participant_username"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversation_account_recent_idx").on(t.accountId, t.lastMessageAt)],
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    fromIgId: text("from_ig_id"),
    /** true when we sent it (including automated private replies). */
    isFromAccount: boolean("is_from_account").notNull().default(false),
    text: text("text"),
    /** Non-text payloads (images, shares, reels) summarised for display. */
    attachmentSummary: text("attachment_summary"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("message_conversation_time_idx").on(t.conversationId, t.sentAt)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Link-in-bio click. `linkId` is "a-<automationId>" or "p-<mediaId>".
 * Joined with comment_event (DMs sent) this closes the funnel.
 * ──────────────────────────────────────────────────────────────────────── */
export const linkClick = pgTable(
  "link_click",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    linkId: text("link_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("link_click_account_time_idx").on(t.accountId, t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────────────
 * Link-in-bio page settings, one row per account. `order`, `hidden` and
 * `manual` hold ids: automation ids for the automatic buttons, "m<n>" ids
 * for manual links. `photo` is a small (240px) JPEG data URL.
 * ──────────────────────────────────────────────────────────────────────── */
export const bioConfig = pgTable("bio_config", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => account.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("papel"),
  shape: text("shape").notNull().default("arredondado"),
  bio: text("bio").notNull().default(""),
  photo: text("photo"),
  showFollowers: boolean("show_followers").notNull().default(true),
  showPosts: boolean("show_posts").notNull().default(true),
  postLayout: text("post_layout").notNull().default("grid3"),
  order: jsonb("order").$type<string[]>().notNull().default([]),
  hidden: jsonb("hidden").$type<string[]>().notNull().default([]),
  manual: jsonb("manual")
    .$type<{ id: string; label: string; url: string; type?: "link" | "heading" }[]>()
    .notNull()
    .default([]),
  /** Header layout, wallpaper, button style, font, colours, socials (see lib/bio/theme.ts). */
  style: jsonb("style").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* Requests submitted on the public data-deletion page. Handled manually. */
export const deletionRequest = pgTable("deletion_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  protocol: text("protocol").notNull().unique(),
  igUsername: text("ig_username").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────────────────────────────────────────────────
 * Lead — a person captured by a story automation. `step` drives the little
 * question flow in DMs: email → phone → done.
 * ──────────────────────────────────────────────────────────────────────── */
export const lead = pgTable(
  "lead",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    automationId: uuid("automation_id").references(() => automation.id, {
      onDelete: "set null",
    }),
    igId: text("ig_id").notNull(),
    username: text("username"),
    /** story | comment */
    source: text("source").notNull().default("story"),
    /** What the person replied with (the keyword / emoji). */
    trigger: text("trigger"),
    email: text("email"),
    phone: text("phone"),
    /** email | phone | done: which answer we are waiting for. */
    step: text("step").notNull().default("done"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lead_account_created_idx").on(t.accountId, t.createdAt)],
);
