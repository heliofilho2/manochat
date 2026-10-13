"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, flow } from "@/db";
import { EMPTY_GRAPH, MAX_BUTTONS, validateGraph, type FlowGraph } from "@/lib/flow/graph";
import { getSession } from "@/lib/session";

const id = z.string().max(40);

const node = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("trigger"), data: z.object({}) }),
  z.object({
    id,
    type: z.literal("message"),
    data: z.object({
      text: z.string().max(1000),
      buttons: z
        .array(z.object({ id, label: z.string().max(60), url: z.string().max(500).optional() }))
        .max(MAX_BUTTONS + 2),
    }),
  }),
  z.object({
    id,
    type: z.literal("random"),
    data: z.object({
      branches: z.array(z.object({ id, label: z.string().max(60), weight: z.number().min(0).max(1000) })).max(6),
    }),
  }),
  z.object({
    id,
    type: z.literal("condition"),
    data: z.object({
      check: z.union([
        z.object({ kind: z.literal("has_tag"), tag: z.string().max(60) }),
        z.object({ kind: z.literal("is_follower") }),
      ]),
    }),
  }),
  z.object({ id, type: z.literal("delay"), data: z.object({ minutes: z.number().min(0).max(100_000) }) }),
  z.object({
    id,
    type: z.literal("action"),
    data: z.object({ op: z.enum(["add_tag", "remove_tag"]), tag: z.string().max(60) }),
  }),
]);

const graphSchema = z.object({
  nodes: z.array(node).max(60),
  edges: z
    .array(z.object({ id, source: id, sourceHandle: z.string().max(40).nullable(), target: id }))
    .max(120),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
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

export async function createFlow(): Promise<never> {
  const session = await requireSession();
  const [row] = await db
    .insert(flow)
    .values({ accountId: session.accountId, name: "Novo fluxo", graph: EMPTY_GRAPH })
    .returning({ id: flow.id });
  redirect(`/fluxos/${row.id}`);
}

/** What stops a flow from going live; empty means it can. */
function liveBlockers(input: { keywords: string[]; scope: string; postIds: string[]; graph: FlowGraph }): string[] {
  const problems: string[] = [];
  if (input.keywords.length === 0) problems.push("Defina pelo menos uma palavra-chave no gatilho.");
  if (input.scope === "specific_posts" && input.postIds.length === 0) {
    problems.push("Escolha pelo menos um post, ou use “todos os posts”.");
  }
  if (!input.graph.nodes.some((n) => n.type === "message")) problems.push("Adicione pelo menos uma mensagem.");
  problems.push(...validateGraph(input.graph).map((i) => i.message));
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
  if (!parsed.success) return { ok: false };

  const [current] = await db
    .select({ status: flow.status })
    .from(flow)
    .where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)))
    .limit(1);
  if (!current) return { ok: false };

  const pause = current.status === "live" && liveBlockers(parsed.data).length > 0;
  await db
    .update(flow)
    .set({ ...parsed.data, graph: parsed.data.graph as FlowGraph, updatedAt: new Date(), ...(pause ? { status: "paused" } : {}) })
    .where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)));
  return { ok: true, paused: pause };
}

export type StatusResult = { ok: true; status: string } | { ok: false; problems: string[] };

export async function setFlowStatus(flowId: string, status: "live" | "paused" | "draft"): Promise<StatusResult> {
  const session = await requireSession();
  const [row] = await db
    .select()
    .from(flow)
    .where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)))
    .limit(1);
  if (!row) return { ok: false, problems: ["Fluxo não encontrado."] };

  if (status === "live") {
    const problems = liveBlockers(row);
    if (problems.length > 0) return { ok: false, problems };
  }
  await db.update(flow).set({ status, updatedAt: new Date() }).where(eq(flow.id, row.id));
  return { ok: true, status };
}

export async function deleteFlow(flowId: string): Promise<void> {
  const session = await requireSession();
  await db.delete(flow).where(and(eq(flow.id, flowId), eq(flow.accountId, session.accountId)));
  redirect("/fluxos");
}
