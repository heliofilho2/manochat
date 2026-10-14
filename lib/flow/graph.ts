/**
 * Flow graph: the shape a flow is stored in, and the pure rules that walk it.
 *
 * Dependency-free (only the other pure matchers) so "where does this person
 * go next?" and "can this flow spam someone?" are unit-testable without a
 * database or Instagram.
 *
 * A flow is nodes + edges. Every edge leaves a node through a named handle:
 *   trigger / media / action / delay  →  "next"
 *   message                           →  "next" (no taps) or one handle per tap button / quick reply
 *   cards                             →  "next" (no taps) or one handle per tap button on any card
 *   random                            →  one handle per branch
 *   condition                         →  "yes" | "no"
 *   reply                             →  "match" | "other" (not for "any") | "timeout" (when it has one)
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
export type TriggerKind = "comment" | "story" | "mention" | "dm";
export const TRIGGER_KINDS = ["comment", "story", "mention", "dm"] as const;

/** Whether the same person can go through the flow again. */
export type RerunPolicy = "always" | "daily" | "once";
export const RERUN_POLICIES = ["always", "daily", "once"] as const;

export interface MessageButton {
  id: string;
  label: string;
  /** Set = opens this link (tracked). Unset = tap button that continues the flow. */
  url?: string;
}

export interface QuickReply {
  id: string;
  label: string;
}

export interface Card {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  /** Opens when the card itself is tapped. */
  url?: string;
  buttons: MessageButton[];
}

export interface RandomBranch {
  id: string;
  label: string;
  /** Relative weight: 50/50 and 1/1 are the same split. */
  weight: number;
}

export type Rule =
  | { kind: "tag"; tag: string; not?: boolean }
  | { kind: "follower"; not?: boolean }
  | { kind: "clicked"; not?: boolean }
  | { kind: "field"; name: string; op: "equals" | "contains" | "filled" | "empty"; value: string }
  | { kind: "answer"; value: string }
  /** São Paulo time, [from, to) in whole hours; from > to wraps past midnight. */
  | { kind: "hours"; from: number; to: number }
  /** 0 = Sunday … 6 = Saturday, São Paulo time. */
  | { kind: "weekdays"; days: number[] };

/** Older flows stored a single check; normalizeGraph turns it into rules. */
type LegacyCheck = { kind: "has_tag"; tag: string } | { kind: "is_follower" } | { kind: "clicked" };

export type ReplyExpect = "keyword" | "any" | "email" | "phone";
export type MediaKind = "image" | "video" | "audio";

export type ActionData =
  | { op: "add_tag"; tag: string }
  | { op: "remove_tag"; tag: string }
  | { op: "set_field"; field: string; value: string }
  | { op: "clear_field"; field: string }
  /** Sends a note to the owner's alert channel (ALERT_WEBHOOK_URL). */
  | { op: "notify"; text: string }
  /** POSTs the person's data to an external URL (Zapier, Make, n8n…). */
  | { op: "webhook"; url: string }
  /** Ends this flow and starts another one for the same person. */
  | { op: "start_flow"; flowId: string }
  /** Stops all automations for this person for a while, so a human can answer. */
  | { op: "human"; hours: number };

export type FlowNode =
  | { id: string; type: "trigger"; data: Record<string, never> }
  | {
      id: string;
      type: "message";
      data: {
        text: string;
        buttons: MessageButton[];
        quickReplies?: QuickReply[];
        imageUrl?: string;
        /** Seconds of "typing…" before the message (0–5). */
        typing?: number;
      };
    }
  | { id: string; type: "media"; data: { kind: MediaKind; url: string } }
  | { id: string; type: "cards"; data: { cards: Card[] } }
  | { id: string; type: "random"; data: { branches: RandomBranch[] } }
  | { id: string; type: "condition"; data: { match: "all" | "any"; rules: Rule[]; check?: LegacyCheck } }
  | {
      id: string;
      type: "delay";
      data: {
        minutes: number;
        /** Set = wait until the next time it is HH:MM in São Paulo instead. */
        until?: { hour: number; minute: number } | null;
      };
    }
  | { id: string; type: "action"; data: ActionData }
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
        /** Custom field the answer is saved to (usable later as {campo:name}). */
        saveTo?: string;
      };
    };

