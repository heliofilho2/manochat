"use client";

import { useState } from "react";
import type { RankRow } from "@/lib/insights/labels";

type Tab = "hora" | "dia" | "formato" | "tema";

const TABS: [Tab, string][] = [
  ["hora", "Melhor horário"],
  ["dia", "Dia da semana"],
  ["formato", "Formato"],
  ["tema", "Tema"],
];
const HEAD: Record<Tab, string> = {
  hora: "HORÁRIO",
  dia: "DIA",
  formato: "FORMATO",
  tema: "TEMA (1ª HASHTAG)",
};

export function RankingCard({
  rankings,
  combo,
  metricsError,
}: {
  rankings: Record<Tab, RankRow[]>;
  combo: string | null;
  metricsError: boolean;
}) {
  const [tab, setTab] = useState<Tab>("hora");
  const rows = rankings[tab];

  return (
    <section className="flex flex-col gap-[18px] rounded-[20px] border border-line bg-white p-[22px]">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[22px] leading-[1.15] font-bold tracking-[-0.02em]">O que mais converte</h2>
        <span className="text-[13px] text-muted">Últimos 90 dias · conversão = DM enviada</span>
      </div>

      {metricsError ? (
        <div className="rounded-[14px] bg-bg px-4 py-7 text-center text-sm leading-normal text-muted">
          Disponível depois de liberar a permissão de métricas.
        </div>
      ) : (
        <>
          {combo ? (
            <div className="rounded-xl bg-accent-soft px-3.5 py-3 text-sm leading-[1.45] font-medium text-accent-ink-2">
              Sua melhor combinação: <strong className="font-bold">{combo}</strong>
            </div>
          ) : null}
          <div role="tablist" className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
            {TABS.map(([k, label]) => {
              const on = tab === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className="h-9 cursor-pointer rounded-full border px-3.5 text-sm font-medium whitespace-nowrap"
                  style={{
                    borderColor: on ? "var(--color-accent-line)" : "var(--color-line)",
                    background: on ? "var(--color-accent-soft)" : "transparent",
                    color: on ? "var(--color-accent-ink-2)" : "var(--color-ink-2)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {rows.length === 0 ? (
            <div className="rounded-[14px] bg-bg px-4 py-7 text-center text-sm text-muted">
              Sem dados suficientes ainda.
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_64px_60px_44px] gap-2 border-b border-line pb-2 text-[11px] font-medium tracking-[0.03em] text-muted">
                <span>#</span>
                <span>{HEAD[tab]}</span>
                <span className="text-right">CONV.</span>
                <span className="text-right">% ALC.</span>
                <span className="text-right">POSTS</span>
              </div>
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  className="grid grid-cols-[28px_minmax(0,1fr)_64px_60px_44px] items-center gap-2 border-b border-line-soft py-3"
                >
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: i === 0 ? "var(--color-accent-ink)" : "var(--color-muted)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate text-[15px] font-semibold">{r.label}</span>
                    <span className="block h-[5px] overflow-hidden rounded-[9px] bg-line-soft">
                      <span
                        className="block h-full rounded-[9px] transition-[width] duration-[600ms] ease-brand"
                        style={{
                          width: `${r.width}%`,
                          background: i === 0 ? "var(--color-accent)" : "var(--color-line-strong)",
                        }}
                      />
                    </span>
                  </div>
                  <span className="text-right text-[15px] font-semibold">{r.conv}</span>
                  <span className="text-right text-sm text-ink-2">{r.pct}</span>
                  <span className="text-right text-sm text-muted">{r.posts}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
