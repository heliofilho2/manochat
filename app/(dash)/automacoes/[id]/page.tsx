import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { automation, db } from "@/db";
import { getAccountById } from "@/lib/account";
import { fromRow } from "@/lib/automation/draft";
import { getSession } from "@/lib/session";
import { AutomationEditor } from "../automation-editor";
import { listPosts, listStories } from "../posts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar automação — Oslinke" };

export default async function EditAutomationPage({ params }: PageProps<"/automacoes/[id]">) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  // A malformed id would otherwise surface as a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [[row], acct] = await Promise.all([
    db
      .select()
      .from(automation)
      .where(and(eq(automation.id, id), eq(automation.accountId, session.accountId)))
      .limit(1),
    getAccountById(session.accountId),
  ]);
  if (!row || !acct) notFound();
  const posts =
    row.kind === "story"
      ? await listStories(session.accountId)
      : await listPosts(session.accountId);

  return (
    <AutomationEditor
      initial={fromRow(row)}
      posts={posts}
      username={acct.username}
    />
  );
}
