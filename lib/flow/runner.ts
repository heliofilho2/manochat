import "server-only";
import { and, asc, desc, eq, gt, inArray, like, lte, sql } from "drizzle-orm";
import { account, contact, conversation, db, flow, flowRun, lead, linkClick, message, type FlowRunVars } from "@/db";
import { accessTokenFor, type Account } from "@/lib/account";
import { addTag, contactProfile, findContactId, removeTag, touchContact } from "@/lib/contacts";
import { isWindowOpen } from "@/lib/automation/flow";
import { pickReply } from "@/lib/automation/matcher";
import { notifyOwner } from "@/lib/health-server";
import { forwardLead } from "@/lib/leads";
import {
  getUserFollowsBusiness,
  getUserProfile,
  InstagramApiError,
  replyToComment,
  sendDirectMessage,
  sendPrivateReply,
  sendTypingOn,
} from "@/lib/instagram/client";
import type { OutboundMessage } from "@/lib/instagram/types";
import {
  evaluateReply,
  evaluateRules,
  fieldKey,
  findNode,
  MAX_FLOW_HOPS,
  MAX_SENDS_PER_BURST,
  MAX_SENDS_PER_MINUTE,
  MAX_SENDS_PER_RUN,
  MAX_STEPS_PER_RUN,
  MAX_VISITS_PER_NODE,
  nextBrTime,
  nextNodeId,
  NO,
  normalizeGraph,
  OTHER,
  pickBranch,
  renderText,
  rulesNeedFollower,
  startNodeId,
  tapHandles,
  TIMEOUT,
  YES,
  type ActionData,
  type FlowNode,
  type Rule,
  type TextContext,
} from "./graph";
import {
  branchTagName,
  buildCardsMessage,
  buildFlowMessage,
  buildImageMessage,
  buildMediaMessage,
  clickKey,
  linkTarget,
  type FlowTap,
} from "./message";

type Flow = typeof flow.$inferSelect;
type Run = typeof flowRun.$inferSelect;

const patch = (id: string, values: Partial<typeof flowRun.$inferInsert>) =>
  db.update(flowRun).set({ ...values, updatedAt: new Date() }).where(eq(flowRun.id, id));

const loadFlow = async (id: string): Promise<Flow | null> => {
  const [row] = await db.select().from(flow).where(eq(flow.id, id)).limit(1);
  return row ? { ...row, graph: normalizeGraph(row.graph) } : null;
};

/** Tracked links need the public app URL; without it the raw link is sent. */
function trackerBase(): string | null {
  const url = process.env.APP_URL;
  return url ? url.replace(/\/$/, "") : null;
}

const DEFAULT_RETRY = "Não entendi 😅 Pode responder de novo?";

/** A safety cap tripped: the run stops quietly (no webhook retry) and the owner is told. */
class SafetyStop extends Error {}

/* ────────────────────────────────────────────────────────────────────────
 * Starting
 * ──────────────────────────────────────────────────────────────────────── */

export type StartResult = "started" | "skipped";

/**
 * Starts a flow for someone who commented, replied to / mentioned a story,
 * sent a word, or was sent here by another flow.
 *
 * `flow_run.trigger_ref` is UNIQUE, so a duplicate webhook cannot start a
 * second run. A run that failed half-way is picked up again here when the
 * event is retried, and carries on from the block that failed.
 */
