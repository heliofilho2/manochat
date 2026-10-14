"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, flow } from "@/db";
import { MAX_BUTTONS, MAX_CARDS, MAX_QUICK_REPLIES, normalizeGraph, validateGraph, type FlowGraph } from "@/lib/flow/graph";
import { stopRuns } from "@/lib/flow/runner";
import { templateById } from "@/lib/flow/templates";
import { getSession } from "@/lib/session";

const id = z.string().max(40);
const str = (max: number) => z.string().max(max);
const button = z.object({ id, label: str(60), url: str(500).optional() });

const rule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tag"), tag: str(60), not: z.boolean().optional() }),
  z.object({ kind: z.literal("follower"), not: z.boolean().optional() }),
  z.object({ kind: z.literal("clicked"), not: z.boolean().optional() }),
  z.object({ kind: z.literal("field"), name: str(40), op: z.enum(["equals", "contains", "filled", "empty"]), value: str(200) }),
  z.object({ kind: z.literal("answer"), value: str(100) }),
  z.object({ kind: z.literal("hours"), from: z.number().int().min(0).max(24), to: z.number().int().min(0).max(24) }),
  z.object({ kind: z.literal("weekdays"), days: z.array(z.number().int().min(0).max(6)).max(7) }),
]);

const action = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_tag"), tag: str(60) }),
  z.object({ op: z.literal("remove_tag"), tag: str(60) }),
  z.object({ op: z.literal("set_field"), field: str(40), value: str(500) }),
  z.object({ op: z.literal("clear_field"), field: str(40) }),
  z.object({ op: z.literal("notify"), text: str(500) }),
  z.object({ op: z.literal("webhook"), url: str(500) }),
  z.object({ op: z.literal("start_flow"), flowId: str(40) }),
  z.object({ op: z.literal("human"), hours: z.number().min(0).max(1000) }),
]);

const node = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("trigger"), data: z.object({}) }),
  z.object({
    id,
    type: z.literal("message"),
    data: z.object({
      text: str(1000),
      imageUrl: str(500).optional(),
      typing: z.number().min(0).max(5).optional(),
      buttons: z.array(button).max(MAX_BUTTONS + 2),
      quickReplies: z.array(z.object({ id, label: str(60) })).max(MAX_QUICK_REPLIES + 2).optional(),
    }),
  }),
  z.object({ id, type: z.literal("media"), data: z.object({ kind: z.enum(["image", "video", "audio"]), url: str(500) }) }),
  z.object({
    id,
    type: z.literal("cards"),
    data: z.object({
      cards: z
        .array(
          z.object({
            id,
            title: str(120),
            subtitle: str(120),
            imageUrl: str(500),
            url: str(500).optional(),
            buttons: z.array(button).max(MAX_BUTTONS + 2),
          }),
        )
        .max(MAX_CARDS + 2),
    }),
  }),
  z.object({
    id,
    type: z.literal("random"),
    data: z.object({ branches: z.array(z.object({ id, label: str(60), weight: z.number().min(0).max(1000) })).max(6) }),
  }),
  z.object({
    id,
    type: z.literal("condition"),
    data: z.object({ match: z.enum(["all", "any"]), rules: z.array(rule).max(10) }),
  }),
  z.object({
    id,
    type: z.literal("delay"),
    data: z.object({
      minutes: z.number().min(0).max(100_000),
      until: z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59) }).nullable().optional(),
    }),
  }),
  z.object({ id, type: z.literal("action"), data: action }),
  z.object({
    id,
    type: z.literal("reply"),
    data: z.object({
      expect: z.enum(["keyword", "any", "email", "phone"]),
      keywords: z.array(str(60)).max(20),
      retryText: str(640),
      timeoutMinutes: z.number().min(0).max(100_000).nullable(),
      saveTo: str(40).optional(),
    }),
  }),
]);

const graphSchema = z.object({
  nodes: z.array(node).max(80),
  edges: z.array(z.object({ id, source: id, sourceHandle: z.string().max(40).nullable(), target: id })).max(200),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  triggerKind: z.enum(["comment", "story", "mention", "dm"]),
  rerun: z.enum(["always", "daily", "once"]),
  keywords: z.array(z.string().trim().min(1).max(60)).max(20),
  matchMode: z.enum(["exact_word", "contains"]),
  scope: z.enum(["all_posts", "specific_posts"]),
  postIds: z.array(z.string().max(60)).max(60),
  replyEnabled: z.boolean(),
  replyVariants: z.array(z.string().max(300)).max(10),
  graph: graphSchema,
});

