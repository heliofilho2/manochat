"use client";

import Link from "next/link";
import { useState } from "react";
import type { Overall, Step } from "@/lib/inbox";

export interface CommentItem {
  id: string;
  user: string;
  initials: string;
  tone: string;
  time: string;
  text: string;
  keyword: string;
  automation: string;
  reply: Step;
  dm: Step;
  overall: Overall;
  reason: string;
  conversationId: string | null;
}

const STEP_STYLE: Record<Step, [string, string, string]> = {
  sent: ["enviada", "var(--color-success-bg)", "var(--color-success)"],
  pending: ["pendente", "var(--color-warning-bg)", "var(--color-warning)"],
  failed: ["falhou", "var(--color-danger-bg)", "var(--color-danger)"],
  off: ["desligada", "var(--color-fill)", "var(--color-muted)"],
};

const FILTERS = { all: "Todos", sent: "Enviados", pending: "Pendentes", failed: "Falharam" } as const;
type Filter = keyof typeof FILTERS;

function Pill({ label, step }: { label: string; step: Step }) {
  const [text, bg, fg] = STEP_STYLE[step];
  return (
    <span
      className="flex h-6 items-center gap-1.5 rounded-full px-[9px] text-xs font-semibold"
      style={{ background: bg, color: fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />
      {label}: {text}
    </span>
  );
}

export function CommentsList({ items }: { items: CommentItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const count = (k: Filter) => (k === "all" ? items.length : items.filter((c) => c.overall === k).length);
  const shown = items.filter((c) => filter === "all" || c.overall === filter);

  return (
    <>
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
        {(Object.keys(FILTERS) as Filter[]).map((k) => {
          const on = filter === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap"
              style={{
                borderColor: on ? "var(--color-accent-line)" : "var(--color-line)",
                background: on ? "var(--color-accent-soft)" : "transparent",
                color: on ? "var(--color-accent-ink-2)" : "var(--color-ink-2)",
              }}
            >
              {FILTERS[k]}
              <span className="text-xs font-medium opacity-70">{count(k)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white">
        {shown.map((c, ix) => (
          <div
            key={c.id}
            className="animate-up flex gap-3.5 border-b border-line-soft p-4"
            style={{
              animationDelay: `${ix * 45}ms`,
              background: c.overall === "failed" ? "#FFFBF9" : "#fff",
            }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{ background: c.tone }}
            >
              {c.initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <strong className="text-[15px] font-semibold">@{c.user}</strong>
                <span className="text-[13px] text-muted">
                  {c.time} · {c.automation}
                </span>
              </div>
              <span className="text-[15px] leading-[1.45] break-words">&quot;{c.text}&quot;</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {c.keyword ? (
                  <span className="h-6 rounded-md border border-line bg-bg px-2 text-[11px] leading-6 font-semibold tracking-[0.03em]">
                    {c.keyword.toUpperCase()}
                  </span>
                ) : null}
                <Pill label="Resposta" step={c.reply} />
                <Pill label="DM" step={c.dm} />
              </div>
              {c.reason ? (
                <div
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 text-[13px] leading-[1.45]"
                  style={{
                    background: c.overall === "failed" ? "var(--color-danger-bg)" : "var(--color-warning-bg)",
                    color: c.overall === "failed" ? "var(--color-danger-ink)" : "var(--color-warning-ink)",
                  }}
                >
                  <span className="min-w-[180px] flex-1">{c.reason}</span>
                </div>
              ) : null}
            </div>
            {c.conversationId ? (
              <Link
                href={`/entrada?aba=conversas&c=${encodeURIComponent(c.conversationId)}`}
                title="Abrir conversa"
                aria-label="Abrir conversa"
                className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-xl border border-line bg-white text-base font-medium"
              >
                →
              </Link>
            ) : null}
          </div>
        ))}
        {shown.length === 0 ? (
          <div className="px-4 py-8 text-center text-[15px] text-muted">Nenhum comentário com esse status. 🎉</div>
        ) : null}
      </div>
    </>
  );
}
