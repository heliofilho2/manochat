"use client";

import type { FlowGraph } from "@/lib/flow/graph";
import type { FlowStats } from "@/lib/flow/stats";
import { META, STATUS } from "./catalog";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export function Results({ graph, stats, onStop }: { graph: FlowGraph; stats: FlowStats; onStop: () => void }) {
  const waiting =
    (stats.byStatus.waiting_tap ?? 0) + (stats.byStatus.waiting_reply ?? 0) + (stats.byStatus.waiting_delay ?? 0) + (stats.byStatus.running ?? 0);
  const nodeText = (id: string | null) => {
    const n = id ? graph.nodes.find((x) => x.id === id) : null;
    return n ? `${META[n.type].icon} ${n.type === "message" ? n.data.text.slice(0, 40) || "Mensagem" : META[n.type].label}` : "—";
  };
  const links = graph.nodes.flatMap((n) => {
    if (n.type === "message") return n.data.buttons.filter((b) => b.url !== undefined).map((b) => ({ key: `${n.id}.${b.id}`, label: b.label || "Botão", where: n.data.text }));
    if (n.type === "cards") {
      return n.data.cards.flatMap((c) => [
        ...(c.url ? [{ key: `${n.id}.${c.id}`, label: c.title || "Cartão", where: "toque no cartão" }] : []),
        ...c.buttons.filter((b) => b.url !== undefined).map((b) => ({ key: `${n.id}.${b.id}`, label: b.label || "Botão", where: c.title })),
      ]);
    }
    return [];
  });

  if (stats.total === 0) {
    return (
      <div className="rounded-[22px] border border-line bg-white p-8 text-center text-sm leading-relaxed text-muted">
        Ninguém passou por este fluxo ainda. Coloque no ar e teste de outra conta; os números aparecem aqui (recarregue a página para atualizar).
      </div>
    );
  }

  const tile = (label: string, value: number, color?: string) => (
    <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-white px-4 py-3.5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="text-[28px] leading-none font-bold tracking-[-0.02em]" style={{ color }}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 min-[700px]:grid-cols-4">
        {tile("Entraram", stats.total)}
        {tile("Concluíram", stats.byStatus.done ?? 0, "var(--color-success-ink)")}
        {tile("No meio do caminho", waiting)}
        {tile("Pararam com erro", stats.byStatus.failed ?? 0, stats.byStatus.failed ? "#B42318" : undefined)}
      </div>

      {waiting > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-line bg-white px-4 py-3 text-sm">
          <span className="text-ink-2">
            {waiting} {waiting === 1 ? "pessoa ainda está" : "pessoas ainda estão"} no meio do fluxo.
          </span>
          <button type="button" onClick={onStop} className="h-10 cursor-pointer rounded-[11px] border-none bg-danger-bg px-3.5 text-[13px] font-semibold text-danger-ink">
            🛑 Parar tudo agora
          </button>
        </div>
      ) : null}

      {stats.ab.map((ab) => {
        const best = Math.max(...ab.branches.map((b) => (b.people ? b.clicked / b.people : 0)));
        return (
          <section key={ab.nodeId} className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
            <h3 className="m-0 text-base font-bold">🎲 Teste A/B</h3>
            {ab.branches.map((b) => {
              const rate = b.people ? b.clicked / b.people : 0;
              return (
                <div key={b.id} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                    <span className="font-semibold">
                      {b.label} {rate > 0 && rate === best ? "🏆" : ""}
                    </span>
                    <span className="text-muted">
                      {b.people} pessoas · {b.clicked} abriram · <b className="text-ink">{Math.round(rate * 100)}%</b>
                    </span>
                  </div>
                  <span className="block h-2.5 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(rate * 100)}%` }} />
                  </span>
                </div>
              );
            })}
            <span className="text-xs leading-normal text-muted">“Abriram” conta quem tocou em qualquer link do fluxo. Para vendas, compare também no seu checkout.</span>
          </section>
        );
      })}

      {links.length > 0 ? (
        <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-white p-5">
          <h3 className="m-0 mb-1 text-base font-bold">🔗 Cliques nos links</h3>
          {links.map((l) => (
            <div key={l.key} className="flex items-center justify-between gap-3 border-b border-line-soft py-2 text-sm last:border-none">
              <span className="min-w-0 truncate">
                <b>{l.label}</b> <span className="text-muted">· {l.where.slice(0, 50)}</span>
              </span>
              <span className="shrink-0 font-bold">{stats.clicks[l.key] ?? 0}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-white p-5">
        <h3 className="m-0 mb-1 text-base font-bold">👥 Últimas pessoas</h3>
        {stats.recent.map((r) => {
          const s = STATUS[r.status] ?? { label: r.status, tone: "muted" as const };
          const color =
            s.tone === "ok" ? "var(--color-success-ink)" : s.tone === "bad" ? "#B42318" : s.tone === "wait" ? "var(--color-accent-ink)" : "var(--color-muted)";
          return (
            <div key={r.id} className="flex flex-col gap-0.5 border-b border-line-soft py-2.5 last:border-none">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{r.username ? `@${r.username}` : "Pessoa sem @"}</span>
                <span className="text-xs text-muted">{ago(r.updatedAt)}</span>
              </div>
              <span className="text-[13px]" style={{ color }}>
                {s.label}
                {r.status !== "done" && r.currentNodeId ? <span className="text-muted"> · em {nodeText(r.currentNodeId)}</span> : null}
              </span>
              {r.status === "failed" && r.lastError ? <span className="text-xs leading-normal text-[#B42318]">{r.lastError}</span> : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