export type FlowInput = z.infer<typeof schema>;

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

export async function createFlow(templateId: string): Promise<never> {
  const session = await requireSession();
  const t = templateById(templateId);
  const [row] = await db
    .insert(flow)
    .values({ accountId: session.accountId, name: t.name, triggerKind: t.triggerKind, keywords: t.keywords, graph: t.graph })
    .returning({ id: flow.id });
  redirect(`/fluxos/${row.id}`);
}

export async function duplicateFlow(flowId: string): Promise<never> {
  const session = await requireSession();
  const [src] = await db.select().from(flow).where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId))).limit(1);
  if (!src) redirect("/fluxos");
  const [row] = await db
    .insert(flow)
    .values({
      accountId: session.accountId,
      name: `${src.name} (cópia)`.slice(0, 80),
      status: "draft",
      triggerKind: src.triggerKind,
      rerun: src.rerun,
      keywords: src.keywords,
      matchMode: src.matchMode,
      scope: src.scope,
      postIds: src.postIds,
      replyEnabled: src.replyEnabled,
      replyVariants: src.replyVariants,
      graph: src.graph,
    })
    .returning({ id: flow.id });
  redirect(`/fluxos/${row.id}`);
}

/** What stops a flow from going live; empty means it can. */
function liveBlockers(
  flowId: string,
  input: { triggerKind: string; keywords: string[]; scope: string; postIds: string[]; graph: FlowGraph },
): string[] {
  const problems: string[] = [];
  // Story replies and mentions may fire on anything; comments need a word. A DM flow with no word is the default reply.
  if (input.keywords.length === 0 && input.triggerKind === "comment") problems.push("Defina pelo menos uma palavra-chave no gatilho.");
  if (input.triggerKind === "story" && input.scope === "specific_posts" && input.postIds.length === 0) {
    problems.push("Escolha pelo menos um story, ou use “todos”.");
  }
  if (input.triggerKind === "comment" && input.scope === "specific_posts" && input.postIds.length === 0) {
    problems.push("Escolha pelo menos um post, ou use “todos os posts”.");
  }
  if (!input.graph.nodes.some((n) => n.type === "message" || n.type === "media" || n.type === "cards")) {
    problems.push("Adicione pelo menos uma mensagem.");
  }
  problems.push(...validateGraph(normalizeGraph(input.graph), { flowId }).map((i) => i.message));
  return [...new Set(problems)];
}

export type SaveResult = { ok: true; paused: boolean } | { ok: false };

/**
 * Auto-saved by the editor. A live flow that stops being valid is paused
 * instead of left sending broken messages.
 */
export async function saveFlow(flowId: string, input: unknown): Promise<SaveResult> {
  const session = await requireSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    console.error("[flows] invalid save", parsed.error.issues.slice(0, 3));
    return { ok: false };
  }

  const [current] = await db
    .select({ status: flow.status })
    .from(flow)
    .where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)))
    .limit(1);
  if (!current) return { ok: false };

  const graph = parsed.data.graph as FlowGraph;
  const pause = current.status === "live" && liveBlockers(flowId, { ...parsed.data, graph }).length > 0;
  await db
    .update(flow)
    .set({ ...parsed.data, graph, updatedAt: new Date(), ...(pause ? { status: "paused" } : {}) })
    .where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)));
  return { ok: true, paused: pause };
}

export type StatusResult = { ok: true; status: string } | { ok: false; problems: string[] };

export async function setFlowStatus(flowId: string, status: "live" | "paused" | "draft"): Promise<StatusResult> {
  const session = await requireSession();
  const [row] = await db.select().from(flow).where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId))).limit(1);
  if (!row) return { ok: false, problems: ["Fluxo não encontrado."] };

  if (status === "live") {
    const problems = liveBlockers(row.id, row);
    if (problems.length > 0) return { ok: false, problems };
  }
  await db.update(flow).set({ status, updatedAt: new Date() }).where(eq(flow.id, row.id));
  return { ok: true, status };
}

/** The emergency brake: pauses the flow and ends every conversation in progress. */
export async function stopFlowNow(flowId: string): Promise<{ ok: true; stopped: number }> {
  const session = await requireSession();
  await db
    .update(flow)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)));
  const stopped = await stopRuns(flowId, session.accountId);
  return { ok: true, stopped };
}

export async function deleteFlow(flowId: string): Promise<void> {
  const session = await requireSession();
  await db.delete(flow).where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)));
  redirect("/fluxos");
}
