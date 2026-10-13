import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import { account, contact, conversation, db, flow, flowRun, message } from "@/db";
import { accessTokenFor, type Account } from "@/lib/account";
import { addTag, findContactId, hasTag, removeTag, touchContact } from "@/lib/contacts";
import { isWindowOpen } from "@/lib/automation/flow";
import { pickReply } from "@/lib/automation/matcher";
import {
  getUserFollowsBusiness,
  InstagramApiError,
  replyToComment,
  sendDirectMessage,
  sendPrivateReply,
} from "@/lib/instagram/client";
import {
  findNode,
  MAX_STEPS_PER_RUN,
  NO,
  nextNodeId,
  pickBranch,
  startNodeId,
  YES,
} from "./graph";
import { branchTagName, buildFlowMessage, type FlowTap } from "./message";

type Flow = typeof flow.$inferSelect;
type Run = typeof flowRun.$inferSelect;

const patch = (id: string, values: Partial<typeof flowRun.$inferInsert>) =>
  db.update(flowRun).set({ ...values, updatedAt: new Date() }).where(eq(flowRun.id, id));

/**
 * Starts a flow for someone who just commented.
 *
 * `flow_run.trigger_ref` is UNIQUE, so a duplicate webhook cannot start a
 * second run. A run that failed half-way is picked up again here when the
 * event is retried, and carries on from the block that failed.
 */
