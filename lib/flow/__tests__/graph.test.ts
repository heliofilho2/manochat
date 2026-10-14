import { describe, expect, it } from "vitest";
import {
  EMPTY_GRAPH,
  evaluateReply,
  flowWarnings,
  homeOf,
  nextNodeId,
  outputHandles,
  pickBranch,
  startNodeId,
  unreachableNodeIds,
  validateGraph,
  type FlowGraph,
} from "../graph";

const abTest: FlowGraph = {
  nodes: [
    { id: "t", type: "trigger", data: {} },
    { id: "r", type: "random", data: { branches: [
      { id: "a", label: "R$7,90", weight: 50 },
      { id: "b", label: "R$9,90", weight: 50 },
    ] } },
    { id: "ma", type: "message", data: { text: "Aqui: link A", buttons: [] } },
    { id: "mb", type: "message", data: { text: "Aqui: link B", buttons: [] } },
  ],
  edges: [
    { id: "e1", source: "t", sourceHandle: null, target: "r" },
    { id: "e2", source: "r", sourceHandle: "a", target: "ma" },
    { id: "e3", source: "r", sourceHandle: "b", target: "mb" },
  ],
};

describe("flow graph", () => {
  it("starts at the trigger and follows edges by handle", () => {
    expect(startNodeId(abTest)).toBe("t");
    expect(nextNodeId(abTest, "t")).toBe("r");
    expect(nextNodeId(abTest, "r", "b")).toBe("mb");
    expect(nextNodeId(abTest, "ma")).toBeNull();
  });

  it("picks a random branch by weight", () => {
    const branches = [
      { id: "a", label: "A", weight: 1 },
      { id: "b", label: "B", weight: 3 },
    ];
    expect(pickBranch(branches, 0)?.id).toBe("a");
    expect(pickBranch(branches, 0.24)?.id).toBe("a");
    expect(pickBranch(branches, 0.25)?.id).toBe("b");
    expect(pickBranch(branches, 0.999)?.id).toBe("b");
  });

  it("never picks a zero-weight branch, and returns null when none can win", () => {
    const branches = [
      { id: "a", label: "A", weight: 0 },
      { id: "b", label: "B", weight: 2 },
    ];
    expect(pickBranch(branches, 0)?.id).toBe("b");
    expect(pickBranch([{ id: "a", label: "A", weight: 0 }], 0.5)).toBeNull();
    expect(pickBranch([], 0.5)).toBeNull();
  });

  it("exposes one output per tap button; link buttons do not branch", () => {
    const node = {
      id: "m",
      type: "message" as const,
      data: {
        text: "oi",
        buttons: [
          { id: "b1", label: "Quero" },
          { id: "b2", label: "Site", url: "https://a.com" },
        ],
      },
    };
    expect(outputHandles(node)).toEqual(["b1"]);
    expect(outputHandles({ ...node, data: { text: "oi", buttons: [] } })).toEqual(["next"]);
  });

  it("accepts a valid A/B flow and the empty starter graph", () => {
    expect(validateGraph(abTest)).toEqual([]);
    expect(validateGraph(EMPTY_GRAPH)).toEqual([]);
  });

  it("flags the problems that would break a live flow", () => {
    const messages = (g: FlowGraph) => validateGraph(g).map((i) => i.message);

    expect(messages({ nodes: [], edges: [] })).toContain("O fluxo precisa ter exatamente um gatilho.");

    const empty: FlowGraph = {
      nodes: [
        { id: "t", type: "trigger", data: {} },
        { id: "m", type: "message", data: { text: "  ", buttons: [] } },
        { id: "r", type: "random", data: { branches: [{ id: "a", label: "A", weight: 1 }] } },
        { id: "d", type: "delay", data: { minutes: 0 } },
      ],
      edges: [],
    };
    const found = messages(empty);
    expect(found).toContain("Mensagem sem texto.");
    expect(found).toContain("O sorteio precisa de pelo menos 2 caminhos.");
    expect(found).toContain("A espera precisa ser de 1 minuto a 30 dias.");

    const dangling: FlowGraph = {
      nodes: [{ id: "t", type: "trigger", data: {} }],
      edges: [{ id: "e", source: "t", sourceHandle: null, target: "ghost" }],
    };
    expect(messages(dangling)).toContain("Ligação com um bloco que não existe.");

    const stale: FlowGraph = {
      nodes: [
        { id: "t", type: "trigger", data: {} },
        { id: "m", type: "message", data: { text: "oi", buttons: [] } },
      ],
      edges: [{ id: "e", source: "m", sourceHandle: "old-button", target: "t" }],
    };
    expect(messages(stale)).toContain("Ligação saindo de uma saída que não existe mais.");

    const twice: FlowGraph = {
      nodes: [
        { id: "t", type: "trigger", data: {} },
        { id: "a", type: "message", data: { text: "a", buttons: [] } },
        { id: "b", type: "message", data: { text: "b", buttons: [] } },
      ],
      edges: [
        { id: "e1", source: "t", sourceHandle: null, target: "a" },
        { id: "e2", source: "t", sourceHandle: "next", target: "b" },
      ],
    };
    expect(messages(twice)).toContain("Uma saída está ligada a mais de um bloco.");
  });

  it("limits buttons to 3 and titles to 20 characters", () => {
    const g: FlowGraph = {
      nodes: [
        { id: "t", type: "trigger", data: {} },
        {
          id: "m",
          type: "message",
          data: {
            text: "oi",
            buttons: [
              { id: "1", label: "um" },
              { id: "2", label: "dois" },
              { id: "3", label: "três" },
              { id: "4", label: "um título bem comprido demais" },
            ],
          },
        },
      ],
      edges: [],
    };
    const found = validateGraph(g).map((i) => i.message);
    expect(found).toContain("No máximo 3 botões.");
    expect(found.some((m) => m.includes("passa de 20 caracteres"))).toBe(true);
  });

  it("lists blocks that cannot be reached from the trigger", () => {
    const g: FlowGraph = {
      nodes: [
        ...abTest.nodes,
        { id: "orphan", type: "message", data: { text: "perdida", buttons: [] } },
      ],
      edges: abTest.edges,
    };
    expect(unreachableNodeIds(g)).toEqual(["orphan"]);
    expect(unreachableNodeIds(abTest)).toEqual([]);
  });
});

