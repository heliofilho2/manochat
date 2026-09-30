"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { automation, db, webhookEvent } from "@/db";
import { getAccountById } from "@/lib/account";
import { findMissedTappers } from "@/lib/automation/missed";
import { unlock } from "@/lib/automation/processor";
import { MESSAGING_WINDOW_MS } from "@/lib/automation/flow";
import { getSession } from "@/lib/session";

/** People handled per click; keeps the request inside the function time limit. */
const BATCH = 25;

export type ResendResult =
  | { ok: true; sent: number; notFollower: number; failed: number; expired: number; remaining: number }
  | { ok: false; error: string };

/**
 * Re-checks everyone who tapped this automation's button in the last 24h but
 * never got the link, and sends it to those who follow now. People who still
 * don't follow are skipped (no second "follow me" prompt).
 */
export async function resendMissedLinks(automationId: string): Promise<ResendResult> {
  const session = await getSession();
  if (!session) redirect("/");

  const acct = await getAccountById(session.accountId);
  if (!acct) return { ok: false, error: "Conta não encontrada." };

  const [rule] = await db
    .select({ id: automation.id, dmLink: automation.dmLink })
    .from(automation)
    .where(and(eq(automation.id, automationId), eq(automation.accountId, acct.id)))
    .limit(1);
  if (!rule) return { ok: false, error: "Automação não encontrada." };
  if (!rule.dmLink) return { ok: false, error: "Esta automação não tem link para reenviar." };

  const since = new Date(Date.now() - 2 * MESSAGING_WINDOW_MS);
  const rows = await db
    .select({ payload: webhookEvent.payload })
    .from(webhookEvent)
    .where(
      and(
        eq(webhookEvent.field, "messages"),
        gt(webhookEvent.receivedAt, since),
        sql`${webhookEvent.payload}->'entry'->0->>'id' = ${acct.igUserId}`,
      ),
    )
    .orderBy(desc(webhookEvent.receivedAt))
    .limit(5000);

  const now = Date.now();
  const missed = findMissedTappers(
    rows.map((r) => r.payload),
    rule.id,
    rule.dmLink,
  );
  const eligible = missed.filter((m) => now - m.lastTapAt < MESSAGING_WINDOW_MS);
  const expired = missed.length - eligible.length;
  const batch = eligible.slice(0, BATCH);

  let sent = 0;
  let notFollower = 0;
  let failed = 0;
  for (const m of batch) {
    try {
      const outcome = await unlock(acct, rule.id, m.igsid, new Date(m.lastTapAt), {
        linkOnly: true,
        recheckDelayMs: 0,
      });
      if (outcome === "link_sent") sent++;
      else notFollower++;
    } catch {
      failed++;
    }
  }

  revalidatePath("/automacoes");
  return { ok: true, sent, notFollower, failed, expired, remaining: eligible.length - batch.length };
}
