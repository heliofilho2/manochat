import "server-only";
import { and, eq } from "drizzle-orm";
import { contact, contactTag, db, tag } from "@/db";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Creates or refreshes a contact after an inbound interaction (a comment or
 * a DM) and pushes its 24h messaging window forward.
 */
export async function touchContact(
  accountId: string,
  igId: string,
  username: string | null,
  at: Date,
): Promise<string> {
  const windowEnd = new Date(at.getTime() + WINDOW_MS);
  const [row] = await db
    .insert(contact)
    .values({
      accountId,
      igId,
      username,
      lastInteractionAt: at,
      messagingWindowExpiresAt: windowEnd,
    })
    .onConflictDoUpdate({
      target: [contact.accountId, contact.igId],
      set: {
        ...(username ? { username } : {}),
        lastInteractionAt: at,
        messagingWindowExpiresAt: windowEnd,
      },
    })
    .returning({ id: contact.id });
  return row.id;
}

/** The contact row for an Instagram user, if they ever interacted. */
export async function findContactId(accountId: string, igId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: contact.id })
    .from(contact)
    .where(and(eq(contact.accountId, accountId), eq(contact.igId, igId)))
    .limit(1);
  return row?.id ?? null;
}

/** Whether the contact currently carries this tag. */
export async function hasTag(accountId: string, contactId: string, name: string): Promise<boolean> {
  const rows = await db
    .select({ id: tag.id })
    .from(contactTag)
    .innerJoin(tag, eq(tag.id, contactTag.tagId))
    .where(
      and(
        eq(contactTag.contactId, contactId),
        eq(tag.accountId, accountId),
        eq(tag.name, name.trim().toLowerCase()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Removes a tag from a contact. Idempotent. */
export async function removeTag(accountId: string, contactId: string, name: string) {
  const [t] = await db
    .select({ id: tag.id })
    .from(tag)
    .where(and(eq(tag.accountId, accountId), eq(tag.name, name.trim().toLowerCase())))
    .limit(1);
  if (!t) return;
  await db.delete(contactTag).where(and(eq(contactTag.contactId, contactId), eq(contactTag.tagId, t.id)));
}

/** Adds a tag to a contact, creating the tag if needed. Idempotent. */
export async function addTag(accountId: string, contactId: string, name: string) {
  const clean = name.trim().toLowerCase();
  if (!clean) return;

  await db.insert(tag).values({ accountId, name: clean }).onConflictDoNothing();
  const [t] = await db
    .select({ id: tag.id })
    .from(tag)
    .where(and(eq(tag.accountId, accountId), eq(tag.name, clean)))
    .limit(1);

  await db
    .insert(contactTag)
    .values({ contactId, tagId: t.id })
    .onConflictDoNothing();
}