describe("reply blocks", () => {
  const reply = (expect: "keyword" | "any" | "email" | "phone", timeoutMinutes: number | null = null) => ({
    id: "r",
    type: "reply" as const,
    data: { expect, keywords: ["material"], retryText: "", timeoutMinutes },
  });

  it("exposes the right outputs", () => {
    expect(outputHandles(reply("any"))).toEqual(["match"]);
    expect(outputHandles(reply("keyword"))).toEqual(["match", "other"]);
    expect(outputHandles(reply("email", 60))).toEqual(["match", "other", "timeout"]);
  });

  it("checks the answer", () => {
    expect(evaluateReply(reply("keyword"), "MATERIAL!!").handle).toBe("match");
    expect(evaluateReply(reply("keyword"), "quero o materiaaal").handle).toBe("other");
    expect(evaluateReply(reply("any"), "qualquer coisa")).toEqual({ handle: "match", value: "qualquer coisa" });
    expect(evaluateReply(reply("email"), "é ana@x.com")).toEqual({ handle: "match", value: "ana@x.com" });
    expect(evaluateReply(reply("email"), "não tenho")).toEqual({ handle: "other", value: null });
    expect(evaluateReply(reply("phone"), "(31) 99999-8888")).toEqual({ handle: "match", value: "31999998888" });
  });

  it("requires the word when waiting for a keyword", () => {
    const g: FlowGraph = {
      nodes: [{ id: "t", type: "trigger", data: {} }, { ...reply("keyword"), data: { ...reply("keyword").data, keywords: [] } }],
      edges: [{ id: "e", source: "t", sourceHandle: null, target: "r" }],
    };
    expect(validateGraph(g).map((i) => i.message)).toContain("Diga qual palavra a pessoa deve responder.");
  });
});

describe("builder layout and warnings", () => {
  const msg = (id: string, buttons: { id: string; label: string; url?: string }[] = []) => ({
    id,
    type: "message" as const,
    data: { text: id, buttons },
  });

  it("draws each block once, under the first output that reaches it", () => {
    const g: FlowGraph = {
      nodes: [{ id: "t", type: "trigger", data: {} }, msg("a", [{ id: "x", label: "X" }, { id: "y", label: "Y" }]), msg("b")],
      edges: [
        { id: "1", source: "t", sourceHandle: null, target: "a" },
        { id: "2", source: "a", sourceHandle: "x", target: "b" },
        { id: "3", source: "a", sourceHandle: "y", target: "b" },
      ],
    };
    const home = homeOf(g);
    expect(home.get("a")).toBe("t:next");
    expect(home.get("b")).toBe("a:x");
  });

  it("warns about two messages in a row after a comment, but not after a story reply", () => {
    const g: FlowGraph = {
      nodes: [{ id: "t", type: "trigger", data: {} }, msg("a"), msg("b")],
      edges: [
        { id: "1", source: "t", sourceHandle: null, target: "a" },
        { id: "2", source: "a", sourceHandle: null, target: "b" },
      ],
    };
    expect(flowWarnings(g, "comment")).toHaveLength(1);
    expect(flowWarnings(g, "story")).toEqual([]);
  });

  it("accepts the confirm-word pattern after a comment", () => {
    const g: FlowGraph = {
      nodes: [
        { id: "t", type: "trigger", data: {} },
        msg("ask"),
        { id: "r", type: "reply", data: { expect: "keyword", keywords: ["x"], retryText: "", timeoutMinutes: null } },
        msg("give"),
        { id: "d", type: "delay", data: { minutes: 120 } },
        msg("check", [{ id: "ok", label: "Consegui" }]),
      ],
      edges: [
        { id: "1", source: "t", sourceHandle: null, target: "ask" },
        { id: "2", source: "ask", sourceHandle: null, target: "r" },
        { id: "3", source: "r", sourceHandle: "match", target: "give" },
        { id: "4", source: "give", sourceHandle: null, target: "d" },
        { id: "5", source: "d", sourceHandle: null, target: "check" },
      ],
    };
    expect(flowWarnings(g, "comment")).toEqual([]);
    expect(validateGraph(g)).toEqual([]);
  });
});
