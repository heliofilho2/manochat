import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { automation, db, lead } from "@/db";
import { leadsToCsv } from "@/lib/leads-format";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV of the signed-in account's leads. */
export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await db
    .select({ l: lead, automation: automation.name })
    .from(lead)
    .leftJoin(automation, eq(automation.id, lead.automationId))
    .where(eq(lead.accountId, session.accountId))
    .orderBy(desc(lead.createdAt))
    .limit(5000);

  const csv = leadsToCsv(
    rows.map(({ l, automation: name }) => ({
      createdAt: l.createdAt,
      username: l.username,
      email: l.email,
      phone: l.phone,
      trigger: l.trigger,
      source: l.source,
      automation: name,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads-manochat.csv"',
    },
  });
}
