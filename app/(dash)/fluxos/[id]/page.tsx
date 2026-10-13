import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, flow } from "@/db";
import { getSession } from "@/lib/session";
import { listPosts } from "../../automacoes/posts";
import { FlowEditor } from "../flow-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar fluxo — Oslinke" };

export default async function EditFlowPage({ params }: PageProps<"/fluxos/[id]">) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  // A malformed id would otherwise surface as a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [[row], posts] = await Promise.all([
    db
      .select()
      .from(flow)
      .where(and(eq(flow.id, id), eq(flow.accountId, session.accountId)))
      .limit(1),
    listPosts(session.accountId),
  ]);
  if (!row) notFound();

  return (
    <FlowEditor
      flowId={row.id}
      status={row.status}
      posts={posts}
      initial={{
        name: row.name,
        keywords: row.keywords,
        matchMode: row.matchMode === "contains" ? "contains" : "exact_word",
        scope: row.scope === "specific_posts" ? "specific_posts" : "all_posts",
        postIds: row.postIds,
        replyEnabled: row.replyEnabled,
        replyVariants: row.replyVariants,
        graph: row.graph,
      }}
    />
  );
}
