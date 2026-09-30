import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { automation, conversation, db } from "@/db";
import { getAccountById } from "@/lib/account";
import { env } from "@/lib/env";
import { initialsOf } from "@/lib/format";
import { getSession } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/");

  const account = await getAccountById(session.accountId);
  if (!account) redirect("/");

  const now = nowMs();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const [[autos], [inbox]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(automation)
      .where(eq(automation.accountId, account.id)),
    // "New" = threads whose latest message is from the other person, within 24h.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(conversation)
      .where(
        and(
          eq(conversation.accountId, account.id),
          gt(conversation.lastMessageAt, dayAgo),
          sql`(select is_from_account from message
               where message.conversation_id = ${conversation.id}
               order by message.sent_at desc nulls last limit 1) = false`,
        ),
      ),
  ]);

  return (
    <AppShell
      account={{
        username: account.username,
        initials: initialsOf(account.username),
        avatarUrl: account.profilePictureUrl,
        expired: account.tokenExpiresAt.getTime() < now,
        hasAutomations: (autos?.n ?? 0) > 0,
        inboxBadge: inbox?.n ?? 0,
      }}
      publicUrl={`${env.appUrl}/u/${account.username}`}
    >
      {children}
    </AppShell>
  );
}