export async function startFlowRun(
  acct: Account,
  flowRow: Flow,
  input: {
    igsid: string;
    username: string | null;
    /** Unique per trigger: the comment id, or "story:<mid>", "dm:<mid>", "jump:<run>:<node>". */
    triggerRef: string;
    /** Only for comments: the first message goes out as a Private Reply to it. */
    commentId: string | null;
    at: Date;
    hops?: number;
  },
): Promise<StartResult> {
  const graph = normalizeGraph(flowRow.graph);
  const start = startNodeId(graph);
  if (!start) return "skipped";
  const flowNow = { ...flowRow, graph };

  // Retry of the same trigger: carry on from where the failed run stopped.
  const [failed] = await db
    .update(flowRun)
    .set({ status: "running", lastError: null, updatedAt: new Date() })
    .where(and(eq(flowRun.triggerRef, input.triggerRef), eq(flowRun.status, "failed")))
    .returning();
  if (failed) {
    await execute(acct, flowNow, failed);
    return "started";
  }

  // "Same person again?" — the flow's own rule.
  if (flowRow.rerun !== "always") {
    const since = flowRow.rerun === "daily" ? new Date(Date.now() - 24 * 60 * 60 * 1000) : new Date(0);
    const [prior] = await db
      .select({ id: flowRun.id })
      .from(flowRun)
      .where(and(eq(flowRun.flowId, flowRow.id), eq(flowRun.igId, input.igsid), gt(flowRun.createdAt, since)))
      .limit(1);
    if (prior) return "skipped";
  }

  let username = input.username;
  let name: string | null = null;
  try {
    const profile = await getUserProfile(accessTokenFor(acct), input.igsid);
    username = profile.username ?? username;
    name = profile.name ?? null;
  } catch {
    // Only cosmetic ({usuario}, {nome}); carry on without it.
  }

  const [run] = await db
    .insert(flowRun)
    .values({
      flowId: flowRow.id,
      accountId: acct.id,
      igId: input.igsid,
      username,
      triggerRef: input.triggerRef,
      commentId: input.commentId,
      currentNodeId: start,
      variables: { branches: {}, name, hops: input.hops ?? 0, sent: 0 },
    })
    .onConflictDoNothing({ target: flowRun.triggerRef })
    .returning();
  if (!run) return "skipped";

  // A person is in one flow at a time: a new trigger replaces an older conversation.
  await db
    .update(flowRun)
    .set({ status: "done", lastError: "Substituído por um novo gatilho.", updatedAt: new Date() })
    .where(
      and(
        eq(flowRun.accountId, acct.id),
        eq(flowRun.igId, input.igsid),
        inArray(flowRun.status, ["waiting_tap", "waiting_reply", "waiting_delay"]),
        sql`${flowRun.id} <> ${run.id}`,
      ),
    );
  try {
    const contactId = await touchContact(acct.id, input.igsid, username, input.at);
    await addTag(acct.id, contactId, `flow:${flowRow.name}`);
  } catch (error) {
    console.error("[flow] contact upsert failed", error);
  }
  if (input.commentId) await publicReply(acct, flowRow, input.commentId);

  await execute(acct, flowNow, run);
  return "started";
}

/** Optional comment reply. A failure here never blocks the messages. */
async function publicReply(acct: Account, flowRow: Flow, commentId: string) {
  if (!flowRow.replyEnabled) return;
  const text = pickReply(flowRow.replyVariants);
  if (!text) return;
  try {
    await replyToComment(accessTokenFor(acct), commentId, text);
  } catch (error) {
    console.error("[flow] public reply failed", error);
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * Resuming: tap, typed answer, timer
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Continues a run after the person tapped a button, a card button or a quick
 * reply. Returns false when the tap is not ours to act on (stale, repeated…).
 */
export async function resumeFromTap(acct: Account, tap: FlowTap, igsid: string, at: Date): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(tap.runId)) return false;
  const [run] = await db
    .select()
    .from(flowRun)
    .where(and(eq(flowRun.id, tap.runId), eq(flowRun.accountId, acct.id)))
    .limit(1);
  if (!run || run.igId !== igsid) return false;
  if (run.status !== "waiting_tap" || run.currentNodeId !== tap.nodeId) return false;

  const flowRow = await loadFlow(run.flowId);
  if (!flowRow || flowRow.status !== "live") return false;
  const node = findNode(flowRow.graph, tap.nodeId);
  if (!node || !tapHandles(node).some((t) => t.id === tap.buttonId)) return false;

  // A tap is an inbound interaction: it reopens the 24h window.
  await touchContact(acct.id, igsid, null, at);
  return advanceFrom(acct, flowRow, run, "waiting_tap", nextNodeId(flowRow.graph, node.id, tap.buttonId));
}

/**
 * A plain DM from someone whose run waits on a "reply" block. Returns true
 * when the message belonged to a flow (so nothing else should answer it).
 */
