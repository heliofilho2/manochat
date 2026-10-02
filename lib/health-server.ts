import "server-only";
import { and, gt, inArray, lt, sql } from "drizzle-orm";
import { account, alertLog, db, webhookEvent } from "@/db";
import { cooldownMs, evaluateHealth, type HealthInput, type Issue } from "./health";

const STUCK_AFTER_MS = 30 * 60 * 1000;

/** Reads the signals `evaluateHealth` needs. `igUserId` narrows it to one account. */
export async function collectHealthInput(igUserId?: string): Promise<HealthInput> {
  const now = Date.now();
  const mine = igUserId ? sql`${webhookEvent.payload}->'entry'->0->>'id' = ${igUserId}` : undefined;

  const [dead, stuckRows, accounts] = await Promise.all([
    db
      .select({ error: webhookEvent.lastError })
      .from(webhookEvent)
      .where(and(inArray(webhookEvent.status, ["dead", "failed"]), gt(webhookEvent.processedAt, new Date(now - 24 * 3600_000)), mine))
      .limit(200),
    db
      .select({ at: webhookEvent.receivedAt })
      .from(webhookEvent)
      .where(
        and(inArray(webhookEvent.status, ["pending", "failed"]), lt(webhookEvent.receivedAt, new Date(now - STUCK_AFTER_MS)), mine),
      )
      .orderBy(webhookEvent.receivedAt)
      .limit(200),
    db.select({ username: account.username, igUserId: account.igUserId, expiresAt: account.tokenExpiresAt }).from(account),
  ]);

  return {
    now,
    dead,
    stuck: { count: stuckRows.length, oldestAt: stuckRows[0]?.at.getTime() ?? null },
    tokens: accounts
      .filter((a) => !igUserId || a.igUserId === igUserId)
      .map((a) => ({ username: a.username, expiresAt: a.expiresAt.getTime() })),
  };
}

export async function getHealth(igUserId?: string): Promise<Issue[]> {
  return evaluateHealth(await collectHealthInput(igUserId));
}

/** True only if this key has not alerted within its cooldown (and records it). */
async function claim(issue: Issue): Promise<boolean> {
  const cutoff = new Date(Date.now() - cooldownMs(issue.severity));
  const rows = await db
    .insert(alertLog)
    .values({ key: issue.key })
    .onConflictDoUpdate({ target: alertLog.key, set: { sentAt: new Date() }, setWhere: lt(alertLog.sentAt, cutoff) })
    .returning({ key: alertLog.key });
  return rows.length > 0;
}

/** Sends one message to ALERT_WEBHOOK_URL (Discord, Slack, ntfy...). Best effort. */
async function post(text: string) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  const plain = /ntfy|\/message\b/i.test(url);
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": plain ? "text/plain; charset=utf-8" : "application/json" },
    // Discord reads `content`, Slack reads `text`; each ignores the other.
    body: plain ? text : JSON.stringify({ content: text, text }),
    signal: AbortSignal.timeout(8000),
  });
}

/**
 * Called from the cron jobs. Alerts about current problems, at most once per
 * cooldown each. Never throws: monitoring must not break the thing it watches.
 */
export async function runHealthCheck(): Promise<{ issues: number; alerted: number }> {
  try {
    const issues = await getHealth();
    const fresh: Issue[] = [];
    for (const issue of issues) if (await claim(issue)) fresh.push(issue);
    if (fresh.length > 0) {
      const host = process.env.APP_URL ?? "Oslinke";
      const lines = fresh.map((i) => `${i.severity === "error" ? "🔴" : "🟡"} ${i.title}\n${i.detail}`);
      // One tap from the phone: the login link, when the fix is "reconnect".
      const reconnect = fresh.some((i) => i.key === "token-invalid" || i.key.startsWith("token:"))
        ? `\n\nReconectar agora: ${host}/api/auth/instagram`
        : "";
      await post(`Oslinke (${host})\n\n${lines.join("\n\n")}${reconnect}`);
    }
    return { issues: issues.length, alerted: fresh.length };
  } catch (error) {
    console.error("[health] check failed", error);
    return { issues: 0, alerted: 0 };
  }
}
