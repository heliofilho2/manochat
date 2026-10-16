import { and, eq, gte, isNotNull, notLike, sql, type AnyColumn } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  automation,
  bioView,
  commentEvent,
  conversation,
  db,
  flow,
  flowRun,
  lead,
  linkClick,
  message,
  tapEvent,
} from "@/db";
import { getAccount } from "@/lib/account";
import {
  buildCentralExport,
  CENTRAL_TIME_ZONE,
  dayRange,
  dayStart,
  parseCentralDays,
  type CentralInput,
  type DayCount,
  type MessageFlag,
  type WebhookComment,
} from "@/lib/central/export";
import { isAuthorizedCentralApi } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Fuso como literal (constante nossa, nunca entrada de fora): com parâmetro, o select e o group by
// viram $1 e $2 e o Postgres não reconhece que são a mesma expressão.
const TZ = sql.raw(`'${CENTRAL_TIME_ZONE}'`);
const dayExpr = (col: AnyColumn) => sql<string>`to_char(${col} at time zone ${TZ}, 'YYYY-MM-DD')`;

/**
 * Único consumidor: a Central do Criador (lib/oslinke.ts de lá), uma vez por dia.
 * Somente leitura, protegido por CENTRAL_API_SECRET (ver lib/cron-auth.ts).
 * ?days=N (1 a 31, padrão 3): totais por dia, palavras por dia e as mensagens
 * recebidas no período, sem e-mail nem telefone (lib/central/export.ts).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCentralApi(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const days = parseCentralDays(request.nextUrl.searchParams.get("days"));
  const empty: CentralInput = {
    now,
    days,
    comments: [],
    flowRuns: [],
    flowComments: [],
    flows: [],
    automations: [],
    taps: [],
    messages: [],
    flags: [],
    leads: [],
    commentsReceived: [],
    bioViews: [],
    bioClicks: [],
  };

  const acct = await getAccount();
  if (!acct) return NextResponse.json(buildCentralExport(empty));

  const since = dayStart(dayRange(now, days)[0]);
  const me = acct.igUserId;
  // Nos SQL crus a data vai como texto ISO com cast: não depende de como o driver serializa Date.
  const sinceIso = since.toISOString();

  const [comments, runs, flows, autos, taps, messages, leads, received, views, clicks, flags] = await Promise.all([
    db
      .select({
        commentId: commentEvent.commentId,
        automationId: commentEvent.automationId,
        mediaId: commentEvent.mediaId,
        text: commentEvent.commentText,
        matchedKeyword: commentEvent.matchedKeyword,
        fromIgId: commentEvent.fromIgId,
        dmStatus: commentEvent.dmStatus,
        commentedAt: commentEvent.commentedAt,
        createdAt: commentEvent.createdAt,
      })
      .from(commentEvent)
      .where(and(eq(commentEvent.accountId, acct.id), gte(commentEvent.createdAt, since))),
    db
      .select({
        flowId: flowRun.flowId,
        igId: flowRun.igId,
        triggerRef: flowRun.triggerRef,
        commentId: flowRun.commentId,
        status: flowRun.status,
        privateReplyUsed: flowRun.privateReplyUsed,
        at: flowRun.createdAt,
      })
      .from(flowRun)
      .where(and(eq(flowRun.accountId, acct.id), gte(flowRun.createdAt, since))),
    db.select({ id: flow.id, keywords: flow.keywords, matchMode: flow.matchMode }).from(flow).where(eq(flow.accountId, acct.id)),
    db
      .select({ id: automation.id, kind: automation.kind, requireFollow: automation.requireFollow, openerText: automation.openerText })
      .from(automation)
      .where(eq(automation.accountId, acct.id)),
    db
      .select({ automationId: tapEvent.automationId, igId: tapEvent.igId, outcome: tapEvent.outcome, at: tapEvent.createdAt })
      .from(tapEvent)
      .where(and(eq(tapEvent.accountId, acct.id), eq(tapEvent.outcome, "link_sent"), gte(tapEvent.createdAt, since))),
    db
      .select({
        id: message.id,
        fromIgId: message.fromIgId,
        text: message.text,
        attachmentSummary: message.attachmentSummary,
        at: message.sentAt,
      })
      .from(message)
      .innerJoin(conversation, eq(conversation.id, message.conversationId))
      .where(
        and(
          eq(conversation.accountId, acct.id),
          eq(message.isFromAccount, false),
          isNotNull(message.sentAt),
          gte(message.sentAt, since),
        ),
      ),
    db
      .select({ source: lead.source, trigger: lead.trigger, at: lead.createdAt })
      .from(lead)
      .where(and(eq(lead.accountId, acct.id), gte(lead.createdAt, since))),
    // Todos os comentários que chegaram (não só os com palavra), sem os do próprio perfil.
    db.execute<{ day: string; n: number }>(sql`
      select to_char(w.received_at at time zone ${TZ}, 'YYYY-MM-DD') as day,
             count(distinct c -> 'value' ->> 'id')::int as n
      from webhook_event w
      cross join lateral jsonb_path_query(w.payload, '$.entry[*].changes[*] ? (@.field == "comments")') as c
      where w.field = 'comments'
        and w.received_at >= ${sinceIso}::timestamptz
        and coalesce(c -> 'value' -> 'from' ->> 'id', '') <> ${me}
      group by 1
    `),
    db
      .select({ day: dayExpr(bioView.createdAt), n: sql<number>`count(*)::int` })
      .from(bioView)
      .where(and(eq(bioView.accountId, acct.id), gte(bioView.createdAt, since)))
      .groupBy(dayExpr(bioView.createdAt)),
    // Cliques da página de links (a-, p-, m-). Os "f-" são botões de fluxo dentro da DM.
    db
      .select({ day: dayExpr(linkClick.createdAt), n: sql<number>`count(*)::int` })
      .from(linkClick)
      .where(and(eq(linkClick.accountId, acct.id), gte(linkClick.createdAt, since), notLike(linkClick.linkId, "f-%")))
      .groupBy(dayExpr(linkClick.createdAt)),
    // O que só o webhook cru sabe: resposta de story, toque em resposta rápida, menção em story.
    db.execute<{ mid: string; story_id: string | null; story_reply: boolean; quick_reply: boolean; mention: boolean }>(sql`
      select m -> 'message' ->> 'mid' as mid,
             m -> 'message' -> 'reply_to' -> 'story' ->> 'id' as story_id,
             (m -> 'message' -> 'reply_to' -> 'story') is not null as story_reply,
             (m -> 'message' -> 'quick_reply') is not null as quick_reply,
             coalesce((m -> 'message' -> 'attachments') @> '[{"type":"story_mention"}]'::jsonb, false) as mention
      from webhook_event w
      cross join lateral jsonb_path_query(w.payload, '$.entry[*].messaging[*]') as m
      where w.field = 'messages'
        and w.received_at >= ${sinceIso}::timestamptz
        and m -> 'message' ->> 'mid' is not null
        and ((m -> 'message' -> 'reply_to' -> 'story') is not null
          or (m -> 'message' -> 'quick_reply') is not null
          or coalesce((m -> 'message' -> 'attachments') @> '[{"type":"story_mention"}]'::jsonb, false))
    `),
  ]);

  // O flow_run não guarda o texto do comentário: vem do webhook que abriu o fluxo.
  const flowCommentIds = [...new Set(runs.filter((r) => r.commentId && r.triggerRef === r.commentId).map((r) => r.commentId!))];
  const flowComments: WebhookComment[] = flowCommentIds.length
    ? (
        await db.execute<{ id: string; text: string | null; media_id: string | null }>(sql`
          select distinct on (c -> 'value' ->> 'id')
                 c -> 'value' ->> 'id' as id,
                 c -> 'value' ->> 'text' as text,
                 c -> 'value' -> 'media' ->> 'id' as media_id
          from webhook_event w
          cross join lateral jsonb_path_query(w.payload, '$.entry[*].changes[*] ? (@.field == "comments")') as c
          where w.field = 'comments'
            and w.received_at >= ${new Date(since.getTime() - 86_400_000).toISOString()}::timestamptz
            and (c -> 'value' ->> 'id') in (${sql.join(
              flowCommentIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        `)
      ).rows.map((r) => ({ id: r.id, text: r.text, mediaId: r.media_id }))
    : [];

  const toDayCounts = (rows: { day: string; n: number }[]): DayCount[] => rows.map((r) => ({ day: r.day, n: Number(r.n) }));
  const flagRows: MessageFlag[] = flags.rows.map((f) => ({
    mid: f.mid,
    storyId: f.story_id,
    storyReply: !!f.story_reply,
    quickReply: !!f.quick_reply,
    mention: !!f.mention,
  }));

  return NextResponse.json(
    buildCentralExport({
      ...empty,
      comments: comments.map((c) => ({ ...c, at: c.commentedAt ?? c.createdAt })),
      flowRuns: runs,
      flowComments,
      flows,
      // Mesma regra de usesOpenerButton (lib/automation/flow.ts): botão no primeiro DM = link no toque.
      automations: autos.map((a) => ({ id: a.id, gated: a.kind === "comment" && (a.requireFollow || Boolean(a.openerText)) })),
      taps,
      messages: messages.map((m) => ({ ...m, at: m.at! })),
      flags: flagRows,
      leads,
      commentsReceived: toDayCounts(received.rows),
      bioViews: toDayCounts(views),
      bioClicks: toDayCounts(clicks),
    }),
  );
}