export async function resumeFromReply(acct: Account, igsid: string, text: string, mid: string, at: Date): Promise<boolean> {
  const [run] = await db
    .select()
    .from(flowRun)
    .where(and(eq(flowRun.accountId, acct.id), eq(flowRun.igId, igsid), eq(flowRun.status, "waiting_reply")))
    .orderBy(desc(flowRun.updatedAt))
    .limit(1);
  if (!run?.currentNodeId) return false;

  const flowRow = await loadFlow(run.flowId);
  const node = flowRow ? findNode(flowRow.graph, run.currentNodeId) : undefined;
  if (!flowRow || flowRow.status !== "live" || node?.type !== "reply") return false;

  // Claim this answer so a repeated webhook can't advance the run twice.
  const claimed = await db
    .insert(message)
    .values({ id: `flowreply:${mid}`, conversationId: `ig:${acct.igUserId}:${igsid}`, fromIgId: igsid, isFromAccount: false, text, sentAt: at })
    .onConflictDoNothing({ target: message.id })
    .returning({ id: message.id });
  if (claimed.length === 0) return true;

  const result = evaluateReply(node, text);
  const target = nextNodeId(flowRow.graph, node.id, result.handle);

  if (result.handle === OTHER && !target) {
    // Nowhere to go for a wrong answer: ask again (a few times at most) and keep waiting.
    const retries = (run.variables.path ?? []).filter((n) => n === `retry:${node.id}`).length;
    if (retries >= 3) return true;
    await assertWindowOpen(acct.id, igsid);
    const retry = renderText(node.data.retryText.trim() || DEFAULT_RETRY, { username: run.username, name: run.variables.name });
    await sendDirectMessage(accessTokenFor(acct), acct.igUserId, igsid, { text: retry });
    await mirrorOutbound(acct, igsid, retry);
    await patch(run.id, { variables: { ...run.variables, path: [...(run.variables.path ?? []), `retry:${node.id}`] } });
    return true;
  }

  const answer = text.slice(0, 500);
  const vars: FlowRunVars = { ...run.variables, answers: { ...run.variables.answers, [node.id]: answer } };
  const contactId = await findContactId(acct.id, igsid);
  if (contactId && node.data.saveTo && fieldKey(node.data.saveTo)) {
    await setField(contactId, fieldKey(node.data.saveTo), result.value ?? answer);
  }
  if (result.value && (node.data.expect === "email" || node.data.expect === "phone")) {
    vars.leadId = await saveLead(acct, flowRow, run, vars.leadId, node.data.expect, result.value);
  }
  await patch(run.id, { variables: vars });
  return advanceFrom(acct, flowRow, { ...run, variables: vars }, "waiting_reply", target);
}

/** Moves a waiting run to `target` (or finishes it), claiming it so only one caller wins. */
async function advanceFrom(
  acct: Account,
  flowRow: Flow,
  run: Run,
  from: "waiting_tap" | "waiting_reply" | "waiting_delay",
  target: string | null,
): Promise<boolean> {
  const [claimed] = await db
    .update(flowRun)
    .set({ status: target ? "running" : "done", currentNodeId: target, resumeAt: null, updatedAt: new Date() })
    .where(and(eq(flowRun.id, run.id), eq(flowRun.status, from)))
    .returning();
  if (!claimed) return false;
  if (target) await execute(acct, flowRow, claimed);
  return true;
}

/** Continues runs whose wait is over (delays, and answers that never came). Cron. Paused flows wait. */
export async function resumeDueRuns(limit = 10): Promise<number> {
  const due = await db
    .select({ run: flowRun })
    .from(flowRun)
    .innerJoin(flow, eq(flow.id, flowRun.flowId))
    .where(and(inArray(flowRun.status, ["waiting_delay", "waiting_reply"]), lte(flowRun.resumeAt, new Date()), eq(flow.status, "live")))
    .orderBy(asc(flowRun.resumeAt))
    .limit(limit);

  let resumed = 0;
  for (const { run } of due) {
    const flowRow = await loadFlow(run.flowId);
    const [acct] = await db.select().from(account).where(eq(account.id, run.accountId)).limit(1);
    if (!flowRow || !acct) {
      await patch(run.id, { status: "failed", lastError: "Fluxo ou conta não existe mais." });
      continue;
    }
    // A delay already points at the next block; an unanswered question takes its "timeout" path.
    const target =
      run.status === "waiting_delay" ? run.currentNodeId : run.currentNodeId ? nextNodeId(flowRow.graph, run.currentNodeId, TIMEOUT) : null;
    try {
      if (await advanceFrom(acct, flowRow, run, run.status as "waiting_delay" | "waiting_reply", target)) resumed++;
    } catch (error) {
      console.error("[flow] resume failed", run.id, error);
    }
  }
  return resumed;
}

