import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { automation, commentEvent, db } from "@/db";
import { getSession } from "@/lib/session";
import { AutomationList, type ListItem } from "./automation-list";
import { listPosts } from "./posts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automações — Manochat" };

export default async function AutomationsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const [rows, posts] = await Promise.all([
    db
      .select({
        id: automation.id,
        name: automation.name,
        status: automation.status,
        keywords: automation.keywords,
        matchMode: automation.matchMode,
        scope: automation.scope,
        postIds: automation.postIds,
        dms: sql<number>`(
          select count(*)::int from ${commentEvent}
          where "comment_event"."automation_id" = "automation"."id"
            and "comment_event"."dm_status" = 'sent'
        )`,
      })
      .from(automation)
      .where(eq(automation.accountId, session.accountId))
      .orderBy(desc(automation.createdAt)),
    listPosts(session.accountId),
  ]);

  const byId = new Map(posts.map((p) => [p.id, p]));
  const items: ListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status === "live" ? "active" : r.status === "paused" ? "paused" : "draft",
    keywords: r.keywords.map((k) => k.toUpperCase()),
    match: r.matchMode === "contains" ? "contains" : "exact",
    target: r.scope === "specific_posts" ? "specific" : r.scope === "from_now_on" ? "future" : "all",
    postCount: r.postIds.length,
    thumbs: r.postIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)).slice(0, 2),
    dms: r.dms,
  }));

  return <AutomationList items={items} />;
}
