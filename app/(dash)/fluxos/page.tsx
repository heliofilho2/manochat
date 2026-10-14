import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db, flow, flowRun } from "@/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fluxos — Oslinke" };

const STATUS_LABEL: Record<string, string> = { draft: "Rascunho", live: "No ar", paused: "Pausado" };
const TRIGGER_LABEL: Record<string, string> = { comment: "Comentário", story: "Resposta ao story", dm: "Palavra no direct" };

export default async function FlowsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const rows = await db
    .select({
      id: flow.id,
      name: flow.name,
      status: flow.status,
      triggerKind: flow.triggerKind,
      keywords: flow.keywords,
      runs: sql<number>`(select count(*)::int from ${flowRun} where "flow_run"."flow_id" = "flow"."id")`,
      waiting: sql<number>`(select count(*)::int from ${flowRun} where "flow_run"."flow_id" = "flow"."id" and "flow_run"."status" in ('waiting_tap','waiting_reply','waiting_delay'))`,
      failed: sql<number>`(select count(*)::int from ${flowRun} where "flow_run"."flow_id" = "flow"."id" and "flow_run"."status" = 'failed')`,
    })
    .from(flow)
    .where(eq(flow.accountId, session.accountId))
    .orderBy(desc(flow.createdAt));

  return (
    <div className="animate-up flex max-w-[900px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[clamp(30px,4.5vw,42px)] leading-[1.02] font-bold tracking-[-0.025em]">Fluxos</h1>
          <span className="max-w-[560px] text-[15px] leading-normal text-muted">
            Conversas com vários passos: pedir uma palavra de confirmação, entregar o material, perguntar se deu certo,
            testar dois preços. Quando um fluxo no ar combina, ele responde no lugar das automações simples.
          </span>
        </div>
        <Link
          href="/fluxos/novo"
          className="flex h-11 items-center rounded-xl bg-ink px-5 text-sm font-semibold text-white no-underline"
        >
          + Novo fluxo
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-white p-8 text-center text-sm text-muted">
          Nenhum fluxo ainda. Comece por um modelo pronto em “Novo fluxo”.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/fluxos/${r.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] border border-line bg-white px-5 py-4 text-ink no-underline"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-base font-semibold">{r.name}</span>
                <span className="truncate text-[13px] text-muted">
                  {TRIGGER_LABEL[r.triggerKind] ?? "Comentário"}
                  {r.keywords.length > 0
                    ? ` · ${r.keywords.map((k) => k.toUpperCase()).join(", ")}`
                    : r.triggerKind === "story"
                      ? " · qualquer resposta"
                      : " · sem palavra-chave ainda"}
                </span>
              </div>
              <span className="text-[13px] text-muted">
                {r.runs} {r.runs === 1 ? "pessoa" : "pessoas"}
                {r.waiting > 0 ? ` · ${r.waiting} esperando` : ""}
                {r.failed > 0 ? ` · ${r.failed} com erro` : ""}
              </span>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: r.status === "live" ? "var(--color-accent-soft)" : "var(--color-fill)",
                  color: r.status === "live" ? "var(--color-accent-ink-2)" : "var(--color-muted)",
                }}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