/** Ends every unfinished run of a flow (the "stop everything" button). */
export async function stopRuns(flowId: string, accountId: string): Promise<number> {
  const rows = await db
    .update(flowRun)
    .set({ status: "done", lastError: "Encerrado manualmente.", resumeAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(flowRun.flowId, flowId),
        eq(flowRun.accountId, accountId),
        inArray(flowRun.status, ["running", "waiting_tap", "waiting_reply", "waiting_delay"]),
      ),
    )
    .returning({ id: flowRun.id });
  return rows.length;
}

/**
 * Records a click on a tracked flow link and returns where to send the person.
 * Called by the /r/f-… redirect.
 */
export async function recordFlowClick(tap: FlowTap, opts: { device: string | null; count: boolean }): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(tap.runId)) return null;
  const [run] = await db.select().from(flowRun).where(eq(flowRun.id, tap.runId)).limit(1);
  if (!run) return null;
  const flowRow = await loadFlow(run.flowId);
  const node = flowRow ? findNode(flowRow.graph, tap.nodeId) : undefined;
  const dest = node ? linkTarget(node, tap.buttonId) : null;
  if (!flowRow || !dest) return null;

  if (opts.count) {
    await db.insert(linkClick).values({ accountId: run.accountId, linkId: clickKey(flowRow.id, tap.nodeId, tap.buttonId), device: opts.device });
    const key = `${tap.nodeId}.${tap.buttonId}`;
    const clicks = run.variables.clicks ?? [];
    if (!clicks.includes(key)) await patch(run.id, { variables: { ...run.variables, clicks: [...clicks, key] } });
  }
  return dest;
}

/* ────────────────────────────────────────────────────────────────────────
 * Walking the graph
 * ──────────────────────────────────────────────────────────────────────── */

