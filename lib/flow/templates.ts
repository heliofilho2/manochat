/**
 * Ready-made flows the "Novo fluxo" screen offers. Link buttons start empty on
 * purpose: going live is blocked until the real link is filled in.
 */

import { EMPTY_GRAPH, type FlowEdge, type FlowGraph, type FlowNode, type TriggerKind } from "./graph";

export interface FlowTemplate {
  id: string;
  title: string;
  description: string;
  steps: string[];
  name: string;
  triggerKind: TriggerKind;
  keywords: string[];
  graph: FlowGraph;
}

const e = (source: string, target: string, sourceHandle: string | null = null): FlowEdge => ({
  id: `e_${source}_${sourceHandle ?? "next"}`,
  source,
  sourceHandle,
  target,
});

const trigger: FlowNode = { id: "trigger", type: "trigger", data: {} };

export const TEMPLATES: FlowTemplate[] = [
  {
    id: "confirmar",
    title: "Material com palavra de confirmação",
    description:
      "A pessoa comenta, recebe um pedido para responder com a palavra, ganha o material e, horas depois, você pergunta se deu certo.",
    steps: ["Comentário", "Pede a palavra", "Espera a resposta", "Entrega o link", "Espera 2h", "“Conseguiu acessar?”"],
    name: "Material com confirmação",
    triggerKind: "comment",
    keywords: ["MATERIAL"],
    graph: {
      nodes: [
        trigger,
        {
          id: "pede",
          type: "message",
          data: { text: "Oi {usuario}! 👋 Pra eu liberar o material, me responde aqui com a palavra MATERIAL 👇", buttons: [] },
        },
        {
          id: "espera",
          type: "reply",
          data: {
            expect: "keyword",
            keywords: ["MATERIAL"],
            retryText: "Quase! É só responder com a palavra MATERIAL 😉",
            timeoutMinutes: null,
          },
        },
        {
          id: "entrega",
          type: "message",
          data: { text: "Liberado! 🎉 Toca no botão pra acessar:", buttons: [{ id: "acessar", label: "Acessar material", url: "" }] },
        },
        { id: "aguarda", type: "delay", data: { minutes: 120 } },
        {
          id: "pergunta",
          type: "message",
          data: {
            text: "E aí, conseguiu acessar o material? 😊",
            buttons: [
              { id: "sim", label: "Consegui ✅" },
              { id: "nao", label: "Tive um problema" },
            ],
          },
        },
        { id: "bom", type: "message", data: { text: "Que bom! Depois me conta o que achou 🙌", buttons: [] } },
        { id: "tag_problema", type: "action", data: { op: "add_tag", tag: "problema-acesso" } },
        {
          id: "ajuda",
          type: "message",
          data: { text: "Poxa! Tenta por este link direto. Se não der, me responde aqui que eu te ajudo 💬", buttons: [{ id: "direto", label: "Link direto", url: "" }] },
        },
      ],
      edges: [
        e("trigger", "pede"),
        e("pede", "espera"),
        e("espera", "entrega", "match"),
        e("entrega", "aguarda"),
        e("aguarda", "pergunta"),
        e("pergunta", "bom", "sim"),
        e("pergunta", "tag_problema", "nao"),
        e("tag_problema", "ajuda"),
      ],
    },
  },
  {
    id: "story",
    title: "Venda pelos stories",
    description:
      "Quem responde o story com a palavra recebe a oferta. Três horas depois, quem não abriu o link recebe um lembrete com ajuda.",
    steps: ["Resposta ao story", "Oferta com link", "Espera 3h", "Abriu o link?", "Lembrete ou obrigado"],
    name: "Venda pelos stories",
    triggerKind: "story",
    keywords: ["QUERO"],
    graph: {
      nodes: [
        trigger,
        { id: "interessado", type: "action", data: { op: "add_tag", tag: "interessado" } },
        {
          id: "oferta",
          type: "message",
          data: {
            text: "Oi {usuario}! Que bom que você quer saber mais 😍 Separei a oferta pra você aqui:",
            buttons: [{ id: "ver", label: "Ver oferta", url: "" }],
          },
        },
        { id: "aguarda", type: "delay", data: { minutes: 180 } },
        { id: "abriu", type: "condition", data: { match: "all", rules: [{ kind: "clicked" }] } },
        { id: "obrigado", type: "message", data: { text: "Viu a oferta? Qualquer dúvida é só me chamar aqui 💬", buttons: [] } },
        {
          id: "lembrete",
          type: "message",
          data: {
            text: "Ficou alguma dúvida sobre a oferta? 🤔",
            buttons: [
              { id: "link", label: "Manda o link de novo" },
              { id: "duvida", label: "Tenho uma dúvida" },
            ],
          },
        },
        { id: "reenvio", type: "message", data: { text: "Aqui está 👇", buttons: [{ id: "ver2", label: "Ver oferta", url: "" }] } },
        { id: "pede_duvida", type: "message", data: { text: "Pode mandar sua dúvida aqui que eu te respondo 💬", buttons: [] } },
        { id: "recebe_duvida", type: "reply", data: { expect: "any", keywords: [], retryText: "", timeoutMinutes: null } },
        { id: "tag_duvida", type: "action", data: { op: "add_tag", tag: "duvida" } },
      ],
      edges: [
        e("trigger", "interessado"),
        e("interessado", "oferta"),
        e("oferta", "aguarda"),
        e("aguarda", "abriu"),
        e("abriu", "obrigado", "yes"),
        e("abriu", "lembrete", "no"),
        e("lembrete", "reenvio", "link"),
        e("lembrete", "pede_duvida", "duvida"),
        e("pede_duvida", "recebe_duvida"),
        e("recebe_duvida", "tag_duvida", "match"),
      ],
    },
  },
  {
    id: "ab",
    title: "Teste A/B de preço",
    description: "Metade recebe um link, metade recebe outro. Em Resultados você compara quantos clicaram em cada um.",
    steps: ["Comentário", "Botão “Quero o link”", "Sorteio 50/50", "Link A ou link B"],
    name: "Teste A/B de preço",
    triggerKind: "comment",
    keywords: ["EBOOK"],
    graph: {
      nodes: [
        trigger,
        {
          id: "abre",
          type: "message",
          data: { text: "Oi {usuario}! Toca no botão pra receber o link 👇", buttons: [{ id: "quero", label: "Quero o link" }] },
        },
        {
          id: "sorteio",
          type: "random",
          data: {
            branches: [
              { id: "a", label: "Preço A", weight: 50 },
              { id: "b", label: "Preço B", weight: 50 },
            ],
          },
        },
        { id: "link_a", type: "message", data: { text: "Aqui está! 🎉", buttons: [{ id: "comprar_a", label: "Comprar", url: "" }] } },
        { id: "link_b", type: "message", data: { text: "Aqui está! 🎉", buttons: [{ id: "comprar_b", label: "Comprar", url: "" }] } },
      ],
      edges: [e("trigger", "abre"), e("abre", "sorteio", "quero"), e("sorteio", "link_a", "a"), e("sorteio", "link_b", "b")],
    },
  },
  {
    id: "email",
    title: "Captar e-mail pelo direct",
    description: "A pessoa manda a palavra no direct, você pede o e-mail e ele vai para a lista de Leads.",
    steps: ["Palavra no direct", "Pede o e-mail", "Confere o e-mail", "Agradece"],
    name: "Captar e-mail",
    triggerKind: "dm",
    keywords: ["LISTA"],
    graph: {
      nodes: [
        trigger,
        { id: "pede", type: "message", data: { text: "Oba! 🙌 Qual é o seu melhor e-mail?", buttons: [] } },
        {
          id: "email",
          type: "reply",
          data: {
            expect: "email",
            keywords: [],
            retryText: "Não consegui entender esse e-mail 😅 Pode mandar de novo? (ex.: nome@email.com)",
            timeoutMinutes: null,
          },
        },
        { id: "obrigado", type: "message", data: { text: "Anotado! Você vai receber as novidades por lá 📩", buttons: [] } },
      ],
      edges: [e("trigger", "pede"), e("pede", "email"), e("email", "obrigado", "match")],
    },
  },
];

export const BLANK_TEMPLATE: FlowTemplate = {
  id: "zero",
  title: "Começar do zero",
  description: "Só o gatilho. Você monta os passos.",
  steps: [],
  name: "Novo fluxo",
  triggerKind: "comment",
  keywords: [],
  graph: EMPTY_GRAPH,
};

export function templateById(id: string): FlowTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? BLANK_TEMPLATE;
}
