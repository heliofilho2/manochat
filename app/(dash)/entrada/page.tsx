import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { automation, commentEvent, contact, contactTag, conversation, db, message, tag } from "@/db";
import { getAccountById } from "@/lib/account";
import { initialsOf, timeAgo } from "@/lib/format";
import { clock, dayLabel, friendlyReason, hoursLeft, overallOf, stepOf } from "@/lib/inbox";
import { toneFor } from "@/lib/posts-view";
import { getSession } from "@/lib/session";
import { IconInbox } from "@/components/icons";
import { CommentsList, type CommentItem } from "./comments-list";
import { ConversationsPane, type ThreadItem, type ThreadMessage } from "./conversations-pane";

export const dynamic = "force-dynamic";
export const metadata = { title: "Caixa de entrada — Manochat" };

export default async function InboxPage({ searchParams }: PageProps<"/entrada">) {
  const session = await getSession();
  if (!session) redirect("/");
  const acct = await getAccountById(session.accountId);
  if (!acct) redirect("/");

  const { aba, c } = await searchParams;
  const tab = aba === "conversas" ? "conversas" : "comentarios";
  const selected = typeof c === "string" ? c : null;

  const [events, threads] = await Promise.all([
    db
      .select({ event: commentEvent, automationName: automation.name })
      .from(commentEvent)
      .leftJoin(automation, eq(commentEvent.automationId, automation.id))
      .where(eq(commentEvent.accountId, acct.id))
      .orderBy(desc(commentEvent.createdAt))
      .limit(100),
    db
      .select()
      .from(conversation)
      .where(eq(conversation.accountId, acct.id))
      .orderBy(desc(conversation.lastMessageAt))
      .limit(50),
  ]);

  const convIds = new Set(threads.map((t) => t.id));
  const comments: CommentItem[] = events.map(({ event, automationName }) => {
    const reply = stepOf(event.replyStatus);
    const dm = stepOf(event.dmStatus);
    const user = event.fromUsername ?? "alguém";
    const convId = event.fromIgId ? `ig:${acct.igUserId}:${event.fromIgId}` : null;
    return {
      id: event.id,
      user,
      initials: initialsOf(user),
      tone: toneFor(user),
      time: timeAgo(event.createdAt),
      text: event.commentText,
      keyword: event.matchedKeyword ?? "",
      automation: automationName ?? "automação excluída",
      reply,
      dm,
      overall: overallOf(reply, dm),
      reason: friendlyReason(reply, dm, event.replyError, event.dmError),
      conversationId: convId && convIds.has(convId) ? convId : null,
    };
  });

  // Conversations: messages, 24h window and tags all come from our own mirror.
  let threadItems: ThreadItem[] = [];
  if (threads.length > 0) {
    const ids = threads.map((t) => t.id);
    const igIds = threads.map((t) => t.participantIgId).filter((x): x is string => Boolean(x));
    const [msgs, contacts] = await Promise.all([
      db.select().from(message).where(inArray(message.conversationId, ids)).orderBy(desc(message.sentAt)).limit(600),
      igIds.length
        ? db
            .select()
            .from(contact)
            .where(eq(contact.accountId, acct.id))
            .then((all) => all.filter((x) => igIds.includes(x.igId)))
        : Promise.resolve([]),
    ]);
    const contactIds = contacts.map((x) => x.id);
    const tagRows = contactIds.length
      ? await db
          .select({ contactId: contactTag.contactId, name: tag.name })
          .from(contactTag)
          .innerJoin(tag, eq(tag.id, contactTag.tagId))
          .where(inArray(contactTag.contactId, contactIds))
      : [];
    const byContact = new Map<string, string[]>();
    for (const r of tagRows) byContact.set(r.contactId, [...(byContact.get(r.contactId) ?? []), r.name]);
    const contactByIg = new Map(contacts.map((x) => [x.igId, x]));

    const byThread = new Map<string, typeof msgs>();
    for (const m of msgs) byThread.set(m.conversationId, [...(byThread.get(m.conversationId) ?? []), m]);

    const now = new Date();
    threadItems = threads.map((t) => {
      const user = t.participantUsername ?? t.participantIgId ?? "desconhecido";
      const ct = t.participantIgId ? contactByIg.get(t.participantIgId) : undefined;
      const ms = (byThread.get(t.id) ?? []).slice().reverse(); // oldest first
      const view: ThreadMessage[] = [];
      let lastDay = "";
      for (const m of ms) {
        if (!m.sentAt) continue;
        const day = dayLabel(m.sentAt, now);
        if (day !== lastDay) {
          view.push({ id: `day:${t.id}:${day}`, kind: "day", text: day, meta: "" });
          lastDay = day;
        }
        view.push({
          id: m.id,
          kind: m.isFromAccount ? "me" : "them",
          text: m.text ?? m.attachmentSummary ?? "(anexo)",
          meta: clock(m.sentAt),
        });
      }
      const latest = ms[ms.length - 1];
      return {
        id: t.id,
        user,
        initials: initialsOf(user),
        tone: toneFor(user),
        time: timeAgo(t.lastMessageAt),
        last: latest
          ? `${latest.isFromAccount ? "Você: " : ""}${latest.text ?? latest.attachmentSummary ?? "(anexo)"}`
          : (t.lastMessagePreview ?? ""),
        unread: latest ? !latest.isFromAccount && now.getTime() - (latest.sentAt?.getTime() ?? 0) < 86_400_000 : false,
        hours: hoursLeft(ct?.messagingWindowExpiresAt ?? null),
        tags: (ct ? (byContact.get(ct.id) ?? []) : []).map((n) => `#${n}`).join(" · "),
        messages: view,
      };
    });
  }

  const unread = threadItems.filter((t) => t.unread).length;
  const empty = comments.length === 0 && threadItems.length === 0;
  const tabs = [
    { k: "comentarios", label: "Comentários", count: String(comments.length) },
    { k: "conversas", label: "Conversas", count: unread ? `${unread} novas` : String(threadItems.length) },
  ];

  return (
    <div className="animate-up flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
            Caixa de entrada
          </h1>
          <span className="text-[15px] text-muted">Tudo o que o Manochat respondeu e enviou por você.</span>
        </div>
        <div role="tablist" className="flex gap-0.5 rounded-xl bg-fill p-1">
          {tabs.map((t) => (
            <Link
              key={t.k}
              href={`/entrada?aba=${t.k}`}
              className="flex h-[38px] items-center gap-2 rounded-[9px] px-3.5 text-sm font-medium whitespace-nowrap"
              style={{
                background: tab === t.k ? "#fff" : "transparent",
                boxShadow: tab === t.k ? "0 1px 3px rgba(27,23,18,.12)" : "none",
              }}
            >
              {t.label}
              <span className="text-xs font-medium text-muted">{t.count}</span>
            </Link>
          ))}
        </div>
      </div>

      {empty ? (
        <div className="flex flex-col items-start gap-3 rounded-[22px] border border-dashed border-line-strong bg-white p-[clamp(24px,5vw,48px)]">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px_16px_16px_4px] bg-accent-soft text-accent-ink">
            <IconInbox size={24} strokeWidth={2} />
          </span>
          <h2 className="m-0 text-[26px] leading-[1.1] font-bold tracking-[-0.02em]">Nada por aqui ainda</h2>
          <p className="m-0 max-w-[460px] text-base leading-[1.55] text-ink-2">
            Quando alguém comentar uma das suas palavras-chave, o comentário e a conversa aparecem aqui na hora.
          </p>
        </div>
      ) : tab === "comentarios" ? (
        <CommentsList items={comments} />
      ) : threadItems.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line-strong bg-white px-5 py-9 text-center text-[15px] text-muted">
          Nenhuma conversa ainda. Elas aparecem quando alguém responde às suas DMs.
        </div>
      ) : (
        <ConversationsPane threads={threadItems} selected={selected} />
      )}
    </div>
  );
}