/** Walks the graph from the run's current block until it must wait or ends. */
async function execute(acct: Account, flowRow: Flow, run: Run): Promise<void> {
  const graph = flowRow.graph;
  const token = accessTokenFor(acct);
  let nodeId = run.currentNodeId;
  let privateReplyUsed = run.privateReplyUsed;
  let burst = 0;
  const vars: FlowRunVars = { ...run.variables, branches: { ...run.variables.branches }, path: [...(run.variables.path ?? [])] };

  const textCtx = async (): Promise<TextContext> => {
    const contactId = await findContactId(acct.id, run.igId);
    const fields = contactId ? (await contactProfile(acct.id, contactId)).fields : {};
    const answers = Object.values(vars.answers ?? {});
    return { username: run.username, name: vars.name ?? null, fields, answer: answers.at(-1) ?? null };
  };

  /** Every outgoing message goes through here, so every cap is checked in one place. */
  const send = async (body: OutboundMessage, opts: { typing?: number } = {}) => {
    burst++;
    vars.sent = (vars.sent ?? 0) + 1;
    if (burst > MAX_SENDS_PER_BURST) {
      throw new SafetyStop(`mais de ${MAX_SENDS_PER_BURST} mensagens seguidas sem a pessoa interagir.`);
    }
    if (vars.sent > MAX_SENDS_PER_RUN) throw new SafetyStop(`esta pessoa já recebeu ${MAX_SENDS_PER_RUN} mensagens deste fluxo.`);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(message)
      .where(
        and(
          eq(message.conversationId, `ig:${acct.igUserId}:${run.igId}`),
          like(message.id, "flow:%"),
          gt(message.sentAt, new Date(Date.now() - 60_000)),
        ),
      );
    if (n >= MAX_SENDS_PER_MINUTE) throw new SafetyStop(`mais de ${MAX_SENDS_PER_MINUTE} mensagens de fluxos para esta pessoa em 1 minuto.`);

    if (run.commentId && !privateReplyUsed) {
      await sendPrivateReply(token, acct.igUserId, run.commentId, body);
      privateReplyUsed = true;
      await patch(run.id, { privateReplyUsed: true });
    } else {
      await assertWindowOpen(acct.id, run.igId);
      if (opts.typing && opts.typing > 0) {
        try {
          await sendTypingOn(token, acct.igUserId, run.igId);
          await new Promise((r) => setTimeout(r, Math.min(5, opts.typing!) * 1000));
        } catch {
          // Cosmetic only.
        }
      }
      await sendDirectMessage(token, acct.igUserId, run.igId, body);
    }
    await patch(run.id, { variables: vars });
  };

  try {
    for (let steps = 0; nodeId; steps++) {
      if (steps >= MAX_STEPS_PER_RUN) throw new SafetyStop("o fluxo andou passos demais de uma vez.");
      const node = findNode(graph, nodeId);
      if (!node) throw new Error("Um bloco do fluxo foi apagado enquanto a pessoa estava nele.");

      const visits = vars.path!.filter((p) => p === node.id).length;
      if (visits >= MAX_VISITS_PER_NODE) throw new SafetyStop(`o mesmo passo rodou ${MAX_VISITS_PER_NODE} vezes para esta pessoa.`);

      // Checkpoint: if we die inside this block, a retry starts again from here.
      vars.path!.push(node.id);
      await patch(run.id, { status: "running", currentNodeId: node.id, variables: vars });

      switch (node.type) {
        case "trigger":
          nodeId = nextNodeId(graph, node.id);
          break;

        case "message": {
          const ctx = await textCtx();
          // The Private Reply is a single send, so an image only goes when the window is open.
          const image = buildImageMessage(node);
          if (image && (privateReplyUsed || !run.commentId)) await send(image);
          await send(buildFlowMessage(node, run.id, { baseUrl: trackerBase(), text: ctx }), { typing: node.data.typing });
          await mirrorOutbound(acct, run.igId, renderText(node.data.text, ctx));
          if (tapHandles(node).length > 0) {
            await patch(run.id, { status: "waiting_tap", currentNodeId: node.id });
            return;
          }
          nodeId = nextNodeId(graph, node.id);
          break;
        }

        case "media": {
          const body = buildMediaMessage(node);
          if (body) {
            await send(body);
            await mirrorOutbound(acct, run.igId, node.data.kind === "image" ? "🖼️ Imagem" : node.data.kind === "video" ? "🎬 Vídeo" : "🎧 Áudio");
          }
          nodeId = nextNodeId(graph, node.id);
          break;
        }

        case "cards": {
          await send(buildCardsMessage(node, run.id, { baseUrl: trackerBase(), text: await textCtx() }));
          await mirrorOutbound(acct, run.igId, `🗂️ ${node.data.cards.map((c) => c.title).join(" · ")}`);
          if (tapHandles(node).length > 0) {
            await patch(run.id, { status: "waiting_tap", currentNodeId: node.id });
            return;
          }
          nodeId = nextNodeId(graph, node.id);
          break;
        }

        case "reply": {
          // Wait for the person's next DM; resumeFromReply takes it from here.
          const t = node.data.timeoutMinutes;
          await patch(run.id, { status: "waiting_reply", currentNodeId: node.id, resumeAt: t ? new Date(Date.now() + t * 60_000) : null });
          return;
        }

        case "random": {
          const branch = pickBranch(node.data.branches, Math.random());
          if (!branch) throw new Error("O sorteio não tem nenhum caminho possível.");
          vars.branches[node.id] = branch.id;
          await patch(run.id, { variables: vars });
          const contactId = await findContactId(acct.id, run.igId);
          if (contactId) await addTag(acct.id, contactId, branchTagName(flowRow.name, branch.label));
          nodeId = nextNodeId(graph, node.id, branch.id);
          break;
        }

        case "condition": {
          const yes = await evaluate(acct, token, run, vars, node.data.match, node.data.rules);
          nodeId = nextNodeId(graph, node.id, yes ? YES : NO);
          break;
        }

        case "delay": {
          const next = nextNodeId(graph, node.id);
          if (!next) {
            nodeId = null;
            break;
          }
          const until = node.data.until;
          await patch(run.id, {
            status: "waiting_delay",
            currentNodeId: next,
            resumeAt: until ? nextBrTime(new Date(), until.hour, until.minute) : new Date(Date.now() + node.data.minutes * 60_000),
          });
          return;
        }

        case "action": {
          const jumped = await runAction(acct, flowRow, run, vars, node, privateReplyUsed);
          if (jumped) return;
          nodeId = nextNodeId(graph, node.id);
          break;
        }
      }
    }
    await patch(run.id, { status: "done", currentNodeId: null });
  } catch (error) {
    const stop = error instanceof SafetyStop;
    const reason = error instanceof Error ? error.message : String(error);
    await patch(run.id, {
      status: "failed",
      resumeAt: null,
      lastError: stop ? `🛑 Trava de segurança: ${reason} O fluxo parou para esta pessoa.` : reason,
    });
    if (stop) {
      await notifyOwner(`🛑 Oslinke parou o fluxo "${flowRow.name}" para @${run.username ?? run.igId}: ${reason} Confira o fluxo para não mandar mensagens demais.`);
      return; // Never retried: retrying would trip the same cap.
    }
    throw error;
  }
}

