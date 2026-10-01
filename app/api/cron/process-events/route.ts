import { NextRequest, NextResponse } from "next/server";
import { inArray, lt, or, and, sql } from "drizzle-orm";
import { db, webhookEvent } from "@/db";
import { processEvent } from "@/lib/automation/processor";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runHealthCheck } from "@/lib/health-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 12;
/** Leave headroom under maxDuration for the health check and the response. */
const TIME_BUDGET_MS = 40_000;
/** A `processing` row older than this belonged to a crashed run. */
const STUCK_MS = 5 * 60 * 1000;

/**
 * The durability net.
 *
 * `after()` handles the happy path, but a cold-start timeout or a transient
 * Instagram 500 leaves events unfinished. This sweeps them up, which is what
 * lets the system avoid a queue service entirely.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const stale = new Date(Date.now() - STUCK_MS);

  const pending = await db
    .select({ id: webhookEvent.id })
    .from(webhookEvent)
    .where(
      or(
        inArray(webhookEvent.status, ["pending", "failed"]),
        and(
          inArray(webhookEvent.status, ["processing"]),
          lt(webhookEvent.receivedAt, stale),
        ),
      ),
    )
    .orderBy(sql`${webhookEvent.receivedAt} asc`)
    .limit(BATCH);

  let processed = 0;
  const startedAt = Date.now();
  for (const row of pending) {
    // Stop before the function limit; what is left is picked up on the next tick.
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    try {
      await processEvent(row.id);
      processed++;
    } catch (error) {
      console.error("[cron] event failed", row.id, error);
    }
    // Instagram allows 2 messaging calls/second per account.
    await new Promise((resolve) => setTimeout(resolve, 550));
  }

  // Every sweep doubles as the health check (alerts are rate-limited per issue).
  const health = await runHealthCheck();

  return NextResponse.json({ found: pending.length, processed, health });
}
