/**
 * Flow graph: the shape a flow is stored in, and the pure rules that walk it.
 *
 * Dependency-free (like lib/automation/matcher.ts) so "where does this person
 * go next?" is unit-testable without a database or Instagram.
 *
 * A flow is nodes + edges. Every edge leaves a node through a named handle:
 *   trigger / action / delay  →  "next"
 *   message                   →  "next" (no buttons) or one handle per postback button
 *   random                    →  one handle per branch
 *   condition                 →  "yes" | "no"
 */

export const NEXT = "next";
export const YES = "yes";
export const NO = "no";

export interface MessageButton {
  id: string;
  label: string;
  /** Set = opens this link (leaves the flow). Unset = postback that continues the flow. */
  url?: string;
}

export interface RandomBranch {
  id: string;
  label: string;
  /** Relative weight: 50/50 and 1/1 are the same split. */
  weight: number;
}

export type ConditionCheck = { kind: "has_tag"; tag: string } | { kind: "is_follower" };

export type FlowNode =
  | { id: string; type: "trigger"; data: Record<string, never> }
  | { id: string; type: "message"; data: { text: string; buttons: MessageButton[] } }
  | { id: string; type: "random"; data: { branches: RandomBranch[] } }
  | { id: string; type: "condition"; data: { check: ConditionCheck } }
  | { id: string; type: "delay"; data: { minutes: number } }
  | { id: string; type: "action"; data: { op: "add_tag" | "remove_tag"; tag: string } };

export type FlowNodeType = FlowNode["type"];

export interface FlowEdge {
  id: string;
  source: string;
  /** Which output of `source` this edge leaves from. Null is read as "next". */
  sourceHandle: string | null;
  target: string;
}

/** Canvas position, kept beside the node so the editor can restore the layout. */
export interface FlowPositions {
  [nodeId: string]: { x: number; y: number };
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  positions?: FlowPositions;
}

export const EMPTY_GRAPH: FlowGraph = {
  nodes: [{ id: "trigger", type: "trigger", data: {} }],
  edges: [],
};

/** A run that revisits more nodes than this is looping; stop it instead of spinning. */
export const MAX_STEPS_PER_RUN = 50;
/** Meta caps template buttons at 3. */
export const MAX_BUTTONS = 3;
export const MAX_DELAY_MINUTES = 60 * 24 * 30;

/** Ids travel inside button payloads separated by ":", so they must not contain it. */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;

export function findNode(graph: FlowGraph, id: string): FlowNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function startNodeId(graph: FlowGraph): string | null {
  return graph.nodes.find((n) => n.type === "trigger")?.id ?? null;
}

/** The node an edge from (`nodeId`, `handle`) points at, or null if the path ends there. */
export function nextNodeId(graph: FlowGraph, nodeId: string, handle: string = NEXT): string | null {
  const edge = graph.edges.find((e) => e.source === nodeId && (e.sourceHandle ?? NEXT) === handle);
  return edge?.target ?? null;
}

/**
 * Weighted pick. `roll` is a number in [0, 1) so tests can pin the outcome;
 * production passes Math.random(). Returns null when there is nothing to pick.
 */
export function pickBranch(branches: RandomBranch[], roll: number): RandomBranch | null {
  const usable = branches.filter((b) => b.weight > 0);
  const total = usable.reduce((sum, b) => sum + b.weight, 0);
  if (total <= 0) return null;
  let acc = 0;
  const target = roll * total;
  for (const b of usable) {
    acc += b.weight;
    if (target < acc) return b;
  }
  return usable[usable.length - 1];
}

/** Handles a node can leave through; the editor draws one connector per entry. */
export function outputHandles(node: FlowNode): string[] {
  switch (node.type) {
    case "message": {
      const taps = node.data.buttons.filter((b) => !b.url).map((b) => b.id);
      return taps.length > 0 ? taps : [NEXT];
    }
    case "random":
      return node.data.branches.map((b) => b.id);
    case "condition":
      return [YES, NO];
    default:
      return [NEXT];
  }
}

