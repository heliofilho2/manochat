"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type EdgeChange,
} from "@xyflow/react";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast";
import {
  MAX_BUTTONS,
  NEXT,
  outputHandles,
  unreachableNodeIds,
  validateGraph,
  type FlowGraph,
  type FlowNode,
} from "@/lib/flow/graph";
import type { PostView } from "@/lib/posts-view";
import { deleteFlow, saveFlow, setFlowStatus, type FlowInput } from "./actions";

/* ─── ids and defaults ──────────────────────────────────────────────────── */

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type NodeKind = Exclude<FlowNode["type"], "trigger">;

const KINDS: { kind: NodeKind; label: string; hint: string; color: string }[] = [
  { kind: "message", label: "Mensagem", hint: "Texto com botões", color: "#2F6FDE" },
  { kind: "random", label: "Sorteio A/B", hint: "Divide em caminhos", color: "#8B5CF6" },
  { kind: "condition", label: "Condição", hint: "Sim ou não", color: "#D97706" },
  { kind: "delay", label: "Espera", hint: "Continua depois", color: "#0F9D58" },
  { kind: "action", label: "Tag", hint: "Marca a pessoa", color: "#DB2777" },
];
const COLOR: Record<FlowNode["type"], string> = {
  trigger: "#1B1712",
  message: "#2F6FDE",
  random: "#8B5CF6",
  condition: "#D97706",
  delay: "#0F9D58",
  action: "#DB2777",
};
const TITLE: Record<FlowNode["type"], string> = {
  trigger: "Gatilho: comentário",
  message: "Mensagem",
  random: "Sorteio A/B",
  condition: "Condição",
  delay: "Espera",
  action: "Tag",
};

function blankNode(kind: NodeKind): FlowNode {
  const id = uid("n");
  switch (kind) {
    case "message":
      return { id, type: "message", data: { text: "", buttons: [] } };
    case "random":
      return {
        id,
        type: "random",
        data: {
          branches: [
            { id: uid("c"), label: "Caminho A", weight: 50 },
            { id: uid("c"), label: "Caminho B", weight: 50 },
          ],
        },
      };
    case "condition":
      return { id, type: "condition", data: { check: { kind: "has_tag", tag: "" } } };
    case "delay":
      return { id, type: "delay", data: { minutes: 60 } };
    case "action":
      return { id, type: "action", data: { op: "add_tag", tag: "" } };
  }
}

/* ─── canvas node ───────────────────────────────────────────────────────── */

interface BlockData extends Record<string, unknown> {
  node: FlowNode;
  invalid: boolean;
  orphan: boolean;
}
type BlockRF = Node<BlockData, "block">;

function summary(node: FlowNode): string {
  switch (node.type) {
    case "trigger":
      return "Quando alguém comenta a palavra-chave";
    case "message":
      return node.data.text.trim() || "Mensagem sem texto";
    case "random":
      return `${node.data.branches.length} caminhos`;
    case "condition":
      return node.data.check.kind === "is_follower" ? "A pessoa já segue?" : `Tem a tag “${node.data.check.tag || "…"}”?`;
    case "delay":
      return `Espera ${fmtMinutes(node.data.minutes)}`;
    case "action":
      return `${node.data.op === "add_tag" ? "Adiciona" : "Remove"} a tag “${node.data.tag || "…"}”`;
  }
}

function outputLabels(node: FlowNode): { id: string; label: string }[] {
  switch (node.type) {
    case "message": {
      const taps = node.data.buttons.filter((b) => !b.url);
      return taps.length > 0 ? taps.map((b) => ({ id: b.id, label: b.label || "Botão" })) : [{ id: NEXT, label: "" }];
    }
    case "random": {
      const total = node.data.branches.reduce((s, b) => s + Math.max(0, b.weight), 0) || 1;
      return node.data.branches.map((b) => ({
        id: b.id,
        label: `${b.label || "Caminho"} · ${Math.round((Math.max(0, b.weight) / total) * 100)}%`,
      }));
    }
    case "condition":
      return [
        { id: "yes", label: "Sim" },
        { id: "no", label: "Não" },
      ];
    default:
      return [{ id: NEXT, label: "" }];
  }
}