export type FlowNodeType = FlowNode["type"];
type Of<T extends FlowNodeType> = Extract<FlowNode, { type: T }>;

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
  /** Legacy canvas positions; the builder lays the tree out by itself. */
  positions?: Record<string, { x: number; y: number }>;
}

export const EMPTY_GRAPH: FlowGraph = {
  nodes: [{ id: "trigger", type: "trigger", data: {} }],
  edges: [],
};

/* ─── safety limits ─────────────────────────────────────────────────────── */

/** Blocks walked in one go before the run is stopped as a runaway. */
export const MAX_STEPS_PER_RUN = 40;
/** Messages sent in one go (without the person doing anything in between). */
export const MAX_SENDS_PER_BURST = 6;
/** Messages one person can get from one run, ever. */
export const MAX_SENDS_PER_RUN = 40;
/** Times one block may run for the same person. */
export const MAX_VISITS_PER_NODE = 8;
/** Flow messages one person may get in a minute, across all flows. */
export const MAX_SENDS_PER_MINUTE = 10;
/** "Go to another flow" chains longer than this are cut. */
export const MAX_FLOW_HOPS = 3;

/** Meta caps template buttons at 3, quick replies at 13, carousel cards at 10. */
export const MAX_BUTTONS = 3;
export const MAX_QUICK_REPLIES = 13;
export const MAX_CARDS = 10;
export const MAX_DELAY_MINUTES = 60 * 24 * 30;
/** Meta's standard messaging window. */
export const WINDOW_MINUTES = 24 * 60;

/** Ids travel inside button payloads separated by ":" and ".", so they must not contain them. */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const FIELD_NAME = /^[a-z0-9_]{1,30}$/;

/* ─── basics ────────────────────────────────────────────────────────────── */

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

/** Field names are stored lower-case with underscores: "Cidade natal" → "cidade_natal". */
export function fieldKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

/**
 * Brings stored graphs up to the current shape (older condition blocks kept a
 * single `check`). Safe to call on an already-current graph.
 */
export function normalizeGraph(graph: FlowGraph): FlowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.type !== "condition" || Array.isArray(n.data.rules)) return n;
      const c = n.data.check;
      const rule: Rule =
        c?.kind === "has_tag" ? { kind: "tag", tag: c.tag } : c?.kind === "is_follower" ? { kind: "follower" } : { kind: "clicked" };
      return { ...n, data: { match: "all", rules: [rule] } };
    }),
  };
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

/** Tap buttons of a message (the ones that continue the flow). */
export function tapButtons(node: Of<"message">): MessageButton[] {
  return node.data.buttons.filter((b) => b.url === undefined);
}

/** Every handle that waits for the person to tap something. */
export function tapHandles(node: FlowNode): { id: string; label: string }[] {
  if (node.type === "message") {
    return [
      ...tapButtons(node).map((b) => ({ id: b.id, label: b.label })),
      ...(node.data.quickReplies ?? []).map((q) => ({ id: q.id, label: q.label })),
    ];
  }
  if (node.type === "cards") {
    return node.data.cards.flatMap((c) =>
      c.buttons.filter((b) => b.url === undefined).map((b) => ({ id: b.id, label: `${c.title || "Cartão"} · ${b.label}` })),
    );
  }
  return [];
}

