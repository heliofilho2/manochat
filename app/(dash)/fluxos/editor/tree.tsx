"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nextNodeId, wouldLoop, type FlowGraph, type FlowNode } from "@/lib/flow/graph";
import type { FlowStats } from "@/lib/flow/stats";
import { CANVAS_MOVED } from "./canvas";
import { BLOCKS, META, outputs, shortText, TRIGGERS, type Kind, type Meta } from "./catalog";

export interface TreeCtx {
  graph: FlowGraph;
  meta: Meta;
  flows: { id: string; name: string }[];
  home: Map<string, string>;
  stats: FlowStats;
  selectedId: string | null;
  select: (id: string) => void;
  issueCount: (id: string) => number;
  addAt: (source: string, handle: string, kind: Kind) => void;
  linkTo: (source: string, handle: string, target: string) => void;
  unlink: (source: string, handle: string) => void;
}

const Line = ({ h = 22 }: { h?: number }) => <span className="block w-0.5 bg-[#CFC6B8]" style={{ height: h }} />;

export function Tree({ id, ctx }: { id: string; ctx: TreeCtx }) {
  const node = ctx.graph.nodes.find((n) => n.id === id);
  if (!node) return null;
  const outs = outputs(node);

  return (
    <div className="flex flex-col items-center">
      <Card node={node} ctx={ctx} />
      {outs.length === 1 && !outs[0].label ? (
        <Slot source={node.id} handle={outs[0].id} ctx={ctx} />
      ) : (
        <>
          <Line h={16} />
          <div className="flex items-start">
            {outs.map((o, i) => (
              <div key={o.id} className="relative flex flex-col items-center px-4">
                {/* the rail joining the branches */}
                {i > 0 ? <span className="absolute top-0 left-0 h-0.5 w-1/2 bg-[#CFC6B8]" /> : null}
                {i < outs.length - 1 ? <span className="absolute top-0 right-0 h-0.5 w-1/2 bg-[#CFC6B8]" /> : null}
                <Line h={12} />
                <span className="max-w-[240px] truncate rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-ink-2 shadow-sm">
                  {o.label}
                </span>
                <Slot source={node.id} handle={o.id} ctx={ctx} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** What hangs under one output: the next block, a "go back" link, or the "+" to add one. */
function Slot({ source, handle, ctx }: { source: string; handle: string; ctx: TreeCtx }) {
  const target = nextNodeId(ctx.graph, source, handle);
  if (!target) {
    return (
      <>
        <Line />
        <AddMenu source={source} handle={handle} ctx={ctx} big />
      </>
    );
  }
  if (ctx.home.get(target) !== `${source}:${handle}`) {
    const t = ctx.graph.nodes.find((n) => n.id === target);
    return (
      <>
        <Line />
        <span className="flex max-w-[280px] items-center gap-1 rounded-xl border-[1.5px] border-dashed border-[#B9AE9C] bg-white py-1 pr-1 pl-3 text-[13px] font-semibold text-ink-2">
          <button
            type="button"
            onClick={() => ctx.select(target)}
            className="min-w-0 cursor-pointer truncate border-none bg-transparent p-0 text-left font-semibold text-ink-2"
          >
            ↩ Volta para: {t ? `${META[t.type].icon} ${shortText(t, ctx.meta, ctx.flows)}` : "bloco"}
          </button>
          <button
            type="button"
            aria-label="Desfazer ligação"
            title="Desfazer ligação"
            onClick={() => ctx.unlink(source, handle)}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-base text-muted hover:bg-fill"
          >
            ×
          </button>
        </span>
      </>
    );
  }
  return (
    <>
      <Line h={10} />
      <AddMenu source={source} handle={handle} ctx={ctx} />
      <Line h={10} />
      <Tree id={target} ctx={ctx} />
    </>
  );
}

function AddMenu({ source, handle, ctx, big }: { source: string; handle: string; ctx: TreeCtx; big?: boolean }) {
  const [open, setOpen] = useState(false);
  const [jump, setJump] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setJump(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener(CANVAS_MOVED, close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(CANVAS_MOVED, close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open) return close();
    const r = btn.current!.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const up = r.bottom + 440 > window.innerHeight && r.top > 440;
    setAt({ left: Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12)), top: up ? r.top - 8 : r.bottom + 8, up });
    setOpen(true);
  };

  const targets = ctx.graph.nodes.filter((n) => n.type !== "trigger" && n.id !== source);
  const groups = [...new Set(BLOCKS.map((b) => b.group))];

  return (
    <div className="relative flex flex-col items-center">
      {big ? (
        <button
          ref={btn}
          type="button"
          onClick={toggle}
          className="flex h-11 cursor-pointer items-center gap-1.5 rounded-[13px] border-[1.5px] border-dashed border-[#B9AE9C] bg-white px-4 text-[13px] font-semibold text-ink-2 shadow-sm hover:border-accent hover:text-accent-ink"
        >
          <span className="text-lg leading-none">+</span> Próximo passo
        </button>
      ) : (
        <button
          ref={btn}
          type="button"
          aria-label="Colocar um passo aqui"
          title="Colocar um passo aqui"
          onClick={toggle}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-[#CFC6B8] bg-white text-base leading-none text-muted hover:border-accent hover:text-accent-ink"
        >
          +
        </button>
      )}
      {open && at
        ? createPortal(
            <div
              ref={menu}
              className="fixed z-[70] flex max-h-[min(440px,70vh)] w-[min(320px,calc(100vw-24px))] flex-col overflow-y-auto rounded-2xl border border-line bg-white p-1.5 text-left shadow-[0_18px_44px_rgba(27,23,18,.22)]"
              style={{ left: at.left, ...(at.up ? { bottom: window.innerHeight - at.top } : { top: at.top }) }}
            >
              {!jump ? (
                <>
                  {groups.map((g) => (
                    <div key={g} className="flex flex-col">
                      <span className="px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">{g}</span>
                      {BLOCKS.filter((b) => b.group === g).map((b) => (
                        <button
                          key={b.kind}
                          type="button"
                          onClick={() => {
                            ctx.addAt(source, handle, b.kind);
                            close();
                          }}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-2.5 py-2 text-left hover:bg-bg"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-lg" style={{ background: `${b.color}1A` }}>
                            {b.icon}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-semibold text-ink">{b.label}</span>
                            <span className="text-xs leading-snug text-muted">{b.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                  {targets.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setJump(true)}
                      className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-2.5 py-2 text-left hover:bg-bg"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-fill text-lg">↩</span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold text-ink">Voltar para um bloco</span>
                        <span className="text-xs text-muted">Ex.: perguntar de novo depois de uma resposta errada</span>
                      </span>
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="px-2.5 pt-2 pb-1 text-xs font-semibold text-muted">Ir para qual bloco?</span>
                  {targets.map((t) => {
                    const loops = wouldLoop(ctx.graph, source, handle, t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={loops}
                        onClick={() => {
                          ctx.linkTo(source, handle, t.id);
                          close();
                        }}
                        className="flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border-none bg-transparent px-2.5 py-2 text-left text-[13px] hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                      >
                        <span className="flex w-full items-center gap-2">
                          <span>{META[t.type].icon}</span>
                          <span className="truncate text-ink">{shortText(t, ctx.meta, ctx.flows)}</span>
                        </span>
                        {loops ? (
                          <span className="pl-6 text-[11px] leading-snug text-[#B42318]">
                            🛑 Criaria um laço sem pausa (mensagens sem parar). Coloque um botão ou “Esperar resposta” no caminho.
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setJump(false)} className="h-10 cursor-pointer border-none bg-transparent text-[13px] font-semibold text-muted">
                    ← Voltar
                  </button>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Card({ node, ctx }: { node: FlowNode; ctx: TreeCtx }) {
  const m = META[node.type];
  const selected = ctx.selectedId === node.id;
  const bad = ctx.issueCount(node.id);
  const reached = ctx.stats.reached[node.id];
  const title = node.type === "trigger" ? (TRIGGERS.find((t) => t.kind === ctx.meta.triggerKind)?.label ?? "Gatilho") : m.label;

  return (
    <button
      type="button"
      onClick={() => ctx.select(node.id)}
      className="flex w-[280px] cursor-pointer flex-col overflow-hidden rounded-[18px] border-2 bg-white p-0 text-left text-ink shadow-[0_6px_18px_rgba(27,23,18,.08)] transition-shadow hover:shadow-[0_12px_28px_rgba(27,23,18,.14)]"
      style={{
        borderColor: selected ? "var(--color-accent)" : bad ? "#E25555" : "var(--color-line)",
        boxShadow: selected ? "0 0 0 4px var(--color-accent-soft), 0 10px 26px rgba(27,23,18,.12)" : undefined,
      }}
    >
      <span className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[15px]" style={{ background: `${m.color}1A` }}>
          {m.icon}
        </span>
        <span className="flex-1 truncate text-[13px] font-bold tracking-[0.01em]" style={{ color: m.color }}>
          {title}
        </span>
        {reached ? (
          <span title="Pessoas que passaram por aqui" className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-bold text-ink-2">
            👥 {reached}
          </span>
        ) : null}
        {bad ? (
          <span title="Algo para corrigir" className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E25555] text-[11px] font-bold text-white">
            !
          </span>
        ) : null}
      </span>
      <span className="line-clamp-4 px-3.5 pb-3 text-sm leading-snug whitespace-pre-line text-ink-2">{shortText(node, ctx.meta, ctx.flows)}</span>

      {node.type === "message" && (node.data.imageUrl || node.data.buttons.length > 0 || (node.data.quickReplies ?? []).length > 0) ? (
        <span className="flex flex-col gap-1.5 border-t border-line-soft bg-bg px-3 py-2.5">
          {node.data.imageUrl ? <span className="text-xs font-semibold text-muted">🖼️ Com imagem</span> : null}
          {node.data.buttons.map((b) => (
            <span key={b.id} className="flex items-center justify-between gap-2 rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-[13px] font-semibold">
              <span className="truncate">
                {b.url !== undefined ? "🔗 " : ""}
                {b.label || "Botão sem texto"}
              </span>
              {b.url !== undefined && ctx.stats.clicks[`${node.id}.${b.id}`] ? (
                <span className="shrink-0 text-[11px] text-muted">{ctx.stats.clicks[`${node.id}.${b.id}`]} cliques</span>
              ) : null}
            </span>
          ))}
          {(node.data.quickReplies ?? []).length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {(node.data.quickReplies ?? []).map((q) => (
                <span key={q.id} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold">
                  {q.label || "…"}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}

      {node.type === "cards" ? (
        <span className="flex gap-1.5 overflow-hidden border-t border-line-soft bg-bg px-3 py-2.5">
          {node.data.cards.slice(0, 3).map((c) => (
            <span key={c.id} className="flex w-[78px] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-white">
              <span className="h-10 bg-fill bg-cover bg-center" style={c.imageUrl ? { backgroundImage: `url("${c.imageUrl}")` } : undefined} />
              <span className="truncate px-1.5 py-1 text-[11px] font-semibold">{c.title || "Cartão"}</span>
            </span>
          ))}
          {node.data.cards.length > 3 ? <span className="self-center text-xs text-muted">+{node.data.cards.length - 3}</span> : null}
        </span>
      ) : null}
    </button>
  );
}
