"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { contact, conversation, db, message } from "@/db";
import { accessTokenFor, getAccountById } from "@/lib/account";
import { isWindowOpen } from "@/lib/automation/flow";
import { sendDirectMessage } from "@/lib/instagram/client";
import { clock } from "@/lib/inbox";
import { getSession } from "@/lib/session";

export type SendResult =
  | { ok: true; id: string; time: string }
  | { ok: false; error: string };

/**
 * Sends a free-form DM from the inbox. Meta only allows this inside the 24h
 * window after the person's last message, so that is re-checked here rather
 * than trusting the client.
 */
export async function sendInboxMessage(conversationId: string, text: string): Promise<SendResult> {
  const session = await getSession();
  if (!session) redirect("/");
  const body = text.trim();
  if (!body) return { ok: false, error: "Escreva uma mensagem." };
  if (body.length > 1000) return { ok: false, error: "A mensagem passou de 1000 caracteres." };

  const [thread] = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), eq(conversation.accountId, session.accountId)))
    .limit(1);
  if (!thread?.participantIgId) return { ok: false, error: "Conversa não encontrada." };

  const acct = await getAccountById(session.accountId);
  if (!acct) redirect("/");

  const [c] = await db
    .select({ expires: contact.messagingWindowExpiresAt })
    .from(contact)
    .where(and(eq(contact.accountId, acct.id), eq(contact.igId, thread.participantIgId)))
    .limit(1);
  if (!isWindowOpen(c?.expires ?? null)) {
    return {
      ok: false,
      error: "A janela de 24h fechou. O Instagram só deixa responder quando a pessoa mandar uma nova mensagem.",
    };
  }

  try {
    const sent = await sendDirectMessage(accessTokenFor(acct), acct.igUserId, thread.participantIgId, body);
    const now = new Date();
    const id = sent.message_id ?? `out:${now.getTime()}`;
    await db
      .insert(message)
      .values({ id, conversationId, fromIgId: acct.igUserId, isFromAccount: true, text: body, sentAt: now })
      .onConflictDoNothing({ target: message.id });
    await db
      .update(conversation)
      .set({ lastMessageAt: now, lastMessagePreview: body.slice(0, 200) })
      .where(eq(conversation.id, conversationId));
    revalidatePath("/entrada");
    return { ok: true, id, time: clock(now) };
  } catch (e) {
    console.error("[inbox] send failed", e);
    return { ok: false, error: "O Instagram não aceitou a mensagem agora. Tente de novo em instantes." };
  }
}
