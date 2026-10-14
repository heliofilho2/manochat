"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast";
import {
  flowWarnings,
  homeOf,
  MATCH,
  MAX_BUTTONS,
  NEXT,
  NO,
  nextNodeId,
  OTHER,
  outputHandles,
  tapButtons,
  unreachableNodeIds,
  validateGraph,
  YES,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type ReplyExpect,
  type TriggerKind,
} from "@/lib/flow/graph";
import type { FlowStats } from "@/lib/flow/stats";
import type { PostView } from "@/lib/posts-view";
import { deleteFlow, saveFlow, setFlowStatus, type FlowInput } from "./actions";

/* ─── catalogue ─────────────────────────────────────────────────────────── */

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Kind = Exclude<FlowNode["type"], "trigger">;

const BLOCKS: { kind: Kind; icon: string; label: string; hint: string; color: string }[] = [
  { kind: "message", icon: "💬", label: "Mensagem", hint: "Texto, imagem, link e botões", color: "#2F6FDE" },
  { kind: "reply", icon: "⌨️", label: "Esperar resposta", hint: "Uma palavra, e-mail, telefone…", color: "#0E8FA8" },
  { kind: "delay", icon: "⏱️", label: "Esperar um tempo", hint: "Continua depois de minutos, horas ou dias", color: "#0F9D58" },
  { kind: "condition", icon: "🔀", label: "Condição", hint: "Clicou no link? Tem tag? Segue?", color: "#D97706" },
  { kind: "random", icon: "🎲", label: "Sorteio A/B", hint: "Divide as pessoas em caminhos", color: "#8B5CF6" },
  { kind: "action", icon: "🏷️", label: "Tag", hint: "Marca a pessoa para filtrar depois", color: "#DB2777" },
];
const META: Record<FlowNode["type"], { icon: string; label: string; color: string }> = {
  trigger: { icon: "⚡", label: "Gatilho", color: "#1B1712" },
  ...Object.fromEntries(BLOCKS.map((b) => [b.kind, { icon: b.icon, label: b.label, color: b.color }])),
} as Record<FlowNode["type"], { icon: string; label: string; color: string }>;

const TRIGGERS: { kind: TriggerKind; icon: string; label: string; hint: string }[] = [
  { kind: "comment", icon: "💬", label: "Comentário", hint: "Alguém comenta a palavra num post ou Reel" },
  { kind: "story", icon: "📱", label: "Resposta ao story", hint: "Alguém responde ou reage a um story" },
  { kind: "dm", icon: "✉️", label: "Palavra no direct", hint: "Alguém manda a palavra no seu direct" },
];

const STATUS: Record<string, { label: string; tone: "ok" | "wait" | "bad" | "muted" }> = {
  running: { label: "Andando", tone: "wait" },
  waiting_tap: { label: "Esperando tocar no botão", tone: "wait" },
  waiting_reply: { label: "Esperando responder", tone: "wait" },
  waiting_delay: { label: "Na espera", tone: "wait" },
  done: { label: "Concluiu", tone: "ok" },
  failed: { label: "Erro", tone: "bad" },
};

function blank(kind: Kind): FlowNode {
  const id = uid("n");
  switch (kind) {
    case "message":
      return { id, type: "message", data: { text: "", buttons: [] } };
    case "reply":
      return { id, type: "reply", data: { expect: "keyword", keywords: [], retryText: "", timeoutMinutes: null } };
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
      return { id, type: "condition", data: { check: { kind: "clicked" } } };
    case "delay":
      return { id, type: "delay", data: { minutes: 60 } };
    case "action":
      return { id, type: "action", data: { op: "add_tag", tag: "" } };
  }
}

/* ─── words for the tree ────────────────────────────────────────────────── */

