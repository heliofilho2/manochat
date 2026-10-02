import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { automation, commentEvent, db, tapEvent } from "@/db";
import { buildAutomationFunnel } from "@/lib/insights/automation-funnel";
import { getSession } from "@/lib/session";
import { nowMs } from "@/lib/time";
import { AutomationFunnel } from "../automation-funnel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Por automação — Oslinke" };

const PERIODS = [7, 30, 90] as const;

export default async function PerAutomationPage({ searchParams }: PageProps<"/painel/automacoes">) {
  const session = await getSession();
  if (!session) redirect("/");
  const accountId = session.accountId;

  const { dias } = await searchParams;
  const days = PERIODS.find((p) => String(p) === dias) ?? 30;
  const since = new Date(nowMs() - days * 86_400_000);

  const [autos, entryRows, tapRows] = await Promise.all([
    db
      .select({
        id: automation.id,
        name: automation.name,
        kind: automation.kind,
        requireFollow: automation.requireFollow,
        openerText: automation.openerText,
      })
      .from(automation)
      .where(eq(automation.accountId, accountId)),
    db
      .select({
        automationId: commentEvent.automationId,
        entries: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where ${commentEvent.dmStatus} = 'sent')::int`,
      })
      .from(commentEvent)
      .where(and(eq(commentEvent.accountId, accountId), gt(commentEvent.createdAt, since)))
      .groupBy(commentEvent.automationId),
    db
      .select({
        automationId: tapEvent.automationId,
        taps: sql<number>`count(*)::int`,
        linkSent: sql<number>`count(*) filter (where ${tapEvent.outcome} = 'link_sent')::int`,
      })
      .from(tapEvent)
      .where(and(eq(tapEvent.accountId, accountId), gt(tapEvent.createdAt, since)))
      .groupBy(tapEvent.automationId),
  ]);

  const rows = buildAutomationFunnel(
    autos.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind === "story" ? "story" : "comment",
      gated: a.requireFollow || Boolean(a.openerText),
    })),
    entryRows.flatMap((r) => (r.automationId ? [{ automationId: r.automationId, entries: r.entries, sent: r.sent }] : [])),
    tapRows.flatMap((r) => (r.automationId ? [{ automationId: r.automationId, taps: r.taps, linkSent: r.linkSent }] : [])),
  );

  return (
    <div className="animate-up flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Link href="/painel" className="text-sm font-medium text-muted hover:text-ink">
            ← Painel
          </Link>
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">
            Por automação
          </h1>
          <span className="text-[15px] text-muted">Como cada automação converte, do gatilho ao link entregue.</span>
        </div>
        <div role="tablist" className="flex gap-0.5 rounded-xl bg-fill p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/painel/automacoes?dias=${p}`}
              className="flex h-9 items-center rounded-[9px] px-3.5 text-sm font-medium whitespace-nowrap"
              style={{
                background: days === p ? "#fff" : "transparent",
                boxShadow: days === p ? "0 1px 3px rgba(27,23,18,.12)" : "none",
              }}
            >
              {p} dias
            </Link>
          ))}
        </div>
      </div>

      <AutomationFunnel rows={rows} days={days} />
    </div>
  );
}
