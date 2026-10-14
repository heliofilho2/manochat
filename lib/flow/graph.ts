/**
 * Flow graph: the shape a flow is stored in, and the pure rules that walk it.
 *
 * Dependency-free (only the other pure matchers) so "where does this person
 * go next?" is unit-testable without a database or Instagram.
 *
 * A flow is nodes + edges. Every edge leaves a node through a named handle:
 *   trigger / action / delay  →  "next"
 *   message                   →  "next" (no tap buttons) or one handle per tap button
 *   random                    →  one handle per branch
 *   condition                 →  "yes" | "no"
 *   reply                     →  "match" | "other" (not for "any") | "timeout" (when it has one)
 */

import { matchKeyword } from "@/lib/automation/matcher";
import { parseEmail, parsePhone } from "@/lib/automation/story";

export const NEXT = "next";
export const YES = "yes";
export const NO = "no";
export const MATCH = "match";
export const OTHER = "other";
export const TIMEOUT = "timeout";

/** What starts a flow. */
export type TriggerKind = "comment" | "story" | "dm";
export const TRIGGER_KINDS: readonly TriggerKind[] = ["comment", "story", "dm"];

export interface MessageButton {
  id: string;
  label: string;
  /** Set = opens this link (tracked). Unset = tap button that continues the flow. */
  url?: string;
}

export interface RandomBranch {
  id: string;
  label: string;
  /** Relative weight: 50/50 and 1/1 are the same split. */
  weight: number;
}

export type ConditionCheck =
  | { kind: "has_tag"; tag: string }
  | { kind: "is_follower" }
  /** Whether the person opened any link this flow sent them. */
  | { kind: "clicked" };

export type ReplyExpect = "keyword" | "any" | "email" | "phone";

export type FlowNode =
  | { id: string; type: "trigger"; data: Record<string, never> }
  | {
      id: string;
      type: "message";
      data: { text: string; buttons: MessageButton[]; imageUrl?: string };
    }
  | { id: string; type: "random"; data: { branches: RandomBranch[] } }
  | { id: string; type: "condition"; data: { check: ConditionCheck } }
  | { id: string; type: "delay"; data: { minutes: number } }
  | { id: string; type: "action"; data: { op: "add_tag" | "remove_tag"; tag: string } }
  | {
      id: string;
      type: "reply";
      data: {
        expect: ReplyExpect;
        /** For "keyword": any of these words releases the "match" path. */
        keywords: string[];
        /** Sent when the answer doesn't fit and "other" leads nowhere; the block keeps waiting. */
        retryText: string;
        /** Null = wait forever. Otherwise the "timeout" path fires after this. */
        timeoutMinutes: number | null;
      };
    };

export type FlowNodeType = FlowNode["type"];

export interface FlowEdge {
  id: string;
  source: string;
  /** Which output of `source` this edge leaves from. Null is read as "next". */
  sourceHandle: string | null;
  target: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Legacy canvas positions; the builder lays the tree out by itself now. */
  positions?: Record<string, { x: number; y: number }>;
}

export const EMPTY_GRAPH: FlowGraph = {
  nodes: [{ id: "trigger", type: "trigger", data: {} }],
  edges: [],
};

/** A run that walks more blocks than this in one go is looping; stop it instead of spinning. */
export const MAX_STEPS_PER_RUN = 50;
/** Meta caps template buttons at 3. */
export const MAX_BUTTONS = 3;
export const MAX_DELAY_MINUTES = 60 * 24 * 30;
/** Meta's standard messaging window. */
export const WINDOW_MINUTES = 24 * 60;

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

/** Tap buttons (the ones that continue the flow). */
export function tapButtons(node: Extract<FlowNode, { type: "message" }>): MessageButton[] {
  return node.data.buttons.filter((b) => b.url === undefined);
}

