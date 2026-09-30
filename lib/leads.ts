import "server-only";
import { eq } from "drizzle-orm";
import { account, db, lead } from "@/db";

/**
 * Sends a lead to the account's own endpoint (their website), if they set
 * one. Best effort: a failing endpoint must never break the DM flow.
 */
export async function forwardLead(leadId: string, event: "lead.created" | "lead.updated") {
  try {
    const [row] = await db
      .select({ l: lead, url: account.leadsWebhookUrl, username: account.username })
      .from(lead)
      .innerJoin(account, eq(account.id, lead.accountId))
      .where(eq(lead.id, leadId))
      .limit(1);
    if (!row?.url) return;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.LEADS_WEBHOOK_SECRET) {
      headers.Authorization = `Bearer ${process.env.LEADS_WEBHOOK_SECRET}`;
    }
    const res = await fetch(row.url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        event,
        account: row.username,
        lead: {
          id: row.l.id,
          instagram: row.l.username,
          instagramId: row.l.igId,
          source: row.l.source,
          trigger: row.l.trigger,
          email: row.l.email,
          phone: row.l.phone,
          complete: row.l.step === "done",
          createdAt: row.l.createdAt,
          updatedAt: row.l.updatedAt,
        },
      }),
    });
    if (!res.ok) console.error("[leads] webhook responded", res.status);
  } catch (e) {
    console.error("[leads] webhook failed", e);
  }
}