function fmtMinutes(m: number): string {
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} ${m / 1440 === 1 ? "dia" : "dias"}`;
  if (m >= 60 && m % 60 === 0) return `${m / 60} ${m / 60 === 1 ? "hora" : "horas"}`;
  return `${m} min`;
}

function outputs(node: FlowNode): { id: string; label: string }[] {
  switch (node.type) {
    case "message": {
      const taps = tapButtons(node);
      return taps.length > 0 ? taps.map((b) => ({ id: b.id, label: `Tocou “${b.label || "botão"}”` })) : [{ id: NEXT, label: "" }];
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
        { id: YES, label: "Sim" },
        { id: NO, label: "Não" },
      ];
    case "reply": {
      const right = node.data.expect === "keyword" ? "Respondeu certo" : node.data.expect === "any" ? "Respondeu" : "Resposta válida";
      return outputHandles(node).map((h) => ({
        id: h,
        label: h === MATCH ? right : h === OTHER ? "Outra resposta" : `Não respondeu em ${fmtMinutes(node.data.timeoutMinutes ?? 0)}`,
      }));
    }
    default:
      return [{ id: NEXT, label: "" }];
  }
}

function title(node: FlowNode): string {
  return META[node.type].label;
}

function shortText(node: FlowNode, meta: Meta): string {
  switch (node.type) {
    case "trigger": {
      const t = TRIGGERS.find((x) => x.kind === meta.triggerKind)!;
      const words = meta.keywords.length ? meta.keywords.map((k) => k.toUpperCase()).join(", ") : "";
      if (meta.triggerKind === "story") return words ? `Responde o story com ${words}` : "Responde ou reage a um story";
      return words ? `${t.label}: ${words}` : `${t.label}: defina a palavra`;
    }
    case "message":
      return node.data.text.trim() || "Mensagem sem texto";
    case "reply":
      return node.data.expect === "keyword"
        ? `Espera a pessoa responder ${node.data.keywords.filter(Boolean).map((k) => k.toUpperCase()).join(" ou ") || "…"}`
        : node.data.expect === "email"
          ? "Espera o e-mail da pessoa (vira lead)"
          : node.data.expect === "phone"
            ? "Espera o WhatsApp da pessoa (vira lead)"
            : "Espera qualquer resposta";
    case "delay":
      return `Espera ${fmtMinutes(node.data.minutes)} e continua`;
    case "condition":
      return node.data.check.kind === "clicked"
        ? "A pessoa abriu algum link deste fluxo?"
        : node.data.check.kind === "is_follower"
          ? "A pessoa já segue o perfil?"
          : `A pessoa tem a tag “${node.data.check.tag || "…"}”?`;
    case "random":
      return `Sorteia entre ${node.data.branches.length} caminhos`;
    case "action":
      return `${node.data.op === "add_tag" ? "Adiciona" : "Remove"} a tag “${node.data.tag || "…"}”`;
  }
}

/* ─── shared bits ───────────────────────────────────────────────────────── */

const inputCls =
  "h-[44px] w-full rounded-[11px] border-[1.5px] border-line bg-white px-3 text-[15px] text-ink outline-accent";
const areaCls =
  "w-full resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-[15px] leading-normal text-ink outline-accent";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="text-[13px] leading-normal text-muted">{hint}</span> : null}
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-0.5 self-start rounded-xl bg-fill p-1">
      {options.map(([k, label]) => (
        <button
          key={String(k)}
          type="button"
          onClick={() => onPick(k)}
          className="h-9 cursor-pointer rounded-[9px] border-none px-3 text-[13px] font-semibold whitespace-nowrap"
          style={{ background: value === k ? "#fff" : "transparent", color: value === k ? "var(--color-ink)" : "var(--color-muted)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Words as chips: type and press Enter or comma. */
function WordsInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const words = raw.split(",").map((w) => w.trim()).filter(Boolean);
    if (words.length === 0) return;
    onChange([...new Set([...values, ...words.map((w) => w.toUpperCase())])].slice(0, 20));
    setDraft("");
  };
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-[11px] border-[1.5px] border-line bg-white px-2 py-1.5">
      {values.map((w) => (
        <span key={w} className="flex items-center gap-1 rounded-lg bg-accent-soft py-1 pr-1 pl-2.5 text-[13px] font-bold text-accent-ink-2">
          {w}
          <button
            type="button"
            aria-label={`Remover ${w}`}
            onClick={() => onChange(values.filter((x) => x !== w))}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-base text-accent-ink-2"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={values.length ? "" : placeholder}
        onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        className="h-8 min-w-[120px] flex-1 border-none bg-transparent px-1 text-[15px] text-ink outline-none"
      />
    </div>
  );
}

function DurationInput({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const guess = minutes >= 1440 && minutes % 1440 === 0 ? 1440 : minutes >= 60 && minutes % 60 === 0 ? 60 : 1;
  const [unit, setUnit] = useState(guess);
  const amount = Math.max(1, Math.round(minutes / unit));
  return (
    <div className="flex gap-2">
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1) * unit)}
        className={`${inputCls} w-24`}
      />
      <select
        value={unit}
        onChange={(e) => {
          const next = Number(e.target.value);
          setUnit(next);
          onChange(amount * next);
        }}
        className={inputCls}
      >
        <option value={1}>minutos</option>
        <option value={60}>horas</option>
        <option value={1440}>dias</option>
      </select>
    </div>
  );
}

type Meta = Omit<FlowInput, "graph">;

/* ─── editor ────────────────────────────────────────────────────────────── */

export function FlowEditor({
  flowId,
  status: initialStatus,
  posts,
  stories,
  stats,
  initial,
}: {
  flowId: string;
  status: string;
  posts: PostView[];
  stories: PostView[];
  stats: FlowStats;
  initial: FlowInput;
}) {
  const toast = useToast();
  const [meta, setMeta] = useState<Meta>(() => {
    const { graph: _g, ...rest } = initial;
    void _g;
    return rest;
  });
  const [graph, setGraph] = useState<FlowGraph>(initial.graph);
  const [status, setStatus] = useState(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"build" | "results">("build");
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState<"saved" | "saving" | "error">("saved");

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

  const issues = useMemo(() => validateGraph(graph), [graph]);
  const warnings = useMemo(() => flowWarnings(graph, meta.triggerKind), [graph, meta.triggerKind]);
  const home = useMemo(() => homeOf(graph), [graph]);
  const orphans = useMemo(() => unreachableNodeIds(graph), [graph]);
  const issueCount = (id: string) => issues.filter((i) => i.nodeId === id).length;

  /* graph edits */

  const link = (cur: FlowGraph, source: string, handle: string, target: string): FlowEdge[] => [
    ...cur.edges.filter((e) => !(e.source === source && (e.sourceHandle ?? NEXT) === handle)),
    { id: uid("e"), source, sourceHandle: handle, target },
  ];

  /** Adds a block at an output; when something was already there, the new block goes in between. */
  const addAt = (source: string, handle: string, kind: Kind) => {
    const node = blank(kind);
    setGraph((cur) => {
      const old = nextNodeId(cur, source, handle);
      let edges = link(cur, source, handle, node.id);
      const firstOut = outputHandles(node)[0];
      if (old && firstOut) edges = [...edges, { id: uid("e"), source: node.id, sourceHandle: firstOut, target: old }];
      return { ...cur, nodes: [...cur.nodes, node], edges };
    });
    setSelectedId(node.id);
  };

  const linkTo = (source: string, handle: string, target: string) =>
    setGraph((cur) => ({ ...cur, edges: link(cur, source, handle, target) }));

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

  const removeNode = (id: string) => {
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
      if (!confirm(`Remover este bloco e os ${lost.length} passo(s) que vêm depois dele?`)) return;
      const gone = new Set(lost);
      next = { ...next, nodes: next.nodes.filter((n) => !gone.has(n.id)), edges: next.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)) };
    }
    setGraph(next);
    setSelectedId(null);
  };

  const duplicate = (id: string) => {
    const node = graph.nodes.find((n) => n.id === id);
    if (!node || node.type === "trigger") return;
    const copy = JSON.parse(JSON.stringify(node)) as FlowNode;
    copy.id = uid("n");
    if (copy.type === "message") copy.data.buttons = copy.data.buttons.map((b) => ({ ...b, id: uid("b") }));
    if (copy.type === "random") copy.data.branches = copy.data.branches.map((b) => ({ ...b, id: uid("c") }));
    setGraph((cur) => ({ ...cur, nodes: [...cur.nodes, copy] }));
    setSelectedId(copy.id);
    toast("Cópia criada em “Blocos soltos”. Ligue-a pelo “+” de qualquer saída.");
  };

  const toggleLive = async () => {
    setProblems([]);
    // Flush pending edits so the server validates what the screen shows.
    await saveFlow(flowId, { ...meta, graph });
    const r = await setFlowStatus(flowId, status === "live" ? "paused" : "live");
    if (r.ok) {
      setStatus(r.status);
      toast(r.status === "live" ? "Fluxo no ar! 🚀" : "Fluxo pausado.");
    } else {
      setProblems(r.problems);
    }
  };

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const ctx: TreeCtx = { graph, meta, home, stats, selectedId, select: setSelectedId, issueCount, addAt, linkTo, unlink };

  return (
    <div className="animate-up flex flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href="/fluxos" className="flex h-8 items-center self-start text-sm font-medium text-muted">
            ← Fluxos
          </Link>
          <input
            value={meta.name}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            maxLength={80}
            aria-label="Nome do fluxo"
            className="-ml-2 h-12 w-full max-w-[560px] rounded-xl border-[1.5px] border-transparent bg-transparent px-2 text-[clamp(24px,3.5vw,32px)] font-bold tracking-[-0.02em] text-ink outline-accent hover:border-line"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] text-muted">
            {saving === "saving" ? "Salvando…" : saving === "error" ? "⚠️ Não salvou" : "✓ Salvo"}
          </span>
          <span
            className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
            style={{
              background: status === "live" ? "var(--color-success-bg)" : "var(--color-fill)",
              color: status === "live" ? "var(--color-success-ink)" : "var(--color-muted)",
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: status === "live" ? "var(--color-success)" : "var(--color-muted-2)" }} />
            {status === "live" ? "No ar" : status === "paused" ? "Pausado" : "Rascunho"}
          </span>
          <button
            type="button"
            onClick={toggleLive}
            className="h-11 cursor-pointer rounded-xl border-none px-5 text-sm font-semibold"
            style={{ background: status === "live" ? "var(--color-fill)" : "var(--color-ink)", color: status === "live" ? "var(--color-ink)" : "#fff" }}
          >
            {status === "live" ? "Pausar" : "Colocar no ar"}
          </button>
        </div>
      </div>

      {problems.length > 0 ? (
        <Notice tone="bad" title="Falta pouco para colocar no ar:" items={problems} onClose={() => setProblems([])} />
      ) : null}
      {warnings.length > 0 ? <Notice tone="warn" title="Atenção com as regras do Instagram:" items={warnings} /> : null}

      <div className="flex items-center justify-between gap-3">
        <Segmented
          value={tab}
          onPick={setTab}
          options={[
            ["build", "Construtor"],
            ["results", `Resultados${stats.total ? ` · ${stats.total}` : ""}`],
          ]}
        />
        {tab === "build" && status !== "live" ? (
          <span className="hidden text-[13px] text-muted min-[700px]:block">
            Dica: teste com uma palavra só sua antes de divulgar.
          </span>
        ) : null}
      </div>

      {tab === "build" ? (
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1 overflow-x-auto rounded-[22px] border border-line bg-[radial-gradient(circle,var(--color-line)_1px,transparent_1px)] [background-size:22px_22px] px-4 py-8">
            <div className="mx-auto flex w-max min-w-full flex-col items-center">
              <Tree id={graph.nodes.find((n) => n.type === "trigger")?.id ?? "trigger"} ctx={ctx} />
            </div>
            {orphans.length > 0 ? (
              <div className="mt-10 flex flex-col items-center gap-3 border-t border-dashed border-line-dashed pt-6">
                <span className="text-[13px] font-semibold text-muted">
                  Blocos soltos (ninguém chega neles). Ligue pelo “+” de uma saída ou remova.
                </span>
                <div className="flex flex-wrap justify-center gap-3">
                  {orphans.map((id) => (
                    <Tree key={id} id={id} ctx={ctx} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Desktop: side panel. Phone: a sheet over the tree while a block is open. */}
          <aside
            className={`flex-col gap-4 bg-white min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:flex min-[1100px]:max-h-[calc(100vh-48px)] min-[1100px]:w-[390px] min-[1100px]:shrink-0 min-[1100px]:overflow-y-auto min-[1100px]:rounded-[22px] min-[1100px]:border min-[1100px]:border-line min-[1100px]:p-5 ${
              selected
                ? "max-[1099px]:fixed max-[1099px]:inset-x-0 max-[1099px]:top-[8vh] max-[1099px]:bottom-0 max-[1099px]:z-50 max-[1099px]:flex max-[1099px]:overflow-y-auto max-[1099px]:rounded-t-[26px] max-[1099px]:p-5 max-[1099px]:shadow-[0_-12px_40px_rgba(27,23,18,.25)]"
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
                issues={issues.filter((i) => i.nodeId === selected.id).map((i) => i.message)}
                onChange={updateNode}
                onRemove={() => removeNode(selected.id)}
                onDuplicate={() => duplicate(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
                <span className="text-base font-bold text-ink">Como montar</span>
                <span>
                  <b className="text-ink">Clique num bloco</b> para editar o texto, os botões e as opções dele.
                </span>
                <span>
                  <b className="text-ink">Clique no “+”</b> embaixo de um bloco para escolher o próximo passo. O “+”
                  em cima de uma linha coloca um passo no meio.
                </span>
                <span>
                  Botões que <b className="text-ink">continuam o fluxo</b> abrem um caminho para cada um. Botões de{" "}
                  <b className="text-ink">link</b> só abrem a página, e os cliques aparecem em Resultados.
                </span>
                <span>
                  Escreva <b className="text-ink">{"{usuario}"}</b> numa mensagem para chamar a pessoa pelo @.
                </span>
              </div>
            )}
          </aside>
          {selected ? (
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setSelectedId(null)}
              className="fixed inset-0 z-40 border-none bg-[rgba(27,23,18,.35)] min-[1100px]:hidden"
            />
          ) : null}
        </div>
      ) : (
        <Results graph={graph} stats={stats} />
      )}

      <form
        action={deleteFlow.bind(null, flowId)}
        onSubmit={(e) => {
          if (!confirm("Apagar este fluxo? Quem está no meio dele deixa de receber os próximos passos.")) e.preventDefault();
        }}
        className="pt-2"
      >
        <button type="submit" className="h-10 cursor-pointer border-none bg-transparent px-1 text-sm font-medium text-danger">
          Apagar fluxo
        </button>
      </form>
    </div>
  );
}

