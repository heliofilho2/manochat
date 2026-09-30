import { describe, expect, it } from "vitest";
import { computeInsights } from "../insights";
import { bestCombo, hourLabel, pctLabel, rankings } from "../labels";

describe("insight labels", () => {
  it("formats hour ranges and percentages in pt-BR", () => {
    expect(hourLabel("19h")).toBe("19h – 20h");
    expect(hourLabel("23h")).toBe("23h – 0h");
    expect(pctLabel(0.0384)).toBe("3,8%");
  });

  const rows = [
    {
      mediaId: "a",
      mediaType: "VIDEO",
      productType: "REELS",
      caption: "x #receitafacil",
      // Thu 2026-03-05 22:00 UTC = 19:00 in São Paulo
      timestamp: "2026-03-05T22:00:00Z",
      reach: 1000,
    },
  ];
  const ins = computeInsights(rows, new Map([["a", 30]]));

  it("builds ranking rows with friendly names", () => {
    const r = rankings(ins);
    expect(r.formato[0]).toMatchObject({ label: "Reel", conv: "30", pct: "3,0%", posts: 1, width: 100 });
    expect(r.dia[0].label).toBe("Quinta-feira");
    expect(r.hora[0].label).toBe("19h – 20h");
  });

  it("writes the best combination sentence", () => {
    // Theme needs 2+ posts to count, so only format/day/hour appear here.
    expect(bestCombo(ins)).toBe("Reels, às quintas, entre 19h e 20h.");
  });

  it("returns null without conversions", () => {
    expect(bestCombo(computeInsights(rows, new Map()))).toBeNull();
  });
});
