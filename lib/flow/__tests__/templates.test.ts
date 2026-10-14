import { describe, expect, it } from "vitest";
import { flowWarnings, unreachableNodeIds, validateGraph } from "../graph";
import { TEMPLATES } from "../templates";

describe("flow templates", () => {
  for (const t of TEMPLATES) {
    it(`"${t.title}" is sound apart from the links left for the user`, () => {
      const issues = validateGraph(t.graph).map((i) => i.message);
      expect(issues.every((m) => m.includes("sem um link válido"))).toBe(true);
      expect(unreachableNodeIds(t.graph)).toEqual([]);
      expect(flowWarnings(t.graph, t.triggerKind)).toEqual([]);
    });
  }
});