/** Runs one action block. Returns true when the run handed over to another flow. */
async function runAction(
  acct: Account,
  flowRow: Flow,
  run: Run,
  vars: FlowRunVars,
  node: Extract<FlowNode, { type: "action" }>,
  privateReplyUsed: boolean,
): Promise<boolean> {
  const a: ActionData = node.data;
  const contactId = await findContactId(acct.id, run.igId);
  const ctx = async (): Promise<TextContext> => ({
    username: run.username,
    name: vars.name ?? null,
    fields: contactId ? (await contactProfile(acct.id, contactId)).fields : {},
    answer: Object.values(vars.answers ?? {}).at(-1) ?? null,
  });

  switch (a.op) {
    case "add_tag":
      if (contactId) await addTag(acct.id, contactId, a.tag);
      return false;
    case "remove_tag":
      if (contactId) await removeTag(acct.id, contactId, a.tag);
      return false;
    case "set_field":
      if (contactId) await setField(contactId, fieldKey(a.field), renderText(a.value, await ctx()).slice(0, 500));
      return false;
    case "clear_field":
      if (contactId) {
        await db
          .update(contact)
          .set({ fields: sql`${contact.fields} - ${fieldKey(a.field)}` })
          .where(eq(contact.id, contactId));
      }
      return false;
    case "notify":
      await notifyOwner(`🔔 ${flowRow.name} · @${run.username ?? run.igId}\n${renderText(a.text, await ctx())}`);
      return false;
    case "webhook": {
      const profile = contactId ? await contactProfile(acct.id, contactId) : { fields: {}, tags: [] as string[] };
      try {
        await fetch(a.url.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "flow.webhook",
            flow: { id: flowRow.id, name: flowRow.name },
            contact: { igId: run.igId, username: run.username, name: vars.name ?? null, fields: profile.fields, tags: profile.tags },
            answers: vars.answers ?? {},
            at: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (error) {
        console.error("[flow] webhook failed", error);
      }
      return false;
    }
    case "human": {
      if (contactId) {
        await db
          .update(contact)
          .set({ botPausedUntil: new Date(Date.now() + a.hours * 60 * 60 * 1000) })
          .where(eq(contact.id, contactId));
      }
      await notifyOwner(`🙋 @${run.username ?? run.igId} quer falar com você (fluxo "${flowRow.name}"). As automações ficam quietas para essa pessoa por ${a.hours}h. Responda pela Caixa de entrada.`);
      return false;
    }
    case "start_flow": {
      const hops = (vars.hops ?? 0) + 1;
      if (hops > MAX_FLOW_HOPS) throw new SafetyStop(`fluxos demais encadeados (máximo ${MAX_FLOW_HOPS}).`);
      const target = await loadFlow(a.flowId);
      if (!target || target.accountId !== acct.id || target.status !== "live") {
        throw new Error("O fluxo escolhido em “Iniciar outro fluxo” não está no ar.");
      }
      await patch(run.id, { status: "done", currentNodeId: null, variables: vars });
      await startFlowRun(acct, target, {
        igsid: run.igId,
        username: run.username,
        triggerRef: `jump:${run.id}:${node.id}`,
        commentId: run.commentId && !privateReplyUsed ? run.commentId : null,
        at: new Date(),
        hops,
      });
      return true;
    }
  }
}

async function evaluate(acct: Account, token: string, run: Run, vars: FlowRunVars, match: "all" | "any", rules: Rule[]): Promise<boolean> {
  const contactId = await findContactId(acct.id, run.igId);
  const profile = contactId ? await contactProfile(acct.id, contactId) : { tags: [], fields: {} };
  // Re-read clicks: they land on the row while the run is parked in a delay.
  const [fresh] = await db.select({ v: flowRun.variables }).from(flowRun).where(eq(flowRun.id, run.id)).limit(1);
  if (fresh?.v.clicks) vars.clicks = fresh.v.clicks;

  let isFollower: boolean | null = null;
  if (rulesNeedFollower(rules)) {
    try {
      isFollower = await getUserFollowsBusiness(token, run.igId);
      if (contactId) {
        await db.update(contact).set({ isFollower, followerCheckedAt: new Date() }).where(eq(contact.id, contactId));
        if (isFollower) await addTag(acct.id, contactId, "follower");
      }
    } catch (error) {
      // Meta only answers for people who interacted; "can't tell" reads as "no".
      if (!(error instanceof InstagramApiError)) throw error;
      isFollower = false;
    }
  }

  return evaluateRules(match, rules, {
    tags: profile.tags,
    isFollower,
    clicked: (vars.clicks ?? []).length > 0,
    fields: profile.fields,
    answer: Object.values(vars.answers ?? {}).at(-1) ?? null,
    now: new Date(),
  });
}

async function setField(contactId: string, key: string, value: string) {
  if (!key) return;
  await db
    .update(contact)
    .set({ fields: sql`${contact.fields} || jsonb_build_object(${key}::text, ${value}::text)` })
    .where(eq(contact.id, contactId));
}

/** E-mail / phone answers become a lead (one per run), forwarded like story leads. */
async function saveLead(
  acct: Account,
  flowRow: Flow,
  run: Run,
  leadId: string | undefined,
  kind: "email" | "phone",
  value: string,
): Promise<string | undefined> {
  try {
    const fields = kind === "email" ? { email: value } : { phone: value };
    let id = leadId;
    if (id) {
      await db.update(lead).set({ ...fields, updatedAt: new Date() }).where(eq(lead.id, id));
    } else {
      const [row] = await db
        .insert(lead)
        .values({ accountId: acct.id, igId: run.igId, username: run.username, source: "flow", trigger: flowRow.name.slice(0, 60), step: "done", ...fields })
        .returning({ id: lead.id });
      id = row.id;
    }
    const contactId = await findContactId(acct.id, run.igId);
    if (contactId) await addTag(acct.id, contactId, "lead");
    void forwardLead(id, leadId ? "lead.updated" : "lead.created");
    return id;
  } catch (error) {
    console.error("[flow] lead save failed", error);
    return leadId;
  }
}

/** Meta refuses free-form DMs once the 24h window after the person's last interaction closes. */
async function assertWindowOpen(accountId: string, igsid: string) {
  const [c] = await db
    .select({ expires: contact.messagingWindowExpiresAt })
    .from(contact)
    .where(and(eq(contact.accountId, accountId), eq(contact.igId, igsid)))
    .limit(1);
  if (!isWindowOpen(c?.expires ?? null)) {
    throw new Error("Janela de 24h do Instagram fechada: a pessoa não interage há mais de um dia.");
  }
}

/** Keeps what the flow sent visible in the Inbox (and feeds the per-minute cap). */
async function mirrorOutbound(acct: Account, igsid: string, text: string) {
  const id = `ig:${acct.igUserId}:${igsid}`;
  const now = new Date();
  try {
    await db
      .insert(conversation)
      .values({ id, accountId: acct.id, participantIgId: igsid, lastMessageAt: now, lastMessagePreview: text })
      .onConflictDoUpdate({ target: conversation.id, set: { lastMessageAt: now, lastMessagePreview: text } });
    await db.insert(message).values({ id: `flow:${crypto.randomUUID()}`, conversationId: id, fromIgId: acct.igUserId, isFromAccount: true, text, sentAt: now });
  } catch (error) {
    console.error("[flow] inbox mirror failed", error);
  }
}