/** Handles a node can leave through, in display order. */
export function outputHandles(node: FlowNode): string[] {
  switch (node.type) {
    case "message": {
      const taps = tapButtons(node).map((b) => b.id);
      return taps.length > 0 ? taps : [NEXT];
    }
    case "random":
      return node.data.branches.map((b) => b.id);
    case "condition":
      return [YES, NO];
    case "reply": {
      const out = node.data.expect === "any" ? [MATCH] : [MATCH, OTHER];
      return node.data.timeoutMinutes ? [...out, TIMEOUT] : out;
    }
    default:
      return [NEXT];
  }
}

/**
 * Where an answer to a "reply" block leads, and the value worth keeping
 * (the e-mail or phone, normalised).
 */
export function evaluateReply(
  node: Extract<FlowNode, { type: "reply" }>,
  text: string,
): { handle: typeof MATCH | typeof OTHER; value: string | null } {
  switch (node.data.expect) {
    case "any":
      return { handle: MATCH, value: text.trim() || null };
    case "keyword":
      return matchKeyword(text, node.data.keywords, "contains")
        ? { handle: MATCH, value: text.trim() }
        : { handle: OTHER, value: null };
    case "email": {
      const email = parseEmail(text);
      return email ? { handle: MATCH, value: email } : { handle: OTHER, value: null };
    }
    case "phone": {
      const phone = parsePhone(text);
      return phone ? { handle: MATCH, value: phone } : { handle: OTHER, value: null };
    }
  }
}

/** `{usuario}` → "@name" (or nothing when unknown). */
export function renderText(text: string, username: string | null): string {
  return text.replace(/\{usuario\}/gi, username ? `@${username}` : "").replace(/ {2,}/g, " ");
}

export interface GraphIssue {
  nodeId: string | null;
  message: string;
}

const looksLikeUrl = (u: string) => /^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(u.trim());

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
        if (node.data.imageUrl && !looksLikeUrl(node.data.imageUrl)) {
          issues.push({ nodeId: node.id, message: "O link da imagem não parece um endereço válido." });
        }
        if (node.data.buttons.length > MAX_BUTTONS) {
          issues.push({ nodeId: node.id, message: `No máximo ${MAX_BUTTONS} botões por mensagem.` });
        }
        for (const b of node.data.buttons) {
          if (!SAFE_ID.test(b.id)) issues.push({ nodeId: node.id, message: "Identificador de botão inválido." });
          if (!b.label.trim()) issues.push({ nodeId: node.id, message: "Botão sem texto." });
          if (b.label.length > 20) issues.push({ nodeId: node.id, message: `Botão "${b.label}" passa de 20 caracteres.` });
          if (b.url !== undefined && !looksLikeUrl(b.url)) {
            issues.push({ nodeId: node.id, message: `O botão "${b.label || "sem texto"}" está sem um link válido.` });
          }
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
        if (!node.data.tag.trim()) issues.push({ nodeId: node.id, message: "Bloco de tag sem nome da tag." });
        break;
      }
      case "reply": {
        if (node.data.expect === "keyword" && !node.data.keywords.some((k) => k.trim())) {
          issues.push({ nodeId: node.id, message: "Diga qual palavra a pessoa deve responder." });
        }
        const t = node.data.timeoutMinutes;
        if (t !== null && (!Number.isFinite(t) || t < 1 || t > MAX_DELAY_MINUTES)) {
          issues.push({ nodeId: node.id, message: "O prazo para responder precisa ser de 1 minuto a 30 dias." });
        }
        break;
      }
    }
  }

  for (const edge of graph.edges) {
    const from = graph.nodes.find((n) => n.id === edge.source);
    const to = graph.nodes.find((n) => n.id === edge.target);
    if (!from || !to) {
      issues.push({ nodeId: edge.source, message: "Ligação com um bloco que não existe." });
      continue;
    }
    if (to.type === "trigger") issues.push({ nodeId: edge.source, message: "Nada pode voltar para o gatilho." });
    if (!outputHandles(from).includes(edge.sourceHandle ?? NEXT)) {
      issues.push({ nodeId: edge.source, message: "Ligação saindo de uma saída que não existe mais." });
    }
  }

  // Two links from one output would make the path ambiguous.
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const key = `${edge.source}:${edge.sourceHandle ?? NEXT}`;
    if (seen.has(key)) issues.push({ nodeId: edge.source, message: "Uma saída está ligada a mais de um bloco." });
    seen.add(key);
  }

  return issues;
}

