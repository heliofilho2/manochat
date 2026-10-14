import "server-only";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { account, contact, conversation, db, flow, flowRun, lead, linkClick, message, type FlowRunVars } from "@/db";
import { accessTokenFor, type Account } from "@/lib/account";
import { safeUrl } from "@/lib/bio/theme";
import { addTag, findContactId, hasTag, removeTag, touchContact } from "@/lib/contacts";
import { isWindowOpen } from "@/lib/automation/flow";
import { pickReply } from "@/lib/automation/matcher";
import { forwardLead } from "@/lib/leads";
import {
  getUserFollowsBusiness,
  getUserProfile,
  InstagramApiError,
  replyToComment,
  sendDirectMessage,
  sendPrivateReply,
} from "@/lib/instagram/client";
import type { OutboundMessage } from "@/lib/instagram/types";
import {
  evaluateReply,
  findNode,
  MAX_STEPS_PER_RUN,
  NO,
  nextNodeId,
  OTHER,
  pickBranch,
  renderText,
  startNodeId,
  tapButtons,
  TIMEOUT,
  YES,
  type ConditionCheck,
} from "./graph";
import {
  branchTagName,
  buildFlowMessage,
  buildImageMessage,
  clickKey,
  type FlowTap,
} from "./message";

type Flow = typeof flow.$inferSelect;
type Run = typeof flowRun.$inferSelect;

const patch = (id: string, values: Partial<typeof flowRun.$inferInsert>) =>
  db.update(flowRun).set({ ...values, updatedAt: new Date() }).where(eq(flowRun.id, id));

/** Tracked links need the public app URL; without it the raw link is sent. */
function trackerBase(): string | null {
  const url = process.env.APP_URL;
  return url ? url.replace(/\/$/, "") : null;
}

const DEFAULT_RETRY = "Não entendi 😅 Pode responder de novo?";