export interface GraphIssue {
  nodeId: string | null;
  message: string;
}

/**
 * Everything wrong with a graph that would make it misbehave live. A flow can
 * be saved as a draft with issues, but only a clean one can go live.
 */
export function validateGraph(graph: FlowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();

  const triggers = graph.nodes.filter((n) => n.type === "trigger");
  if (triggers.length !== 1) {
    issues.push({ nodeId: null, message: "O fluxo precisa ter exatamente um gatilho." });
  }

  for (const node of graph.nodes) {
    if (!SAFE_ID.test(node.id)) issues.push({ nodeId: node.id, message: "Identificador de bloco inválido." });
    if (ids.has(node.id)) issues.push({ nodeId: node.id, message: "Bloco duplicado." });
    ids.add(node.id);

    switch (node.type) {
      case "message": {
        if (!node.data.text.trim()) issues.push({ nodeId: node.id, message: "Mensagem sem texto." });
        if (node.data.buttons.length > MAX_BUTTONS) {
          issues.push({ nodeId: node.id, message: `No máximo ${MAX_BUTTONS} botões por mensagem.` });
        }
        for (const b of node.data.buttons) {
          if (!SAFE_ID.test(b.id)) issues.push({ nodeId: node.id, message: "Identificador de botão inválido." });
          if (!b.label.trim()) issues.push({ nodeId: node.id, message: "Botão sem texto." });
          if (b.label.length > 20) issues.push({ nodeId: node.id, message: `Botão "${b.label}" passa de 20 caracteres.` });
        }
        break;
      }
      case "random": {
        if (node.data.branches.length < 2) {
          issues.push({ nodeId: node.id, message: "O sorteio precisa de pelo menos 2 caminhos." });
        }
        if (node.data.branches.some((b) => !SAFE_ID.test(b.id))) {
          issues.push({ nodeId: node.id, message: "Identificador de caminho inválido." });
        }
        if (!node.data.branches.some((b) => b.weight > 0)) {
          issues.push({ nodeId: node.id, message: "Nenhum caminho do sorteio tem chance maior que zero." });
        }
        break;
      }
      case "condition": {
        if (node.data.check.kind === "has_tag" && !node.data.check.tag.trim()) {
          issues.push({ nodeId: node.id, message: "Condição sem tag." });
        }
        break;
      }
      case "delay": {
        const m = node.data.minutes;
        if (!Number.isFinite(m) || m < 1 || m > MAX_DELAY_MINUTES) {
          issues.push({ nodeId: node.id, message: "A espera precisa ser de 1 minuto a 30 dias." });
        }
        break;
      }
      case "action": {
        if (!node.data.tag.trim()) issues.push({ nodeId: node.id, message: "Ação sem tag." });
        break;
      }
    }
  }

  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.source);
    if (!from || !ids.has(edge.target)) {
      issues.push({ nodeId: edge.source, message: "Seta ligada a um bloco que não existe." });
      continue;
    }
    if (!outputHandles(from).includes(edge.sourceHandle ?? NEXT)) {
      issues.push({ nodeId: edge.source, message: "Seta saindo de uma saída que não existe mais." });
    }
  }

  // Two arrows from one output would make the path ambiguous.
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const key = `${edge.source}:${edge.sourceHandle ?? NEXT}`;
    if (seen.has(key)) issues.push({ nodeId: edge.source, message: "Uma saída está ligada a mais de um bloco." });
    seen.add(key);
  }

  return issues;
}

/** Nodes nobody can reach from the trigger: harmless, but worth flagging in the editor. */
export function unreachableNodeIds(graph: FlowGraph): string[] {
  const start = startNodeId(graph);
  if (!start) return graph.nodes.map((n) => n.id);
  const reached = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of graph.edges) {
      if (e.source === cur && !reached.has(e.target)) {
        reached.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return graph.nodes.filter((n) => !reached.has(n.id)).map((n) => n.id);
}