function BlockNode({ data, selected }: NodeProps<BlockRF>) {
  const { node, invalid, orphan } = data;
  const outs = outputLabels(node);
  return (
    <div
      className="w-[240px] rounded-2xl bg-white text-ink shadow-[0_6px_18px_rgba(27,23,18,.08)]"
      style={{
        border: `2px solid ${selected ? "var(--color-accent)" : invalid ? "#DC2626" : "var(--color-line)"}`,
        opacity: orphan ? 0.55 : 1,
      }}
    >
      {node.type !== "trigger" ? <Handle type="target" position={Position.Left} /> : null}
      <div className="flex items-center gap-2 rounded-t-[13px] px-3 py-2 text-xs font-bold text-white" style={{ background: COLOR[node.type] }}>
        {TITLE[node.type]}
      </div>
      <div className="px-3 py-2.5 text-[13px] leading-snug break-words text-ink-2">
        {summary(node).slice(0, 120)}
      </div>
      <div className="flex flex-col pb-1.5">
        {outs.map((o) => (
          <div key={o.id} className="relative flex min-h-[26px] items-center justify-end pr-4 pl-3 text-xs font-semibold text-muted">
            {o.label ? <span className="truncate">{o.label}</span> : null}
            <Handle type="source" position={Position.Right} id={o.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
const nodeTypes = { block: BlockNode };

/* ─── small helpers ─────────────────────────────────────────────────────── */

function fmtMinutes(m: number): string {
  if (m % 1440 === 0) return `${m / 1440} ${m / 1440 === 1 ? "dia" : "dias"}`;
  if (m % 60 === 0) return `${m / 60} h`;
  return `${m} min`;
}

const inputCls = "h-[42px] rounded-[10px] border-[1.5px] border-line bg-white px-3 text-sm text-ink outline-accent";
const smallBtn = "h-9 cursor-pointer rounded-[9px] border border-line bg-white px-3 text-xs font-semibold whitespace-nowrap";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

type Meta = Omit<FlowInput, "graph">;

/* ─── editor ────────────────────────────────────────────────────────────── */

export function FlowEditor({
  flowId,
  status: initialStatus,
  posts,
  initial,
}: {
  flowId: string;
  status: string;
  posts: PostView[];
  initial: FlowInput;
}) {
  const toast = useToast();
  const [meta, setMeta] = useState<Meta>(() => {
    const { graph: _graph, ...rest } = initial;
    void _graph;
    return rest;
  });
  const [graph, setGraph] = useState<FlowGraph>(initial.graph);
  const [status, setStatus] = useState(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>("trigger");
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("saved");

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
        setSaving("idle");
        toast("Não deu pra salvar agora. Confira os campos e tente de novo.");
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

  const issues = useMemo(() => validateGraph(graph), [graph]);
  const orphans = useMemo(() => new Set(unreachableNodeIds(graph)), [graph]);
  const invalidIds = useMemo(() => new Set(issues.map((i) => i.nodeId).filter(Boolean) as string[]), [issues]);
  const warnings = useMemo(() => flowWarnings(graph), [graph]);

  const rfNodes: BlockRF[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: "block",
    position: graph.positions?.[n.id] ?? { x: 40 + i * 300, y: 60 },
    data: { node: n, invalid: invalidIds.has(n.id), orphan: n.type !== "trigger" && orphans.has(n.id) },
    selected: n.id === selectedId,
    deletable: n.type !== "trigger",
  }));
  const rfEdges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? NEXT,
  }));

  const onNodesChange = useCallback((changes: NodeChange<BlockRF>[]) => {
    setGraph((cur) => {
      let next = cur;
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          next = { ...next, positions: { ...next.positions, [c.id]: c.position } };
        } else if (c.type === "remove") {
          const target = next.nodes.find((n) => n.id === c.id);
          if (!target || target.type === "trigger") continue;
          next = {
            ...next,
            nodes: next.nodes.filter((n) => n.id !== c.id),
            edges: next.edges.filter((e) => e.source !== c.id && e.target !== c.id),
          };
        }
      }
      return next;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => c.id));
    if (removed.size === 0) return;
    setGraph((cur) => ({ ...cur, edges: cur.edges.filter((e) => !removed.has(e.id)) }));
  }, []);

  const connect = useCallback((source: string, handle: string, target: string) => {
    if (source === target) return;
    setGraph((cur) => {
      if (cur.nodes.find((n) => n.id === target)?.type === "trigger") return cur;
      // One arrow per output: a new one replaces the old.
      const kept = cur.edges.filter((e) => !(e.source === source && (e.sourceHandle ?? NEXT) === handle));
      return { ...cur, edges: [...kept, { id: uid("e"), source, sourceHandle: handle, target }] };
    });
  }, []);

  const onConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) connect(c.source, c.sourceHandle ?? NEXT, c.target);
    },
    [connect],
  );

  const updateNode = (id: string, node: FlowNode) =>
    setGraph((cur) => {
      // Drop arrows that left from outputs the edit just removed.
      const handles = new Set(outputHandles(node));
      return {
        ...cur,
        nodes: cur.nodes.map((n) => (n.id === id ? node : n)),
        edges: cur.edges.filter((e) => e.source !== id || handles.has(e.sourceHandle ?? NEXT)),
      };
    });

  const addNode = (kind: NodeKind) => {
    const node = blankNode(kind);
    const from = selectedId ? graph.nodes.find((n) => n.id === selectedId) : undefined;
    const base = from ? graph.positions?.[from.id] ?? { x: 40, y: 60 } : null;
    const maxY = Math.max(0, ...graph.nodes.map((n) => graph.positions?.[n.id]?.y ?? 60));
    const position = base ? { x: base.x + 300, y: base.y } : { x: 40, y: maxY + 180 };

    setGraph((cur) => {
      const next: FlowGraph = { ...cur, nodes: [...cur.nodes, node], positions: { ...cur.positions, [node.id]: position } };
      if (!from) return next;
      // Plug into the first free output of the selected block.
      const free = outputHandles(from).find((h) => !cur.edges.some((e) => e.source === from.id && (e.sourceHandle ?? NEXT) === h));
      return free ? { ...next, edges: [...next.edges, { id: uid("e"), source: from.id, sourceHandle: free, target: node.id }] } : next;
    });
    setSelectedId(node.id);
  };

  const removeNode = (id: string) => {
    setGraph((cur) => ({
      ...cur,
      nodes: cur.nodes.filter((n) => n.id !== id),
      edges: cur.edges.filter((e) => e.source !== id && e.target !== id),
    }));
    setSelectedId(null);
  };

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;

  const toggleLive = async () => {
    setProblems([]);
    // Flush any pending edit first so the server validates what the screen shows.
    await saveFlow(flowId, { ...meta, graph });
    const r = await setFlowStatus(flowId, status === "live" ? "paused" : "live");
    if (r.ok) setStatus(r.status);
    else setProblems(r.problems);
  };

  return (
    <div className="animate-up flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href="/fluxos" className="flex h-8 items-center self-start text-sm font-medium text-muted">
            ← Fluxos
          </Link>
          <input
            value={meta.name}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            maxLength={80}
            aria-label="Nome do fluxo"
            className="h-12 w-full max-w-[520px] rounded-xl border-[1.5px] border-transparent bg-transparent px-2 text-[26px] font-bold tracking-[-0.02em] text-ink outline-accent hover:border-line"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-muted">
            {saving === "saving" ? "Salvando…" : saving === "saved" ? "Salvo" : "Não salvo"}
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: status === "live" ? "var(--color-accent-soft)" : "var(--color-fill)",
              color: status === "live" ? "var(--color-accent-ink-2)" : "var(--color-muted)",
            }}
          >
            {status === "live" ? "No ar" : status === "paused" ? "Pausado" : "Rascunho"}
          </span>
          <button
            type="button"
            onClick={toggleLive}
            className="h-11 cursor-pointer rounded-xl border-none bg-ink px-5 text-sm font-semibold text-white"
          >
            {status === "live" ? "Pausar" : "Colocar no ar"}
          </button>
        </div>
      </div>

      {problems.length > 0 ? (
        <div className="rounded-[14px] border border-[#F2C4C4] bg-[#FDF1F1] px-4 py-3 text-sm text-[#8A1F1F]">
          <b>Ainda não dá pra colocar no ar:</b>
          <ul className="m-0 mt-1.5 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-[14px] border border-[#EBDDB0] bg-[#FBF6E6] px-4 py-3 text-sm text-[#6B5311]">
          <b>Atenção:</b>
          <ul className="m-0 mt-1.5 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted">Adicionar bloco:</span>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => addNode(k.kind)}
            title={k.hint}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-semibold"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
            {k.label}
          </button>
        ))}
        <span className="text-xs text-muted">
          Com um bloco selecionado, o novo já liga na saída livre dele. Arraste de uma bolinha à outra para ligar.
        </span>
      </div>

      <div className="flex flex-col items-stretch gap-4 min-[1000px]:flex-row">
        <div className="h-[68vh] min-h-[420px] min-w-0 flex-1 overflow-hidden rounded-[20px] border border-line bg-white">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.3}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[20px] border border-line bg-white p-5 min-[1000px]:w-[360px]">
          {selected ? (
            <Panel
              node={selected}
              meta={meta}
              setMeta={setMeta}
              posts={posts}
              onChange={(n) => updateNode(selected.id, n)}
              onRemove={() => removeNode(selected.id)}
              issues={issues.filter((i) => i.nodeId === selected.id).map((i) => i.message)}
            />
          ) : (
            <span className="text-sm leading-normal text-muted">
              Clique em um bloco para editar. Para ligar dois blocos, arraste da bolinha da direita de um até a
              bolinha da esquerda do outro. Para apagar uma seta ou um bloco, selecione e aperte Delete.
            </span>
          )}
        </aside>
      </div>

      <form
        action={deleteFlow.bind(null, flowId)}
        onSubmit={(e) => {
          if (!confirm("Apagar este fluxo? As pessoas que estão no meio dele deixam de receber os próximos passos.")) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" className="h-10 cursor-pointer border-none bg-transparent px-1 text-sm font-medium text-danger">
          Apagar fluxo
        </button>
      </form>
    </div>
  );
}

