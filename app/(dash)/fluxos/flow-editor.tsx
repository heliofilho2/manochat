"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import {
  flowWarnings,
  homeOf,
  NEXT,
  nextNodeId,
  outputHandles,
  unreachableNodeIds,
  validateGraph,
  wouldLoop,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
} from "@/lib/flow/graph";
import type { FlowStats } from "@/lib/flow/stats";
import type { PostView } from "@/lib/posts-view";
import { deleteFlow, duplicateFlow, saveFlow, setFlowStatus, stopFlowNow, type FlowInput } from "./actions";
import { Canvas } from "./editor/canvas";
import { blank, TRIGGERS, uid, type Kind, type Meta } from "./editor/catalog";
import { Panel } from "./editor/panel";
import { Results } from "./editor/results";
import { Tree, type TreeCtx } from "./editor/tree";
import { Segmented } from "./editor/ui";

interface Doc {
  meta: Meta;
  graph: FlowGraph;
}

const typingInField = () => {
  const a = document.activeElement;
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement;
};

export function FlowEditor({
  flowId,
  status: initialStatus,
  posts,
  stories,
  stats,
  flows,
  initial,
}: {
  flowId: string;
  status: string;
  posts: PostView[];
  stories: PostView[];
  stats: FlowStats;
  flows: { id: string; name: string; status: string }[];
  initial: FlowInput;
}) {
  const toast = useToast();
  const [doc, setDocRaw] = useState<Doc>(() => {
    const { graph, ...meta } = initial;
    return { meta, graph };
  });
  const { meta, graph } = doc;
  const [status, setStatus] = useState(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"build" | "results">("build");
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState<"saved" | "saving" | "error">("saved");
  const [full, setFull] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [more, setMore] = useState(false);

  /* ── undo / redo: typing bursts collapse into one step ── */
  const [history, setHistory] = useState<{ past: Doc[]; future: Doc[] }>({ past: [], future: [] });
  const lastPush = useRef(0);

  // Edits read the latest doc from here, so several in one tick chain correctly.
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  const setDoc = useCallback((fn: (d: Doc) => Doc) => {
    const cur = docRef.current;
    const next = fn(cur);
    if (next === cur) return;
    const now = Date.now();
    if (now - lastPush.current > 800) setHistory((h) => ({ past: [...h.past.slice(-49), cur], future: [] }));
    lastPush.current = now;
    docRef.current = next;
    setDocRaw(next);
  }, []);
  const setGraph = useCallback((fn: (g: FlowGraph) => FlowGraph) => setDoc((d) => ({ ...d, graph: fn(d.graph) })), [setDoc]);
  const setMeta = useCallback((m: Meta) => setDoc((d) => ({ ...d, meta: m })), [setDoc]);

  const undo = useCallback(() => {
    if (history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    setHistory({ past: history.past.slice(0, -1), future: [doc, ...history.future].slice(0, 50) });
    setDocRaw(prev);
    lastPush.current = 0;
  }, [history, doc]);
  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    const [next, ...rest] = history.future;
    setHistory({ past: [...history.past, doc], future: rest });
    setDocRaw(next);
    lastPush.current = 0;
  }, [history, doc]);

  // Debounced auto-save. The first render is the server state, so skip it.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaving("saving");
    const t = setTimeout(async () => {
      const r = await saveFlow(flowId, { ...meta, graph });
      if (!r.ok) {
        setSaving("error");
        return;
      }
      setSaving("saved");
      if (r.paused) {
        setStatus("paused");
        toast("O fluxo ficou incompleto e foi pausado. Corrija e coloque no ar de novo.");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [meta, graph, flowId, toast]);

  const issues = useMemo(() => validateGraph(graph, { flowId }), [graph, flowId]);
  const warnings = useMemo(() => flowWarnings(graph, meta.triggerKind), [graph, meta.triggerKind]);
  const home = useMemo(() => homeOf(graph), [graph]);
  const orphans = useMemo(() => unreachableNodeIds(graph), [graph]);
  const otherFlows = flows.filter((f) => f.id !== flowId);

  /* ── graph edits ── */

  const relink = (cur: FlowGraph, source: string, handle: string, target: string): FlowEdge[] => [
    ...cur.edges.filter((e) => !(e.source === source && (e.sourceHandle ?? NEXT) === handle)),
    { id: uid("e"), source, sourceHandle: handle, target },
  ];

  /** Adds a block at an output; when something was already there, the new block goes in between. */
  const addAt = (source: string, handle: string, kind: Kind) => {
    const node = blank(kind);
    setGraph((cur) => {
      const old = nextNodeId(cur, source, handle);
      let edges = relink(cur, source, handle, node.id);
      const firstOut = outputHandles(node)[0];
      if (old && firstOut) edges = [...edges, { id: uid("e"), source: node.id, sourceHandle: firstOut, target: old }];
      return { ...cur, nodes: [...cur.nodes, node], edges };
    });
    setSelectedId(node.id);
  };

  const linkTo = (source: string, handle: string, target: string) => {
    if (wouldLoop(graph, source, handle, target)) {
      toast("🛑 Isso criaria um laço sem pausa e mandaria mensagens sem parar. Coloque um botão ou “Esperar resposta” no caminho.");
      return;
    }
    setGraph((cur) => ({ ...cur, edges: relink(cur, source, handle, target) }));
  };

  const unlink = (source: string, handle: string) =>
    setGraph((cur) => ({ ...cur, edges: cur.edges.filter((e) => !(e.source === source && (e.sourceHandle ?? NEXT) === handle)) }));

  const updateNode = (node: FlowNode) =>
    setGraph((cur) => {
      // Drop links that left from outputs the edit just removed.
      const handles = new Set(outputHandles(node));
      return {
        ...cur,
        nodes: cur.nodes.map((n) => (n.id === node.id ? node : n)),
        edges: cur.edges.filter((e) => e.source !== node.id || handles.has(e.sourceHandle ?? NEXT)),
      };
    });

  const removeNode = useCallback(
    (id: string) => {
      const node = graph.nodes.find((n) => n.id === id);
      if (!node || node.type === "trigger") return;
      const handles = outputHandles(node);
      const only = handles.length === 1 ? nextNodeId(graph, id, handles[0]) : null;

      // Single way out: the blocks around it simply close the gap.
      let next: FlowGraph = {
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== id),
        edges: graph.edges
          .filter((e) => e.source !== id)
          .flatMap((e) => (e.target !== id ? [e] : only && only !== e.source ? [{ ...e, target: only }] : [])),
      };
      const before = new Set(unreachableNodeIds(graph));
      const lost = unreachableNodeIds(next).filter((n) => !before.has(n));
      if (lost.length > 0) {
        if (!confirm(`Remover este bloco e os ${lost.length} passo(s) que vêm depois dele? (Dá para desfazer.)`)) return;
        const gone = new Set(lost);
        next = { ...next, nodes: next.nodes.filter((n) => !gone.has(n.id)), edges: next.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)) };
      }
      setGraph(() => next);
      setSelectedId(null);
    },
    [graph, setGraph],
  );

  const duplicate = (id: string) => {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node || node.type === "trigger") return;
    const copy = JSON.parse(JSON.stringify(node)) as FlowNode;
    copy.id = uid("n");
    if (copy.type === "message") {
      copy.data.buttons = copy.data.buttons.map((b) => ({ ...b, id: uid("b") }));
      if (copy.data.quickReplies) copy.data.quickReplies = copy.data.quickReplies.map((q) => ({ ...q, id: uid("q") }));
    }
    if (copy.type === "cards") copy.data.cards = copy.data.cards.map((c) => ({ ...c, id: uid("k"), buttons: c.buttons.map((b) => ({ ...b, id: uid("b") })) }));
    if (copy.type === "random") copy.data.branches = copy.data.branches.map((b) => ({ ...b, id: uid("c") }));
    setGraph((cur) => ({ ...cur, nodes: [...cur.nodes, copy] }));
    setSelectedId(copy.id);
    toast("Cópia criada em “Blocos soltos”. Ligue pelo “+” de uma saída → “Voltar para um bloco”.");
  };

  // Keyboard: undo/redo, delete the selected block.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingInField()) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeNode(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, removeNode, selectedId]);

  /* ── status ── */

  const goLive = async () => {
    setConfirmLive(false);
    setProblems([]);
    // Flush pending edits so the server validates what the screen shows.
    await saveFlow(flowId, { ...meta, graph });
    const r = await setFlowStatus(flowId, "live");
    if (r.ok) {
      setStatus(r.status);
      toast("Fluxo no ar! 🚀");
    } else {
      setProblems(r.problems);
    }
  };

  const pause = async () => {
    const r = await setFlowStatus(flowId, "paused");
    if (r.ok) {
      setStatus(r.status);
      toast("Fluxo pausado. Ninguém recebe mensagens dele até você colocar no ar de novo.");
    }
  };

  const stopAll = async () => {
    setMore(false);
    if (!confirm("Parar tudo agora? O fluxo é pausado e todas as conversas em andamento são encerradas (ninguém recebe os próximos passos).")) return;
    const r = await stopFlowNow(flowId);
    setStatus("paused");
    toast(`🛑 Fluxo parado. ${r.stopped} ${r.stopped === 1 ? "conversa encerrada" : "conversas encerradas"}.`);
  };

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const ctx: TreeCtx = {
    graph,
    meta,
    flows: otherFlows,
    home,
    stats,
    selectedId,
    select: setSelectedId,
    issueCount: (id) => issues.filter((i) => i.nodeId === id).length,
    addAt,
    linkTo,
    unlink,
  };
  const trigger = TRIGGERS.find((t) => t.kind === meta.triggerKind)!;
  const iconBtn =
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-white text-lg text-ink disabled:cursor-default disabled:opacity-35";

  return (
    <div className="animate-up flex flex-col gap-3.5">
      {/* header */}
      <div className="flex flex-col gap-2">
        <Link href="/fluxos" className="flex h-8 items-center self-start text-sm font-medium text-muted">
          ← Fluxos
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            value={meta.name}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            maxLength={80}
            aria-label="Nome do fluxo"
            className="-ml-2 h-12 min-w-0 flex-[1_1_260px] rounded-xl border-[1.5px] border-transparent bg-transparent px-2 text-[clamp(22px,3.5vw,30px)] font-bold tracking-[-0.02em] text-ink outline-accent hover:border-line"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-[13px] text-muted min-[560px]:inline">
              {saving === "saving" ? "Salvando…" : saving === "error" ? "⚠️ Não salvou" : "✓ Salvo"}
            </span>
            <button type="button" onClick={undo} disabled={history.past.length === 0} aria-label="Desfazer" title="Desfazer (Ctrl+Z)" className={iconBtn}>
              ↶
            </button>
            <button type="button" onClick={redo} disabled={history.future.length === 0} aria-label="Refazer" title="Refazer (Ctrl+Y)" className={iconBtn}>
              ↷
            </button>
            <span
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
              style={{
                background: status === "live" ? "var(--color-success-bg)" : "var(--color-fill)",
                color: status === "live" ? "var(--color-success-ink)" : "var(--color-muted)",
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: status === "live" ? "var(--color-success)" : "var(--color-muted-2)" }} />
              {status === "live" ? "No ar" : status === "paused" ? "Pausado" : "Rascunho"}
            </span>
            {status === "live" ? (
              <button type="button" onClick={pause} className="h-11 cursor-pointer rounded-xl border-none bg-fill px-4 text-sm font-semibold text-ink">
                Pausar
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmLive(true)} className="h-11 cursor-pointer rounded-xl border-none bg-ink px-4 text-sm font-semibold text-white">
                Colocar no ar
              </button>
            )}
            <div className="relative">
              <button type="button" onClick={() => setMore((v) => !v)} aria-label="Mais opções" className={iconBtn}>
                ⋯
              </button>
              {more ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMore(false)} />
                  <div className="absolute top-12 right-0 z-[41] flex w-[240px] flex-col gap-0.5 rounded-2xl border border-line bg-white p-1.5 shadow-[0_16px_40px_rgba(27,23,18,.18)]">
                    <button type="button" onClick={stopAll} className="h-11 cursor-pointer rounded-[10px] border-none bg-transparent px-3 text-left text-sm font-semibold text-danger hover:bg-danger-bg">
                      🛑 Parar tudo agora
                    </button>
                    <form action={duplicateFlow.bind(null, flowId)}>
                      <button type="submit" className="h-11 w-full cursor-pointer rounded-[10px] border-none bg-transparent px-3 text-left text-sm font-medium hover:bg-bg">
                        Duplicar fluxo
                      </button>
                    </form>
                    <form
                      action={deleteFlow.bind(null, flowId)}
                      onSubmit={(e) => {
                        if (!confirm("Apagar este fluxo? Quem está no meio dele deixa de receber os próximos passos.")) e.preventDefault();
                      }}
                    >
                      <button type="submit" className="h-11 w-full cursor-pointer rounded-[10px] border-none bg-transparent px-3 text-left text-sm font-medium text-danger hover:bg-danger-bg">
                        Apagar fluxo
                      </button>
                    </form>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {problems.length > 0 ? <Notice tone="bad" title="Falta pouco para colocar no ar:" items={problems} onClose={() => setProblems([])} /> : null}
      {warnings.length > 0 ? <Notice tone="warn" title="Atenção com as regras do Instagram:" items={warnings} /> : null}

      <Segmented
        value={tab}
        onPick={setTab}
        options={[
          ["build", "🧩 Construtor"],
          ["results", `📊 Resultados${stats.total ? ` · ${stats.total}` : ""}`],
        ]}
      />

      {tab === "build" ? (
        <div
          className={
            full
              ? "fixed inset-0 z-[45] flex gap-3 bg-bg p-2 pb-[calc(8px+env(safe-area-inset-bottom))] min-[1100px]:p-3"
              : "flex h-[calc(100dvh-250px)] min-h-[440px] gap-4 min-[820px]:h-[calc(100dvh-290px)]"
          }
        >
          <div className="min-w-0 flex-1">
            <Canvas full={full} onToggleFull={() => setFull((f) => !f)}>
              <div className="flex flex-col items-center px-8 pt-2">
                <Tree id={graph.nodes.find((n) => n.type === "trigger")?.id ?? "trigger"} ctx={ctx} />
                {orphans.length > 0 ? (
                  <div className="mt-12 flex flex-col items-center gap-3 border-t-2 border-dashed border-[#CFC6B8] pt-6">
                    <span className="text-[13px] font-semibold text-muted">Blocos soltos (ninguém chega neles). Ligue pelo “+” → “Voltar para um bloco”, ou remova.</span>
                    <div className="flex flex-wrap items-start justify-center gap-6">
                      {orphans.map((id) => (
                        <Tree key={id} id={id} ctx={ctx} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Canvas>
          </div>

          {/* Desktop: side panel. Phone: a sheet from the bottom while a block is open. */}
          <aside
            className={`min-[1100px]:flex min-[1100px]:w-[400px] min-[1100px]:shrink-0 min-[1100px]:flex-col min-[1100px]:overflow-y-auto min-[1100px]:rounded-[22px] min-[1100px]:border min-[1100px]:border-line min-[1100px]:bg-white min-[1100px]:p-5 ${
              selected
                ? "max-[1099px]:fixed max-[1099px]:inset-x-0 max-[1099px]:bottom-0 max-[1099px]:z-[60] max-[1099px]:flex max-[1099px]:max-h-[86dvh] max-[1099px]:flex-col max-[1099px]:overflow-y-auto max-[1099px]:rounded-t-[26px] max-[1099px]:bg-white max-[1099px]:p-5 max-[1099px]:pb-[calc(24px+env(safe-area-inset-bottom))] max-[1099px]:shadow-[0_-12px_40px_rgba(27,23,18,.25)]"
                : "max-[1099px]:hidden"
            }`}
          >
            {selected ? (
              <Panel
                node={selected}
                meta={meta}
                setMeta={setMeta}
                posts={posts}
                stories={stories}
                flows={otherFlows}
                issues={issues.filter((i) => i.nodeId === selected.id).map((i) => i.message)}
                onChange={updateNode}
                onRemove={() => removeNode(selected.id)}
                onDuplicate={() => duplicate(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <Guide />
            )}
          </aside>
          {selected ? (
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 z-[55] border-none bg-[rgba(27,23,18,.35)] min-[1100px]:hidden"
            />
          ) : null}
        </div>
      ) : (
        <Results graph={graph} stats={stats} onStop={stopAll} />
      )}

      {confirmLive ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(27,23,18,.4)] p-0 min-[600px]:items-center min-[600px]:p-6" onClick={() => setConfirmLive(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[460px] flex-col gap-4 rounded-t-[26px] bg-white p-6 pb-[calc(24px+env(safe-area-inset-bottom))] min-[600px]:rounded-[24px]"
          >
            <h2 className="m-0 text-xl font-bold tracking-[-0.02em]">Colocar no ar?</h2>
            <div className="flex flex-col gap-2 rounded-2xl bg-bg p-4 text-sm leading-normal">
              <span>
                <b>Quem entra:</b> {trigger.icon} {trigger.label}
                {meta.keywords.length ? ` com ${meta.keywords.join(", ")}` : meta.triggerKind === "dm" ? " (qualquer mensagem)" : ""}
                {(meta.triggerKind === "comment" || meta.triggerKind === "story") && meta.scope === "specific_posts"
                  ? ` · ${meta.postIds.length} ${meta.triggerKind === "story" ? "story(s)" : "post(s)"} escolhido(s)`
                  : meta.triggerKind === "comment"
                    ? " · em todos os posts"
                    : ""}
              </span>
              <span>
                <b>Mesma pessoa de novo:</b> {meta.rerun === "always" ? "sempre" : meta.rerun === "daily" ? "no máximo 1× por dia" : "só 1 vez"}
              </span>
              <span className="text-[13px] text-muted">
                🛡️ Travas ligadas: no máximo 6 mensagens seguidas sem a pessoa interagir, 10 por minuto e 40 por pessoa. Se passar disso, o
                fluxo para sozinho e você é avisado.
              </span>
            </div>
            {meta.triggerKind === "comment" && meta.scope === "all_posts" ? (
              <span className="rounded-xl bg-[#FBF6E6] px-3 py-2.5 text-[13px] leading-normal text-[#6B5311]">
                Dica: para testar, escolha <b>um post específico</b> e uma palavra só sua. Depois abra para todos.
              </span>
            ) : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmLive(false)} className="h-12 flex-1 cursor-pointer rounded-xl border border-line bg-white text-sm font-semibold">
                Voltar
              </button>
              <button type="button" onClick={goLive} className="h-12 flex-[2] cursor-pointer rounded-xl border-none bg-ink text-sm font-semibold text-white">
                Colocar no ar 🚀
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Guide() {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
      <span className="text-base font-bold text-ink">Como montar</span>
      <span>
        <b className="text-ink">Toque num bloco</b> para editar textos, botões e opções.
      </span>
      <span>
        <b className="text-ink">“+ Próximo passo”</b> escolhe o que vem depois. O <b className="text-ink">“+”</b> pequeno numa linha coloca um passo no meio.
      </span>
      <span>
        <b className="text-ink">Mover o quadro:</b> arraste o fundo, ou segure Ctrl / Espaço e arraste. Ctrl + rolar dá zoom. No celular, um dedo move e a pinça dá zoom.
      </span>
      <span>
        Botões que <b className="text-ink">continuam o fluxo</b> abrem um caminho para cada um; botões de <b className="text-ink">link</b> só abrem a página e contam cliques.
      </span>
      <span>
        Nas mensagens: <b className="text-ink">{"{nome}"}</b>, <b className="text-ink">{"{usuario}"}</b>, <b className="text-ink">{"{resposta}"}</b> e{" "}
        <b className="text-ink">{"{campo:cidade}"}</b>.
      </span>
      <span>
        Errou? <b className="text-ink">Ctrl+Z</b> ou ↶ desfaz.
      </span>
      <span className="rounded-xl bg-bg px-3 py-2.5 text-[13px]">
        🛡️ O editor não deixa criar laços que mandem mensagens sem parar, e o fluxo para sozinho se passar dos limites de segurança.
      </span>
    </div>
  );
}

function Notice({ tone, title: heading, items, onClose }: { tone: "bad" | "warn"; title: string; items: string[]; onClose?: () => void }) {
  const c = tone === "bad" ? ["#F2C4C4", "#FDF1F1", "#8A1F1F"] : ["#EBDDB0", "#FBF6E6", "#6B5311"];
  return (
    <div className="flex gap-3 rounded-[16px] border px-4 py-3 text-sm" style={{ borderColor: c[0], background: c[1], color: c[2] }}>
      <div className="min-w-0 flex-1">
        <b>{heading}</b>
        <ul className="m-0 mt-1.5 flex list-disc flex-col gap-1 pl-5 leading-normal">
          {items.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Fechar" className="h-8 w-8 cursor-pointer border-none bg-transparent text-lg" style={{ color: c[2] }}>
          ×
        </button>
      ) : null}
    </div>
  );
}
