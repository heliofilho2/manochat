import { fmt } from "@/lib/format";
import type { FunnelRow } from "@/lib/insights/automation-funnel";

const pct = (n: number) => `${n.toFixed(n >= 10 ? 0 : 1).replace(".", ",")}%`;

/** How each automation converts, from the first trigger to the delivered link. */
export function AutomationFunnel({ rows, days }: { rows: FunnelRow[]; days: number }) {
  return (
    <section className="flex flex-col gap-[18px] rounded-[20px] border border-line bg-white p-[22px]">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">Por automação</h2>
        <span className="text-[13px] text-muted">
          Do comentário (ou resposta ao story) até o link entregue, nos últimos {days} dias
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[14px] bg-fill px-4 py-5 text-sm leading-normal text-muted">
          Ainda sem atividade nesse período.
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-line-soft">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <strong className="text-base font-semibold">{r.name}</strong>
                <span className="text-xs font-medium text-muted">
                  {r.kind === "story" ? "Story" : "Comentário"}
                  {r.rate !== null ? ` · ${pct(r.rate)} chegaram ao link` : ""}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-2">
                {[
                  [r.kind === "story" ? "Respostas" : "Comentários", r.entries],
                  ["DMs enviadas", r.dms],
                  ...(r.taps !== null ? [["Toques no botão", r.taps] as const] : []),
                  ["Link entregue", r.delivered],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex flex-col gap-0.5 rounded-xl bg-bg px-3 py-2.5">
                    <span className="text-xl leading-none font-bold tabular-nums">{fmt(value as number)}</span>
                    <span className="text-xs text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <span className="text-xs leading-normal text-muted">
        Os toques no botão são registrados a partir de 01/10/2026. Em stories, &quot;link entregue&quot; conta as DMs
        enviadas.
      </span>
    </section>
  );
}