/**
 * The builder draws the flow as a tree: each block is drawn once, under the
 * first output (in walk order) that reaches it. Any other output pointing at
 * it is drawn as a "go to" link. Returns nodeId → "sourceId:handle".
 */
export function homeOf(graph: FlowGraph): Map<string, string> {
  const home = new Map<string, string>();
  const start = startNodeId(graph);
  if (!start) return home;
  home.set(start, "");
  const visit = (id: string) => {
    const node = findNode(graph, id);
    if (!node) return;
    for (const h of outputHandles(node)) {
      const target = nextNodeId(graph, id, h);
      if (!target || home.has(target)) continue;
      home.set(target, `${id}:${h}`);
      visit(target);
    }
  };
  visit(start);
  return home;
}

/** Nodes nobody can reach from the trigger. */
export function unreachableNodeIds(graph: FlowGraph): string[] {
  const home = homeOf(graph);
  return graph.nodes.filter((n) => !home.has(n.id)).map((n) => n.id);
}

/**
 * Soft problems: the flow runs, but Meta may refuse part of it.
 *
 * After a comment, Instagram allows exactly one message (the Private Reply)
 * until the person answers or taps a button. Story replies and DMs open the
 * 24h window themselves.
 */
export function flowWarnings(graph: FlowGraph, trigger: TriggerKind): string[] {
  type State = "before" | "sent" | "open";
  const out = new Set<string>();
  const seen = new Set<string>();

  const walk = (id: string | null, state: State) => {
    if (!id) return;
    const key = `${id}:${state}`;
    if (seen.has(key)) return;
    seen.add(key);
    const node = findNode(graph, id);
    if (!node) return;

    switch (node.type) {
      case "message": {
        if (state === "sent") {
          out.add(
            "Depois da primeira mensagem de um comentário, a Meta só aceita outra quando a pessoa responde ou toca num botão. Coloque um botão ou um bloco “Esperar resposta” entre as duas.",
          );
        }
        if (state === "before" && node.data.imageUrl) {
          out.add("A primeira mensagem depois de um comentário vai sem a imagem (a Meta só permite um envio). Mande a imagem num passo seguinte.");
        }
        const taps = tapButtons(node);
        if (taps.length > 0) {
          for (const b of taps) walk(nextNodeId(graph, id, b.id), "open");
        } else {
          walk(nextNodeId(graph, id), state === "before" ? "sent" : state);
        }
        return;
      }
      case "reply":
        walk(nextNodeId(graph, id, MATCH), "open");
        walk(nextNodeId(graph, id, OTHER), "open");
        walk(nextNodeId(graph, id, TIMEOUT), state);
        if ((node.data.timeoutMinutes ?? 0) > WINDOW_MINUTES) {
          out.add("O prazo de resposta passa de 24h: depois disso a Meta recusa mensagens até a pessoa voltar a falar com você.");
        }
        return;
      case "delay":
        if (node.data.minutes > WINDOW_MINUTES) {
          out.add("Uma espera passa de 24h: depois disso a Meta recusa mensagens até a pessoa voltar a falar com você.");
        }
        walk(nextNodeId(graph, id), state);
        return;
      default:
        for (const h of outputHandles(node)) walk(nextNodeId(graph, id, h), state);
    }
  };

  walk(startNodeId(graph), trigger === "comment" ? "before" : "open");
  return [...out];
}