/** Handles a node can leave through, in display order. */
export function outputHandles(node: FlowNode): string[] {
  switch (node.type) {
    case "message":
    case "cards": {
      const taps = tapHandles(node).map((t) => t.id);
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

/** An edge the person has to cause (a tap or an answer), as opposed to one the flow takes alone. */
export function isPersonDriven(node: FlowNode, handle: string): boolean {
  if (node.type === "message" || node.type === "cards") return handle !== NEXT && tapHandles(node).some((t) => t.id === handle);
  if (node.type === "reply") return handle === MATCH || handle === OTHER;
  return false;
}

/* ─── replies ───────────────────────────────────────────────────────────── */

/**
 * Where an answer to a "reply" block leads, and the value worth keeping
 * (the e-mail or phone, normalised).
 */
export function evaluateReply(node: Of<"reply">, text: string): { handle: typeof MATCH | typeof OTHER; value: string | null } {
  switch (node.data.expect) {
    case "any":
      return { handle: MATCH, value: text.trim() || null };
    case "keyword":
      return matchKeyword(text, node.data.keywords, "contains") ? { handle: MATCH, value: text.trim() } : { handle: OTHER, value: null };
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

/* ─── text ──────────────────────────────────────────────────────────────── */

export interface TextContext {
  username?: string | null;
  /** Display name from Instagram, when known. */
  name?: string | null;
  fields?: Record<string, string>;
  /** The person's latest answer to a "reply" block. */
  answer?: string | null;
}

/**
 * Fills the placeholders:
 *   {usuario} → @handle     {nome} → first name (or @handle)
 *   {campo:x} → custom field x     {resposta} → latest answer
 */
export function renderText(text: string, ctx: TextContext | string | null): string {
  const c: TextContext = typeof ctx === "string" || ctx === null ? { username: ctx } : ctx;
  const handle = c.username ? `@${c.username}` : "";
  const first = c.name?.trim().split(/\s+/)[0] || handle;
  return text
    .replace(/\{usuario\}/gi, handle)
    .replace(/\{nome\}/gi, first)
    .replace(/\{resposta\}/gi, c.answer ?? "")
    .replace(/\{campo:([^}]+)\}/gi, (_, k: string) => c.fields?.[fieldKey(k)] ?? "")
    .replace(/ {2,}/g, " ");
}

/* ─── time (São Paulo has no daylight saving since 2019: UTC-3) ─────────── */

const BR_OFFSET_MS = -3 * 60 * 60 * 1000;

export function brClock(now: Date): { hour: number; minute: number; weekday: number } {
  const d = new Date(now.getTime() + BR_OFFSET_MS);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() };
}

/** The next moment (strictly after `now`) it is HH:MM in São Paulo. */
export function nextBrTime(now: Date, hour: number, minute: number): Date {
  const local = new Date(now.getTime() + BR_OFFSET_MS);
  const target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour, minute) - BR_OFFSET_MS;
  return new Date(target > now.getTime() ? target : target + 24 * 60 * 60 * 1000);
}

/* ─── conditions ────────────────────────────────────────────────────────── */

export interface Facts {
  tags: string[];
  /** Null = unknown (only looked up when a rule needs it). */
  isFollower: boolean | null;
  clicked: boolean;
  fields: Record<string, string>;
  answer: string | null;
  now: Date;
}

export function rulesNeedFollower(rules: Rule[]): boolean {
  return rules.some((r) => r.kind === "follower");
}

export function evaluateRule(rule: Rule, f: Facts): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  switch (rule.kind) {
    case "tag": {
      const has = f.tags.includes(norm(rule.tag));
      return rule.not ? !has : has;
    }
    case "follower": {
      const yes = f.isFollower === true;
      return rule.not ? !yes : yes;
    }
    case "clicked":
      return rule.not ? !f.clicked : f.clicked;
    case "field": {
      const v = f.fields[fieldKey(rule.name)] ?? "";
      if (rule.op === "filled") return v.trim() !== "";
      if (rule.op === "empty") return v.trim() === "";
      if (rule.op === "equals") return norm(v) === norm(rule.value);
      return norm(v).includes(norm(rule.value));
    }
    case "answer":
      return matchKeyword(f.answer ?? "", [rule.value], "contains") !== null;
    case "hours": {
      const h = brClock(f.now).hour;
      return rule.from <= rule.to ? h >= rule.from && h < rule.to : h >= rule.from || h < rule.to;
    }
    case "weekdays":
      return rule.days.includes(brClock(f.now).weekday);
  }
}

export function evaluateRules(match: "all" | "any", rules: Rule[], f: Facts): boolean {
  if (rules.length === 0) return true;
  return match === "all" ? rules.every((r) => evaluateRule(r, f)) : rules.some((r) => evaluateRule(r, f));
}

/* ─── safety: loops ─────────────────────────────────────────────────────── */

/**
 * A loop the flow can go round on its own (no tap, no answer in it) would
 * message the person without end. Returns one such loop, as block ids, or null.
 */
export function automaticLoop(graph: FlowGraph): string[] | null {
  const auto = new Map<string, string[]>();
  for (const e of graph.edges) {
    const from = findNode(graph, e.source);
    if (!from || isPersonDriven(from, e.sourceHandle ?? NEXT)) continue;
    auto.set(e.source, [...(auto.get(e.source) ?? []), e.target]);
  }
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const dfs = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const next of auto.get(id) ?? []) {
      if (state.get(next) === 1) return stack.slice(stack.indexOf(next));
      if (!state.has(next)) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const n of graph.nodes) {
    if (!state.has(n.id)) {
      const found = dfs(n.id);
      if (found) return found;
    }
  }
  return null;
}