function Notice({ tone, title: heading, items, onClose }: { tone: "bad" | "warn"; title: string; items: string[]; onClose?: () => void }) {
  const c = tone === "bad" ? ["#F2C4C4", "#FDF1F1", "#8A1F1F"] : ["#EBDDB0", "#FBF6E6", "#6B5311"];
  return (
    <div className="flex gap-3 rounded-[16px] border px-4 py-3 text-sm" style={{ borderColor: c[0], background: c[1], color: c[2] }}>
      <div className="flex-1">
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

/* ─── tree ──────────────────────────────────────────────────────────────── */

interface TreeCtx {
  graph: FlowGraph;
  meta: Meta;
  home: Map<string, string>;
  stats: FlowStats;
  selectedId: string | null;
  select: (id: string) => void;
  issueCount: (id: string) => number;
  addAt: (source: string, handle: string, kind: Kind) => void;
  linkTo: (source: string, handle: string, target: string) => void;
  unlink: (source: string, handle: string) => void;
}

const Line = ({ h = 22 }: { h?: number }) => <span className="block w-0.5 bg-line-strong" style={{ height: h }} />;

function Tree({ id, ctx }: { id: string; ctx: TreeCtx }) {
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
              <div key={o.id} className="relative flex flex-col items-center px-3">
                {/* the horizontal rail joining the branches */}
                {i > 0 ? <span className="absolute top-0 left-0 h-0.5 w-1/2 bg-line-strong" /> : null}
                {i < outs.length - 1 ? <span className="absolute top-0 right-0 h-0.5 w-1/2 bg-line-strong" /> : null}
                <Line h={12} />
                <span className="max-w-[220px] truncate rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-ink-2 shadow-sm">
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

/** What hangs under one output: the next block, a "go to" link, or the "+" to add one. */
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
        <span className="flex items-center gap-1 rounded-xl border border-dashed border-line-dashed bg-white py-1 pr-1 pl-3 text-[13px] font-semibold text-ink-2">
          <button type="button" onClick={() => ctx.select(target)} className="cursor-pointer border-none bg-transparent p-0 text-left font-semibold text-ink-2">
            ↪ Volta para: {t ? `${META[t.type].icon} ${shortText(t, ctx.meta).slice(0, 34)}` : "bloco"}
          </button>
          <button
            type="button"
            aria-label="Desfazer ligação"
            onClick={() => ctx.unlink(source, handle)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-base text-muted"
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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setJump(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const targets = ctx.graph.nodes.filter((n) => n.type !== "trigger" && n.id !== source);

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      {big ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line-dashed bg-white px-3.5 text-[13px] font-semibold text-ink-2 hover:border-accent hover:text-accent-ink"
        >
          <span className="text-lg leading-none">+</span> Próximo passo
        </button>
      ) : (
        <button
          type="button"
          aria-label="Colocar um passo aqui"
          title="Colocar um passo aqui"
          onClick={() => setOpen((o) => !o)}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-line-strong bg-white text-sm leading-none text-muted hover:border-accent hover:text-accent-ink"
        >
          +
        </button>
      )}
      {open ? (
        <div className="absolute top-full z-30 mt-2 flex w-[290px] flex-col gap-0.5 rounded-2xl border border-line bg-white p-1.5 text-left shadow-[0_16px_40px_rgba(27,23,18,.16)]">
          {!jump ? (
            <>
              {BLOCKS.map((b) => (
                <button
                  key={b.kind}
                  type="button"
                  onClick={() => {
                    ctx.addAt(source, handle, b.kind);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-2.5 py-2 text-left hover:bg-bg"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-lg" style={{ background: `${b.color}1A` }}>
                    {b.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{b.label}</span>
                    <span className="text-xs text-muted">{b.hint}</span>
                  </span>
                </button>
              ))}
              {targets.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setJump(true)}
                  className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border-t border-none border-line-soft bg-transparent px-2.5 py-2 text-left hover:bg-bg"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-fill text-lg">↪</span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">Voltar para um bloco</span>
                    <span className="text-xs text-muted">Ex.: perguntar de novo</span>
                  </span>
                </button>
              ) : null}
            </>
          ) : (
            <>
              <span className="px-2.5 pt-1.5 pb-1 text-xs font-semibold text-muted">Ir para qual bloco?</span>
              <div className="flex max-h-[300px] flex-col overflow-y-auto">
                {targets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      ctx.linkTo(source, handle, t.id);
                      setOpen(false);
                      setJump(false);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border-none bg-transparent px-2.5 py-2 text-left text-[13px] hover:bg-bg"
                  >
                    <span>{META[t.type].icon}</span>
                    <span className="truncate text-ink">{shortText(t, ctx.meta)}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setJump(false)} className="h-9 cursor-pointer border-none bg-transparent text-[13px] font-semibold text-muted">
                ← Voltar
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Card({ node, ctx }: { node: FlowNode; ctx: TreeCtx }) {
  const m = META[node.type];
  const selected = ctx.selectedId === node.id;
  const bad = ctx.issueCount(node.id);
  const reached = ctx.stats.reached[node.id];
  return (
    <button
      type="button"
      onClick={() => ctx.select(node.id)}
      className="flex w-[270px] cursor-pointer flex-col overflow-hidden rounded-[18px] border-2 bg-white p-0 text-left text-ink shadow-[0_6px_18px_rgba(27,23,18,.07)] transition-shadow hover:shadow-[0_10px_26px_rgba(27,23,18,.12)]"
      style={{ borderColor: selected ? "var(--color-accent)" : bad ? "#E25555" : "var(--color-line)" }}
    >
      <span className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[15px]" style={{ background: `${m.color}1A` }}>
          {m.icon}
        </span>
        <span className="flex-1 text-[13px] font-bold tracking-[0.01em]" style={{ color: m.color }}>
          {node.type === "trigger" ? TRIGGERS.find((t) => t.kind === ctx.meta.triggerKind)?.label : title(node)}
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
      <span className="line-clamp-4 px-3.5 pb-3 text-sm leading-snug whitespace-pre-line text-ink-2">{shortText(node, ctx.meta)}</span>
      {node.type === "message" && (node.data.imageUrl || node.data.buttons.length > 0) ? (
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
        </span>
      ) : null}
    </button>
  );
}

/* ─── side panel ────────────────────────────────────────────────────────── */

function Panel({
  node,
  meta,
  setMeta,
  posts,
  stories,
  issues,
  onChange,
  onRemove,
  onDuplicate,
  onClose,
}: {
  node: FlowNode;
  meta: Meta;
  setMeta: (m: Meta) => void;
  posts: PostView[];
  stories: PostView[];
  issues: string[];
  onChange: (n: FlowNode) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const m = META[node.type];
  return (
    <>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lg" style={{ background: `${m.color}1A` }}>
          {m.icon}
        </span>
        <h2 className="m-0 flex-1 text-lg font-bold tracking-[-0.01em]">{node.type === "trigger" ? "O que começa o fluxo" : m.label}</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border-none bg-fill text-lg">
          ×
        </button>
      </div>

      {issues.length > 0 ? (
        <ul className="m-0 flex list-disc flex-col gap-1 rounded-xl bg-[#FDF1F1] py-2.5 pr-3 pl-7 text-[13px] leading-normal text-[#8A1F1F]">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}

      {node.type === "trigger" ? <TriggerForm meta={meta} setMeta={setMeta} posts={posts} stories={stories} /> : null}
      {node.type === "message" ? <MessageForm node={node} onChange={onChange} /> : null}
      {node.type === "reply" ? <ReplyForm node={node} onChange={onChange} /> : null}

      {node.type === "delay" ? (
        <Field label="Quanto tempo esperar" hint="Depois desse tempo o fluxo segue para o próximo passo sozinho. Passando de 24h, a Meta pode recusar a mensagem seguinte.">
          <DurationInput minutes={node.data.minutes} onChange={(minutes) => onChange({ ...node, data: { minutes } })} />
        </Field>
      ) : null}

      {node.type === "condition" ? (
        <>
          <Field label="Pergunta" hint="A pessoa segue pelo caminho “Sim” ou “Não”.">
            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["clicked", "🔗 Abriu algum link deste fluxo?"],
                  ["has_tag", "🏷️ Tem uma tag?"],
                  ["is_follower", "👤 Já segue o perfil?"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    onChange({ ...node, data: { check: k === "has_tag" ? { kind: "has_tag", tag: "" } : { kind: k } } })
                  }
                  className="flex h-11 cursor-pointer items-center rounded-xl border-2 bg-white px-3 text-left text-sm font-semibold text-ink"
                  style={{ borderColor: node.data.check.kind === k ? "var(--color-accent)" : "var(--color-line)" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          {node.data.check.kind === "has_tag" ? (
            <Field label="Qual tag">
              <input
                value={node.data.check.tag}
                maxLength={60}
                placeholder="ex.: comprou"
                onChange={(e) => onChange({ ...node, data: { check: { kind: "has_tag", tag: e.target.value } } })}
                className={inputCls}
              />
            </Field>
          ) : null}
          {node.data.check.kind === "clicked" ? (
            <span className="text-[13px] leading-normal text-muted">
              Ótimo depois de uma espera: quem não abriu a oferta recebe um lembrete, quem abriu recebe outra mensagem.
            </span>
          ) : null}
        </>
      ) : null}

      {node.type === "random" ? (
        <>
          <span className="text-[13px] leading-normal text-muted">
            Cada pessoa cai num caminho ao acaso, na proporção abaixo. Em Resultados você compara quantos abriram o link em cada
            caminho.
          </span>
          {node.data.branches.map((b, i) => {
            const total = node.data.branches.reduce((s, x) => s + Math.max(0, x.weight), 0) || 1;
            return (
              <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={b.label}
                    maxLength={40}
                    aria-label="Nome do caminho"
                    onChange={(e) =>
                      onChange({ ...node, data: { branches: node.data.branches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } })
                    }
                    className={inputCls}
                  />
                  {node.data.branches.length > 2 ? (
                    <button
                      type="button"
                      aria-label="Remover caminho"
                      onClick={() => onChange({ ...node, data: { branches: node.data.branches.filter((_, j) => j !== i) } })}
                      className="h-10 w-10 shrink-0 cursor-pointer border-none bg-transparent text-xl text-danger"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={b.weight}
                    aria-label="Chance"
                    onChange={(e) =>
                      onChange({ ...node, data: { branches: node.data.branches.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)) } })
                    }
                    className="flex-1 accent-accent"
                  />
                  <span className="w-12 text-right text-sm font-bold">{Math.round((Math.max(0, b.weight) / total) * 100)}%</span>
                </div>
              </div>
            );
          })}
          {node.data.branches.length < 6 ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...node,
                  data: { branches: [...node.data.branches, { id: uid("c"), label: `Caminho ${String.fromCharCode(65 + node.data.branches.length)}`, weight: 50 }] },
                })
              }
              className="h-11 cursor-pointer self-start rounded-xl border-[1.5px] border-dashed border-line-dashed bg-transparent px-4 text-sm font-semibold"
            >
              + Caminho
            </button>
          ) : null}
        </>
      ) : null}

      {node.type === "action" ? (
        <>
          <Segmented
            value={node.data.op}
            onPick={(op) => onChange({ ...node, data: { ...node.data, op } })}
            options={[
              ["add_tag", "Adicionar tag"],
              ["remove_tag", "Remover tag"],
            ]}
          />
          <Field label="Tag" hint="Use tags para separar quem comprou, quem teve dúvida etc. Uma Condição pode olhar para elas depois.">
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

      {node.type !== "trigger" ? (
        <div className="mt-2 flex gap-2 border-t border-line-soft pt-4">
          <button type="button" onClick={onDuplicate} className="h-10 cursor-pointer rounded-[10px] border border-line bg-white px-3.5 text-[13px] font-semibold">
            Duplicar
          </button>
          <button type="button" onClick={onRemove} className="h-10 cursor-pointer rounded-[10px] border-none bg-transparent px-2 text-[13px] font-semibold text-danger">
            Remover bloco
          </button>
        </div>
      ) : null}
    </>
  );
}

function TriggerForm({ meta, setMeta, posts, stories }: { meta: Meta; setMeta: (m: Meta) => void; posts: PostView[]; stories: PostView[] }) {
  const [more, setMore] = useState(false);
  const list = meta.triggerKind === "story" ? stories : posts;
  const shown = more ? list : list.slice(0, 8);
  const what = meta.triggerKind === "story" ? "stories" : "posts";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {TRIGGERS.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => setMeta({ ...meta, triggerKind: t.kind, scope: "all_posts", postIds: [] })}
            className="flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5 text-left text-ink"
            style={{ borderColor: meta.triggerKind === t.kind ? "var(--color-accent)" : "var(--color-line)" }}
          >
            <span className="text-xl">{t.icon}</span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-xs text-muted">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <Field
        label={meta.triggerKind === "story" ? "Palavras (opcional)" : "Palavras-chave"}
        hint={
          meta.triggerKind === "story"
            ? "Sem palavras, qualquer resposta ou reação ao story começa o fluxo."
            : "Digite e aperte Enter. Maiúsculas, acentos e emojis em volta não atrapalham."
        }
      >
        <WordsInput values={meta.keywords} onChange={(keywords) => setMeta({ ...meta, keywords })} placeholder="ex.: QUERO" />
      </Field>
      <Segmented
        value={meta.matchMode}
        onPick={(matchMode) => setMeta({ ...meta, matchMode })}
        options={[
          ["exact_word", "Palavra exata"],
          ["contains", "Contém o texto"],
        ]}
      />

      {meta.triggerKind !== "dm" ? (
        <Field label={`Em quais ${what}`}>
          <Segmented
            value={meta.scope}
            onPick={(scope) => setMeta({ ...meta, scope })}
            options={[
              ["all_posts", `Todos os ${what}`],
              ["specific_posts", "Escolher"],
            ]}
          />
          {meta.scope === "specific_posts" ? (
            <div className="flex flex-col gap-1.5">
              {list.length === 0 ? (
                <span className="text-[13px] text-muted">
                  {meta.triggerKind === "story" ? "Nenhum story no ar agora (stories somem em 24h)." : "Nenhum post encontrado."}
                </span>
              ) : null}
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
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg" style={{ background: p.tone }}>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.caption || p.type}</span>
                    <span className="text-xs text-muted">{on ? "✓" : p.date}</span>
                  </button>
                );
              })}
              {list.length > 8 && !more ? (
                <button type="button" onClick={() => setMore(true)} className="h-9 cursor-pointer self-start rounded-[9px] border border-line bg-white px-3 text-xs font-semibold">
                  Ver mais
                </button>
              ) : null}
            </div>
          ) : null}
        </Field>
      ) : null}

      {meta.triggerKind === "comment" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Responder o comentário em público</span>
            <Switch checked={meta.replyEnabled} onChange={() => setMeta({ ...meta, replyEnabled: !meta.replyEnabled })} label="Responder o comentário em público" />
          </div>
          {meta.replyEnabled ? (
            <Field label="Respostas (uma por linha)" hint="Uma é sorteada a cada comentário. Variar evita parecer spam para o Instagram.">
              <textarea
                value={meta.replyVariants.join("\n")}
                onChange={(e) => setMeta({ ...meta, replyVariants: e.target.value.split("\n").slice(0, 10) })}
                rows={4}
                placeholder={"Te mandei no direct! 📩\nConfere sua caixa de mensagens 😉"}
                className={areaCls}
              />
            </Field>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function MessageForm({ node, onChange }: { node: Extract<FlowNode, { type: "message" }>; onChange: (n: FlowNode) => void }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const set = (data: Partial<typeof node.data>) => onChange({ ...node, data: { ...node.data, ...data } });
  const setButton = (i: number, b: (typeof node.data.buttons)[number]) => set({ buttons: node.data.buttons.map((x, j) => (j === i ? b : x)) });
  const [showImage, setShowImage] = useState(node.data.imageUrl !== undefined);

  const insertName = () => {
    const el = area.current;
    const at = el?.selectionStart ?? node.data.text.length;
    set({ text: `${node.data.text.slice(0, at)}{usuario}${node.data.text.slice(at)}` });
  };

  return (
    <>
      <Field label="Texto">
        <textarea
          ref={area}
          value={node.data.text}
          onChange={(e) => set({ text: e.target.value })}
          rows={5}
          maxLength={640}
          placeholder="Oi {usuario}! Aqui está o que você pediu…"
          className={areaCls}
        />
        <div className="flex items-center justify-between">
          <button type="button" onClick={insertName} className="h-8 cursor-pointer rounded-lg border border-line bg-white px-2.5 text-xs font-semibold">
            + {"{usuario}"}
          </button>
          <span className="text-xs text-muted">{node.data.text.length}/640</span>
        </div>
      </Field>

      {showImage ? (
        <Field label="Imagem (link)" hint="Cole o link de uma imagem pública (.jpg ou .png). Ela vai antes do texto.">
          <div className="flex gap-2">
            <input
              value={node.data.imageUrl ?? ""}
              placeholder="https://…/imagem.jpg"
              onChange={(e) => set({ imageUrl: e.target.value })}
              className={inputCls}
            />
            <button
              type="button"
              aria-label="Tirar imagem"
              onClick={() => {
                const { imageUrl: _i, ...rest } = node.data;
                void _i;
                onChange({ ...node, data: rest });
                setShowImage(false);
              }}
              className="h-11 w-10 shrink-0 cursor-pointer border-none bg-transparent text-xl text-danger"
            >
              ×
            </button>
          </div>
          {node.data.imageUrl && /^https?:\/\//.test(node.data.imageUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.data.imageUrl} alt="" className="max-h-40 self-start rounded-xl border border-line object-contain" />
          ) : null}
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowImage(true);
            set({ imageUrl: "" });
          }}
          className="h-10 cursor-pointer self-start rounded-[10px] border border-line bg-white px-3 text-[13px] font-semibold"
        >
          🖼️ Adicionar imagem
        </button>
      )}

      <Field label={`Botões (até ${MAX_BUTTONS})`}>
        {node.data.buttons.map((b, i) => (
          <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <div className="flex items-center gap-2">
              <input
                value={b.label}
                maxLength={20}
                placeholder="Texto do botão"
                onChange={(e) => setButton(i, { ...b, label: e.target.value })}
                className={inputCls}
              />
              <button
                type="button"
                aria-label="Remover botão"
                onClick={() => set({ buttons: node.data.buttons.filter((_, j) => j !== i) })}
                className="h-11 w-10 shrink-0 cursor-pointer border-none bg-transparent text-xl text-danger"
              >
                ×
              </button>
            </div>
            <Segmented
              value={b.url === undefined ? "tap" : "link"}
              onPick={(v) => setButton(i, v === "tap" ? { id: b.id, label: b.label } : { ...b, url: b.url ?? "" })}
              options={[
                ["link", "🔗 Abre um link"],
                ["tap", "➡️ Continua o fluxo"],
              ]}
            />
            {b.url !== undefined ? (
              <input value={b.url} maxLength={500} placeholder="https://…" onChange={(e) => setButton(i, { ...b, url: e.target.value })} className={inputCls} />
            ) : (
              <span className="text-xs leading-normal text-muted">Abre um caminho próprio no fluxo. Use para “Quero o link”, “Sim/Não”…</span>
            )}
          </div>
        ))}
        {node.data.buttons.length < MAX_BUTTONS ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set({ buttons: [...node.data.buttons, { id: uid("b"), label: "", url: "" }] })}
              className="h-10 cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-line-dashed bg-transparent px-3 text-[13px] font-semibold"
            >
              + Botão de link
            </button>
            <button
              type="button"
              onClick={() => set({ buttons: [...node.data.buttons, { id: uid("b"), label: "" }] })}
              className="h-10 cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-line-dashed bg-transparent px-3 text-[13px] font-semibold"
            >
              + Botão de resposta
            </button>
          </div>
        ) : null}
      </Field>
    </>
  );
}

function ReplyForm({ node, onChange }: { node: Extract<FlowNode, { type: "reply" }>; onChange: (n: FlowNode) => void }) {
  const set = (data: Partial<typeof node.data>) => onChange({ ...node, data: { ...node.data, ...data } });
  return (
    <>
      <span className="text-[13px] leading-normal text-muted">
        O fluxo para aqui até a pessoa escrever no direct. Pedir uma resposta é o jeito de liberar mais mensagens depois de um
        comentário: o Instagram só deixa continuar a conversa quando a pessoa responde.
      </span>
      <Field label="O que você espera">
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["keyword", "🔑 Uma palavra"],
              ["any", "💬 Qualquer resposta"],
              ["email", "📧 E-mail"],
              ["phone", "📱 WhatsApp"],
            ] as [ReplyExpect, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ expect: k })}
              className="flex h-11 cursor-pointer items-center justify-center rounded-xl border-2 bg-white px-2 text-[13px] font-semibold text-ink"
              style={{ borderColor: node.data.expect === k ? "var(--color-accent)" : "var(--color-line)" }}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      {node.data.expect === "keyword" ? (
        <Field label="Palavra que libera" hint="Vale se a resposta contiver a palavra, sem ligar para maiúsculas e acentos.">
          <WordsInput values={node.data.keywords} onChange={(keywords) => set({ keywords })} placeholder="ex.: MATERIAL" />
        </Field>
      ) : null}
      {node.data.expect === "email" || node.data.expect === "phone" ? (
        <span className="rounded-xl bg-bg px-3 py-2.5 text-[13px] leading-normal text-ink-2">
          Respostas válidas viram um lead em <b>Leads</b> (e vão para o seu webhook, se tiver).
        </span>
      ) : null}
      {node.data.expect !== "any" ? (
        <Field
          label="Se responder outra coisa"
          hint="Se a saída “Outra resposta” não estiver ligada a nada, o fluxo manda este texto e continua esperando."
        >
          <textarea
            value={node.data.retryText}
            onChange={(e) => set({ retryText: e.target.value })}
            rows={2}
            maxLength={640}
            placeholder={node.data.expect === "keyword" ? "Quase! É só responder com a palavra 😉" : "Não entendi 😅 Pode mandar de novo?"}
            className={areaCls}
          />
        </Field>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Prazo para responder</span>
        <Switch
          checked={node.data.timeoutMinutes !== null}
          onChange={() => set({ timeoutMinutes: node.data.timeoutMinutes === null ? 720 : null })}
          label="Prazo para responder"
        />
      </div>
      {node.data.timeoutMinutes !== null ? (
        <Field label="Se não responder em" hint="Abre a saída “Não respondeu”, para mandar um lembrete, por exemplo.">
          <DurationInput minutes={node.data.timeoutMinutes} onChange={(m) => set({ timeoutMinutes: m })} />
        </Field>
      ) : null}
    </>
  );
}

/* ─── results ───────────────────────────────────────────────────────────── */

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

function Results({ graph, stats }: { graph: FlowGraph; stats: FlowStats }) {
  const waiting = (stats.byStatus.waiting_tap ?? 0) + (stats.byStatus.waiting_reply ?? 0) + (stats.byStatus.waiting_delay ?? 0) + (stats.byStatus.running ?? 0);
  const nodeText = (id: string | null) => {
    const n = id ? graph.nodes.find((x) => x.id === id) : null;
    return n ? `${META[n.type].icon} ${n.type === "message" ? n.data.text.slice(0, 40) || "Mensagem" : META[n.type].label}` : "—";
  };
  const links = graph.nodes.flatMap((n) =>
    n.type === "message" ? n.data.buttons.filter((b) => b.url !== undefined).map((b) => ({ key: `${n.id}.${b.id}`, label: b.label || "Botão", where: n.data.text })) : [],
  );

  if (stats.total === 0) {
    return (
      <div className="rounded-[22px] border border-line bg-white p-8 text-center text-sm leading-relaxed text-muted">
        Ninguém passou por este fluxo ainda. Coloque no ar e teste comentando de outra conta; os números aparecem aqui (recarregue a
        página para atualizar).
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {tile("Pessoas que entraram", stats.total)}
        {tile("Concluíram", stats.byStatus.done ?? 0, "var(--color-success-ink)")}
        {tile("No meio do caminho", waiting)}
        {tile("Com erro", stats.byStatus.failed ?? 0, stats.byStatus.failed ? "#B42318" : undefined)}
      </div>

      {stats.ab.map((ab) => {
        const best = Math.max(...ab.branches.map((b) => (b.people ? b.clicked / b.people : 0)));
        return (
          <section key={ab.nodeId} className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
            <h3 className="m-0 text-base font-bold">🎲 Teste A/B</h3>
            <div className="flex flex-col gap-2">
              {ab.branches.map((b) => {
                const rate = b.people ? b.clicked / b.people : 0;
                return (
                  <div key={b.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">
                        {b.label} {rate > 0 && rate === best ? "🏆" : ""}
                      </span>
                      <span className="text-muted">
                        {b.people} pessoas · {b.clicked} abriram o link · <b className="text-ink">{Math.round(rate * 100)}%</b>
                      </span>
                    </div>
                    <span className="block h-2.5 overflow-hidden rounded-full bg-fill">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(rate * 100)}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
            <span className="text-xs leading-normal text-muted">
              “Abriram o link” conta quem tocou em qualquer botão de link do fluxo. Para vendas, compare também no seu checkout.
            </span>
          </section>
        );
      })}

      {links.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-[20px] border border-line bg-white p-5">
          <h3 className="m-0 text-base font-bold">🔗 Cliques nos links</h3>
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
          const color = s.tone === "ok" ? "var(--color-success-ink)" : s.tone === "bad" ? "#B42318" : s.tone === "wait" ? "var(--color-accent-ink)" : "var(--color-muted)";
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