/** Soft problems: the flow runs, but Meta may refuse part of it. */
function flowWarnings(graph: FlowGraph): string[] {
  const out: string[] = [];
  for (const n of graph.nodes) {
    if (n.type === "delay" && n.data.minutes > 1440) {
      out.push("Uma espera passa de 24h: depois desse tempo a Meta pode recusar a mensagem seguinte, a não ser que a pessoa tenha interagido antes.");
    }
    if (n.type === "message" && !n.data.buttons.some((b) => !b.url)) {
      const next = graph.edges.find((e) => e.source === n.id)?.target;
      if (next && graph.nodes.find((x) => x.id === next)?.type === "message") {
        out.push("Duas mensagens seguidas sem botão no meio: a Meta só aceita a segunda se a pessoa responder antes. Coloque um botão na primeira.");
      }
    }
  }
  return [...new Set(out)];
}

/* ─── side panel ────────────────────────────────────────────────────────── */

function Panel({
  node,
  meta,
  setMeta,
  posts,
  onChange,
  onRemove,
  issues,
}: {
  node: FlowNode;
  meta: Meta;
  setMeta: (m: Meta) => void;
  posts: PostView[];
  onChange: (n: FlowNode) => void;
  onRemove: () => void;
  issues: string[];
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: COLOR[node.type] }} />
        <h2 className="m-0 flex-1 text-lg font-bold tracking-[-0.01em]">{TITLE[node.type]}</h2>
        {node.type !== "trigger" ? (
          <button type="button" onClick={onRemove} className="h-9 cursor-pointer border-none bg-transparent px-1 text-sm font-medium text-danger">
            Remover bloco
          </button>
        ) : null}
      </div>
      {issues.length > 0 ? (
        <ul className="m-0 list-disc rounded-[10px] bg-[#FDF1F1] py-2 pr-3 pl-6 text-[13px] text-[#8A1F1F]">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}

      {node.type === "trigger" ? <TriggerForm meta={meta} setMeta={setMeta} posts={posts} /> : null}

      {node.type === "message" ? (
        <>
          <Field label="Texto">
            <textarea
              value={node.data.text}
              onChange={(e) => onChange({ ...node, data: { ...node.data, text: e.target.value } })}
              rows={5}
              maxLength={640}
              placeholder="Oi! Aqui está o que você pediu…"
              className="resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-[15px] leading-normal font-normal text-ink outline-accent"
            />
            <span className="self-end text-xs font-normal text-muted">{node.data.text.length}/640</span>
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Botões (até {MAX_BUTTONS})</span>
            {node.data.buttons.map((b, i) => (
              <div key={b.id} className="flex flex-col gap-1.5 rounded-xl border border-line p-2.5">
                <div className="flex gap-2">
                  <input
                    value={b.label}
                    maxLength={20}
                    placeholder="Texto do botão"
                    onChange={(e) =>
                      onChange({ ...node, data: { ...node.data, buttons: node.data.buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })
                    }
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    aria-label="Remover botão"
                    onClick={() => onChange({ ...node, data: { ...node.data, buttons: node.data.buttons.filter((_, j) => j !== i) } })}
                    className="h-[42px] w-9 cursor-pointer border-none bg-transparent text-lg text-danger"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={smallBtn}
                    onClick={() =>
                      onChange({
                        ...node,
                        data: {
                          ...node.data,
                          buttons: node.data.buttons.map((x, j) => (j === i ? (x.url === undefined ? { ...x, url: "" } : { id: x.id, label: x.label }) : x)),
                        },
                      })
                    }
                  >
                    {b.url === undefined ? "Continua o fluxo" : "Abre um link"}
                  </button>
                  {b.url !== undefined ? (
                    <input
                      value={b.url}
                      maxLength={500}
                      placeholder="https://…"
                      onChange={(e) =>
                        onChange({ ...node, data: { ...node.data, buttons: node.data.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) } })
                      }
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                  ) : (
                    <span className="text-xs text-muted">Ganha uma saída para ligar ao próximo bloco.</span>
                  )}
                </div>
              </div>
            ))}
            {node.data.buttons.length < MAX_BUTTONS ? (
              <button
                type="button"
                onClick={() => onChange({ ...node, data: { ...node.data, buttons: [...node.data.buttons, { id: uid("b"), label: "" }] } })}
                className="h-[42px] cursor-pointer self-start rounded-[11px] border border-dashed border-line-dashed bg-transparent px-4 text-sm font-semibold"
              >
                + Botão
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {node.type === "random" ? (
        <>
          <span className="text-[13px] leading-normal text-muted">
            Cada pessoa cai em um caminho ao acaso, na proporção abaixo. Quem cai em um caminho ganha a tag
            “ab:nome do fluxo:caminho”, e você compara os grupos depois.
          </span>
          {node.data.branches.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <input
                value={b.label}
                maxLength={40}
                placeholder="Nome"
                onChange={(e) =>
                  onChange({ ...node, data: { branches: node.data.branches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })
                }
                className={`${inputCls} min-w-0 flex-1`}
              />
              <input
                type="number"
                min={0}
                max={1000}
                value={b.weight}
                aria-label="Peso"
                onChange={(e) =>
                  onChange({ ...node, data: { branches: node.data.branches.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)) } })
                }
                className={`${inputCls} w-20`}
              />
              {node.data.branches.length > 2 ? (
                <button
                  type="button"
                  aria-label="Remover caminho"
                  onClick={() => onChange({ ...node, data: { branches: node.data.branches.filter((_, j) => j !== i) } })}
                  className="h-9 w-9 cursor-pointer border-none bg-transparent text-lg text-danger"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {node.data.branches.length < 6 ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...node,
                  data: { branches: [...node.data.branches, { id: uid("c"), label: `Caminho ${String.fromCharCode(65 + node.data.branches.length)}`, weight: 50 }] },
                })
              }
              className="h-[42px] cursor-pointer self-start rounded-[11px] border border-dashed border-line-dashed bg-transparent px-4 text-sm font-semibold"
            >
              + Caminho
            </button>
          ) : null}
        </>
      ) : null}

      {node.type === "condition" ? (
        <>
          <Field label="Pergunta">
            <select
              value={node.data.check.kind}
              onChange={(e) =>
                onChange({ ...node, data: { check: e.target.value === "is_follower" ? { kind: "is_follower" } : { kind: "has_tag", tag: "" } } })
              }
              className={inputCls}
            >
              <option value="has_tag">A pessoa tem a tag…</option>
              <option value="is_follower">A pessoa já segue o perfil</option>
            </select>
          </Field>
          {node.data.check.kind === "has_tag" ? (
            <Field label="Tag">
              <input
                value={node.data.check.tag}
                maxLength={60}
                placeholder="ex.: follower"
                onChange={(e) => onChange({ ...node, data: { check: { kind: "has_tag", tag: e.target.value } } })}
                className={inputCls}
              />
            </Field>
          ) : null}
          <span className="text-[13px] leading-normal text-muted">Ligue a saída “Sim” e a saída “Não” a blocos diferentes.</span>
        </>
      ) : null}

      {node.type === "delay" ? <DelayForm minutes={node.data.minutes} onChange={(minutes) => onChange({ ...node, data: { minutes } })} /> : null}

      {node.type === "action" ? (
        <>
          <Field label="O que fazer">
            <select
              value={node.data.op}
              onChange={(e) => onChange({ ...node, data: { ...node.data, op: e.target.value as "add_tag" | "remove_tag" } })}
              className={inputCls}
            >
              <option value="add_tag">Adicionar a tag</option>
              <option value="remove_tag">Remover a tag</option>
            </select>
          </Field>
          <Field label="Tag">
            <input
              value={node.data.tag}
              maxLength={60}
              placeholder="ex.: quer-ebook"
              onChange={(e) => onChange({ ...node, data: { ...node.data, tag: e.target.value } })}
              className={inputCls}
            />
          </Field>
        </>
      ) : null}
    </>
  );
}

function DelayForm({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const unit = minutes % 1440 === 0 ? 1440 : minutes % 60 === 0 ? 60 : 1;
  const [u, setU] = useState(unit);
  return (
    <>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={Math.max(1, Math.round(minutes / u))}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1) * u)}
          className={`${inputCls} w-24`}
        />
        <select
          value={u}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(Math.max(1, Math.round(minutes / u)) * next);
            setU(next);
          }}
          className={`${inputCls} flex-1`}
        >
          <option value={1}>minutos</option>
          <option value={60}>horas</option>
          <option value={1440}>dias</option>
        </select>
      </div>
      <span className="text-[13px] leading-normal text-muted">
        A espera é conferida a cada poucos minutos. Passando de 24h, a Meta pode recusar a próxima mensagem.
      </span>
    </>
  );
}