/** Whether linking (`source`, `handle`) → `target` would create a loop the flow can spin alone. */
export function wouldLoop(graph: FlowGraph, source: string, handle: string, target: string): boolean {
  const edges = graph.edges.filter((e) => !(e.source === source && (e.sourceHandle ?? NEXT) === handle));
  return automaticLoop({ ...graph, edges: [...edges, { id: "probe", source, sourceHandle: handle, target }] }) !== null;
}

/* ─── validation ────────────────────────────────────────────────────────── */

export interface GraphIssue {
  nodeId: string | null;
  message: string;
}

const looksLikeUrl = (u: string) => /^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(u.trim());

function checkButtons(nodeId: string, buttons: MessageButton[], issues: GraphIssue[]) {
  if (buttons.length > MAX_BUTTONS) issues.push({ nodeId, message: `No máximo ${MAX_BUTTONS} botões.` });
  for (const b of buttons) {
    if (!SAFE_ID.test(b.id)) issues.push({ nodeId, message: "Identificador de botão inválido." });
    if (!b.label.trim()) issues.push({ nodeId, message: "Botão sem texto." });
    if (b.label.length > 20) issues.push({ nodeId, message: `Botão "${b.label}" passa de 20 caracteres.` });
    if (b.url !== undefined && !looksLikeUrl(b.url)) {
      issues.push({ nodeId, message: `O botão "${b.label || "sem texto"}" está sem um link válido.` });
    }
  }
}

/**
 * Everything wrong with a graph that would make it misbehave live. A flow can
 * be saved as a draft with issues, but only a clean one can go live.
 */
