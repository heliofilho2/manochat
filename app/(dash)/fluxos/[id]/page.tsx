import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, flow } from "@/db";
import { getSession } from "@/lib/session";
import { flowStats } from "@/lib/flow/stats";
import { normalizeGraph, type RerunPolicy, type TriggerKind } from "@/lib/flow/graph";
import { listPosts, listStories } from "../../automacoes/posts";
import { FlowEditor } from "../flow-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar fluxo — Oslinke" };

const KINDS: TriggerKind[] = ["comment", "story", "mention", "dm"];
const RERUNS: RerunPolicy[] = ["always", "daily", "once"];

export default async function EditFlowPage({ params }: PageProps<"/fluxos/[id]">) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  // A malformed id would otherwise surface as a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [row] = await db
    .select()
    .from(flow)
    .where(and(eq(flow.id, id), eq(flow.accountId, session.accountId)))
    .limit(1);
  if (!row) notFound();

  const graph = normalizeGraph(row.graph);
  const [posts, stories, stats, flows] = await Promise.all([
    listPosts(session.accountId),
    listStories(session.accountId),
    flowStats(row.id, session.accountId, graph),
    db
      .select({ id: flow.id, name: flow.name, status: flow.status })
      .from(flow)
      .where(eq(flow.accountId, session.accountId))
      .orderBy(desc(flow.createdAt)),
  ]);

  return (
    <FlowEditor
      flowId={row.id}
      status={row.status}
      posts={posts}
      stories={stories}
      stats={stats}
      flows={flows}
      initial={{
        name: row.name,
        triggerKind: KINDS.includes(row.triggerKind as TriggerKind) ? (row.triggerKind as TriggerKind) : "comment",
        rerun: RERUNS.includes(row.rerun as RerunPolicy) ? (row.rerun as RerunPolicy) : "always",
        keywords: row.keywords,
        matchMode: row.matchMode === "contains" ? "contains" : "exact_word",
        scope: row.scope === "specific_posts" ? "specific_posts" : "all_posts",
        postIds: row.postIds,
        replyEnabled: row.replyEnabled,
        replyVariants: row.replyVariants,
        graph,
      }}
    />
  );
}
