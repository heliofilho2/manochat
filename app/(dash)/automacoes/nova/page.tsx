import { redirect } from "next/navigation";
import { getAccountById } from "@/lib/account";
import { BLANK_DRAFT } from "@/lib/automation/draft";
import { getSession } from "@/lib/session";
import { AutomationEditor } from "../automation-editor";
import { listPosts } from "../posts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova automação — Manochat" };

export default async function NewAutomationPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const [acct, posts] = await Promise.all([getAccountById(session.accountId), listPosts(session.accountId)]);
  if (!acct) redirect("/");

  return <AutomationEditor initial={BLANK_DRAFT} posts={posts} username={acct.username} />;
}
