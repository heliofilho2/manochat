import { describe, expect, it } from "vitest";
import {
  automaticLoop,
  evaluateRules,
  nextBrTime,
  normalizeGraph,
  outputHandles,
  renderText,
  validateGraph,
  wouldLoop,
  type Facts,
  type FlowGraph,
  type FlowNode,
} from "../graph";
import { buildCardsMessage, buildFlowMessage, linkTarget } from "../message";

const msg = (id: string, buttons: { id: string; label: string; url?: string }[] = []): FlowNode => ({
  id,
  type: "message",
  data: { text: id, buttons },
});
const edge = (source: string, target: string, sourceHandle: string | null = null) => ({
  id: `${source}-${sourceHandle}`,
  source,
  sourceHandle,
  target,
});
const trigger: FlowNode = { id: "t", type: "trigger", data: {} };

describe("loop safety", () => {
  it("blocks a loop the flow can go round alone (the spam bug)", () => {
    const g: FlowGraph = { nodes: [trigger, msg("a"), msg("b")], edges: [edge("t", "a"), edge("a", "b"), edge("b", "a")] };
    expect(automaticLoop(g)).toEqual(["a", "b"]);
    expect(validateGraph(g).some((i) => i.message.startsWith("Laço sem pausa"))).toBe(true);
  });

  it("a delay in the loop does not make it safe", () => {
    const g: FlowGraph = {
      nodes: [trigger, msg("a"), { id: "d", type: "delay", data: { minutes: 1 } }],
      edges: [edge("t", "a"), edge("a", "d"), edge("d", "a")],
    };
    expect(automaticLoop(g)).not.toBeNull();
  });

  it("allows going back when the person has to tap or answer", () => {
    const tap: FlowGraph = {
      nodes: [trigger, msg("ask", [{ id: "again", label: "De novo" }])],
      edges: [edge("t", "ask"), edge("ask", "ask", "again")],
    };
    expect(automaticLoop(tap)).toBeNull();

    const answer: FlowGraph = {
      nodes: [trigger, msg("ask"), { id: "r", type: "reply", data: { expect: "email", keywords: [], retryText: "", timeoutMinutes: null } }],
      edges: [edge("t", "ask"), edge("ask", "r"), edge("r", "ask", "other")],
    };
    expect(automaticLoop(answer)).toBeNull();
  });

  it("treats an unanswered-question timeout as automatic", () => {
    const g: FlowGraph = {
      nodes: [trigger, msg("ask"), { id: "r", type: "reply", data: { expect: "any", keywords: [], retryText: "", timeoutMinutes: 60 } }],
      edges: [edge("t", "ask"), edge("ask", "r"), edge("r", "ask", "timeout")],
    };
    expect(automaticLoop(g)).not.toBeNull();
  });

  it("predicts a bad link before it is made", () => {
    const tapB: FlowGraph = { nodes: [trigger, msg("a"), msg("b", [{ id: "x", label: "X" }])], edges: [edge("t", "a"), edge("a", "b")] };
    expect(wouldLoop(tapB, "b", "x", "a")).toBe(false);
    const plainB: FlowGraph = { nodes: [trigger, msg("a"), msg("b")], edges: [edge("t", "a"), edge("a", "b")] };
    expect(wouldLoop(plainB, "b", "next", "a")).toBe(true);
  });
});