/* ────────────────────────────────────────────────────────────────────────
 * Starting
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Starts a flow for someone who commented, replied to a story or sent a word.
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
    /** Unique per trigger: the comment id, or "story:<mid>" / "dm:<mid>". */
    triggerRef: string;
    /** Only for comments: the first message goes out as a Private Reply to it. */
    commentId: string | null;
    at: Date;
  },
): Promise<void> {
  const start = startNodeId(flowRow.graph);
  if (!start) return;

  let username = input.username;
  if (!username) {
    try {
      username = (await getUserProfile(accessTokenFor(acct), input.igsid)).username ?? null;
    } catch {
      // Only cosmetic ({usuario}); carry on without it.
    }
  }

  const [created] = await db
    .insert(flowRun)
    .values({
      flowId: flowRow.id,
      accountId: acct.id,
      igId: input.igsid,
      username,
      triggerRef: input.triggerRef,
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
      .where(and(eq(flowRun.triggerRef, input.triggerRef), eq(flowRun.status, "failed")))
      .returning();
    if (!run) return;
  } else {
    // A person is in one flow at a time: a new trigger replaces an older conversation.
    await db
      .update(flowRun)
      .set({ status: "done", lastError: "Substituído por um novo gatilho.", updatedAt: new Date() })
      .where(
        and(
          eq(flowRun.accountId, acct.id),
          eq(flowRun.igId, input.igsid),
          inArray(flowRun.status, ["waiting_tap", "waiting_reply", "waiting_delay"]),
        ),
      );
    try {
      const contactId = await touchContact(acct.id, input.igsid, username, input.at);
      await addTag(acct.id, contactId, `flow:${flowRow.name}`);
    } catch (error) {
      console.error("[flow] contact upsert failed", error);
    }
    if (input.commentId) await publicReply(acct, flowRow, input.commentId);
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

/* ────────────────────────────────────────────────────────────────────────
 * Resuming: button tap, typed answer, timer
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Continues a run after the person tapped one of its buttons.
 * Returns false when the tap is not ours to act on (stale, wrong person, repeated).
 */
export async function resumeFromTap(acct: Account, tap: FlowTap, igsid: string, at: Date): Promise<boolean> {
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
  const button = tapButtons(node).find((b) => b.id === tap.buttonId);
  if (!button) return false;

  // A tap is an inbound interaction: it reopens the 24h window.
  await touchContact(acct.id, igsid, null, at);
  return advanceFrom(acct, flowRow, run, "waiting_tap", nextNodeId(flowRow.graph, node.id, button.id));
}

/**
 * A plain DM from someone whose run waits on a "reply" block. Returns true
 * when the message belonged to a flow (so nothing else should answer it).
 */
export async function resumeFromReply(
  acct: Account,
  igsid: string,
  text: string,
  mid: string,
  at: Date,
): Promise<boolean> {
  const [run] = await db
    .select()
    .from(flowRun)
    .where(and(eq(flowRun.accountId, acct.id), eq(flowRun.igId, igsid), eq(flowRun.status, "waiting_reply")))
    .orderBy(desc(flowRun.updatedAt))
    .limit(1);
  if (!run?.currentNodeId) return false;

  const [flowRow] = await db.select().from(flow).where(eq(flow.id, run.flowId)).limit(1);
  const node = flowRow ? findNode(flowRow.graph, run.currentNodeId) : undefined;
  if (!flowRow || node?.type !== "reply") return false;

  // Claim this answer so a repeated webhook can't advance the run twice.
  const claimed = await db
    .insert(message)
    .values({
      id: `flowreply:${mid}`,
      conversationId: `ig:${acct.igUserId}:${igsid}`,
      fromIgId: igsid,
      isFromAccount: false,
      text,
      sentAt: at,
    })
    .onConflictDoNothing({ target: message.id })
    .returning({ id: message.id });
  if (claimed.length === 0) return true;

  const result = evaluateReply(node, text);
  const target = nextNodeId(flowRow.graph, node.id, result.handle);

  if (result.handle === OTHER && !target) {
    // Nowhere to go for a wrong answer: ask again and keep waiting.
    await assertWindowOpen(acct.id, igsid);
    const retry = renderText(node.data.retryText.trim() || DEFAULT_RETRY, run.username);
    await sendDirectMessage(accessTokenFor(acct), acct.igUserId, igsid, { text: retry });
    await mirrorOutbound(acct, igsid, retry);
    return true;
  }

  const vars: FlowRunVars = { ...run.variables, answers: { ...run.variables.answers, [node.id]: text.slice(0, 500) } };
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

/** Continues every run whose wait is over (delays, and answers that never came). Cron. */
export async function resumeDueRuns(limit = 10): Promise<number> {
  const due = await db
    .select()
    .from(flowRun)
    .where(and(inArray(flowRun.status, ["waiting_delay", "waiting_reply"]), lte(flowRun.resumeAt, new Date())))
    .orderBy(asc(flowRun.resumeAt))
    .limit(limit);

  let resumed = 0;
  for (const run of due) {
    const [flowRow] = await db.select().from(flow).where(eq(flow.id, run.flowId)).limit(1);
    const [acct] = await db.select().from(account).where(eq(account.id, run.accountId)).limit(1);
    if (!flowRow || !acct) {
      await patch(run.id, { status: "failed", lastError: "Fluxo ou conta não existe mais." });
      continue;
    }
    // A delay already points at the next block; an unanswered question takes its "timeout" path.
    const target =
      run.status === "waiting_delay"
        ? run.currentNodeId
        : run.currentNodeId
          ? nextNodeId(flowRow.graph, run.currentNodeId, TIMEOUT)
          : null;
    try {
      if (await advanceFrom(acct, flowRow, run, run.status as "waiting_delay" | "waiting_reply", target)) resumed++;
    } catch (error) {
      console.error("[flow] resume failed", run.id, error);
    }
  }
  return resumed;
}

/**
 * Records a click on a tracked flow link and returns where to send the person.
 * Called by the /r/f-… redirect.
 */
export async function recordFlowClick(
  tap: FlowTap,
  opts: { device: string | null; count: boolean },
): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(tap.runId)) return null;
  const [run] = await db.select().from(flowRun).where(eq(flowRun.id, tap.runId)).limit(1);
  if (!run) return null;
  const [flowRow] = await db.select().from(flow).where(eq(flow.id, run.flowId)).limit(1);
  const node = flowRow ? findNode(flowRow.graph, tap.nodeId) : undefined;
  if (!flowRow || node?.type !== "message") return null;
  const button = node.data.buttons.find((b) => b.id === tap.buttonId && b.url !== undefined);
  const dest = button?.url ? safeUrl(button.url) : null;
  if (!dest) return null;

  if (opts.count) {
    await db.insert(linkClick).values({
      accountId: run.accountId,
      linkId: clickKey(flowRow.id, tap.nodeId, tap.buttonId),
      device: opts.device,
    });
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
  const vars: FlowRunVars = {
    ...run.variables,
    branches: { ...run.variables.branches },
    path: [...(run.variables.path ?? [])],
  };

  const send = async (body: OutboundMessage) => {
    if (run.commentId && !privateReplyUsed) {
      await sendPrivateReply(token, acct.igUserId, run.commentId, body);
      privateReplyUsed = true;
      await patch(run.id, { privateReplyUsed: true });
    } else {
      await assertWindowOpen(acct.id, run.igId);
      await sendDirectMessage(token, acct.igUserId, run.igId, body);
    }
  };

  try {
    for (let steps = 0; nodeId; steps++) {
      if (steps >= MAX_STEPS_PER_RUN) throw new Error("O fluxo deu voltas demais e foi interrompido.");
      const node = findNode(graph, nodeId);
      if (!node) throw new Error(`Um bloco do fluxo foi apagado enquanto a pessoa estava nele.`);

      // Checkpoint: if we die inside this block, a retry starts again from here.
      if (vars.path!.at(-1) !== node.id) vars.path!.push(node.id);
      await patch(run.id, { status: "running", currentNodeId: node.id, variables: vars });

      switch (node.type) {
        case "trigger":
          nodeId = nextNodeId(graph, node.id);
          break;

        case "message": {
          // The Private Reply is a single send, so an image only goes when the window is open.
          const image = buildImageMessage(node);
          if (image && (privateReplyUsed || !run.commentId)) await send(image);
          const text = renderText(node.data.text, run.username);
          await send(buildFlowMessage(node, run.id, { baseUrl: trackerBase(), username: run.username }));
          await mirrorOutbound(acct, run.igId, text);

          if (tapButtons(node).length > 0) {
            await patch(run.id, { status: "waiting_tap", currentNodeId: node.id });
            return;
          }
          nodeId = nextNodeId(graph, node.id);
          break;
        }

        case "reply": {
          // Wait for the person's next DM; resumeFromReply takes it from here.
          const t = node.data.timeoutMinutes;
          await patch(run.id, {
            status: "waiting_reply",
            currentNodeId: node.id,
            resumeAt: t ? new Date(Date.now() + t * 60_000) : null,
          });
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
          const yes = await evaluate(acct, token, run, vars, node.data.check);
          nodeId = nextNodeId(graph, node.id, yes ? YES : NO);
          break;
        }

        case "delay": {
          const next = nextNodeId(graph, node.id);
          if (!next) {
            nodeId = null;
            break;
          }
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

async function evaluate(acct: Account, token: string, run: Run, vars: FlowRunVars, check: ConditionCheck): Promise<boolean> {
  if (check.kind === "clicked") {
    // Re-read: the click lands on the row while the run is parked in a delay.
    const [fresh] = await db.select({ v: flowRun.variables }).from(flowRun).where(eq(flowRun.id, run.id)).limit(1);
    const clicks = fresh?.v.clicks ?? vars.clicks ?? [];
    if (fresh?.v.clicks) vars.clicks = fresh.v.clicks;
    return clicks.length > 0;
  }
  if (check.kind === "has_tag") {
    const contactId = await findContactId(acct.id, run.igId);
    return contactId ? hasTag(acct.id, contactId, check.tag) : false;
  }
  try {
    const follows = await getUserFollowsBusiness(token, run.igId);
    const contactId = await findContactId(acct.id, run.igId);
    if (contactId) {
      await db.update(contact).set({ isFollower: follows, followerCheckedAt: new Date() }).where(eq(contact.id, contactId));
      if (follows) await addTag(acct.id, contactId, "follower");
    }
    return follows;
  } catch (error) {
    // Meta only answers for people who interacted; "can't tell" reads as "no".
    if (error instanceof InstagramApiError) return false;
    throw error;
  }
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
        .values({
          accountId: acct.id,
          igId: run.igId,
          username: run.username,
          source: "flow",
          trigger: flowRow.name.slice(0, 60),
          step: "done",
          ...fields,
        })
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
