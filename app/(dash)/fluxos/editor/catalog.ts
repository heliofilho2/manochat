import {
  MATCH,
  NEXT,
  NO,
  OTHER,
  outputHandles,
  tapHandles,
  YES,
  type FlowNode,
  type Rule,
  type TriggerKind,
} from "@/lib/flow/graph";
import type { FlowInput } from "../actions";

export type Meta = Omit<FlowInput, "graph">;
export type Kind = Exclude<FlowNode["type"], "trigger">;

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface BlockInfo {
  kind: Kind;
  icon: string;
  label: string;
  hint: string;
  color: string;
  group: string;
}

export const BLOCKS: BlockInfo[] = [
  { kind: "message", icon: "💬", label: "Mensagem", hint: "Texto com botões ou respostas rápidas", color: "#2F6FDE", group: "Enviar" },
  { kind: "media", icon: "🖼️", label: "Imagem, vídeo ou áudio", hint: "Um arquivo por link", color: "#3B82F6", group: "Enviar" },
  { kind: "cards", icon: "🗂️", label: "Cartões (galeria)", hint: "Produtos lado a lado, com foto e botões", color: "#6366F1", group: "Enviar" },
  { kind: "reply", icon: "⌨️", label: "Esperar resposta", hint: "Palavra, e-mail, telefone, qualquer texto", color: "#0E8FA8", group: "Esperar" },
  { kind: "delay", icon: "⏱️", label: "Esperar um tempo", hint: "Minutos, horas, dias ou até um horário", color: "#0F9D58", group: "Esperar" },
  { kind: "condition", icon: "🔀", label: "Condição", hint: "Tag, campo, clique, seguidor, horário…", color: "#D97706", group: "Decidir" },
  { kind: "random", icon: "🎲", label: "Sorteio A/B", hint: "Divide as pessoas em caminhos", color: "#8B5CF6", group: "Decidir" },
  { kind: "action", icon: "⚙️", label: "Ação", hint: "Tag, campo, avisar você, webhook, outro fluxo…", color: "#DB2777", group: "Fazer" },
];

export const META: Record<FlowNode["type"], { icon: string; label: string; color: string }> = {
  trigger: { icon: "⚡", label: "Gatilho", color: "#1B1712" },
  ...(Object.fromEntries(BLOCKS.map((b) => [b.kind, { icon: b.icon, label: b.label, color: b.color }])) as Record<
    Kind,
    { icon: string; label: string; color: string }
  >),
};

export const TRIGGERS: { kind: TriggerKind; icon: string; label: string; hint: string }[] = [
  { kind: "comment", icon: "💬", label: "Comentário", hint: "Alguém comenta a palavra num post ou Reel" },
  { kind: "story", icon: "📱", label: "Resposta ao story", hint: "Alguém responde ou reage a um story" },
  { kind: "mention", icon: "📣", label: "Menção no story", hint: "Alguém marca você no story dela" },
  { kind: "dm", icon: "✉️", label: "Mensagem no direct", hint: "Uma palavra no direct, ou qualquer mensagem (resposta padrão)" },
];

export const STATUS: Record<string, { label: string; tone: "ok" | "wait" | "bad" | "muted" }> = {
  running: { label: "Andando", tone: "wait" },
  waiting_tap: { label: "Esperando tocar num botão", tone: "wait" },
  waiting_reply: { label: "Esperando responder", tone: "wait" },
  waiting_delay: { label: "Na espera", tone: "wait" },
  done: { label: "Concluiu", tone: "ok" },
  failed: { label: "Parou com erro", tone: "bad" },
};

export function blank(kind: Kind): FlowNode {
  const id = uid("n");
  switch (kind) {
    case "message":
      return { id, type: "message", data: { text: "", buttons: [] } };
    case "media":
      return { id, type: "media", data: { kind: "image", url: "" } };
    case "cards":
      return { id, type: "cards", data: { cards: [{ id: uid("k"), title: "", subtitle: "", imageUrl: "", buttons: [] }] } };
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
      return { id, type: "condition", data: { match: "all", rules: [{ kind: "clicked" }] } };
    case "delay":
      return { id, type: "delay", data: { minutes: 60 } };
    case "action":
      return { id, type: "action", data: { op: "add_tag", tag: "" } };
  }
}