describe("conditions", () => {
  const facts = (over: Partial<Facts> = {}): Facts => ({
    tags: ["comprou"],
    isFollower: true,
    clicked: false,
    fields: { cidade: "Belo Horizonte" },
    answer: "quero o ebook",
    now: new Date("2026-10-14T15:00:00Z"), // 12:00 in São Paulo, a Wednesday
    ...over,
  });

  it("combines rules with all / any", () => {
    const rules = [{ kind: "tag" as const, tag: "Comprou" }, { kind: "clicked" as const }];
    expect(evaluateRules("all", rules, facts())).toBe(false);
    expect(evaluateRules("any", rules, facts())).toBe(true);
  });

  it("understands negation, fields, answers, hours and weekdays", () => {
    const f = facts();
    expect(evaluateRules("all", [{ kind: "tag", tag: "comprou", not: true }], f)).toBe(false);
    expect(evaluateRules("all", [{ kind: "field", name: "Cidade", op: "contains", value: "belo" }], f)).toBe(true);
    expect(evaluateRules("all", [{ kind: "field", name: "email", op: "empty", value: "" }], f)).toBe(true);
    expect(evaluateRules("all", [{ kind: "answer", value: "EBOOK" }], f)).toBe(true);
    expect(evaluateRules("all", [{ kind: "hours", from: 9, to: 18 }], f)).toBe(true);
    expect(evaluateRules("all", [{ kind: "hours", from: 22, to: 6 }], f)).toBe(false);
    expect(evaluateRules("all", [{ kind: "weekdays", days: [3] }], f)).toBe(true);
  });

  it("upgrades the old single-check condition", () => {
    const legacy = { id: "c", type: "condition", data: { check: { kind: "has_tag", tag: "vip" } } } as unknown as FlowNode;
    const g = normalizeGraph({ nodes: [trigger, legacy], edges: [] });
    expect(g.nodes[1]).toEqual({ id: "c", type: "condition", data: { match: "all", rules: [{ kind: "tag", tag: "vip" }] } });
  });
});

describe("text and time", () => {
  it("fills every placeholder", () => {
    expect(
      renderText("Oi {nome} ({usuario}), de {campo:Cidade}? Você disse: {resposta}", {
        username: "ana.s",
        name: "Ana Souza",
        fields: { cidade: "BH" },
        answer: "sim",
      }),
    ).toBe("Oi Ana (@ana.s), de BH? Você disse: sim");
    expect(renderText("Oi {nome}", { username: "ana" })).toBe("Oi @ana");
  });

  it("finds the next São Paulo clock time", () => {
    const now = new Date("2026-10-14T15:00:00Z"); // 12:00 BRT
    expect(nextBrTime(now, 18, 30).toISOString()).toBe("2026-10-14T21:30:00.000Z");
    expect(nextBrTime(now, 9, 0).toISOString()).toBe("2026-10-15T12:00:00.000Z");
  });
});

describe("rich messages", () => {
  it("sends quick replies as chips that continue the flow", () => {
    const node: FlowNode = { id: "m", type: "message", data: { text: "Escolha", buttons: [], quickReplies: [{ id: "q1", label: "Sim" }] } };
    expect(outputHandles(node)).toEqual(["q1"]);
    if (node.type !== "message") throw new Error();
    expect(buildFlowMessage(node, "r1")).toEqual({
      text: "Escolha",
      quick_replies: [{ content_type: "text", title: "Sim", payload: "flow:r1:m:q1" }],
    });
  });

  it("builds a card carousel and resolves its links", () => {
    const node: FlowNode = {
      id: "g",
      type: "cards",
      data: {
        cards: [
          {
            id: "c1",
            title: "Ebook",
            subtitle: "R$ 9,90",
            imageUrl: "site.com/e.jpg",
            url: "site.com/e",
            buttons: [
              { id: "b1", label: "Comprar", url: "pay.com/x" },
              { id: "b2", label: "Dúvida" },
            ],
          },
        ],
      },
    };
    expect(outputHandles(node)).toEqual(["b2"]);
    if (node.type !== "cards") throw new Error();
    expect(buildCardsMessage(node, "r1")).toEqual({
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "Ebook",
              subtitle: "R$ 9,90",
              image_url: "https://site.com/e.jpg",
              default_action: { type: "web_url", url: "https://site.com/e" },
              buttons: [
                { type: "web_url", title: "Comprar", url: "https://pay.com/x" },
                { type: "postback", title: "Dúvida", payload: "flow:r1:g:b2" },
              ],
            },
          ],
        },
      },
    });
    expect(linkTarget(node, "b1")).toBe("https://pay.com/x");
    expect(linkTarget(node, "c1")).toBe("https://site.com/e");
    expect(linkTarget(node, "b2")).toBeNull();
  });
});