export function validateGraph(graph: FlowGraph, opts: { flowId?: string } = {}): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set<string>();
  const push = (nodeId: string | null, message: string) => issues.push({ nodeId, message });

  if (graph.nodes.filter((n) => n.type === "trigger").length !== 1) push(null, "O fluxo precisa ter exatamente um gatilho.");

  for (const node of graph.nodes) {
    if (!SAFE_ID.test(node.id)) push(node.id, "Identificador de bloco inválido.");
    if (ids.has(node.id)) push(node.id, "Bloco duplicado.");
    ids.add(node.id);

    switch (node.type) {
      case "message": {
        if (!node.data.text.trim()) push(node.id, "Mensagem sem texto.");
        if (node.data.imageUrl && !looksLikeUrl(node.data.imageUrl)) push(node.id, "O link da imagem não parece um endereço válido.");
        checkButtons(node.id, node.data.buttons, issues);
        const qr = node.data.quickReplies ?? [];
        if (qr.length > 0 && node.data.buttons.length > 0) push(node.id, "Use botões ou respostas rápidas, não os dois na mesma mensagem.");
        if (qr.length > MAX_QUICK_REPLIES) push(node.id, `No máximo ${MAX_QUICK_REPLIES} respostas rápidas.`);
        for (const q of qr) {
          if (!SAFE_ID.test(q.id)) push(node.id, "Identificador de resposta rápida inválido.");
          if (!q.label.trim()) push(node.id, "Resposta rápida sem texto.");
          if (q.label.length > 20) push(node.id, `Resposta rápida "${q.label}" passa de 20 caracteres.`);
        }
        break;
      }
      case "media":
        if (!looksLikeUrl(node.data.url)) push(node.id, "Cole o link do arquivo (imagem, vídeo ou áudio).");
        break;
      case "cards": {
        if (node.data.cards.length === 0) push(node.id, "Adicione pelo menos um cartão.");
        if (node.data.cards.length > MAX_CARDS) push(node.id, `No máximo ${MAX_CARDS} cartões.`);
        for (const c of node.data.cards) {
          if (!SAFE_ID.test(c.id)) push(node.id, "Identificador de cartão inválido.");
          if (!c.title.trim()) push(node.id, "Cartão sem título.");
          if (c.title.length > 80 || c.subtitle.length > 80) push(node.id, "Título e subtítulo do cartão vão até 80 caracteres.");
          if (c.imageUrl && !looksLikeUrl(c.imageUrl)) push(node.id, `A imagem do cartão "${c.title}" não parece um link válido.`);
          if (c.url && !looksLikeUrl(c.url)) push(node.id, `O link do cartão "${c.title}" não parece válido.`);
          checkButtons(node.id, c.buttons, issues);
        }
        break;
      }
      case "random":
        if (node.data.branches.length < 2) push(node.id, "O sorteio precisa de pelo menos 2 caminhos.");
        if (node.data.branches.some((b) => !SAFE_ID.test(b.id))) push(node.id, "Identificador de caminho inválido.");
        if (!node.data.branches.some((b) => b.weight > 0)) push(node.id, "Nenhum caminho do sorteio tem chance maior que zero.");
        break;
      case "condition":
        if ((node.data.rules ?? []).length === 0) push(node.id, "A condição precisa de pelo menos uma regra.");
        for (const r of node.data.rules ?? []) {
          if (r.kind === "tag" && !r.tag.trim()) push(node.id, "Regra de tag sem o nome da tag.");
          if (r.kind === "field" && !fieldKey(r.name)) push(node.id, "Regra de campo sem o nome do campo.");
          if (r.kind === "field" && (r.op === "equals" || r.op === "contains") && !r.value.trim()) push(node.id, "Regra de campo sem o valor.");
          if (r.kind === "answer" && !r.value.trim()) push(node.id, "Regra de resposta sem a palavra.");
          if (r.kind === "weekdays" && r.days.length === 0) push(node.id, "Escolha pelo menos um dia da semana.");
          if (r.kind === "hours" && (r.from === r.to || r.from < 0 || r.to > 24)) push(node.id, "Horário inválido na condição.");
        }
        break;
      case "delay": {
        if (node.data.until) {
          const { hour, minute } = node.data.until;
          if (!(hour >= 0 && hour < 24 && minute >= 0 && minute < 60)) push(node.id, "Horário da espera inválido.");
        } else if (!Number.isFinite(node.data.minutes) || node.data.minutes < 1 || node.data.minutes > MAX_DELAY_MINUTES) {
          push(node.id, "A espera precisa ser de 1 minuto a 30 dias.");
        }
        break;
      }
      case "action": {
        const a = node.data;
        if ((a.op === "add_tag" || a.op === "remove_tag") && !a.tag.trim()) push(node.id, "Diga qual tag.");
        if ((a.op === "set_field" || a.op === "clear_field") && !FIELD_NAME.test(fieldKey(a.field))) push(node.id, "Diga o nome do campo.");
        if (a.op === "notify" && !a.text.trim()) push(node.id, "Escreva o aviso.");
        if (a.op === "webhook" && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(a.url.trim())) push(node.id, "O webhook precisa de um link https://.");
        if (a.op === "start_flow" && !a.flowId) push(node.id, "Escolha qual fluxo iniciar.");
        if (a.op === "start_flow" && opts.flowId && a.flowId === opts.flowId) push(node.id, "Um fluxo não pode iniciar a si mesmo.");
        if (a.op === "human" && !(a.hours >= 1 && a.hours <= 168)) push(node.id, "A pausa para atendimento vai de 1 a 168 horas.");
        break;
      }
      case "reply": {
        if (node.data.expect === "keyword" && !node.data.keywords.some((k) => k.trim())) push(node.id, "Diga qual palavra a pessoa deve responder.");
        const t = node.data.timeoutMinutes;
        if (t !== null && (!Number.isFinite(t) || t < 1 || t > MAX_DELAY_MINUTES)) push(node.id, "O prazo para responder precisa ser de 1 minuto a 30 dias.");
        if (node.data.saveTo !== undefined && node.data.saveTo !== "" && !FIELD_NAME.test(fieldKey(node.data.saveTo))) {
          push(node.id, "Nome de campo inválido para salvar a resposta.");
        }
        break;
      }
    }
  }

  for (const edge of graph.edges) {
    const from = findNode(graph, edge.source);
    const to = findNode(graph, edge.target);
    if (!from || !to) {
      push(edge.source, "Ligação com um bloco que não existe.");
      continue;
    }
    if (to.type === "trigger") push(edge.source, "Nada pode voltar para o gatilho.");
    if (!outputHandles(from).includes(edge.sourceHandle ?? NEXT)) push(edge.source, "Ligação saindo de uma saída que não existe mais.");
  }

  // Two links from one output would make the path ambiguous.
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const key = `${edge.source}:${edge.sourceHandle ?? NEXT}`;
    if (seen.has(key)) push(edge.source, "Uma saída está ligada a mais de um bloco.");
    seen.add(key);
  }

  const loop = automaticLoop(graph);
  if (loop) {
    for (const id of loop) {
      push(id, "Laço sem pausa: estes passos voltam um para o outro sem a pessoa tocar em nada ou responder. Isso mandaria mensagens sem parar.");
    }
  }

  return issues;
}