export function fmtMinutes(m: number): string {
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} ${m / 1440 === 1 ? "dia" : "dias"}`;
  if (m >= 60 && m % 60 === 0) return `${m / 60} ${m / 60 === 1 ? "hora" : "horas"}`;
  return `${m} min`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The labelled ways out of a block, in display order. */
export function outputs(node: FlowNode): { id: string; label: string }[] {
  switch (node.type) {
    case "message":
    case "cards": {
      const taps = tapHandles(node);
      return taps.length > 0 ? taps.map((t) => ({ id: t.id, label: `Tocou “${t.label || "botão"}”` })) : [{ id: NEXT, label: "" }];
    }
    case "random": {
      const total = node.data.branches.reduce((s, b) => s + Math.max(0, b.weight), 0) || 1;
      return node.data.branches.map((b) => ({ id: b.id, label: `${b.label || "Caminho"} · ${Math.round((Math.max(0, b.weight) / total) * 100)}%` }));
    }
    case "condition":
      return [
        { id: YES, label: "✓ Sim" },
        { id: NO, label: "✕ Não" },
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

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function ruleText(r: Rule): string {
  switch (r.kind) {
    case "tag":
      return `${r.not ? "não tem" : "tem"} a tag “${r.tag || "…"}”`;
    case "follower":
      return r.not ? "não segue o perfil" : "segue o perfil";
    case "clicked":
      return r.not ? "não abriu nenhum link" : "abriu algum link";
    case "field":
      return r.op === "filled"
        ? `o campo ${r.name || "…"} está preenchido`
        : r.op === "empty"
          ? `o campo ${r.name || "…"} está vazio`
          : `o campo ${r.name || "…"} ${r.op === "equals" ? "é" : "contém"} “${r.value}”`;
    case "answer":
      return `a última resposta contém “${r.value || "…"}”`;
    case "hours":
      return `é entre ${pad(r.from)}h e ${pad(r.to)}h`;
    case "weekdays":
      return `é ${r.days.map((d) => WEEK[d]).join(", ") || "…"}`;
  }
}

/** One line that says what a block does, for the tree cards and pickers. */
export function shortText(node: FlowNode, meta: Meta, flows: { id: string; name: string }[] = []): string {
  switch (node.type) {
    case "trigger": {
      const t = TRIGGERS.find((x) => x.kind === meta.triggerKind)!;
      const words = meta.keywords.map((k) => k.toUpperCase()).join(", ");
      if (meta.triggerKind === "dm") return words ? `Mandou ${words} no direct` : "Qualquer mensagem no direct (resposta padrão)";
      if (meta.triggerKind === "story") return words ? `Respondeu o story com ${words}` : "Respondeu ou reagiu a um story";
      if (meta.triggerKind === "mention") return "Marcou você no story";
      return words ? `${t.label}: ${words}` : `${t.label}: defina a palavra`;
    }
    case "message":
      return node.data.text.trim() || "Mensagem sem texto";
    case "media":
      return `${node.data.kind === "image" ? "Imagem" : node.data.kind === "video" ? "Vídeo" : "Áudio"}${node.data.url ? "" : " (sem link)"}`;
    case "cards":
      return node.data.cards.map((c) => c.title || "Cartão").join(" · ");
    case "reply":
      return node.data.expect === "keyword"
        ? `Espera a pessoa responder ${node.data.keywords.filter(Boolean).map((k) => k.toUpperCase()).join(" ou ") || "…"}`
        : node.data.expect === "email"
          ? "Espera o e-mail (vira lead)"
          : node.data.expect === "phone"
            ? "Espera o WhatsApp (vira lead)"
            : "Espera qualquer resposta";
    case "delay":
      return node.data.until ? `Espera até ${pad(node.data.until.hour)}:${pad(node.data.until.minute)}` : `Espera ${fmtMinutes(node.data.minutes)}`;
    case "condition": {
      const rules = node.data.rules ?? [];
      if (rules.length === 0) return "Sem regras";
      return `Se ${rules.map(ruleText).join(node.data.match === "all" ? " e " : " ou ")}`;
    }
    case "random":
      return `Sorteia entre ${node.data.branches.length} caminhos`;
    case "action": {
      const a = node.data;
      switch (a.op) {
        case "add_tag":
          return `Adiciona a tag “${a.tag || "…"}”`;
        case "remove_tag":
          return `Remove a tag “${a.tag || "…"}”`;
        case "set_field":
          return `Salva ${a.field || "…"} = ${a.value || "…"}`;
        case "clear_field":
          return `Apaga o campo ${a.field || "…"}`;
        case "notify":
          return `Avisa você: ${a.text || "…"}`;
        case "webhook":
          return `Envia os dados para ${a.url.replace(/^https?:\/\//, "") || "…"}`;
        case "start_flow":
          return `Vai para o fluxo “${flows.find((f) => f.id === a.flowId)?.name ?? "…"}”`;
        case "human":
          return `Passa para atendimento humano (${a.hours}h sem robô)`;
      }
    }
  }
}