export async function startFlowRun(
  acct: Account,
  flowRow: Flow,
  input: { igsid: string; username: string | null; commentId: string; at: Date },
): Promise<void> {
  const start = startNodeId(flowRow.graph);
  if (!start) return;

  const [created] = await db
    .insert(flowRun)
    .values({
      flowId: flowRow.id,
      accountId: acct.id,
      igId: input.igsid,
      username: input.username,
      triggerRef: input.commentId,
      commentId: input.commentId,
      currentNodeId: start,
    })
    .onConflictDoNothing({ target: flowRun.triggerRef })
    .returning();

  let run = created;
  if (!run) {
    // Seen before: only a failed run is worth another attempt, and only one attempt may win it.
    [run] = await db
      .update(flowRun)
      .set({ status: "running", lastError: null, updatedAt: new Date() })
      .where(and(eq(flowRun.triggerRef, input.commentId), eq(flowRun.status, "failed")))
      .returning();
    if (!run) return;
  } else {
    try {
      const contactId = await touchContact(acct.id, input.igsid, input.username, input.at);
      await addTag(acct.id, contactId, `flow:${flowRow.name}`);
    } catch (error) {
      console.error("[flow] contact upsert failed", error);
    }
    await publicReply(acct, flowRow, input.commentId);
  }

  await execute(acct, flowRow, run);
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

/**
 * Continues a run after the person tapped one of its buttons.
 * Returns false when the tap is not ours to act on (stale, wrong person, repeated).
 */
export async function resumeFromTap(
  acct: Account,
  tap: FlowTap,
  igsid: string,
  at: Date,
): Promise<boolean> {
  const [run] = await db
    .select()
    .from(flowRun)
    .where(and(eq(flowRun.id, tap.runId), eq(flowRun.accountId, acct.id)))
    .limit(1);
  if (!run || run.igId !== igsid) return false;
  if (run.status !== "waiting_tap" || run.currentNodeId !== tap.nodeId) return false;

  const [flowRow] = await db.select().from(flow).where(eq(flow.id, run.flowId)).limit(1);
  if (!flowRow) return false;

  const node = findNode(flowRow.graph, tap.nodeId);
  if (node?.type !== "message") return false;
  const button = node.data.buttons.find((b) => b.id === tap.buttonId && !b.url);
  if (!button) return false;

  // A tap is an inbound interaction: it reopens the 24h window.
  await touchContact(acct.id, igsid, null, at);

  // Only one tap may move the run on.
  const nextId = nextNodeId(flowRow.graph, node.id, button.id);
  const [claimed] = await db
    .update(flowRun)
    .set({
      status: nextId ? "running" : "done",
      currentNodeId: nextId,
      updatedAt: new Date(),
    })
    .where(and(eq(flowRun.id, run.id), eq(flowRun.status, "waiting_tap")))
    .returning();
  if (!claimed || !nextId) return Boolean(claimed);

  await execute(acct, flowRow, claimed);
  return true;
}

/** Continues every run whose wait is over. Called by the cron sweeper. */
export async function resumeDueRuns(limit = 10): Promise<number> {
  const due = await db
    .select({ id: flowRun.id })
    .from(flowRun)
    .where(and(eq(flowRun.status, "waiting_delay"), lte(flowRun.resumeAt, new Date())))
    .orderBy(asc(flowRun.resumeAt))
    .limit(limit);

  let resumed = 0;
  for (const { id } of due) {
    const [run] = await db
      .update(flowRun)
      .set({ status: "running", resumeAt: null, updatedAt: new Date() })
      .where(and(eq(flowRun.id, id), eq(flowRun.status, "waiting_delay")))
      .returning();
    if (!run) continue;

    const [flowRow] = await db.select().from(flow).where(eq(flow.id, run.flowId)).limit(1);
    const [acct] = await db.select().from(account).where(eq(account.id, run.accountId)).limit(1);
    if (!flowRow || !acct) {
      await patch(run.id, { status: "failed", lastError: "Fluxo ou conta não existe mais." });
      continue;
    }
    try {
      await execute(acct, flowRow, run);
      resumed++;
    } catch (error) {
      console.error("[flow] resume failed", run.id, error);
    }
  }
  return resumed;
}

/** Walks the graph from the run's current block until it must wait or ends. */
async function execute(acct: Account, flowRow: Flow, run: Run): Promise<void> {
  const graph = flowRow.graph;
  const token = accessTokenFor(acct);
  let nodeId = run.currentNodeId;
  let privateReplyUsed = run.privateReplyUsed;
  const branches = { ...run.variables.branches };

  try {
    for (let steps = 0; nodeId; steps++) {
      if (steps >= MAX_STEPS_PER_RUN) throw new Error("O fluxo deu voltas demais e foi interrompido.");
      const node = findNode(graph, nodeId);
      if (!node) throw new Error(`Bloco ${nodeId} não existe mais no fluxo.`);

      // If we die inside this block, a retry starts again from here.
      await patch(run.id, { status: "running", currentNodeId: node.id });

      switch (node.type) {
        case "trigger":
          nodeId = nextNodeId(graph, node.id);
          break;

        case "message": {
          const body = buildFlowMessage(node, run.id);
          if (run.commentId && !privateReplyUsed) {
            await sendPrivateReply(token, acct.igUserId, run.commentId, body);
            privateReplyUsed = true;
            await patch(run.id, { privateReplyUsed: true });
          } else {
            await assertWindowOpen(acct.id, run.igId);
            await sendDirectMessage(token, acct.igUserId, run.igId, body);
          }
          await mirrorOutbound(acct, run.igId, node.data.text);

          if (node.data.buttons.some((b) => !b.url)) {
            // Wait for a tap; resumeFromTap picks the run up from here.
            await patch(run.id, { status: "waiting_tap", currentNodeId: node.id });
            return;
          }
          nodeId = nextNodeId(graph, node.id);
          break;
        }

        case "random": {
          const branch = pickBranch(node.data.branches, Math.random());
          if (!branch) throw new Error("O sorteio não tem nenhum caminho possível.");
          branches[node.id] = branch.id;
          await patch(run.id, { variables: { branches } });
          const contactId = await findContactId(acct.id, run.igId);
          if (contactId) await addTag(acct.id, contactId, branchTagName(flowRow.name, branch.label));
          nodeId = nextNodeId(graph, node.id, branch.id);
          break;
        }

        case "condition": {
          const yes = await evaluate(acct, token, run.igId, node.data.check);
          nodeId = nextNodeId(graph, node.id, yes ? YES : NO);
          break;
        }

        case "delay": {
          const next = nextNodeId(graph, node.id);
          if (!next) break;
          await patch(run.id, {
            status: "waiting_delay",
            currentNodeId: next,
            resumeAt: new Date(Date.now() + node.data.minutes * 60_000),
          });
          return;
        }

        case "action": {
          const contactId = await findContactId(acct.id, run.igId);
          if (contactId) {
            if (node.data.op === "add_tag") await addTag(acct.id, contactId, node.data.tag);
            else await removeTag(acct.id, contactId, node.data.tag);
          }
          nodeId = nextNodeId(graph, node.id);
          break;
        }
      }
    }
    await patch(run.id, { status: "done", currentNodeId: null });
  } catch (error) {
    await patch(run.id, {
      status: "failed",
      lastError: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function evaluate(
  acct: Account,
  token: string,
  igsid: string,
  check: { kind: "has_tag"; tag: string } | { kind: "is_follower" },
): Promise<boolean> {
  if (check.kind === "has_tag") {
    const contactId = await findContactId(acct.id, igsid);
    return contactId ? hasTag(acct.id, contactId, check.tag) : false;
  }
  try {
    const follows = await getUserFollowsBusiness(token, igsid);
    const contactId = await findContactId(acct.id, igsid);
    if (contactId) {
      await db.update(contact).set({ isFollower: follows, followerCheckedAt: new Date() }).where(eq(contact.id, contactId));
    }
    return follows;
  } catch (error) {
    // Meta only answers for people who interacted; "can't tell" reads as "no".
    if (error instanceof InstagramApiError) return false;
    throw error;
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

/** Keeps what the flow sent visible in the Inbox. */
async function mirrorOutbound(acct: Account, igsid: string, text: string) {
  const id = `ig:${acct.igUserId}:${igsid}`;
  const now = new Date();
  try {
    await db
      .insert(conversation)
      .values({ id, accountId: acct.id, participantIgId: igsid, lastMessageAt: now, lastMessagePreview: text })
      .onConflictDoUpdate({ target: conversation.id, set: { lastMessageAt: now, lastMessagePreview: text } });
    await db.insert(message).values({
      id: `flow:${crypto.randomUUID()}`,
      conversationId: id,
      fromIgId: acct.igUserId,
      isFromAccount: true,
      text,
      sentAt: now,
    });
  } catch (error) {
    console.error("[flow] inbox mirror failed", error);
  }
}
