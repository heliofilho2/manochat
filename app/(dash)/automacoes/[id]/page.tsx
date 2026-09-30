import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { automation, db } from "@/db";
import { getAccountById } from "@/lib/account";
import { fromRow } from "@/lib/automation/draft";
import { getSession } from "@/lib/session";
import { AutomationEditor } from "../automation-editor";
import { listPosts } from "../posts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar automação — Manochat" };

export default async function EditAutomationPage({ params }: PageProps<"/automacoes/[id]">) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  // A malformed id would otherwise surface as a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [[row], acct, posts] = await Promise.all([
    db
      .select()
      .from(automation)
      .where(and(eq(automation.id, id), eq(automation.accountId, session.accountId)))
      .limit(1),
    getAccountById(session.accountId),
    listPosts(session.accountId),
  ]);
  if (!row || !acct) notFound();

  return (
    <AutomationEditor
      initial={fromRow(row)}
      posts={posts}
      username={acct.username}
    />
  );
}