function TriggerForm({ meta, setMeta, posts }: { meta: Meta; setMeta: (m: Meta) => void; posts: PostView[] }) {
  const [kw, setKw] = useState(meta.keywords.join(", "));
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? posts : posts.slice(0, 8);
  return (
    <>
      <Field label="Palavras-chave (separe por vírgula)">
        <input
          value={kw}
          placeholder="ex.: LIVRO, EBOOK"
          onChange={(e) => {
            setKw(e.target.value);
            setMeta({ ...meta, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) });
          }}
          className={inputCls}
        />
      </Field>
      <div className="flex gap-0.5 self-start rounded-xl bg-fill p-1">
        {(
          [
            ["exact_word", "Palavra exata"],
            ["contains", "Contém"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMeta({ ...meta, matchMode: k })}
            className="h-9 cursor-pointer rounded-[9px] border-none px-3 text-[13px] font-medium"
            style={{ background: meta.matchMode === k ? "#fff" : "transparent" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Em quais posts</span>
        <div className="flex gap-0.5 self-start rounded-xl bg-fill p-1">
          {(
            [
              ["all_posts", "Todos"],
              ["specific_posts", "Escolher"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMeta({ ...meta, scope: k })}
              className="h-9 cursor-pointer rounded-[9px] border-none px-3 text-[13px] font-medium"
              style={{ background: meta.scope === k ? "#fff" : "transparent" }}
            >
              {label}
            </button>
          ))}
        </div>
        {meta.scope === "specific_posts" ? (
          <div className="flex flex-col gap-1.5">
            {shown.map((p) => {
              const on = meta.postIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMeta({ ...meta, postIds: on ? meta.postIds.filter((x) => x !== p.id) : [...meta.postIds, p.id] })}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border-2 bg-white p-2 text-left text-ink"
                  style={{ borderColor: on ? "var(--color-accent)" : "var(--color-line)" }}
                >
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg" style={{ background: p.tone }}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.caption || p.type}</span>
                  <span className="text-xs text-muted">{p.date}</span>
                </button>
              );
            })}
            {posts.length > 8 && !showAll ? (
              <button type="button" onClick={() => setShowAll(true)} className={`${smallBtn} self-start`}>
                Ver mais
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Responder o comentário em público</span>
        <Switch
          checked={meta.replyEnabled}
          onChange={() => setMeta({ ...meta, replyEnabled: !meta.replyEnabled })}
          label="Responder o comentário em público"
        />
      </div>
      {meta.replyEnabled ? (
        <Field label="Respostas (uma por linha; sorteia uma)">
          <textarea
            value={meta.replyVariants.join("\n")}
            onChange={(e) => setMeta({ ...meta, replyVariants: e.target.value.split("\n").slice(0, 10) })}
            rows={4}
            placeholder={"Te mandei no direct! 📩\nConfere sua caixa de mensagens 😉"}
            className="resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-[15px] leading-normal font-normal text-ink outline-accent"
          />
        </Field>
      ) : null}
    </>
  );
}
