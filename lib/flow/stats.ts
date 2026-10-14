import "server-only";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { db, flowRun, linkClick } from "@/db";
import type { FlowGraph } from "./graph";
import { clickKey } from "./message";

/** Plain, serialisable numbers for the editor's "Resultados" tab and block badges. */
export interface FlowStats {
  total: number;
  byStatus: Record<string, number>;
  /** nodeId → how many people reached the block. */
  reached: Record<string, number>;
  /** "nodeId.buttonId" → total clicks on that link button. */
  clicks: Record<string, number>;
  /** Per A/B block: per branch, people and how many of them opened any link. */
  ab: { nodeId: string; branches: { id: string; label: string; people: number; clicked: number }[] }[];
  recent: {
    id: string;
    username: string | null;
    status: string;
    currentNodeId: string | null;
    lastError: string | null;
    updatedAt: string;
  }[];
}

/** Enough to be meaningful for one creator; the totals above stay exact via SQL. */
const RUN_SAMPLE = 5000;

export async function flowStats(flowId: string, accountId: string, graph: FlowGraph): Promise<FlowStats> {
  const [statusRows, runs, clickRows] = await Promise.all([
    db
      .select({ status: flowRun.status, n: sql<number>`count(*)::int` })
      .from(flowRun)
      .where(and(eq(flowRun.flowId, flowId), eq(flowRun.accountId, accountId)))
      .groupBy(flowRun.status),
    db
      .select({
        id: flowRun.id,
        username: flowRun.username,
        status: flowRun.status,
        currentNodeId: flowRun.currentNodeId,
        lastError: flowRun.lastError,
        variables: flowRun.variables,
        updatedAt: flowRun.updatedAt,
      })
      .from(flowRun)
      .where(and(eq(flowRun.flowId, flowId), eq(flowRun.accountId, accountId)))
      .orderBy(desc(flowRun.updatedAt))
      .limit(RUN_SAMPLE),
    db
      .select({ linkId: linkClick.linkId, n: sql<number>`count(*)::int` })
      .from(linkClick)
      .where(and(eq(linkClick.accountId, accountId), like(linkClick.linkId, `f-${flowId}.%`)))
      .groupBy(linkClick.linkId),
  ]);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of statusRows) {
    byStatus[r.status] = r.n;
    total += r.n;
  }

  const reached: Record<string, number> = {};
  for (const run of runs) {
    for (const nodeId of new Set(run.variables.path ?? [])) reached[nodeId] = (reached[nodeId] ?? 0) + 1;
  }

  const clicks: Record<string, number> = {};
  for (const node of graph.nodes) {
    if (node.type !== "message") continue;
    for (const b of node.data.buttons) {
      if (b.url === undefined) continue;
      const row = clickRows.find((c) => c.linkId === clickKey(flowId, node.id, b.id));
      clicks[`${node.id}.${b.id}`] = row?.n ?? 0;
    }
  }

  const ab = graph.nodes
    .filter((n) => n.type === "random")
    .map((n) => ({
      nodeId: n.id,
      branches: (n.type === "random" ? n.data.branches : []).map((b) => {
        const inBranch = runs.filter((r) => r.variables.branches?.[n.id] === b.id);
        return {
          id: b.id,
          label: b.label,
          people: inBranch.length,
          clicked: inBranch.filter((r) => (r.variables.clicks ?? []).length > 0).length,
        };
      }),
    }));

  return {
    total,
    byStatus,
    reached,
    clicks,
    ab,
    recent: runs.slice(0, 30).map((r) => ({
      id: r.id,
      username: r.username,
      status: r.status,
      currentNodeId: r.currentNodeId,
      lastError: r.lastError,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}