/* ─── layout ────────────────────────────────────────────────────────────── */

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

/* ─── soft warnings ─────────────────────────────────────────────────────── */

/**
 * The flow runs, but Meta may refuse part of it.
 *
 * After a comment, Instagram allows exactly one message (the Private Reply)
 * until the person answers or taps something. Story replies, mentions and DMs
 * open the 24h window themselves.
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

    const sends = node.type === "message" || node.type === "media" || node.type === "cards";
    if (sends && state === "sent") {
      out.add(
        "Depois da primeira mensagem de um comentário, a Meta só aceita outra quando a pessoa responde ou toca num botão. Coloque um botão ou um bloco “Esperar resposta” entre as duas.",
      );
    }
    if (state === "before" && (node.type === "media" || node.type === "cards" || (node.type === "message" && node.data.imageUrl))) {
      out.add("A primeira mensagem depois de um comentário precisa ser um texto (com ou sem botões). Imagens, vídeos e cartões vão num passo seguinte.");
    }

    switch (node.type) {
      case "message":
      case "cards": {
        const taps = tapHandles(node);
        if (taps.length > 0) for (const t of taps) walk(nextNodeId(graph, id, t.id), "open");
        else walk(nextNodeId(graph, id), state === "before" ? "sent" : state);
        return;
      }
      case "media":
        walk(nextNodeId(graph, id), state === "before" ? "sent" : state);
        return;
      case "reply":
        walk(nextNodeId(graph, id, MATCH), "open");
        walk(nextNodeId(graph, id, OTHER), "open");
        walk(nextNodeId(graph, id, TIMEOUT), state);
        if ((node.data.timeoutMinutes ?? 0) > WINDOW_MINUTES) {
          out.add("O prazo de resposta passa de 24h: depois disso a Meta recusa mensagens até a pessoa voltar a falar com você.");
        }
        return;
      case "delay":
        if (!node.data.until && node.data.minutes > WINDOW_MINUTES) {
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
